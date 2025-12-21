/* eslint-disable no-undef */
import nrvideo from '@newrelic/video-core';
import VideojsAdsTracker from './videojs-ads';
import {
  DEFAULT_CONFIG,
  STREAM_TYPE,
  MANIFEST_TYPE,
} from './utils/mt-constants.js';
import {
  getTimestamp,
  detectManifestType,
  detectStreamType,
  extractTrackingUrl,
  determineAdPosition,
  getQuartilesToFire,
  findActiveAdBreak,
  findActivePod,
  mergeAdSchedules,
  parseHLSManifestForAds,
  parseDASHManifestForAds,
  detectAdsFromVHSPlaylist,
  enrichScheduleWithTracking,
  getHLSMasterManifest,
  getHLSMediaPlaylist,
  getDASHManifest,
  getTrackingMetadata,
} from './utils/mt.js';

// Handle both direct and default export from video-core
const nrvideoCore = nrvideo.default || nrvideo;
const Log = nrvideoCore.Log;

/**
 * AWS MediaTailor Ad Tracker
 * Tracks ads from AWS MediaTailor SSAI streams (HLS/DASH)
 *
 * Features:
 * - Client-side ad detection from manifest markers (CUE-OUT/CUE-IN)
 * - Pod-level tracking (multiple ads within one break)
 * - VOD and Live stream support
 * - Zero race conditions via VHS player hooks
 * - Tracking API metadata enrichment
 */
export default class MediaTailorAdsTracker extends VideojsAdsTracker {
  /**
   * Checks if tracker should be used for this player source
   */
  static isUsing(player) {
    return (
      player &&
      typeof player.currentSrc === 'function' &&
      player.currentSrc().includes('.mediatailor.')
    );
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
    // Return stored position from current ad break if available
    if (this.currentAdBreak && this.currentAdBreak.adPosition) {
      return this.currentAdBreak.adPosition;
    }
    // Fall back to parent implementation
    return super.getAdPosition();
  }

  constructor(player, options = {}) {
    super(player);

    // Merge config with defaults
    const mtOptions = options.mt || options;
    this.config = { ...DEFAULT_CONFIG, ...mtOptions };

    // Initialize state
    this.streamType = null; // 'vod' or 'live'
    this.manifestType = null; // 'hls' or 'dash'
    this.mediaTailorEndpoint = player.currentSrc();
    // Note: isAd is set to false by parent tracker after setAdsTracker() call

    // Ad tracking state
    this.adSchedule = []; // All detected ad breaks
    this.currentAdBreak = null; // Active ad break
    this.currentAdPod = null; // Active pod within break
    this.hasEndedContent = false; // Track if CONTENT_END has been sent

    // Disposal and abort state
    this.isDisposed = false;
    this.trackingAbortController = null;
    this.manifestAbortController = null;
    this.isFetchingTracking = false;
    this.isFetchingManifest = false;

    // Tracking API state
    this.trackingUrl = null;
    this.hasAttemptedTrackingFetch = false;
    this.trackingFetchRetries = 0;
    this.maxTrackingRetries = 1;

    // Live polling timers
    this.manifestPollTimer = null;
    this.trackingPollTimer = null;

    // Manifest parsing cache
    this.mediaPlaylistUrl = null;
    this.lastMediaPlaylistText = null;
    this.manifestTargetDuration = null; // For optimal live polling interval

    console.log(`[MT - ${getTimestamp()}] MediaTailorAdsTracker initialized`, {
      endpoint: this.mediaTailorEndpoint,
      config: this.config,
    });

    // Detect manifest format from URL
    this.manifestType = detectManifestType(this.mediaTailorEndpoint);
    console.log(
      `[MT - ${getTimestamp()}] Manifest type: ${this.manifestType.toUpperCase()}`
    );

    // Wait for player metadata to detect stream type
    this.player.one('loadedmetadata', () => {
      this.streamType = detectStreamType(this.player.duration());
      console.log(
        `[MT - ${getTimestamp()}] Stream type: ${this.streamType.toUpperCase()}`
      );
      this.initializeTracking();
    });
  }

