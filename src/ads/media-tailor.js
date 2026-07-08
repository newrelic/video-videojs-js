/* eslint-disable no-undef */
import nrvideo from '@newrelic/video-core';
import VideojsAdsTracker from './videojs-ads';
import {
  DEFAULT_LIVE_POLL_INTERVAL_MS,
  HLS_MIME_TYPE,
  MEDIATAILOR_HOST_MARKER,
  SCTE35_SCHEME_MARKER,
  TRACKING_API_TIMEOUT_MS,
  STREAM_TYPE,
  MANIFEST_TYPE,
  MT_AD_ERROR_CODE,
} from './utils/mt-constants.js';
import {
  getTimestamp,
  detectManifestFormatFromUrl,
  detectPlaybackStreamType,
  buildTrackingEndpointUrl,
  determineAdPosition,
  getQuartilesToFire,
  findActiveAdBreak,
  findActivePod,
  mergeAdSchedules,
  parseHlsManifestForAdBreaks,
  parseDashManifestForAdBreaks,
  detectAdBreaksFromVhsPlaylist,
  whichAdSegmentMarker,
  enrichAdScheduleWithTrackingMetadata,
  extractHlsTargetDurationSeconds,
  extractDashMinimumUpdatePeriodSeconds,
  fetchHlsMasterManifest,
  fetchHlsMediaPlaylist,
  fetchDashManifest,
  getTrackingMetadata,
} from './utils/mt.js';

// Handle both direct and default export from video-core
const nrvideoCore = nrvideo.default || nrvideo;
const Log = nrvideoCore.Log;

/**
 * SDK-boundary anti-patterns — what this tracker must NEVER do.
 *
 * MediaTailor stitches ads server-side; this tracker only observes the
 * stitched stream and reports engagement. The following are out of scope by
 * design — a violation is always a wrong-metric or scope-creep bug:
 *
 *  1. Do NOT fire VAST tracking beacons (the ad server / consumer does this).
 *  2. Do NOT resolve VAST wrappers.
 *  3. Do NOT implement ad personalization / targeting.
 *  4. Do NOT cache ads across sessions (each sessionId is its own context).
 *  5. Do NOT modify manifest query parameters.
 *  6. Do NOT implement avail suppression.
 *  7. Do NOT render ad UI, pause the player, or call back into business logic.
 *  8. Do NOT assume every avail has ads (no-fill is valid — see no-fill handling).
 *  9. Do NOT pre-fire impression beacons.
 * 10. Do NOT perform OMID / viewability handoff.
 */

/**
 * AWS MediaTailor Ad Tracker
 * Tracks ads from AWS MediaTailor SSAI streams (HLS/DASH)
 *
 * Features:
 * - Client-side ad detection from manifest markers (CUE-OUT/CUE-IN)
 * - Pod-level tracking (multiple ads within one break)
 * - VOD and Live stream support
 * - VHS player hooks avoid races within the manifest-parsing pipeline;
 *   dispose, timer-restart, and source-change races are handled separately
 *   (see the tracker runtime-path notes), not eliminated by the hooks alone
 * - Tracking API metadata enrichment
 */
export default class MediaTailorAdsTracker extends VideojsAdsTracker {
  /**
   * Checks if tracker should be used for this player source
   */
  static isUsing(player, options = {}) {
    // Opt-in flag is the single source of truth.
    // Accepts { mediatailor: true } or { mediatailor: { trackingUrl, adSegmentPrefix } }.
    return Boolean(options && options.mediatailor);
  }

  /**
   * Returns tracker name for New Relic instrumentation
   */
  getTrackerName() {
    return 'aws-media-tailor';
  }

  /**
   * Returns player version (MediaTailor doesn't have version)
   */
  getPlayerVersion() {
    return 'MediaTailor';
  }

  /**
   * Override to return the correct ad position from our ad schedule
   * This overrides video-core's default logic which only checks if content started
   */
  getAdPosition() {
    if (this.currentAdBreak && this.currentAdBreak.adPosition) {
      return this.currentAdBreak.adPosition;
    }
    return super.getAdPosition();
  }

  constructor(player, options = {}) {
    super(player);

    // Normalize mediatailor option: true | { trackingUrl, adSegmentPrefix } | undefined
    const mtOptions =
      options.mediatailor === true ? {} : options.mediatailor || {};

    // Initialize state
    this.streamType = null; // 'vod' or 'live'
    this.manifestFormat = null; // 'hls' or 'dash'
    this.playbackManifestUrl = player.currentSrc();

    // trackingUrl: optional override for the MediaTailor tracking endpoint.
    // When not provided, the tracker derives it automatically from the playback URL.
    this.explicitTrackingUrl = mtOptions.trackingUrl || null;

    // adSegmentPrefix: only needed when the customer configured a CDN ad-segment
    // prefix in AWS MediaTailor that does NOT follow the AWS-recommended /tm/ path.
    // Most setups (default AWS hostname or CDN following AWS conventions) are
    // detected automatically via MT_DEFAULT_AD_SEGMENT_PATH ('/tm/') and do not
    // need this override.
    this.adSegmentPrefix = mtOptions.adSegmentPrefix || null;

    if (this.adSegmentPrefix) {
      Log.debug(`[MT] ad segment detection: custom prefix "${this.adSegmentPrefix}"`);
    } else {
      Log.debug('[MT] ad segment detection: default (segments.mediatailor hostname or /tm/ path)');
    }

    // pollIntervalMs: optional override for the live poll cadence. When set it
    // wins over the manifest-derived interval, letting battery-constrained
    // clients tune the loop; otherwise the tracker keeps its dynamic behavior.
    // Clamped to [100, 5000] ms; a non-numeric value is ignored with a warning.
    this.pollIntervalMs = null;
    if (mtOptions.pollIntervalMs != null) {
      const requested = Number(mtOptions.pollIntervalMs);
      if (Number.isFinite(requested)) {
        const clamped = Math.min(5000, Math.max(100, requested));
        if (clamped !== requested) {
          Log.warn(
            `[MT] pollIntervalMs ${requested} out of range [100, 5000] — clamped to ${clamped}`,
          );
        }
        this.pollIntervalMs = clamped;
      } else {
        Log.warn(
          `[MT] pollIntervalMs must be a number — ignoring "${mtOptions.pollIntervalMs}"`,
        );
      }
    }

    // Ad tracking state
    this.adSchedule = [];
    this.currentAdBreak = null;
    this.currentAdPod = null;
    this.hasEndedContent = false;
    this.wasPaused = false;

    // Disposal and abort state
    this.isDisposed = false;
    this.trackingAbortController = null;
    this.manifestAbortController = null;
    this.isFetchingTracking = false;
    this.isFetchingManifest = false;

    // Tracking API state
    this.trackingEndpointUrl = null;
    this.hasAttemptedTrackingFetch = false;
    this.trackingFetchRetries = 0;
    this.maxTrackingRetries = 1;
    this.nextToken = null; // MediaTailor tracking-API pagination cursor

    // Live polling timers
    this.manifestPollTimer = null;
    this.trackingPollTimer = null;
    this.liveRefreshIntervalSeconds = null;

    // Manifest parsing cache
    this.mediaPlaylistUrl = null;
    this.lastMediaPlaylistText = null;

    Log.debug(`[MT - ${getTimestamp()}] MediaTailorAdsTracker initialized`, {
      endpoint: this.playbackManifestUrl,
      trackingAPITimeout: TRACKING_API_TIMEOUT_MS,
    });

    this.manifestFormat = detectManifestFormatFromUrl(this.playbackManifestUrl);
    Log.debug(
      `[MT - ${getTimestamp()}] Manifest type: ${this.manifestFormat.toUpperCase()}`,
    );

    this.player.one('loadedmetadata', () => {
      this.streamType = detectPlaybackStreamType(this.player.duration());
      Log.debug(
        `[MT - ${getTimestamp()}] Stream type: ${this.streamType.toUpperCase()}`,
      );
      this.initializeTracking();
    });
  }

