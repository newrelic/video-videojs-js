/* eslint-disable no-undef */
import nrvideo from '@newrelic/video-core';
import VideojsAdsTracker from './videojs-ads';

const { Log } = nrvideo;

// OPTIMIZATION: Compile regex patterns once
const REGEX_CUE_OUT = /DURATION=([\d.]+)/;
const REGEX_MAP_URI = /URI="([^"]+)"/;
const REGEX_CUE_IN = /#EXT-X-CUE-IN/;

export default class MediaTailorAdsTracker extends VideojsAdsTracker {
  /**
   * To be instantiated, the player must have a src that contains ".mediatailor."
   * @param {object} player A videojs player instance.
   * @returns {boolean} True if the tracker can be used.
   */
  static isUsing(player) {
    return (
      player &&
      typeof player.currentSrc === 'function' &&
      player.currentSrc().includes('.mediatailor.')
    );
  }

  /**
   * Returns the tracker name.
   * @returns {string} Tracker name.
   */
  getTrackerName() {
    return 'aws-media-tailor';
  }

  /**
   * Returns the player version.
   * @returns {string} Player version.
   */
  getPlayerVersion() {
    return 'MediaTailor'; // MediaTailor doesn't have a version in the player
  }

  constructor(player, options = {}) {
    super(player);

    // NEW: Configuration with defaults
    // Allow options to be passed directly or under 'mt' key
    const mtOptions = options.mt || options;

    this.config = {
      enableManifestParsing: mtOptions.enableManifestParsing !== false, // true by default
      manifestPollInterval: Math.min(mtOptions.manifestPollInterval || 10000, 15000), // Max 15 seconds
      trackingPollInterval: mtOptions.trackingPollInterval || 5000, // 5 seconds
      initialTrackingDelay: mtOptions.initialTrackingDelay || 500, // 500ms initial delay
      retryAttempts: mtOptions.retryAttempts || 10, // 10 attempts over ~5 seconds
      retryDelay: mtOptions.retryDelay || 500, // 500ms between retries
    };

    this.setIsAd(true); // Mark this tracker as an ad tracker
    this.adSchedule = []; // Initialize ad schedule
    this.sessionInitialized = false; // Initialize session flag
    this.sessionInitializing = false; // Flag to prevent multiple initialization attempts
    this.currentAdBreak = null; // Initialize current ad break
    this.currentAdPod = null; // Initialize current ad pod
    this.mediaTailorEndpoint = player.currentSrc(); // Store the MediaTailor endpoint
    this.isInitialLoad = true; // Flag to track if this is the first load

    // NEW: Polling flags
    this.isPolling = false;
    this.manifestPollTimer = null;
    this.trackingPollTimer = null;

    console.log(
      `[${new Date().toISOString()}] MediaTailorAdsTracker: Constructor called`,
      {
        isAd: this.isAd(),
        currentSrc: player.currentSrc(),
        mediaTailorEndpoint: this.mediaTailorEndpoint,
        config: this.config,
      }
    );

    // Initialize session immediately on construction, before playback starts
    if (MediaTailorAdsTracker.isUsing(this.player)) {
      console.log(
        `[${new Date().toISOString()}] MediaTailorAdsTracker: Initializing session on construction`
      );
      this.initializeSession();
    }
  }

  /**
   * This function is called when the videojs-ads plugin is initialized.
   */
  onAdsReady() {
    // Don't initialize here, wait for timeupdate to avoid race conditions
  }