  /**
   * Initializes tracking based on detected stream type
   */
  initializeTracking() {
    console.log(
      `[MT - ${getTimestamp()}] Initializing ${this.manifestType.toUpperCase()} ${this.streamType.toUpperCase()} tracking`
    );

    // Extract tracking URL from sessionized URL
    this.trackingUrl = extractTrackingUrl(this.mediaTailorEndpoint);
    if (this.trackingUrl) {
      console.log(
        `[MT - ${getTimestamp()}] Tracking URL extracted:`,
        this.trackingUrl
      );
    } else {
      console.warn(
        `[MT - ${getTimestamp()}] No sessionId found - user must initialize session externally`
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

    // Bind MediaTailor-specific event listeners
    this.player.on('pause', this.onPause.bind(this));
    this.player.on('playing', this.onPlaying.bind(this));
    this.player.on('seeking', this.onSeeking.bind(this));
    this.player.on('seeked', this.onSeeked.bind(this));
    this.player.on('waiting', this.onWaiting.bind(this));
    this.player.on('ended', this.onEnded.bind(this));
    this.player.on('timeupdate', this.onTimeUpdate.bind(this));
    console.log(`[MT - ${getTimestamp()}] Event listeners registered`);
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
    console.log(`[MT - ${getTimestamp()}] VOD mode: Single manifest parse`);
    this.hookPlayerManifest();
  }

  /**
   * Sets up Live tracking (continuous polling)
   */
  setupLiveTracking() {
    console.log(`[MT - ${getTimestamp()}] Live mode: Continuous polling`);
    this.hookPlayerManifest();

    // AWS best practice: Poll at manifest target duration interval
    const manifestInterval = this.manifestTargetDuration
      ? this.manifestTargetDuration * 1000
      : this.config.liveManifestPollInterval;

    const trackingInterval = this.manifestTargetDuration
      ? this.manifestTargetDuration * 1000
      : this.config.liveTrackingPollInterval;

    // Start polling timers
    this.manifestPollTimer = setInterval(() => {
      this.pollManifestForNewAds();
    }, manifestInterval);

    this.trackingPollTimer = setInterval(() => {
      this.getAndProcessTrackingMetadata();
    }, trackingInterval);

    console.log(`[MT - ${getTimestamp()}] Live polling started`, {
      manifestInterval,
      trackingInterval,
    });
  }

  /**
   * Updates live polling intervals after target duration detected
   */
  updateLivePollingIntervals() {
    if (!this.manifestTargetDuration) return;

    const newInterval = this.manifestTargetDuration * 1000;
    console.log(
      `[MT - ${getTimestamp()}] Updating polling to target duration: ${this.manifestTargetDuration}s`
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
   * Hooks into player's manifest loading (zero race condition)
   * Supports: VHS, Native HLS, contrib-hls, Shaka, dash.js
   */
  hookPlayerManifest() {
    if (!this.config.enableManifestParsing) {
      console.log(`[MT - ${getTimestamp()}] Manifest parsing disabled`);
      return;
    }

    const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
    if (!tech) {
      console.log(`[MT - ${getTimestamp()}] No tech - using fallback fetch`);
      this.getManifestDirectly();
      return;
    }

    // Try hooks in order of preference
    if (this.manifestType === MANIFEST_TYPE.HLS) {
      if (
        this.hookHLSViaVHS(tech) ||
        this.hookHLSViaNative(tech) ||
        this.hookHLSViaContribHls(tech)
      ) {
        return; // Successfully hooked
      }
    } else if (this.manifestType === MANIFEST_TYPE.DASH) {
      if (this.hookDASHViaShaka(tech) || this.hookDASHViaDashJs(tech)) {
        return; // Successfully hooked
      }
    }

    // Fallback: Direct manifest fetch
    console.log(`[MT - ${getTimestamp()}] Using fallback: direct manifest fetch`);
    this.getManifestDirectly();
  }

  /**
   * Hook: VHS (videojs-http-streaming) - Video.js 7.0+
   */
  hookHLSViaVHS(tech) {
    if (!tech.vhs || !tech.vhs.playlists) return false;

    console.log(`[MT - ${getTimestamp()}] Hooked: VHS`);

    // Parse already-loaded playlist
    const currentPlaylist = tech.vhs.playlists.media();
    if (currentPlaylist && currentPlaylist.segments && currentPlaylist.segments.length > 0) {
      console.log(`[MT - ${getTimestamp()}] Parsing existing playlist`);
      this.parseVHSPlaylist(currentPlaylist);
    }

    // Hook future playlist loads
    tech.vhs.on('loadedplaylist', () => {
      const playlist = tech.vhs.playlists.media();
      if (playlist) {
        this.parseVHSPlaylist(playlist);
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
      tech.el_.canPlayType('application/vnd.apple.mpegurl')
    ) {
      console.log(`[MT - ${getTimestamp()}] Native HLS detected - using fallback`);
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

    console.log(`[MT - ${getTimestamp()}] Hooked: contrib-hls (legacy)`);

    // Parse already-loaded playlist
    const currentPlaylist = tech.hls.playlists.media();
    if (currentPlaylist && currentPlaylist.segments && currentPlaylist.segments.length > 0) {
      this.parseVHSPlaylist(currentPlaylist);
    }

    // Hook future playlist loads
    tech.hls.on('loadedplaylist', () => {
      const playlist = tech.hls.playlists.media();
      if (playlist) {
        this.parseVHSPlaylist(playlist);
      }
    });

    return true;
  }

  /**
   * Hook: Shaka Player (DASH)
   */
  hookDASHViaShaka(tech) {
    if (!tech.shakaPlayer) return false;

    console.log(`[MT - ${getTimestamp()}] Hooked: Shaka Player`);
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

    console.log(`[MT - ${getTimestamp()}] Hooked: dash.js`);
    tech.dash.on('EVENT_MODE_ON_RECEIVE', (event) => {
      this.handleDASHEventStream(event);
    });

    return true;
  }

  /**
   * Fetches manifest directly (fallback when hooks unavailable)
   */
  async getManifestDirectly() {
    console.log(`[MT - ${getTimestamp()}] Fallback: fetching manifest directly`);

    try {
      const manifestUrl = this.mediaTailorEndpoint;

      if (this.manifestType === MANIFEST_TYPE.HLS) {
        await this.getAndParseHLSManifest(manifestUrl);
      } else if (this.manifestType === MANIFEST_TYPE.DASH) {
        await this.getAndParseDASHManifest(manifestUrl);
      }
    } catch (error) {
      console.log(`[MT - ${getTimestamp()}] Fallback fetch error:`, error);
    }
  }

  /**
   * Fetches and parses HLS master + media manifest
   */
  async getAndParseHLSManifest(manifestUrl) {
    try {
      console.log(`[MT - ${getTimestamp()}] Fetching HLS master manifest`);

      // Fetch master manifest
      const { mediaPlaylistUrl } = await getHLSMasterManifest(manifestUrl);

      if (!mediaPlaylistUrl) {
        console.log(`[MT - ${getTimestamp()}] No media playlist found`);
        return;
      }

      console.log(`[MT - ${getTimestamp()}] Fetching media playlist`);

      // Fetch media playlist
      const mediaText = await getHLSMediaPlaylist(mediaPlaylistUrl);

      // Parse for ads
      const ads = parseHLSManifestForAds(mediaText);
      if (ads.length > 0) {
        console.log(`[MT - ${getTimestamp()}] Detected ${ads.length} ad break(s)`);
        this.mergeNewAds(ads);
      }
    } catch (error) {
      console.log(`[MT - ${getTimestamp()}] HLS fetch error:`, error);
    }
  }

  /**
   * Fetches and parses DASH MPD manifest
   */
  async getAndParseDASHManifest(manifestUrl) {
    try {
      console.log(`[MT - ${getTimestamp()}] Fetching DASH manifest`);

      // Fetch DASH manifest
      const xmlText = await getDASHManifest(manifestUrl);

      // Parse for ads
      const ads = parseDASHManifestForAds(xmlText);

      console.log(`[MT - ${getTimestamp()}] DASH: ${ads.length} ad break(s) found`);

      if (ads.length > 0) {
        this.mergeNewAds(ads);
      }
    } catch (error) {
      console.log(`[MT - ${getTimestamp()}] DASH fetch error:`, error);
    }
  }

  /**
   * Handles DASH emsg events from Shaka Player
   */
  handleDASHEmsgEvent(event) {
    console.log(`[MT - ${getTimestamp()}] DASH emsg event:`, event);
    // TODO: Full SCTE-35 parsing
  }

  /**
   * Handles DASH event stream from dash.js
   */
  handleDASHEventStream(event) {
    console.log(`[MT - ${getTimestamp()}] DASH event stream:`, event);
    // TODO: Full SCTE-35 parsing
  }

  /**
   * Parses VHS playlist object for ads
   */
  parseVHSPlaylist(playlist) {
    console.log(
      `[MT - ${getTimestamp()}] Parsing VHS playlist (${
        playlist.segments?.length || 0
      } segments)`
    );

    if (!playlist.segments || playlist.segments.length === 0) {
      console.log(`[MT - ${getTimestamp()}] No segments in playlist`);
      return;
    }

    // VHS strips CUE tags - detect via discontinuityStarts + MediaTailor segments
    const ads = detectAdsFromVHSPlaylist(playlist);

    if (ads.length > 0) {
      console.log(
        `[MT - ${getTimestamp()}] VHS detected ${ads.length} ad break(s), ${ads.reduce(
          (sum, ab) => sum + ab.pods.length,
          0
        )} pod(s)`
      );
      this.mergeNewAds(ads);
    } else {
      console.log(`[MT - ${getTimestamp()}] No ads detected in VHS playlist`);
    }
  }

  /**
   * Polls manifest for new ads (Live streams only)
   */
  async pollManifestForNewAds() {
    if (this.isDisposed) return;

    if (this.isFetchingManifest) {
      console.log(`[MT - ${getTimestamp()}] Manifest fetch already in progress, skipping`);
      return;
    }

    this.isFetchingManifest = true;

    try {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
      if (tech && tech.vhs) {
        const playlist = tech.vhs.playlists.media();
        if (playlist) {
          this.parseVHSPlaylist(playlist);
        }
      }
    } catch (error) {
      console.log(`[MT - ${getTimestamp()}] Manifest poll error:`, error);
    } finally {
      this.isFetchingManifest = false;
    }
  }

  /**
   * Merges new ads into schedule (deduplicates)
   */
  mergeNewAds(newAds) {
    this.adSchedule = mergeAdSchedules(this.adSchedule, newAds);

    console.log(
      `[MT - ${getTimestamp()}] Ad schedule: ${this.adSchedule.length} ad break(s)`
    );

    // VOD: Fetch tracking metadata after first manifest parse (AWS best practice)
    if (
      this.streamType === STREAM_TYPE.VOD &&
      this.trackingUrl &&
      !this.hasAttemptedTrackingFetch
    ) {
      this.hasAttemptedTrackingFetch = true;
      console.log(
        `[MT - ${getTimestamp()}] Fetching tracking metadata (first manifest parse)`
      );
      this.getAndProcessTrackingMetadata();
    }
  }

  /**
   * Fetches and processes tracking metadata from AWS MediaTailor Tracking API
   */
  async getAndProcessTrackingMetadata() {
    if (this.isDisposed || !this.trackingUrl) return;

    if (this.isFetchingTracking) {
      console.log(`[MT - ${getTimestamp()}] Tracking fetch already in progress, skipping`);
      return;
    }

    this.isFetchingTracking = true;

    try {
      console.log(`[MT - ${getTimestamp()}] Fetching tracking metadata`);

      this.trackingAbortController = new AbortController();

      const data = await getTrackingMetadata(
        this.trackingUrl,
        this.config.trackingAPITimeout,
        this.trackingAbortController.signal
      );

      if (this.isDisposed) {
        console.log(`[MT - ${getTimestamp()}] Disposed during tracking fetch, ignoring result`);
        return;
      }

      if (data.avails && data.avails.length > 0) {
        console.log(
          `[MT - ${getTimestamp()}] Enriching with ${data.avails.length} avail(s)`
        );
        this.enrichWithTrackingMetadata(data.avails);
        this.trackingFetchRetries = 0;
      } else {
        console.log(`[MT - ${getTimestamp()}] Tracking API returned 0 avails`);
      }
    } catch (error) {
      if (error.name === 'AbortError' || this.isDisposed) {
        console.log(`[MT - ${getTimestamp()}] Tracking fetch aborted`);
        return;
      }

      console.log(
        `[MT - ${getTimestamp()}] Tracking API error: ${error.message}`,
        error
      );

      if (this.trackingFetchRetries < this.maxTrackingRetries) {
        this.trackingFetchRetries++;
        console.log(
          `[MT - ${getTimestamp()}] Retrying tracking fetch (${this.trackingFetchRetries}/${this.maxTrackingRetries})`
        );
        this.isFetchingTracking = false;
        await this.getAndProcessTrackingMetadata();
        return;
      }

      console.log(
        `[MT - ${getTimestamp()}] Max retries reached, continuing with manifest data only`
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
    const newAds = enrichScheduleWithTracking(this.adSchedule, avails);

    // Add any new ads from tracking
    if (newAds.length > 0) {
      this.adSchedule.push(...newAds);
      this.adSchedule.sort((a, b) => a.startTime - b.startTime);
    }

    console.log(
      `[MT - ${getTimestamp()}] Enrichment complete: ${
        this.adSchedule.length
      } ad break(s)`
    );

    // Log enriched schedule with full details
    console.log(
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
      }))
    );

    // Log current player time for debugging
    console.log(
      `[MT - ${getTimestamp()}] Current player time: ${this.player.currentTime()}s`
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
      console.log(`[MT - ${getTimestamp()}] → AD_QUARTILE ${quartile * 25}%`);
      this.sendAdQuartile({ quartile });
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
    if (this.adSchedule.length > 0 && Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime * 10) % 10 === 0) {
      console.log(
        `[MT - ${getTimestamp()}] TimeUpdate: ${currentTime.toFixed(2)}s, Active break: ${
          activeAdBreak ? activeAdBreak.id : 'none'
        }, Schedule count: ${this.adSchedule.length}`
      );
    }

    if (activeAdBreak) {
      // === INSIDE AD BREAK ===

      // Fire AD_BREAK_START once
      if (!activeAdBreak.hasFiredStart) {
        this.currentAdBreak = activeAdBreak;
        this.setIsAd(true); // Switch to ad mode
        console.log(`[MT - ${getTimestamp()}] setIsAd(true) - Entering ad break`);

        // Calculate ad position by finding index based on startTime
        const adBreakIndex = this.adSchedule.findIndex(
          (ad) => Math.abs(ad.startTime - activeAdBreak.startTime) < 0.5
        );
        const adPosition = determineAdPosition(
          adBreakIndex,
          this.adSchedule.length,
          this.streamType
        );

        // Store position on the ad break for reuse
        activeAdBreak.adPosition = adPosition;

        console.log(`[MT - ${getTimestamp()}] → AD_BREAK_START`, {
          startTime: activeAdBreak.startTime,
          duration: activeAdBreak.duration,
          podCount: activeAdBreak.pods?.length || 0,
          position: adPosition,
          breakIndex: adBreakIndex,
          totalBreaks: this.adSchedule.length,
        });
        this.sendAdBreakStart();
        activeAdBreak.hasFiredStart = true;
      }

      // Check for pod-level tracking
      if (activeAdBreak.pods && activeAdBreak.pods.length > 0) {
        const activePod = findActivePod(activeAdBreak, currentTime);

        if (activePod) {
          // Entering new pod
          if (!this.currentAdPod || this.currentAdPod !== activePod) {
            // End previous pod
            if (this.currentAdPod) {
              console.log(`[MT - ${getTimestamp()}] → AD_END (pod transition)`);
              this.sendEnd();
            }

            // Start new pod
            this.currentAdPod = activePod;

            console.log(`[MT - ${getTimestamp()}] → AD_START (new pod)`, {
              startTime: activePod.startTime,
              duration: activePod.duration,
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
            });
            activePod.hasFiredStart = true;
          }

          // Track quartiles for pod
          const podProgress = currentTime - activePod.startTime;
          this.trackQuartiles(activePod, podProgress);
        }
      } else {
        // No pods - treat entire break as single ad
        if (!activeAdBreak.hasFiredAdStart) {
          console.log(`[MT - ${getTimestamp()}] → AD_START (no pods)`, {
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
        console.log(`[MT - ${getTimestamp()}] → AD_END (final pod)`);
        this.sendEnd();
        this.currentAdPod = null;
      }

      // End ad break
      if (!this.currentAdBreak.hasFiredEnd) {
        console.log(`[MT - ${getTimestamp()}] → AD_BREAK_END`);
        this.sendAdBreakEnd();
        this.currentAdBreak.hasFiredEnd = true;
      }

      this.currentAdBreak = null;
      this.setIsAd(false); // Switch back to content mode
      console.log(`[MT - ${getTimestamp()}] setIsAd(false) - Exiting ad break`);

      // Check if video has ended after exiting last ad break
      if (this.player.ended() && !this.hasEndedContent) {
        console.log(`[MT - ${getTimestamp()}] Video ended after last ad → CONTENT_END`);
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
      console.log(`[MT - ${getTimestamp()}] → ${eventName}`);
      sendMethod.call(this);
    }
  }

  /**
   * Handle pause events - sends AD_PAUSE only when ads are playing
   */
  onPause() {
    this.handleAdEvent('AD_PAUSE', this.sendPause);
  }

  /**
   * Handle playing events - sends AD_RESUME only when ads are playing
   */
  onPlaying() {
    if (this.isAd()) {
      console.log(`[MT - ${getTimestamp()}] → AD_RESUME`);
      this.sendResume();
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
      console.log(`[MT - ${getTimestamp()}] Video ended → CONTENT_END`);
      this.sendContentEnd();
      this.hasEndedContent = true;
    }
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
        this.currentAdPod.creativeId ||
        this.currentAdPod.title ||
        this.currentAdBreak?.id ||
        null
      );
    }
    return this.currentAdBreak?.creativeId || this.currentAdBreak?.id || null;
  }

  /**
   * Returns ad source URL for New Relic (adSrc attribute)
   */
  getSrc() {
    // MediaTailor doesn't provide individual creative URLs
    return this.trackingUrl || this.mediaTailorEndpoint || null;
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

    console.log(`[MT - ${getTimestamp()}] Polling stopped`);
  }

  /**
   * Cleanup when tracker is destroyed
   */
  dispose() {
    console.log(`[MT - ${getTimestamp()}] Disposing MediaTailorAdsTracker`);

    this.isDisposed = true;

    if (this.trackingAbortController) {
      console.log(`[MT - ${getTimestamp()}] Aborting in-flight tracking fetch`);
      this.trackingAbortController.abort();
      this.trackingAbortController = null;
    }

    if (this.manifestAbortController) {
      console.log(`[MT - ${getTimestamp()}] Aborting in-flight manifest fetch`);
      this.manifestAbortController.abort();
      this.manifestAbortController = null;
    }

    this.stopLivePolling();
    this.unregisterListeners();
    super.dispose && super.dispose();
  }
}