  /**
   * Initializes tracking based on detected stream type
   */
  initializeTracking() {
    Log.debug(
      `[MT - ${getTimestamp()}] Initializing ${this.manifestFormat.toUpperCase()} ${this.streamType.toUpperCase()} tracking`,
    );

    // Prefer explicit tracking URL (explicit POST session) over derived one
    this.trackingEndpointUrl =
      this.explicitTrackingUrl ||
      buildTrackingEndpointUrl(this.playbackManifestUrl);
    if (this.trackingEndpointUrl) {
      Log.debug(
        `[MT - ${getTimestamp()}] Tracking URL extracted:`,
        this.trackingEndpointUrl,
      );
    } else {
      Log.warn(
        `[MT - ${getTimestamp()}] Could not derive tracking URL from playback URL — pass trackingUrl in mediatailor options if needed`,
      );
    }

    // Set up format-specific tracking
    if (this.streamType === STREAM_TYPE.VOD) {
      this.setupVODTracking();
    } else {
      this.setupLiveTracking();
    }
  }

  /**
   * Register listeners (overrides parent class method)
   */
  registerListeners() {
    super.registerListeners();

    // Bind before registering — super(player) calls registerListeners() before
    // the constructor body runs, so bindings must happen here, not in the constructor.
    this.onPause = this.onPause.bind(this);
    this.onPlaying = this.onPlaying.bind(this);
    this.onSeeking = this.onSeeking.bind(this);
    this.onSeeked = this.onSeeked.bind(this);
    this.onWaiting = this.onWaiting.bind(this);
    this.onEnded = this.onEnded.bind(this);
    this.onTimeUpdate = this.onTimeUpdate.bind(this);
    this.onSourceChange = this.onSourceChange.bind(this);

    this.player.on('pause', this.onPause);
    this.player.on('playing', this.onPlaying);
    this.player.on('seeking', this.onSeeking);
    this.player.on('seeked', this.onSeeked);
    this.player.on('waiting', this.onWaiting);
    this.player.on('ended', this.onEnded);
    this.player.on('timeupdate', this.onTimeUpdate);
    this.player.on('loadstart', this.onSourceChange);
    Log.debug(`[MT - ${getTimestamp()}] Event listeners registered`);
  }

  /**
   * Unregister listeners (overrides parent class method)
   */
  unregisterListeners() {
    super.unregisterListeners();
    this.player.off('pause', this.onPause);
    this.player.off('playing', this.onPlaying);
    this.player.off('seeking', this.onSeeking);
    this.player.off('seeked', this.onSeeked);
    this.player.off('waiting', this.onWaiting);
    this.player.off('ended', this.onEnded);
    this.player.off('timeupdate', this.onTimeUpdate);
    this.player.off('loadstart', this.onSourceChange);
    this.stopLivePolling();
  }

  /**
   * Stops live polling timers
   */
  stopLivePolling() {
    if (this.manifestPollTimer) {
      clearTimeout(this.manifestPollTimer);
      this.manifestPollTimer = null;
    }

    if (this.trackingPollTimer) {
      clearInterval(this.trackingPollTimer);
      this.trackingPollTimer = null;
    }
  }

  /**
   * Sets up VOD tracking (single parse, no polling)
   */
  setupVODTracking() {
    Log.debug(`[MT - ${getTimestamp()}] VOD mode: Single manifest parse`);
    this.hookPlayerManifest();
  }

  /**
   * Sets up Live tracking (continuous polling)
   */
  setupLiveTracking() {
    Log.debug(`[MT - ${getTimestamp()}] Live mode: Continuous polling`);
    this.hookPlayerManifest();

    const pollingInterval = this.getLiveRefreshIntervalMs();

    // Start polling timers
    this.manifestPollTimer = setInterval(() => {
      this.pollManifestForNewAds();
    }, pollingInterval);

    this.trackingPollTimer = setInterval(() => {
      this.getAndProcessTrackingMetadata();
    }, pollingInterval);

    Log.debug(`[MT - ${getTimestamp()}] Live polling started`, {
      pollingInterval,
    });
  }

  /**
   * Returns the live polling interval in milliseconds
   */
  getLiveRefreshIntervalMs() {
    // An explicit pollIntervalMs overrides the manifest-derived cadence.
    if (this.pollIntervalMs) {
      return this.pollIntervalMs;
    }
    return this.liveRefreshIntervalSeconds
      ? this.liveRefreshIntervalSeconds * 1000
      : DEFAULT_LIVE_POLL_INTERVAL_MS;
  }

  /**
   * Updates live polling intervals after manifest metadata is detected
   */
  restartLivePollingTimers() {
    if (!this.liveRefreshIntervalSeconds) return;

    const newInterval = this.getLiveRefreshIntervalMs();
    Log.debug(
      `[MT - ${getTimestamp()}] Updating live polling interval: ${this.liveRefreshIntervalSeconds}s`,
    );

    // Restart timers with new interval
    if (this.manifestPollTimer) clearInterval(this.manifestPollTimer);
    if (this.trackingPollTimer) clearInterval(this.trackingPollTimer);

    this.manifestPollTimer = setInterval(() => {
      this.pollManifestForNewAds();
    }, newInterval);

    this.trackingPollTimer = setInterval(() => {
      this.getAndProcessTrackingMetadata();
    }, newInterval);
  }

