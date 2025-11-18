/* eslint-disable no-undef */
import nrvideo from '@newrelic/video-core';
import VideojsAdsTracker from './videojs-ads';

const { Log } = nrvideo;

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

  constructor(player) {
    super(player);
    this.setIsAd(true); // Mark this tracker as an ad tracker
    this.adSchedule = []; // Initialize ad schedule
    this.sessionInitialized = false; // Initialize session flag
    this.sessionInitializing = false; // Flag to prevent multiple initialization attempts
    this.currentAdBreak = null; // Initialize current ad break
    this.mediaTailorEndpoint = player.currentSrc(); // Store the MediaTailor endpoint
    this.isInitialLoad = true; // Flag to track if this is the first load
    console.log(
      `[${new Date().toISOString()}] MediaTailorAdsTracker: Constructor called`,
      {
        isAd: this.isAd(),
        currentSrc: player.currentSrc(),
        mediaTailorEndpoint: this.mediaTailorEndpoint,
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
    if (this.sessionInitialized) return;

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

      // Update the player source with the session URL ONLY on initial load
      // This ensures we have the session ID in the URL for ad tracking
      if (this.isInitialLoad) {
        console.log(
          `[${new Date().toISOString()}] MediaTailorAdsTracker: Updating player source with session URL`
        );
        this.isInitialLoad = false; // Prevent future updates
        this.player.src({
          src: manifestUrl,
          type: 'application/x-mpegURL',
        });
      }

      this.sessionInitialized = true;

      // Load the ad schedule after a brief delay to allow MediaTailor to populate the tracking data
      // Using 1 second instead of 6 to catch pre-roll ads before they finish
      setTimeout(() => this.loadTracker(), 2000);
    } catch (error) {
      Log.error('Error initializing MediaTailor session:', error);
      this.sendError(error);
    }
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
        this.adSchedule = trackerData.avails
          .map((avail) => {
            const firstAd =
              avail.ads && avail.ads.length > 0 ? avail.ads[0] : null;
            if (!firstAd) return null;

            return {
              id: avail.availId,
              startTime: firstAd.startTimeInSeconds,
              duration: avail.durationInSeconds,
              endTime: firstAd.startTimeInSeconds + avail.durationInSeconds,
              hasFiredStart: false,
              hasFiredQ1: false,
              hasFiredQ2: false,
              hasFiredQ3: false,
              hasFiredEnd: false,
            };
          })
          .filter(Boolean);

        console.log(
          `[${new Date().toISOString()}] Ad schedule loaded with ${
            this.adSchedule.length
          } ad break(s).`
        );
      } else {
        console.log(
          `[${new Date().toISOString()}] Ad schedule loaded with 0 ad break(s).`
        );
      }
    } catch (error) {
      Log.error('Error loading MediaTailor tracker:', error);
      this.sendError(error);
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
      // console.log('MediaTailorAdsTracker: No ad schedule yet', {
      //   hasPlayer: !!this.player,
      //   adScheduleLength: this.adSchedule?.length || 0
      // });
      return;
    }
    const currentTime = this.player.currentTime();

    const activeAd = this.adSchedule.find(
      (ad) => currentTime >= ad.startTime && currentTime < ad.endTime
    );

    if (activeAd) {
      // --- We are INSIDE an ad break ---
      if (!activeAd.hasFiredStart) {
        this.currentAdBreak = activeAd;
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_BREAK_START and AD_START`,
          {
            isAd: this.isAd(),
            adBreak: activeAd,
          }
        );
        this.sendAdBreakStart();
        this.sendStart(); // sendStart() will send AD_START when isAd() is true
        activeAd.hasFiredStart = true;
        if (this.player.controlBar && this.player.controlBar.progressControl) {
          this.player.controlBar.progressControl.disable();
        }
      }

      const adProgress = currentTime - activeAd.startTime;
      const quartile1 = activeAd.duration * 0.25;
      const quartile2 = activeAd.duration * 0.5;
      const quartile3 = activeAd.duration * 0.75;

      if (adProgress >= quartile1 && !activeAd.hasFiredQ1) {
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_QUARTILE 1`,
          {
            isAd: this.isAd(),
          }
        );
        this.sendAdQuartile({ quartile: 1 });
        activeAd.hasFiredQ1 = true;
      }
      if (adProgress >= quartile2 && !activeAd.hasFiredQ2) {
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_QUARTILE 2`,
          {
            isAd: this.isAd(),
          }
        );
        this.sendAdQuartile({ quartile: 2 });
        activeAd.hasFiredQ2 = true;
      }
      if (adProgress >= quartile3 && !activeAd.hasFiredQ3) {
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_QUARTILE 3`,
          {
            isAd: this.isAd(),
          }
        );
        this.sendAdQuartile({ quartile: 3 });
        activeAd.hasFiredQ3 = true;
      }
    } else if (this.currentAdBreak) {
      // --- We just EXITED an ad break ---
      if (!this.currentAdBreak.hasFiredEnd) {
        console.log(
          `[${new Date().toISOString()}] MediaTailor: Sending AD_END and AD_BREAK_END`,
          {
            isAd: this.isAd(),
          }
        );
        this.sendEnd(); // sendEnd() will send AD_END when isAd() is true
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
   * @returns {number} Ad duration
   */
  getDuration() {
    return this.currentAdBreak ? this.currentAdBreak.duration * 1000 : null;
  }

  /**
   * Returns the ad playhead
   * @returns {number} Ad playhead
   */
  getPlayhead() {
    if (this.currentAdBreak) {
      return (this.player.currentTime() - this.currentAdBreak.startTime) * 1000;
    }
    return null;
  }
}