  /**
   * Initializes the MediaTailor session by making a POST request to the endpoint.
   */
  async initializeSession() {
    if (this.sessionInitialized || this.sessionInitializing) return;
    this.sessionInitializing = true;

    // Safety check: make sure we have a valid endpoint
    if (!this.mediaTailorEndpoint) {
      console.log(
        `[${new Date().toISOString()}] MediaTailorAdsTracker: No endpoint available, skipping session initialization`
      );
      this.sessionInitializing = false;
      return;
    }

    try {
      console.log(
        `[${new Date().toISOString()}] Initializing session with MediaTailor.`,
        this.mediaTailorEndpoint
      );

      // Extract the session initialization endpoint from the HLS URL
      // Convert from: https://.../v1/master/<hashed-id>/<config>/master.m3u8
      // To: https://.../v1/session/<hashed-id>/<config>/master.m3u8
      // Note: Keep the /master.m3u8 part - it's required for session initialization!
      let sessionEndpoint = this.mediaTailorEndpoint;
      if (sessionEndpoint.includes('/v1/master/')) {
        sessionEndpoint = sessionEndpoint.replace(
          '/v1/master/',
          '/v1/session/'
        );
      }

      console.log(
        `[${new Date().toISOString()}] Session endpoint URL:`,
        sessionEndpoint
      );

      this.originBaseUrl = new URL(sessionEndpoint).origin;

      const response = await fetch(sessionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adsParams: {},
          reportingMode: 'client',
        }),
      });

      if (!response.ok) {
        throw new Error(
          `MediaTailor session request failed: ${response.status}`
        );
      }

      const sessionData = await response.json();

      const manifestUrl = new URL(sessionData.manifestUrl, this.originBaseUrl)
        .href;
      this.trackingUrl = new URL(
        sessionData.trackingUrl,
        this.originBaseUrl
      ).href;

      console.log(
        `[${new Date().toISOString()}] MediaTailor session initialized.`,
        {
          manifestUrl,
          trackingUrl: this.trackingUrl,
        }
      );

      // Store the session manifest URL but DON'T update player.src()
      // The HLS player will naturally use the session URL when it requests the manifest
      // Updating src() would trigger a new loadstart event and duplicate CONTENT_REQUEST
      this.sessionManifestUrl = manifestUrl;
      console.log(
        `[${new Date().toISOString()}] MediaTailorAdsTracker: Session manifest URL stored (not updating player to avoid duplicate events)`
      );

      this.sessionInitialized = true;

      // NEW: Parse manifest immediately for zero-latency detection
      if (this.config.enableManifestParsing) {
        console.log(
          `[${new Date().toISOString()}] [MANIFEST] Parsing manifest for immediate ad detection...`
        );
        const manifestAds = await this.parseManifestForAds(manifestUrl);

        if (manifestAds.length > 0) {
          this.adSchedule = manifestAds;
          console.log(
            `[${new Date().toISOString()}] [MANIFEST] Ad schedule initialized with ${
              manifestAds.length
            } ads from manifest`
          );
        }

        // NEW: Start polling immediately for pre-roll ads
        // MediaTailor may not have inserted ads into the manifest yet at session creation time
        console.log(
          `[${new Date().toISOString()}] [POLLING] Starting manifest polling for pre-roll detection...`
        );
        this.startManifestPolling();
      }

      // Load tracking API in background (will merge with manifest data)
      setTimeout(() => this.loadTracker(), this.config.initialTrackingDelay);
    } catch (error) {
      Log.error('Error initializing MediaTailor session:', error);
      this.sendError(error);
    } finally {
      this.sessionInitializing = false;
    }
  }

  /**
   * Parses HLS manifest for ad markers (CUE-OUT tags)
   * @param {string} manifestUrl - The manifest URL to parse
   * @returns {Promise<Array>} Array of ad breaks found in manifest
   */
  async parseManifestForAds(manifestUrl) {
    if (!this.config.enableManifestParsing) {
      console.log(
        `[${new Date().toISOString()}] [MANIFEST] Parsing disabled via config`
      );
      return [];
    }

    try {
      let mediaPlaylistUrl = this.mediaPlaylistUrl;

      // OPTIMIZATION: Only fetch master manifest if we don't have the media playlist URL yet
      if (!mediaPlaylistUrl) {
        console.log(
          `[${new Date().toISOString()}] [MANIFEST] Fetching master manifest:`,
          manifestUrl
        );

        // Fetch master manifest with credentials to share MediaTailor session cookies
        const masterResponse = await fetch(manifestUrl, {
          credentials: 'include', // Include cookies for MediaTailor session affinity
        });
        const masterText = await masterResponse.text();

        console.log(
          `[${new Date().toISOString()}] [MANIFEST] Master manifest content:\n`,
          masterText
        );

        // Find first media playlist URL
        const lines = masterText.split('\n');

        for (const line of lines) {
          if (!line.startsWith('#') && line.includes('.m3u8')) {
            mediaPlaylistUrl = new URL(line.trim(), manifestUrl).href;
            break;
          }
        }

        if (!mediaPlaylistUrl) {
          console.log(
            `[${new Date().toISOString()}] [MANIFEST] No media playlist found`
          );
          return [];
        }

        this.mediaPlaylistUrl = mediaPlaylistUrl; // Cache it
      }

      console.log(
        `[${new Date().toISOString()}] [MANIFEST] Found media playlist:`,
        mediaPlaylistUrl
      );

      // Fetch media playlist with credentials to share MediaTailor session cookies
      const mediaResponse = await fetch(mediaPlaylistUrl, {
        credentials: 'include', // Include cookies for MediaTailor session affinity
      });
      const mediaText = await mediaResponse.text();

      // OPTIMIZATION: Skip parsing if playlist hasn't changed
      if (
        this.lastMediaPlaylistText &&
        this.lastMediaPlaylistText === mediaText
      ) {
        return [];
      }
      this.lastMediaPlaylistText = mediaText;

      console.log(
        `[${new Date().toISOString()}] [MANIFEST] Media playlist content:\n`,
        mediaText
      );

      return this.parsePlaylistForAds(mediaText);
    } catch (error) {
      Log.error('[MANIFEST] Error parsing manifest:', error);
      // Reset cache on error to force fresh fetch next time
      this.mediaPlaylistUrl = null;
      this.lastMediaPlaylistText = null;
      return []; // Return empty array, fallback to tracking API
    }
  }

  /**
   * Parses a playlist text for ad markers
   * @param {string} playlistText - The playlist content
   * @returns {Array} Array of ad breaks
   */
  parsePlaylistForAds(playlistText) {
    const adBreaks = [];
    const lines = playlistText.split('\n');
    let currentTime = 0;
    let lineNumber = 0;
    let currentAdBreak = null; // Track ongoing ad break
    let adPods = []; // Track individual ad pods within current ad break
    let currentPodStartTime = null;
    let isInAdBreak = false;
    let lastMapUrl = null;

    console.log(
      `[${new Date().toISOString()}] [MANIFEST] Parsing playlist with ${
        lines.length
      } lines...`
    );

    for (const line of lines) {
      lineNumber++;

      // Detect CUE-OUT tags (ad break start)
      if (line.startsWith('#EXT-X-CUE-OUT')) {
        const durationMatch = line.match(REGEX_CUE_OUT);
        const hasDuration = !!durationMatch;
        const duration = hasDuration ? parseFloat(durationMatch[1]) : null;

        console.log(
          `[${new Date().toISOString()}] [MANIFEST] Line ${lineNumber}: Found CUE-OUT tag: "${line}"`
        );

        isInAdBreak = true;
        adPods = [];
        currentAdBreak = {
          id: `cue-${currentTime}`,
          startTime: currentTime,
          duration: duration,
          endTime: duration ? currentTime + duration : null,
          source: 'manifest-cue',
          confirmedByTracking: false,
          hasFiredStart: false,
          hasFiredQ1: false,
          hasFiredQ2: false,
          hasFiredQ3: false,
          hasFiredEnd: false,
          hasDurationInTag: hasDuration,
          pods: [], // Will contain individual ad pods
        };

        console.log(
          `[${new Date().toISOString()}] [MANIFEST] Ad break started - startTime: ${currentTime}s, duration: ${
            duration !== null ? duration + 's' : 'unknown (waiting for CUE-IN)'
          }`
        );
      }

      // Detect EXT-X-MAP tags (indicates start of new content/ad pod)
      if (isInAdBreak && line.startsWith('#EXT-X-MAP:')) {
        const mapUrlMatch = line.match(REGEX_MAP_URI);
        const mapUrl = mapUrlMatch ? mapUrlMatch[1] : null;

        // Check if this is a new ad pod (different MAP URL than content)
        if (
          mapUrl &&
          mapUrl !== lastMapUrl &&
          mapUrl.includes('mediatailor')
        ) {
          // Close previous pod if exists
          if (currentPodStartTime !== null) {
            const podDuration = currentTime - currentPodStartTime;
            adPods.push({
              startTime: currentPodStartTime,
              duration: podDuration,
              endTime: currentTime,
              mapUrl: lastMapUrl,
            });
            console.log(
              `[${new Date().toISOString()}] [MANIFEST] Ad pod detected - startTime: ${currentPodStartTime}s, duration: ${podDuration}s`
            );
          }

          // Start new pod
          currentPodStartTime = currentTime;
          lastMapUrl = mapUrl;
        }
      }

      // Detect CUE-IN tags (ad break end)
      if (line.startsWith('#EXT-X-CUE-IN')) {
        console.log(
          `[${new Date().toISOString()}] [MANIFEST] Line ${lineNumber}: Found CUE-IN tag: "${line}" at time ${currentTime}s`,
          currentAdBreak ? `(CUE-OUT was at ${currentAdBreak.startTime}s, duration will be ${currentTime - currentAdBreak.startTime}s)` : '(no matching CUE-OUT!)'
        );

        if (currentAdBreak) {
          // Close final ad pod if exists
          if (currentPodStartTime !== null) {
            const podDuration = currentTime - currentPodStartTime;
            adPods.push({
              startTime: currentPodStartTime,
              duration: podDuration,
              endTime: currentTime,
              mapUrl: lastMapUrl,
            });
            console.log(
              `[${new Date().toISOString()}] [MANIFEST] Final ad pod detected - startTime: ${currentPodStartTime}s, duration: ${podDuration}s`
            );
          }

          // Calculate actual ad break duration
          const actualDuration = currentTime - currentAdBreak.startTime;
          if (currentAdBreak.duration === null) {
            console.log(
              `[${new Date().toISOString()}] [MANIFEST] Calculated ad break duration from CUE-IN: ${actualDuration}s`
            );
            currentAdBreak.duration = actualDuration;
            currentAdBreak.endTime = currentTime;
          }

          currentAdBreak.pods = adPods;

          // If we have pods with MediaTailor segments, this is a confirmed real ad
          // Don't wait for tracking API to start firing events
          const hasMediaTailorSegments = adPods.some(
            (pod) => pod.mapUrl && pod.mapUrl.includes('segments.mediatailor')
          );

          if (hasMediaTailorSegments) {
            currentAdBreak.confirmedByTracking = true; // Trust manifest data
            console.log(
              `[${new Date().toISOString()}] [MANIFEST] Ad break has MediaTailor segments - marking as confirmed`
            );
          }

          // NEW: If ad break has non-zero duration, consider it potentially valid
          // (Don't immediately discard - let tracking API or actual playback confirm)
          if (actualDuration > 0.1) {
            console.log(
              `[${new Date().toISOString()}] [MANIFEST] Ad break has non-zero duration (${actualDuration}s), marking as tentatively confirmed`
            );
            currentAdBreak.confirmedByTracking = true; // Trust non-zero duration ads
          }

          console.log(
            `[${new Date().toISOString()}] [MANIFEST] Ad break finalized - startTime: ${
              currentAdBreak.startTime
            }s, duration: ${currentAdBreak.duration}s, podCount: ${
              adPods.length
            }, confirmed: ${currentAdBreak.confirmedByTracking}`
          );

          // Add completed ad break to list (even if not confirmed yet)
          adBreaks.push(currentAdBreak);
          currentAdBreak = null;
          isInAdBreak = false;
          currentPodStartTime = null;
          lastMapUrl = null;
          adPods = [];
        } else {
          console.log(
            `[${new Date().toISOString()}] [MANIFEST] WARNING: CUE-IN without matching CUE-OUT`
          );
        }
      }

      // Track cumulative time via EXTINF
      if (line.startsWith('#EXTINF:')) {
        const segmentDuration = parseFloat(line.split(':')[1]);
        currentTime += segmentDuration;
      }
    }

    // Handle case where CUE-OUT was found but no CUE-IN (shouldn't happen in VOD)
    if (currentAdBreak) {
      console.log(
        `[${new Date().toISOString()}] [MANIFEST] WARNING: Ad break without CUE-IN tag, using default 30s duration`
      );
      currentAdBreak.duration = currentAdBreak.duration || 30;
      currentAdBreak.endTime =
        currentAdBreak.startTime + currentAdBreak.duration;
      currentAdBreak.pods = adPods;
      adBreaks.push(currentAdBreak);
    }

    console.log(
      `[${new Date().toISOString()}] [MANIFEST] Parsing complete. Total ad breaks: ${
        adBreaks.length
      }, Total ad pods: ${adBreaks.reduce((sum, ab) => sum + ab.pods.length, 0)}`
    );
    console.log(
      `[${new Date().toISOString()}] [MANIFEST] Ad breaks:`,
      JSON.stringify(adBreaks, null, 2)
    );
    return adBreaks;
  }

  /**
   * Loads the ad schedule from the tracking URL.
   */
  async loadTracker() {
    try {
      console.log(
        `[${new Date().toISOString()}] Fetching ad schedule from: ${
          this.trackingUrl
        }`
      );
      const trackerResponse = await fetch(
        `${this.trackingUrl}?t=${new Date().getTime()}`
      );
      if (!trackerResponse.ok) {
        throw new Error(
          `Failed to load tracking file: ${trackerResponse.status}`
        );
      }

      const trackerData = await trackerResponse.json();
      console.log(
        `[${new Date().toISOString()}] MediaTailor tracking data received.`,
        trackerData
      );

      if (trackerData.avails && trackerData.avails.length > 0) {
        const trackingAds = trackerData.avails
          .map((avail) => {
            const firstAd =
              avail.ads && avail.ads.length > 0 ? avail.ads[0] : null;
            if (!firstAd) return null;

            return {
              id: avail.availId,
              startTime: firstAd.startTimeInSeconds,
              duration: avail.durationInSeconds,
              endTime: firstAd.startTimeInSeconds + avail.durationInSeconds,
              source: 'tracking-api',
              confirmedByTracking: true, // Tracking API confirms this ad
              hasFiredStart: false,
              hasFiredQ1: false,
              hasFiredQ2: false,
              hasFiredQ3: false,
              hasFiredEnd: false,
            };
          })
          .filter(Boolean);

        // NEW: Merge with existing manifest-based ads
        // OPTIMIZATION: Use Map for O(1) lookup instead of O(N) find()
        const adScheduleMap = new Map();
        this.adSchedule.forEach((ad) => {
          // Key by rounded start time (1s precision)
          const key = Math.round(ad.startTime);
          adScheduleMap.set(key, ad);
        });

        trackingAds.forEach((trackingAd) => {
          // Find matching manifest ad (within 1 second tolerance)
          const key = Math.round(trackingAd.startTime);
          const existingAd = adScheduleMap.get(key);

          if (existingAd) {
            // Update existing ad with accurate tracking data
            console.log(
              `[${new Date().toISOString()}] [MERGE] Updating ad at ${
                existingAd.startTime
              }s with tracking data (was already confirmed: ${existingAd.confirmedByTracking})`
            );
            existingAd.id = trackingAd.id; // Real availId
            // Only update duration if tracking API provides better data
            // Keep manifest duration if it already has pods (more accurate)
            if (!existingAd.pods || existingAd.pods.length === 0) {
              existingAd.duration = trackingAd.duration;
              existingAd.endTime = trackingAd.endTime;
            }
            existingAd.source = 'manifest+tracking'; // Combined source
            existingAd.confirmedByTracking = true; // Ensure confirmed
          } else {
            // Add new ad from tracking that wasn't in manifest
            console.log(
              `[${new Date().toISOString()}] [MERGE] Adding new ad from tracking at ${
                trackingAd.startTime
              }s`
            );
            this.adSchedule.push(trackingAd);
          }
        });

        // Sort by start time
        this.adSchedule.sort((a, b) => a.startTime - b.startTime);

        console.log(
          `[${new Date().toISOString()}] [MERGE] Ad schedule updated with ${
            this.adSchedule.length
          } total ad break(s).`
        );
      } else {
        console.log(
          `[${new Date().toISOString()}] [TRACKING] Ad schedule loaded with 0 ad break(s).`
        );

        // Check if we have unconfirmed manifest ads (without MediaTailor segments)
        const unconfirmedAds = this.adSchedule.filter(
          (ad) => !ad.confirmedByTracking
        );

        if (unconfirmedAds.length > 0) {
          console.log(
            `[${new Date().toISOString()}] [TRACKING] Found ${
              unconfirmedAds.length
            } unconfirmed manifest ad(s) without MediaTailor segments`
          );

          // Only retry for ads without MediaTailor segments (might be placeholder CUE tags)
          if (this.config.retryAttempts > 0) {
            console.log(
              `[${new Date().toISOString()}] [TRACKING] Retrying in ${
                this.config.retryDelay
              }ms... (${this.config.retryAttempts} attempts left)`
            );
            this.config.retryAttempts--;
            setTimeout(() => this.loadTracker(), this.config.retryDelay);
            return; // Return early to avoid starting polling before retries complete
          } else {
            // No more retries, remove unconfirmed ads as they're likely false positives
            console.log(
              `[${new Date().toISOString()}] [TRACKING] Retry attempts exhausted. Removing ${
                unconfirmedAds.length
              } unconfirmed ad(s) (false positives - CUE tags without actual ad content)`
            );
            this.adSchedule = this.adSchedule.filter(
              (ad) => ad.confirmedByTracking
            );
          }
        }
      }

      // NEW: Check if this is a live stream and start polling
      this.checkAndStartLivePolling();
    } catch (error) {
      Log.error('Error loading MediaTailor tracker:', error);
      this.sendError(error);
    }
  }

  /**
   * Starts manifest polling (for both VOD and live)
   */
  startManifestPolling() {
    if (this.manifestPollTimer) {
      console.log(
        `[${new Date().toISOString()}] [POLLING] Manifest polling already active`
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] [POLLING] Polling manifest once for pre-roll ads...`
    );

    // Poll immediately to catch pre-roll ads
    this.pollManifestForNewAds();

    // Poll once more after interval to give MediaTailor time to insert ads
    this.manifestPollTimer = setTimeout(() => {
      console.log(
        `[${new Date().toISOString()}] [POLLING] Retry polling manifest one more time...`
      );
      this.pollManifestForNewAds();
      this.manifestPollTimer = null; // Clear timer after single retry
    }, this.config.manifestPollInterval);
  }

  /**
   * Checks if stream is live and starts polling if needed
   */
  checkAndStartLivePolling() {
    const isLive = this.player.duration() === Infinity;

    // Start manifest polling if not already started
    if (this.config.enableManifestParsing && !this.manifestPollTimer) {
      this.startManifestPolling();
    }

    // Only poll tracking API for live streams (VOD tracking is static)
    if (isLive && !this.trackingPollTimer) {
      console.log(
        `[${new Date().toISOString()}] [POLLING] Live stream detected, starting tracking API polling`
      );
      this.trackingPollTimer = setInterval(() => {
        this.loadTracker();
      }, this.config.trackingPollInterval);
    }

    this.isPolling = true;
  }

  /**
   * Polls manifest for new ads (for both VOD and live)
   */
  async pollManifestForNewAds() {
    try {
      console.log(
        `[${new Date().toISOString()}] [POLLING] Refreshing manifest for ads...`
      );

      // Use session manifest URL if available, otherwise fall back to current src
      const manifestUrl = this.sessionManifestUrl || this.player.currentSrc();
      console.log(
        `[${new Date().toISOString()}] [POLLING] Fetching from URL:`,
        manifestUrl
      );
      console.log(
        `[${new Date().toISOString()}] [POLLING] Player currentSrc:`,
        this.player.currentSrc()
      );

      const newAds = await this.parseManifestForAds(manifestUrl);

      console.log(
        `[${new Date().toISOString()}] [POLLING] Found ${
          newAds.length
        } ads in latest manifest`
      );

      if (newAds.length === 0) return;

      // Merge new ads into existing schedule
      // OPTIMIZATION: Use Map for O(1) lookup
      const adScheduleMap = new Map();
      this.adSchedule.forEach((ad) => {
        const key = Math.round(ad.startTime);
        adScheduleMap.set(key, ad);
      });

      newAds.forEach((newAd) => {
        const key = Math.round(newAd.startTime);
        const exists = adScheduleMap.get(key);

        if (!exists) {
          console.log(
            `[${new Date().toISOString()}] [POLLING] New ad discovered at ${
              newAd.startTime
            }s, duration: ${newAd.duration}s, confirmed: ${
              newAd.confirmedByTracking
            }`,
            newAd
          );
          this.adSchedule.push(newAd);
        } else if (!exists.confirmedByTracking && newAd.confirmedByTracking) {
          // Update existing unconfirmed ad if new one has confirmation
          console.log(
            `[${new Date().toISOString()}] [POLLING] Updating ad at ${
              exists.startTime
            }s - now confirmed with duration ${newAd.duration}s`
          );
          exists.duration = newAd.duration;
          exists.endTime = newAd.endTime;
          exists.pods = newAd.pods;
          exists.confirmedByTracking = true;
        }
      });

      // Sort by start time
      this.adSchedule.sort((a, b) => a.startTime - b.startTime);

      console.log(
        `[${new Date().toISOString()}] [POLLING] Total ads in schedule: ${
          this.adSchedule.length
        }`
      );
    } catch (error) {
      Log.error('[POLLING] Error polling manifest:', error);
    }
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

    this.isPolling = false;
    console.log(`[${new Date().toISOString()}] [POLLING] Stopped all polling`);
  }

  /**
   * Helper to track quartiles for an ad or pod
   * @param {object} adObject - The ad or pod object
   * @param {number} progress - Current progress in seconds
   * @param {string} type - 'pod' or 'ad' for logging
   */
  trackQuartiles(adObject, progress, type = 'ad') {
    const duration = adObject.duration;
    const q1 = duration * 0.25;
    const q2 = duration * 0.5;
    const q3 = duration * 0.75;

    if (progress >= q1 && !adObject.hasFiredQ1) {
      console.log(
        `[${new Date().toISOString()}] MediaTailor: Sending AD_QUARTILE 1 (${type})`
      );
      this.sendAdQuartile({ quartile: 1 });
      adObject.hasFiredQ1 = true;
    }
    if (progress >= q2 && !adObject.hasFiredQ2) {
      console.log(
        `[${new Date().toISOString()}] MediaTailor: Sending AD_QUARTILE 2 (${type})`
      );
      this.sendAdQuartile({ quartile: 2 });
      adObject.hasFiredQ2 = true;
    }
    if (progress >= q3 && !adObject.hasFiredQ3) {
      console.log(
        `[${new Date().toISOString()}] MediaTailor: Sending AD_QUARTILE 3 (${type})`
      );
      this.sendAdQuartile({ quartile: 3 });
      adObject.hasFiredQ3 = true;
    }
  }

  /**
   * Called on 'timeupdate' event. It will check the current time and track ad events.
   */
  onTimeUpdate() {
    // Session should already be initialized from constructor
    if (!this.sessionInitialized) {
      return;
    }

    if (!this.player || !this.adSchedule || !this.adSchedule.length) {
      return;
    }
    const currentTime = this.player.currentTime();

    // OPTIMIZATION: Prune old ads occasionally (every ~5 mins of content)
    // Simple check: if first ad is very old, remove it
    if (
      this.adSchedule.length > 50 &&
      this.adSchedule[0].endTime < currentTime - 300
    ) {
      this.adSchedule.shift(); // Remove oldest
    }

    const activeAdBreak = this.adSchedule.find(
      (ad) =>
        currentTime >= ad.startTime &&
        currentTime < ad.endTime &&
        ad.confirmedByTracking // Only use confirmed ads
    );

    if (activeAdBreak) {
      // --- We are INSIDE an ad break ---

      // Fire AD_BREAK_START only once per ad break
      if (!activeAdBreak.hasFiredStart) {
        this.currentAdBreak = activeAdBreak;
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_BREAK_START`,
          {
            isAd: this.isAd(),
            adBreak: activeAdBreak,
            podCount: activeAdBreak.pods?.length || 0,
          }
        );
        this.sendAdBreakStart();
        activeAdBreak.hasFiredStart = true;
        if (this.player.controlBar && this.player.controlBar.progressControl) {
          this.player.controlBar.progressControl.disable();
        }
      }

      // Check if we have pod information
      if (activeAdBreak.pods && activeAdBreak.pods.length > 0) {
        // Find current active pod
        const activePod = activeAdBreak.pods.find(
          (pod) => currentTime >= pod.startTime && currentTime < pod.endTime
        );

        if (activePod) {
          // Check if we're entering a new pod
          if (!this.currentAdPod || this.currentAdPod !== activePod) {
            // End previous pod if exists
            if (this.currentAdPod) {
              console.log(
                `[${new Date().toISOString()}] MediaTailor: Sending AD_END (pod transition)`,
                {
                  podStartTime: this.currentAdPod.startTime,
                  podDuration: this.currentAdPod.duration,
                }
              );
              this.sendEnd();
            }

            // Start new pod
            this.currentAdPod = activePod;
            console.log(
              `[${new Date().toISOString()}] MediaTailor: Sending AD_START (new pod)`,
              {
                podStartTime: activePod.startTime,
                podDuration: activePod.duration,
              }
            );
            this.sendStart();
            activePod.hasFiredStart = true;
          }

          // Track quartiles for current pod
          const podProgress = currentTime - activePod.startTime;
          this.trackQuartiles(activePod, podProgress, 'pod');
        }
      } else {
        // No pod information, treat entire ad break as single ad (legacy behavior)
        if (!activeAdBreak.hasFiredAdStart) {
          console.log(
            `[${new Date().toISOString()}] MediaTailor: Sending AD_START (no pods)`,
            {
              adBreakStartTime: activeAdBreak.startTime,
              adBreakDuration: activeAdBreak.duration,
            }
          );
          this.sendStart();
          activeAdBreak.hasFiredAdStart = true;
        }

        // Track quartiles for entire ad break
        const adProgress = currentTime - activeAdBreak.startTime;
        this.trackQuartiles(activeAdBreak, adProgress, 'adBreak');
      }
    } else if (this.currentAdBreak) {
      // --- We just EXITED an ad break ---

      // End the last pod if exists
      if (this.currentAdPod) {
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_END (final pod)`,
          {
            podStartTime: this.currentAdPod.startTime,
            podDuration: this.currentAdPod.duration,
          }
        );
        this.sendEnd();
        this.currentAdPod = null;
      }

      // End the ad break
      if (!this.currentAdBreak.hasFiredEnd) {
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_BREAK_END`,
          {
            isAd: this.isAd(),
          }
        );
        this.sendAdBreakEnd();
        this.currentAdBreak.hasFiredEnd = true;
        if (this.player.controlBar && this.player.controlBar.progressControl) {
          this.player.controlBar.progressControl.enable();
        }
      }
      this.currentAdBreak = null;
    }
  }

  /**
   * Register listeners.
   */
  registerListeners() {
    super.registerListeners();
    this.player.on('timeupdate', this.onTimeUpdate.bind(this));
    // Session initialization will happen on first timeupdate
  }

  /**
   * Unregister listeners.
   */
  unregisterListeners() {
    super.unregisterListeners();
    this.player.off('timeupdate', this.onTimeUpdate);
    this.stopLivePolling(); // NEW: Stop polling on cleanup
  }

  /**
   * Cleanup method - called when tracker is destroyed
   */
  dispose() {
    this.stopLivePolling();
    super.dispose && super.dispose();
  }

  /**
   * Returns the ad title
   * @returns {string} Ad title
   */
  getTitle() {
    return this.currentAdBreak ? this.currentAdBreak.id : null;
  }

  /**
   * Returns the ad duration
   * @returns {number} Ad duration in milliseconds
   */
  getDuration() {
    // Return pod duration if we're tracking individual pods
    if (this.currentAdPod) {
      return this.currentAdPod.duration * 1000;
    }
    // Otherwise return ad break duration
    return this.currentAdBreak ? this.currentAdBreak.duration * 1000 : null;
  }

  /**
   * Returns the ad playhead
   * @returns {number} Ad playhead in milliseconds
   */
  getPlayhead() {
    // Return pod playhead if we're tracking individual pods
    if (this.currentAdPod) {
      return (this.player.currentTime() - this.currentAdPod.startTime) * 1000;
    }
    // Otherwise return ad break playhead
    if (this.currentAdBreak) {
      return (this.player.currentTime() - this.currentAdBreak.startTime) * 1000;
    }
    return null;
  }
}