  /**
   * Hooks into player's manifest loading. The hook itself races-safely with
   * the manifest-parsing pipeline; it does not cover dispose/timer/source-change.
   * Supports: VHS, Native HLS, contrib-hls, Shaka, dash.js
   */
  hookPlayerManifest() {
    const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
    if (!tech) {
      Log.debug(`[MT - ${getTimestamp()}] No tech - using fallback fetch`);
      this.getManifestDirectly();
      return;
    }

    // Try hooks in order of preference
    if (this.manifestFormat === MANIFEST_TYPE.HLS) {
      if (
        this.hookHLSViaVHS(tech) ||
        this.hookHLSViaNative(tech) ||
        this.hookHLSViaContribHls(tech)
      ) {
        return; // Successfully hooked
      }
    } else if (this.manifestFormat === MANIFEST_TYPE.DASH) {
      if (this.hookDASHViaShaka(tech) || this.hookDASHViaDashJs(tech)) {
        return; // Successfully hooked
      }
    }

    // Fallback: Direct manifest fetch
    Log.debug(
      `[MT - ${getTimestamp()}] Using fallback: direct manifest fetch`,
    );
    this.getManifestDirectly();
  }

  /**
   * Hook: VHS (videojs-http-streaming) - Video.js 7.0+
   */
  hookHLSViaVHS(tech) {
    if (!tech.vhs || !tech.vhs.playlists) return false;

    Log.debug(`[MT - ${getTimestamp()}] Hooked: VHS`);

    // Parse already-loaded playlist
    const currentPlaylist = tech.vhs.playlists.media();
    if (
      currentPlaylist &&
      currentPlaylist.segments &&
      currentPlaylist.segments.length > 0
    ) {
      Log.debug(`[MT - ${getTimestamp()}] Parsing existing playlist`);
      this.parseVhsPlaylistForAdBreaks(currentPlaylist);
    }

    // Hook future playlist loads
    tech.vhs.on('loadedplaylist', () => {
      const playlist = tech.vhs.playlists.media();
      if (playlist) {
        this.parseVhsPlaylistForAdBreaks(playlist);
      }
    });

    return true;
  }

  /**
   * Hook: Native HLS (Safari)
   */
  hookHLSViaNative(tech) {
    // Safari uses native HLS - can't hook directly
    if (
      tech.el_ &&
      tech.el_.canPlayType &&
      tech.el_.canPlayType(HLS_MIME_TYPE)
    ) {
      Log.debug(
        `[MT - ${getTimestamp()}] Native HLS detected - using fallback`,
      );
      this.getManifestDirectly();
      return true;
    }
    return false;
  }

  /**
   * Hook: videojs-contrib-hls (legacy Video.js 5.x/6.x)
   */
  hookHLSViaContribHls(tech) {
    if (!tech.hls || !tech.hls.playlists) return false;

    Log.debug(`[MT - ${getTimestamp()}] Hooked: contrib-hls (legacy)`);

    // Parse already-loaded playlist
    const currentPlaylist = tech.hls.playlists.media();
    if (
      currentPlaylist &&
      currentPlaylist.segments &&
      currentPlaylist.segments.length > 0
    ) {
      this.parseVhsPlaylistForAdBreaks(currentPlaylist);
    }

    // Hook future playlist loads
    tech.hls.on('loadedplaylist', () => {
      const playlist = tech.hls.playlists.media();
      if (playlist) {
        this.parseVhsPlaylistForAdBreaks(playlist);
      }
    });

    return true;
  }

  /**
   * Hook: Shaka Player (DASH)
   */
  hookDASHViaShaka(tech) {
    if (!tech.shakaPlayer) return false;

    Log.debug(`[MT - ${getTimestamp()}] Hooked: Shaka Player`);
    tech.shakaPlayer.addEventListener('emsg', (event) => {
      this.handleDASHEmsgEvent(event);
    });

    return true;
  }

  /**
   * Hook: dash.js (DASH)
   */
  hookDASHViaDashJs(tech) {
    if (!tech.dash || !tech.dash.on) return false;

    Log.debug(`[MT - ${getTimestamp()}] Hooked: dash.js`);
    tech.dash.on('EVENT_MODE_ON_RECEIVE', (event) => {
      this.handleDASHEventStream(event);
    });

    return true;
  }

  /**
   * Fetches manifest directly (fallback when hooks unavailable)
   */
  async getManifestDirectly() {
    Log.debug(
      `[MT - ${getTimestamp()}] Fallback: fetching manifest directly`,
    );

    try {
      const manifestUrl = this.playbackManifestUrl;

      if (this.manifestFormat === MANIFEST_TYPE.HLS) {
        await this.fetchAndParseHlsManifest(manifestUrl);
      } else if (this.manifestFormat === MANIFEST_TYPE.DASH) {
        await this.fetchAndParseDashManifest(manifestUrl);
      }
    } catch (error) {
      Log.debug(`[MT - ${getTimestamp()}] Fallback fetch error:`, error);
    }
  }

  /**
   * Fetches and parses HLS master + media manifest
   */
  async fetchAndParseHlsManifest(manifestUrl) {
    try {
      Log.debug(`[MT - ${getTimestamp()}] Fetching HLS master manifest`);

      // Fetch master manifest
      const { mediaPlaylistUrl } = await fetchHlsMasterManifest(manifestUrl);
      if (this.isDisposed) return; // disposed mid-fetch — don't touch state

      if (!mediaPlaylistUrl) {
        Log.debug(`[MT - ${getTimestamp()}] No media playlist found`);
        return;
      }

      Log.debug(`[MT - ${getTimestamp()}] Fetching media playlist`);

      // Fetch media playlist
      const mediaText = await fetchHlsMediaPlaylist(mediaPlaylistUrl);
      if (this.isDisposed) return; // disposed mid-fetch — don't touch state

      const hlsTargetDurationSeconds = extractHlsTargetDurationSeconds(mediaText);
      this.updateLiveRefreshIntervalFromManifest(
        hlsTargetDurationSeconds,
        'hls target duration',
      );

      // Parse for ads
      const ads = parseHlsManifestForAdBreaks(mediaText);
      if (ads.length > 0) {
        Log.debug(
          `[MT - ${getTimestamp()}] Detected ${ads.length} ad break(s)`,
        );
        this.mergeNewAds(ads);
      }
    } catch (error) {
      Log.debug(`[MT - ${getTimestamp()}] HLS fetch error:`, error);
    }
  }

  /**
   * Fetches and parses DASH MPD manifest
   */
  async fetchAndParseDashManifest(manifestUrl) {
    try {
      Log.debug(`[MT - ${getTimestamp()}] Fetching DASH manifest`);

      // Fetch DASH manifest
      const xmlText = await fetchDashManifest(manifestUrl);
      if (this.isDisposed) return; // disposed mid-fetch — don't touch state

      const dashMinimumUpdatePeriodSeconds =
        extractDashMinimumUpdatePeriodSeconds(xmlText);
      this.updateLiveRefreshIntervalFromManifest(
        dashMinimumUpdatePeriodSeconds,
        'dash minimumUpdatePeriod',
      );

      // Parse for ads
      const ads = parseDashManifestForAdBreaks(xmlText);

      Log.debug(
        `[MT - ${getTimestamp()}] DASH: ${ads.length} ad break(s) found`,
      );

      if (ads.length > 0) {
        this.mergeNewAds(ads); // also triggers tracking fetch
      } else if (
        this.streamType === STREAM_TYPE.VOD &&
        this.trackingEndpointUrl &&
        !this.hasAttemptedTrackingFetch
      ) {
        // No SCTE-35 markers in manifest - fall back to tracking API directly
        Log.debug(
          `[MT - ${getTimestamp()}] DASH: no manifest cues, fetching tracking API`,
        );
        this.hasAttemptedTrackingFetch = true;
        this.getAndProcessTrackingMetadata();
      }
    } catch (error) {
      Log.debug(`[MT - ${getTimestamp()}] DASH fetch error:`, error);
    }
  }

  /**
   * Handles DASH emsg events from Shaka Player
   */
  handleDASHEmsgEvent(event) {
    Log.debug(`[MT - ${getTimestamp()}] DASH emsg event:`, event);

    try {
      // Shaka Player emits emsg events with event.detail containing the emsg box data
      const emsgData = event.detail;

      if (!emsgData) {
        Log.debug(`[MT - ${getTimestamp()}] No emsg data in event`);
        return;
      }

      // Check if this is a SCTE-35 event
      // schemeIdUri for SCTE-35: urn:scte:scte35:2013:bin or urn:scte:scte35:2014:xml
      const schemeIdUri = emsgData.schemeIdUri || '';

      if (!schemeIdUri.includes(SCTE35_SCHEME_MARKER)) {
        Log.debug(
          `[MT - ${getTimestamp()}] Non-SCTE-35 emsg, skipping:`,
          schemeIdUri,
        );
        return;
      }

      Log.debug(`[MT - ${getTimestamp()}] SCTE-35 emsg detected:`, {
        schemeIdUri: emsgData.schemeIdUri,
        value: emsgData.value,
        timescale: emsgData.timescale,
        presentationTime: emsgData.presentationTime,
        presentationTimeDelta: emsgData.presentationTimeDelta,
        eventDuration: emsgData.eventDuration,
      });

      // Calculate start time in seconds
      const timescale = emsgData.timescale || 1;
      const presentationTime = emsgData.presentationTime || 0;
      const eventDuration = emsgData.eventDuration || 0;

      const startTime = presentationTime / timescale;
      const duration = eventDuration / timescale;

      // Parse SCTE-35 message data
      const messageData = emsgData.messageData;

      if (messageData && duration > 0) {
        const adBreak = {
          id: `dash-emsg-${startTime}`,
          startTime: startTime,
          duration: duration,
          endTime: startTime + duration,
          source: 'dash-emsg',
          confirmedByTracking: false,
          hasFiredStart: false,
          hasFiredEnd: false,
          hasFiredAdStart: false,
          pods: [],
        };

        Log.debug(
          `[MT - ${getTimestamp()}] Adding ad break from DASH emsg:`,
          adBreak,
        );
        this.mergeNewAds([adBreak]);
      }
    } catch (error) {
      Log.debug(
        `[MT - ${getTimestamp()}] Error parsing DASH emsg event:`,
        error,
      );
    }
  }

  /**
   * Handles DASH event stream from dash.js
   */
  handleDASHEventStream(event) {
    Log.debug(`[MT - ${getTimestamp()}] DASH event stream:`, event);

    try {
      // dash.js emits events with different structure
      const eventData = event.event || event;

      if (!eventData) {
        Log.debug(`[MT - ${getTimestamp()}] No event data`);
        return;
      }

      // Check if this is a SCTE-35 event
      const schemeIdUri = eventData.schemeIdUri || '';

      if (!schemeIdUri.includes(SCTE35_SCHEME_MARKER)) {
        Log.debug(
          `[MT - ${getTimestamp()}] Non-SCTE-35 event, skipping:`,
          schemeIdUri,
        );
        return;
      }

      Log.debug(`[MT - ${getTimestamp()}] SCTE-35 event stream detected:`, {
        id: eventData.id,
        schemeIdUri: eventData.schemeIdUri,
        presentationTime: eventData.presentationTime,
        duration: eventData.duration,
        messageData: eventData.messageData,
      });

      // Calculate timing — presentationTime/duration are in timescale ticks,
      // convert to seconds (fallback to 1 when absent or zero to avoid NaN).
      const timescale = parseFloat(eventData.timescale) || 1;
      const startTime = parseFloat(eventData.presentationTime || 0) / timescale;
      const duration = parseFloat(eventData.duration || 0) / timescale;

      if (duration > 0) {
        const adBreak = {
          id: eventData.id || `dash-event-${startTime}`,
          startTime: startTime,
          duration: duration,
          endTime: startTime + duration,
          source: 'dash-event-stream',
          confirmedByTracking: false,
          hasFiredStart: false,
          hasFiredEnd: false,
          hasFiredAdStart: false,
          pods: [],
        };

        Log.debug(
          `[MT - ${getTimestamp()}] Adding ad break from DASH event stream:`,
          adBreak,
        );
        this.mergeNewAds([adBreak]);
      }
    } catch (error) {
      Log.debug(
        `[MT - ${getTimestamp()}] Error parsing DASH event stream:`,
        error,
      );
    }
  }

  /**
   * Parses VHS playlist object for ads
   */
  parseVhsPlaylistForAdBreaks(playlist) {
    Log.debug(
      `[MT - ${getTimestamp()}] Parsing VHS playlist (${
        playlist.segments?.length || 0
      } segments)`,
    );

    if (!playlist.segments || playlist.segments.length === 0) {
      Log.debug(`[MT - ${getTimestamp()}] No segments in playlist`);
      return;
    }

    this.updateLiveRefreshIntervalFromManifest(
      playlist.targetDuration,
      'vhs target duration',
    );

    // VHS strips CUE tags - detect via discontinuityStarts + MediaTailor segments
    const ads = detectAdBreaksFromVhsPlaylist(playlist, {
      adSegmentPrefix: this.adSegmentPrefix,
    });

    if (ads.length > 0) {
      // Log which detection path matched — only on first detection to avoid noise
      if (!this._detectionPathLogged) {
        const firstSeg = playlist.segments && playlist.segments.find(s =>
          whichAdSegmentMarker(s, { adSegmentPrefix: this.adSegmentPrefix })
        );
        if (firstSeg) {
          const path = whichAdSegmentMarker(firstSeg, { adSegmentPrefix: this.adSegmentPrefix });
          Log.debug(`[MT] ad segment detection matched via: ${path}`);
          this._detectionPathLogged = true;
        }
      }
      Log.debug(
        `[MT - ${getTimestamp()}] VHS detected ${ads.length} ad break(s), ${ads.reduce(
          (sum, ab) => sum + ab.pods.length,
          0,
        )} pod(s)`,
      );
      this.mergeNewAds(ads);
    } else {
      Log.debug(`[MT - ${getTimestamp()}] No ads detected in VHS playlist`);
    }
  }

  /**
   * Polls manifest for new ads (Live streams only)
   */
  async pollManifestForNewAds() {
    if (this.isDisposed) return;
    if (this.streamType !== STREAM_TYPE.LIVE) return;

    if (this.isFetchingManifest) {
      Log.debug(
        `[MT - ${getTimestamp()}] Manifest fetch already in progress, skipping`,
      );
      return;
    }

    this.isFetchingManifest = true;

    try {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
      if (tech && tech.vhs) {
        const playlist = tech.vhs.playlists.media();
        if (playlist) {
          this.parseVhsPlaylistForAdBreaks(playlist);
        }
      } else if (this.manifestFormat === MANIFEST_TYPE.DASH) {
        await this.fetchAndParseDashManifest(this.playbackManifestUrl);
        if (this.isDisposed) return; // disposed mid-poll — don't resume
      }
    } catch (error) {
      Log.debug(`[MT - ${getTimestamp()}] Manifest poll error:`, error);
    } finally {
      this.isFetchingManifest = false;
    }
  }

  /**
   * Merges new ads into schedule (deduplicates)
   */
  mergeNewAds(newAds) {
    this.adSchedule = mergeAdSchedules(this.adSchedule, newAds);

    Log.debug(
      `[MT - ${getTimestamp()}] Ad schedule: ${this.adSchedule.length} ad break(s)`,
    );

    // VOD: Fetch tracking metadata after first manifest parse (AWS best practice)
    if (
      this.streamType === STREAM_TYPE.VOD &&
      this.trackingEndpointUrl &&
      !this.hasAttemptedTrackingFetch
    ) {
      this.hasAttemptedTrackingFetch = true;
      Log.debug(
        `[MT - ${getTimestamp()}] Fetching tracking metadata (first manifest parse)`,
      );
      this.getAndProcessTrackingMetadata();
    }
  }

  /**
   * Updates live polling cadence from manifest-derived metadata
   */
  updateLiveRefreshIntervalFromManifest(intervalSeconds, source) {
    if (
      this.streamType !== STREAM_TYPE.LIVE ||
      !intervalSeconds ||
      intervalSeconds <= 0
    ) {
      return;
    }

    if (this.liveRefreshIntervalSeconds === intervalSeconds) {
      return;
    }

    this.liveRefreshIntervalSeconds = intervalSeconds;
    Log.debug(
      `[MT - ${getTimestamp()}] Derived live polling interval from ${source}: ${intervalSeconds}s`,
    );

    if (this.manifestPollTimer || this.trackingPollTimer) {
      this.restartLivePollingTimers();
    }
  }

  /**
   * Fetches and processes tracking metadata from AWS MediaTailor Tracking API
   */
  async getAndProcessTrackingMetadata() {
    if (this.isDisposed || !this.trackingEndpointUrl) return;

    if (this.isFetchingTracking) {
      Log.debug(
        `[MT - ${getTimestamp()}] Tracking fetch already in progress, skipping`,
      );
      return;
    }

    this.isFetchingTracking = true;

    try {
      Log.debug(`[MT - ${getTimestamp()}] Fetching tracking metadata`);

      this.trackingAbortController = new AbortController();

      const data = await getTrackingMetadata(
        this.trackingEndpointUrl,
        TRACKING_API_TIMEOUT_MS,
        this.trackingAbortController.signal,
        this.nextToken,
      );

      if (this.isDisposed) {
        Log.debug(
          `[MT - ${getTimestamp()}] Disposed during tracking fetch, ignoring result`,
        );
        return;
      }

      // Remember the pagination cursor for the next poll.
      this.nextToken = data.nextToken || null;

      if (data.avails && data.avails.length > 0) {
        Log.debug(
          `[MT - ${getTimestamp()}] Enriching with ${data.avails.length} avail(s)`,
        );
        this.enrichWithTrackingMetadata(data.avails);
        this.trackingFetchRetries = 0;
      } else {
        Log.debug(`[MT - ${getTimestamp()}] Tracking API returned 0 avails`);
      }
    } catch (error) {
      if (error.name === 'AbortError' || this.isDisposed) {
        Log.debug(`[MT - ${getTimestamp()}] Tracking fetch aborted`);
        return;
      }

      Log.debug(
        `[MT - ${getTimestamp()}] Tracking API error: ${error.message}`,
        error,
      );

      // HTTP 400 means the pagination cursor expired. Drop it and retry once
      // unpaginated; if we're already tokenless and still get 400, the session
      // is effectively dead — surface TOKEN_EXPIRED and stop polling.
      if (error.status === 400) {
        if (this.nextToken) {
          Log.debug(
            `[MT - ${getTimestamp()}] Tracking 400 — dropping nextToken and retrying`,
          );
          this.nextToken = null;
          this.isFetchingTracking = false;
          await this.getAndProcessTrackingMetadata();
          return;
        }
        this.sendAdError(
          MT_AD_ERROR_CODE.TOKEN_EXPIRED,
          'tracking-fetch',
          error.message,
        );
        this.stopLivePolling();
        return;
      }

      if (this.trackingFetchRetries < this.maxTrackingRetries) {
        this.trackingFetchRetries++;
        Log.debug(
          `[MT - ${getTimestamp()}] Retrying tracking fetch (${this.trackingFetchRetries}/${this.maxTrackingRetries})`,
        );
        this.isFetchingTracking = false;
        await this.getAndProcessTrackingMetadata();
        return;
      }

      // Retries exhausted — surface a semantic error before falling back to
      // manifest-only data. A timeout maps to ADS_TIMEOUT; anything else
      // (non-400) is a generic TRACKING_FETCH_FAILED.
      const code =
        error.code === 'ADS_TIMEOUT'
          ? MT_AD_ERROR_CODE.ADS_TIMEOUT
          : MT_AD_ERROR_CODE.TRACKING_FETCH_FAILED;
      this.sendAdError(code, 'tracking-fetch', error.message);

      Log.debug(
        `[MT - ${getTimestamp()}] Max retries reached, continuing with manifest data only`,
      );
    } finally {
      this.isFetchingTracking = false;
      this.trackingAbortController = null;
    }
  }

  /**
   * Enriches ad schedule with tracking API metadata
   */
  enrichWithTrackingMetadata(avails) {
    const newAds = enrichAdScheduleWithTrackingMetadata(this.adSchedule, avails);

    // Add any new ads from tracking
    if (newAds.length > 0) {
      this.adSchedule.push(...newAds);
      this.adSchedule.sort((a, b) => a.startTime - b.startTime);
    }

    Log.debug(
      `[MT - ${getTimestamp()}] Enrichment complete: ${
        this.adSchedule.length
      } ad break(s)`,
    );

    // Log enriched schedule with full details
    Log.debug(
      `[MT - ${getTimestamp()}] Enriched schedule:`,
      this.adSchedule.map((ab) => ({
        id: ab.id,
        startTime: ab.startTime,
        endTime: ab.endTime,
        duration: ab.duration,
        title: ab.title,
        podCount: ab.pods.length,
        pods: ab.pods.map((p) => ({
          title: p.title,
          startTime: p.startTime,
          endTime: p.endTime,
          duration: p.duration,
        })),
      })),
    );

    // Log current player time for debugging
    Log.debug(
      `[MT - ${getTimestamp()}] Current player time: ${this.player.currentTime()}s`,
    );
  }

  /**
   * Tracks quartile events for active pod/ad
   */
  trackQuartiles(adObject, progress) {
    if (!adObject.duration || adObject.duration <= 0) return;

    const quartilesToFire = getQuartilesToFire(progress, adObject.duration, {
      q1: adObject.hasFiredQ1,
      q2: adObject.hasFiredQ2,
      q3: adObject.hasFiredQ3,
    });

    quartilesToFire.forEach(({ quartile, key }) => {
      Log.debug(`[MT - ${getTimestamp()}] → AD_QUARTILE ${quartile * 25}%`);
      this.sendAdQuartile({ quartile, adPrimaryId: this.getAdPrimaryId() });
      adObject[`hasFired${key.toUpperCase()}`] = true;
    });
  }

  /**
   * Called on timeupdate - main event tracking logic
   */
  onTimeUpdate() {
    const currentTime = this.player.currentTime();
    const activeAdBreak = findActiveAdBreak(this.adSchedule, currentTime);

    // Debug logging (only log when schedule exists and every 5 seconds)
    if (
      this.adSchedule.length > 0 &&
      Math.floor(currentTime) % 5 === 0 &&
      Math.floor(currentTime * 10) % 10 === 0
    ) {
      Log.debug(
        `[MT - ${getTimestamp()}] TimeUpdate: ${currentTime.toFixed(2)}s, Active break: ${
          activeAdBreak ? activeAdBreak.id : 'none'
        }, Schedule count: ${this.adSchedule.length}`,
      );
    }

    if (activeAdBreak) {
      // === INSIDE AD BREAK ===

      // Fire AD_BREAK_START once
      if (!activeAdBreak.hasFiredStart) {
        this.currentAdBreak = activeAdBreak;
        this.setIsAd(true); // Switch to ad mode
        Log.debug(
          `[MT - ${getTimestamp()}] setIsAd(true) - Entering ad break`,
        );

        // Calculate ad position by finding index based on startTime
        const adBreakIndex = this.adSchedule.findIndex(
          (ad) => Math.abs(ad.startTime - activeAdBreak.startTime) < 0.5,
        );
        const adPosition = determineAdPosition(
          adBreakIndex,
          this.adSchedule.length,
          this.streamType,
        );

        // Store position on the ad break for reuse
        activeAdBreak.adPosition = adPosition;

        Log.debug(`[MT - ${getTimestamp()}] → AD_BREAK_START`, {
          startTime: activeAdBreak.startTime,
          duration: activeAdBreak.duration,
          podCount: activeAdBreak.pods?.length || 0,
          position: adPosition,
          breakIndex: adBreakIndex,
          totalBreaks: this.adSchedule.length,
        });
        this.sendAdBreakStart();
        activeAdBreak.hasFiredStart = true;

        if (activeAdBreak.isNoFill) {
          // The ad decision service returned no ad for this avail. Report why,
          // once, at break entry.
          this.sendAdError(
            MT_AD_ERROR_CODE.NO_FILL,
            'tracking-merge',
            'MediaTailor avail returned no ads (no-fill)',
          );
        }

        if (activeAdBreak.hadMissingAvailStart) {
          // Tracking omitted the avail start; we fell back to the first ad's
          // start rather than dropping the avail. Surface it once.
          this.sendAdError(
            MT_AD_ERROR_CODE.MISSING_AVAIL_START,
            'tracking-merge',
            'MediaTailor avail missing startTimeInSeconds; fell back to first ad',
          );
        }

        if (activeAdBreak.podCountMismatch) {
          // Manifest pod count and tracking ad count disagreed; we kept the
          // manifest geometry and matched by closest time. Surface it once.
          this.sendAdError(
            MT_AD_ERROR_CODE.MANIFEST_TRACKING_MISMATCH,
            'tracking-merge',
            'Manifest pod count differs from tracking ad count',
          );
        }
      }

      // No-fill avails fire only the break boundaries (AD_BREAK_START above and
      // AD_BREAK_END on exit) — skip AD_START, quartiles, and AD_END so we
      // don't record a phantom impression with zero engagement.
      if (activeAdBreak.isNoFill) {
        return;
      }

      // Check for pod-level tracking
      if (activeAdBreak.pods && activeAdBreak.pods.length > 0) {
        const activePod = findActivePod(activeAdBreak, currentTime);

        if (activePod) {
          // Entering new pod
          if (!this.currentAdPod || this.currentAdPod !== activePod) {
            // End previous pod
            if (this.currentAdPod) {
              Log.debug(`[MT - ${getTimestamp()}] → AD_END (pod transition)`);
              this.sendEnd({ adPrimaryId: this.getAdPrimaryId() });
            }

            // Start new pod
            this.currentAdPod = activePod;

            Log.debug(`[MT - ${getTimestamp()}] → AD_START (new pod)`, {
              startTime: activePod.startTime,
              duration: activePod.duration,
              position: activeAdBreak.adPosition,
            });

            // NOTE: If the tracking API was slow to respond, the no-pods path
            // (below) will have already called sendStart() on this break.
            // Calling sendStart() again here is intentional — video-core's state
            // machine suppresses duplicate AD_START transitions (AD_START →
            // AD_START is a no-op), so nothing double-fires in New Relic. Once
            // pods are populated by the tracking API, this path takes over and
            // provides pod-level metadata (title, duration, creativeId) for all
            // subsequent events in the break.
            this.sendRequest({
              adPartner: 'aws-mediatailor',
              adPosition: activeAdBreak.adPosition,
            });

            this.sendStart({
              adPartner: 'aws-mediatailor',
              adPosition: activeAdBreak.adPosition,
              adPrimaryId: this.getAdPrimaryId(),
            });
            activePod.hasFiredStart = true;
          }

          // Track quartiles for pod
          const podProgress = currentTime - activePod.startTime;
          this.trackQuartiles(activePod, podProgress);
        } else if (this.currentAdPod) {
          // Playhead left the pod but is still inside the break (a dead-zone
          // from segment-rounding). Fire AD_END now so completion isn't lost;
          // AD_BREAK_END still fires when the break itself ends.
          Log.debug(`[MT - ${getTimestamp()}] → AD_END (pod ended in break)`);
          this.sendEnd({ adPrimaryId: this.getAdPrimaryId() });
          this.currentAdPod = null;
        }
      } else {
        // No pods - treat entire break as single ad
        if (!activeAdBreak.hasFiredAdStart) {
          Log.debug(`[MT - ${getTimestamp()}] → AD_START (no pods)`, {
            startTime: activeAdBreak.startTime,
            duration: activeAdBreak.duration,
            position: activeAdBreak.adPosition,
          });

          // Send AD_REQUEST before AD_START (required sequence)
          this.sendRequest({
            adPartner: 'aws-mediatailor',
            adPosition: activeAdBreak.adPosition,
          });

          // Send AD_START
          this.sendStart({
            adPartner: 'aws-mediatailor',
            adPosition: activeAdBreak.adPosition,
            adPrimaryId: this.getAdPrimaryId(),
          });
          activeAdBreak.hasFiredAdStart = true;
        }

        // Track quartiles for entire break
        const adProgress = currentTime - activeAdBreak.startTime;
        this.trackQuartiles(activeAdBreak, adProgress);
      }
    } else if (this.currentAdBreak) {
      // === EXITING AD BREAK ===

      // End last pod
      if (this.currentAdPod) {
        Log.debug(`[MT - ${getTimestamp()}] → AD_END (final pod)`);
        this.sendEnd({ adPrimaryId: this.getAdPrimaryId() });
        this.currentAdPod = null;
      }

      // End ad break
      if (!this.currentAdBreak.hasFiredEnd) {
        Log.debug(`[MT - ${getTimestamp()}] → AD_BREAK_END`);
        this.sendAdBreakEnd();
        this.currentAdBreak.hasFiredEnd = true;
      }

      this.currentAdBreak = null;
      this.setIsAd(false); // Switch back to content mode
      Log.debug(`[MT - ${getTimestamp()}] setIsAd(false) - Exiting ad break`);

      // Check if video has ended after exiting last ad break
      if (this.player.ended() && !this.hasEndedContent) {
        Log.debug(
          `[MT - ${getTimestamp()}] Video ended after last ad → CONTENT_END`,
        );
        this.sendContentEnd();
        this.hasEndedContent = true;
      }
    }
  }

  /**
   * Sends CONTENT_END event via parent content tracker
   */
  sendContentEnd() {
    if (this.parentTracker) {
      this.parentTracker.sendEnd();
    } else {
      super.sendEnd();
    }
  }

  /**
   * Generic handler for ad events - only fires if currently in an ad break
   * @param {string} eventName - The event name for logging (e.g., 'AD_PAUSE')
   * @param {Function} sendMethod - The method to call (e.g., this.sendPause)
   */
  handleAdEvent(eventName, sendMethod) {
    if (this.isAd()) {
      Log.debug(`[MT - ${getTimestamp()}] → ${eventName}`);
      sendMethod.call(this);
    }
  }

  /**
   * Handle pause events - sends AD_PAUSE only when ads are playing
   */
  onPause() {
    if (this.isAd()) {
      this.wasPaused = true;
    }
    this.handleAdEvent('AD_PAUSE', this.sendPause);
  }

  /**
   * Handle playing events - sends AD_RESUME only when ads are playing
   */
  onPlaying() {
    if (this.isAd()) {
      // Only a genuine resume follows a pause; the first `playing` into an ad
      // must not emit AD_RESUME (that would be AD_START's job).
      if (this.wasPaused) {
        Log.debug(`[MT - ${getTimestamp()}] → AD_RESUME`);
        this.sendResume();
        this.wasPaused = false;
      }
      this.sendBufferEnd(); // Playing event also ends any buffering
    }
  }

  /**
   * Handle seeking events - sends AD_SEEK_START only when ads are playing
   */
  onSeeking() {
    this.handleAdEvent('AD_SEEK_START', this.sendSeekStart);
  }

  /**
   * Handle seeked events - sends AD_SEEK_END only when ads are playing
   */
  onSeeked() {
    this.handleAdEvent('AD_SEEK_END', this.sendSeekEnd);
  }

  /**
   * Handle waiting (buffering) events - sends AD_BUFFER_START only when ads are playing
   */
  onWaiting() {
    this.handleAdEvent('AD_BUFFER_START', this.sendBufferStart);
  }

  /**
   * Override: Fire CONTENT_END when video ends
   */
  onEnded() {
    if (!this.hasEndedContent) {
      Log.debug(`[MT - ${getTimestamp()}] Video ended → CONTENT_END`);
      this.sendContentEnd();
      this.hasEndedContent = true;
    }
  }

  /**
   * Handle source swaps (player.src(newUrl)). Each MediaTailor session is
   * anchored to a sessionId in the manifest URL, so a new source means a new
   * ad-stitching context: clear the stale schedule, cancel in-flight fetches,
   * re-derive the tracking endpoint from the new URL, and re-initialize once
   * the new source's metadata is ready. Guarded on streamType so the initial
   * load (handled in the constructor) is never double-initialized.
   */
  onSourceChange() {
    const newUrl = this.player.currentSrc();
    if (!this.streamType || !newUrl || newUrl === this.playbackManifestUrl) {
      return;
    }

    Log.debug(`[MT - ${getTimestamp()}] Source changed → resetting tracker`, {
      from: this.playbackManifestUrl,
      to: newUrl,
    });

    // Cancel in-flight work and stop polling on the old session.
    this.stopLivePolling();
    if (this.trackingAbortController) {
      this.trackingAbortController.abort();
      this.trackingAbortController = null;
    }
    if (this.manifestAbortController) {
      this.manifestAbortController.abort();
      this.manifestAbortController = null;
    }

    // Clear schedule and in-progress ad/tracking state.
    this.adSchedule = [];
    this.currentAdBreak = null;
    this.currentAdPod = null;
    this.wasPaused = false;
    this.trackingEndpointUrl = null;
    this.hasAttemptedTrackingFetch = false;
    this.trackingFetchRetries = 0;
    this.nextToken = null;
    this.mediaPlaylistUrl = null;
    this.lastMediaPlaylistText = null;

    // Re-derive from the new source. Null streamType until the new source's
    // metadata arrives, which also makes this handler ignore spurious
    // loadstart events fired before re-initialization completes.
    this.playbackManifestUrl = newUrl;
    this.manifestFormat = detectManifestFormatFromUrl(newUrl);
    this.streamType = null;
    this.player.one('loadedmetadata', () => {
      this.streamType = detectPlaybackStreamType(this.player.duration());
      this.initializeTracking();
    });
  }

  /**
   * Emit an AD_ERROR with the semantic MediaTailor error taxonomy so operators
   * can see why ads failed in NRDB instead of only a debug log. Delegates to
   * the parent error event, which resolves to AD_ERROR while in an ad (and
   * CONTENT_ERROR otherwise). `code` must be an MT_AD_ERROR_CODE value.
   */
  sendAdError(code, source, message) {
    Log.debug(
      `[MT - ${getTimestamp()}] → AD_ERROR ${code} (${source}): ${message}`,
    );
    this.sendError({
      errorCode: code,
      errorSource: source,
      errorMessage: message,
    });
  }

  /**
   * Public API: signal a user-initiated ad skip (e.g. a "Skip Ad" button in
   * the host app). Fires the ad-end event flagged as skipped so downstream can
   * tell an opt-out apart from a natural completion. No-op when not currently
   * in an ad. Mirrors the tracker's own 'adskip' player-event handling and the
   * notifyAdSkipped API exposed by the iOS/Android MediaTailor trackers.
   */
  notifyAdSkipped() {
    if (!this.isAd()) {
      return;
    }
    Log.debug(`[MT - ${getTimestamp()}] notifyAdSkipped → AD_END (skipped)`);
    this.sendEnd({ skipped: true, adPrimaryId: this.getAdPrimaryId() });
  }

  /**
   * Returns ad title for New Relic
   */
  getTitle() {
    if (this.currentAdPod) {
      return this.currentAdPod.title || this.currentAdBreak?.id || null;
    }
    return this.currentAdBreak?.title || this.currentAdBreak?.id || null;
  }

  /**
   * Returns ad ID for New Relic (adId attribute)
   */
  getVideoId() {
    if (this.currentAdPod) {
      return (
        this.currentAdPod.adId ||
        this.currentAdPod.title ||
        this.currentAdBreak?.id ||
        null
      );
    }
    return this.currentAdBreak?.adId || this.currentAdBreak?.id || null;
  }

  /**
   * Returns the stable primary ad identity for New Relic (adPrimaryId
   * attribute). Prefers the VAST creativeId (stable across avails), falling
   * back to availId:adId, so count(DISTINCT adPrimaryId) reflects true
   * creatives rather than per-avail adIds.
   */
  getAdPrimaryId() {
    const ad = this.currentAdPod || this.currentAdBreak;
    if (!ad) {
      return null;
    }
    if (ad.creativeId) {
      return ad.creativeId;
    }
    const availId = this.currentAdBreak?.availId;
    if (availId && ad.adId) {
      return `${availId}:${ad.adId}`;
    }
    return ad.adId || ad.id || null;
  }

  /**
   * Returns ad source URL for New Relic (adSrc attribute)
   */
  getSrc() {
    // MediaTailor doesn't provide individual creative URLs
    return this.trackingEndpointUrl || this.playbackManifestUrl || null;
  }

  /**
   * Returns ad duration in milliseconds for New Relic
   */
  getDuration() {
    if (this.currentAdPod) {
      return this.currentAdPod.duration * 1000;
    }
    return this.currentAdBreak ? this.currentAdBreak.duration * 1000 : null;
  }

  /**
   * Stops polling timers
   */
  stopPolling() {
    if (this.manifestPollTimer) {
      clearInterval(this.manifestPollTimer);
      this.manifestPollTimer = null;
    }

    if (this.trackingPollTimer) {
      clearInterval(this.trackingPollTimer);
      this.trackingPollTimer = null;
    }

    Log.debug(`[MT - ${getTimestamp()}] Polling stopped`);
  }

  /**
   * Public API: reversible teardown — stop polling and unregister player
   * listeners without disposing the tracker. Unlike dispose() this does not
   * set isDisposed, so callers can resume later by re-initializing. Idempotent.
   * Canonical name shared with the iOS/Android trackers' stopTracking().
   */
  stopTracking() {
    this.stopLivePolling();
    this.unregisterListeners();
  }

  /**
   * Cleanup when tracker is destroyed
   */
  dispose() {
    Log.debug(`[MT - ${getTimestamp()}] Disposing MediaTailorAdsTracker`);

    // If we're torn down mid-break, synthesize the outstanding closing events
    // so downstream sees a balanced AD_BREAK_START → … → AD_END → AD_BREAK_END
    // sequence instead of a dangling open break. Nulling currentAdBreak keeps
    // this idempotent across repeated dispose() calls.
    if (this.currentAdBreak) {
      if (this.currentAdPod) {
        Log.debug(`[MT - ${getTimestamp()}] → AD_END (dispose during active ad)`);
        this.sendEnd({ adPrimaryId: this.getAdPrimaryId() });
        this.currentAdPod = null;
      }
      if (!this.currentAdBreak.hasFiredEnd) {
        Log.debug(`[MT - ${getTimestamp()}] → AD_BREAK_END (dispose during active ad)`);
        this.sendAdBreakEnd();
        this.currentAdBreak.hasFiredEnd = true;
      }
      this.currentAdBreak = null;
    }

    this.isDisposed = true;

    if (this.trackingAbortController) {
      Log.debug(`[MT - ${getTimestamp()}] Aborting in-flight tracking fetch`);
      this.trackingAbortController.abort();
      this.trackingAbortController = null;
    }

    if (this.manifestAbortController) {
      Log.debug(`[MT - ${getTimestamp()}] Aborting in-flight manifest fetch`);
      this.manifestAbortController.abort();
      this.manifestAbortController = null;
    }

    this.stopLivePolling();
    this.unregisterListeners();
    super.dispose && super.dispose();
  }
}
