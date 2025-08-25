/* global google */
import nrvideo from '@newrelic/video-core';
import VideojsAdsTracker from './videojs-ads';

const daiEvents = {
  // Stream Events
  DAI_STREAM_INITIALIZED: 'dai-stream-initialized',
  DAI_STREAM_LOADED: 'dai-stream-loaded',
  DAI_STREAM_ERROR: 'dai-stream-error',

  // Ad Events
  DAI_AD_BREAK_STARTED: 'dai-ad-break-started',
  DAI_AD_BREAK_ENDED: 'dai-ad-break-ended',
  DAI_AD_PERIOD_STARTED: 'dai-ad-period-started',
  DAI_AD_PERIOD_ENDED: 'dai-ad-period-ended',
  DAI_AD_STARTED: 'dai-ad-started',
  DAI_AD_FIRST_QUARTILE: 'dai-ad-first-quartile',
  DAI_AD_MIDPOINT: 'dai-ad-midpoint',
  DAI_AD_THIRD_QUARTILE: 'dai-ad-third-quartile',
  DAI_AD_COMPLETE: 'dai-ad-complete',
  DAI_AD_SKIPPED: 'dai-ad-skipped',
  DAI_AD_PAUSED: 'dai-ad-paused',
  DAI_AD_RESUMED: 'dai-ad-resumed',
  DAI_AD_CLICKED: 'dai-ad-clicked',
  DAI_AD_ERROR: 'dai-ad-error',

  // Cue Point Events
  DAI_CUEPOINTS_CHANGED: 'dai-cuepoints-changed',

  // Timed Metadata Events
  DAI_TIMED_METADATA: 'dai-timed-metadata',
};

export default class DaiAdsTracker extends VideojsAdsTracker {
  static isUsing(player) {
    // Check for DAI plugin or imaDai method
    return (
      (player.imaDai && typeof player.imaDai === 'function') ||
      (player.dai && typeof player.dai.VERSION !== 'undefined') ||
      (player.ima && player.ima.dai) ||
      player.streamManager
    );
  }

  constructor(player) {
    super(player);
    this.streamManager = null;
    this.currentAdData = null;
    this.adBreakData = null;
    this.streamData = null;
    this.cuePoints = [];
    this.initialized = false;
    this.eventHandlers = null;
  }

  setStreamManager(streamManager) {
    this.streamManager = streamManager;
    this.setupStreamManagerListeners();
    this.initialized = true;
    nrvideo.Log.debug(
      'DaiAdsTracker: StreamManager set and listeners registered'
    );
  }

  setupStreamManagerListeners() {
    if (!this.streamManager || !google?.ima?.dai?.api?.StreamEvent) {
      nrvideo.Log.warn('DaiAdsTracker: StreamManager or DAI API not available');
      return;
    }

    const StreamEvent = google.ima.dai.api.StreamEvent.Type;

    // Create the event handler mapping
    this.eventHandlers = {
      // Stream Events
      [StreamEvent.LOADED]: this.onStreamLoaded.bind(this),
      [StreamEvent.STREAM_INITIALIZED]: this.onStreamInitialized.bind(this),
      [StreamEvent.ERROR]: this.onStreamError.bind(this),

      // Ad Break Events
      [StreamEvent.AD_BREAK_STARTED]: this.onAdBreakStarted.bind(this),
      [StreamEvent.AD_BREAK_ENDED]: this.onAdBreakEnded.bind(this),

      // Ad Period Events
      [StreamEvent.AD_PERIOD_STARTED]: this.onAdPeriodStarted.bind(this),
      [StreamEvent.AD_PERIOD_ENDED]: this.onAdPeriodEnded.bind(this),

      // Individual Ad Events
      [StreamEvent.STARTED]: this.onAdStarted.bind(this),
      [StreamEvent.FIRST_QUARTILE]: this.onAdFirstQuartile.bind(this),
      [StreamEvent.MIDPOINT]: this.onAdMidpoint.bind(this),
      [StreamEvent.THIRD_QUARTILE]: this.onAdThirdQuartile.bind(this),
      [StreamEvent.COMPLETE]: this.onAdComplete.bind(this),
      [StreamEvent.SKIPPED]: this.onAdSkipped.bind(this),
      [StreamEvent.PAUSED]: this.onAdPaused.bind(this),
      [StreamEvent.RESUMED]: this.onAdResumed.bind(this),
      [StreamEvent.CLICK]: this.onAdClicked.bind(this),
      [StreamEvent.VIDEO_CLICKED]: this.onAdClicked.bind(this),

      // Cue Points and Metadata Events
      [StreamEvent.CUEPOINTS_CHANGED]: this.onCuePointsChanged.bind(this),
      [StreamEvent.TIMED_METADATA]: this.onTimedMetadata.bind(this),
    };

    // Register all event listeners using the mapping
    Object.entries(this.eventHandlers).forEach(([eventType, handler]) => {
      this.streamManager.addEventListener(eventType, handler);
    });

    nrvideo.Log.debug('DaiAdsTracker: StreamManager listeners registered');
  }

  registerListeners() {
    // Call parent to register basic videojs-ads events
    super.registerListeners();

    nrvideo.Log.debugCommonVideoEvents(this.player, [
      null,
      Object.values(daiEvents),
    ]);
  }

  unregisterListeners() {
    // Call parent cleanup
    super.unregisterListeners();

    // Clean up StreamManager listeners using the same mapping
    if (this.streamManager && this.eventHandlers) {
      Object.entries(this.eventHandlers).forEach(([eventType, handler]) => {
        this.streamManager.removeEventListener(eventType, handler);
      });
    }

    // Reset state
    this.streamManager = null;
    this.currentAdData = null;
    this.adBreakData = null;
    this.streamData = null;
    this.cuePoints = [];
    this.initialized = false;
    this.eventHandlers = null;
  }

  // Stream Event Handlers
  onStreamLoaded(event) {
    this.streamData = this.extractStreamData(event);
    nrvideo.Log.debug('DaiAdsTracker: Stream loaded', this.streamData);
    this.sendRequest();
  }

  onStreamInitialized(event) {
    nrvideo.Log.debug('DaiAdsTracker: Stream initialized');
    this.sendDownload({ state: 'stream-initialized' });
  }

  onStreamError(event) {
    const errorData = this.extractErrorData(event);
    nrvideo.Log.error('DaiAdsTracker: Stream error', errorData);
    this.sendError(errorData);
  }

  // Ad Break Event Handlers
  onAdBreakStarted(event) {
    this.adBreakData = this.extractAdBreakData(event);
    nrvideo.Log.debug('DaiAdsTracker: Ad break started', this.adBreakData);
    this.sendAdBreakStart(this.adBreakData);
  }

  onAdBreakEnded(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad break ended');
    this.sendAdBreakEnd();
    this.adBreakData = null;
  }

  // Ad Period Event Handlers (for bumpers, etc.)
  onAdPeriodStarted(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad period started');
    // Track as ad break start if no current break
    if (!this.adBreakData) {
      this.onAdBreakStarted(event);
    }
  }

  onAdPeriodEnded(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad period ended');
    // Don't end the break here as there might be more ads
  }

  // Individual Ad Event Handlers
  onAdStarted(event) {
    this.currentAdData = this.extractAdData(event);
    nrvideo.Log.debug('DaiAdsTracker: Ad started', this.currentAdData);
    this.sendStart();
  }

  onAdFirstQuartile(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad first quartile');
    this.sendAdQuartile({ quartile: 1 });
  }

  onAdMidpoint(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad midpoint');
    this.sendAdQuartile({ quartile: 2 });
  }

  onAdThirdQuartile(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad third quartile');
    this.sendAdQuartile({ quartile: 3 });
  }

  onAdComplete(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad complete');
    this.sendEnd();
    this.currentAdData = null;
  }

  onAdSkipped(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad skipped');
    this.sendEnd({ skipped: true });
    this.currentAdData = null;
  }

  onAdPaused(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad paused');
    this.sendPause();
  }

  onAdResumed(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad resumed');
    this.sendResume();
  }

  onAdClicked(event) {
    nrvideo.Log.debug('DaiAdsTracker: Ad clicked');
    this.sendAdClick({ url: this.getClickThroughUrl() });
  }

  // Cue Points Handler
  onCuePointsChanged(event) {
    this.cuePoints = this.extractCuePoints(event);
    nrvideo.Log.debug('DaiAdsTracker: Cue points changed', this.cuePoints);
  }

  // Timed Metadata Handler
  onTimedMetadata(event) {
    const metadata = this.extractTimedMetadata(event);
    nrvideo.Log.debug('DaiAdsTracker: Timed metadata', metadata);
  }

  // Data Extraction Methods
  extractStreamData(event) {
    try {
      const streamData = event.getStreamData();
      return {
        streamId: streamData?.streamId,
        url: streamData?.url,
        adTagParameters: streamData?.adTagParameters,
        streamType: this.getStreamType(),
      };
    } catch (error) {
      nrvideo.Log.warn('DaiAdsTracker: Failed to extract stream data', error);
      return {};
    }
  }

  extractAdBreakData(event) {
    try {
      const adBreakData = event.getAdBreak();
      return {
        adBreakId: adBreakData?.id,
        adBreakTitle: adBreakData?.title,
        adCount: adBreakData?.ads?.length || 0,
        position: this.getAdPosition(),
      };
    } catch (error) {
      nrvideo.Log.warn('DaiAdsTracker: Failed to extract ad break data', error);
      return {};
    }
  }

  extractAdData(event) {
    try {
      const ad = event.getAd();
      return {
        adId: ad?.getAdId(),
        creativeId: ad?.getCreativeId(),
        duration: ad?.getDuration(),
        title: ad?.getTitle(),
        description: ad?.getDescription(),
        advertiserName: ad?.getAdvertiserName(),
        clickThroughUrl: ad?.getClickThroughUrl(),
        dealId: ad?.getDealId(),
        wrapperAdIds: ad?.getWrapperAdIds(),
        position: this.getAdPosition(),
      };
    } catch (error) {
      nrvideo.Log.warn('DaiAdsTracker: Failed to extract ad data', error);
      return {};
    }
  }

  extractErrorData(event) {
    try {
      const error = event.getError();
      return {
        errorCode: error?.getErrorCode(),
        errorMessage: error?.getMessage(),
        innerError: error?.getInnerError(),
      };
    } catch (error) {
      nrvideo.Log.warn('DaiAdsTracker: Failed to extract error data', error);
      return { errorMessage: 'Unknown DAI error' };
    }
  }

  extractCuePoints(event) {
    try {
      return event.getCuepoints() || [];
    } catch (error) {
      nrvideo.Log.warn('DaiAdsTracker: Failed to extract cue points', error);
      return [];
    }
  }

  extractTimedMetadata(event) {
    try {
      return {
        type: event.getType(),
        data: event.getData(),
      };
    } catch (error) {
      nrvideo.Log.warn(
        'DaiAdsTracker: Failed to extract timed metadata',
        error
      );
      return {};
    }
  }

  // Override parent methods for DAI-specific implementations
  getTrackerName() {
    return 'dai-ads';
  }

  getPlayerName() {
    return 'videojs-dai';
  }

  getPlayerVersion() {
    if (this.player.dai?.VERSION) {
      return this.player.dai.VERSION;
    }
    if (this.player.ima?.VERSION) {
      return `ima-dai: ${this.player.ima.VERSION}`;
    }
    return 'unknown';
  }

  getAdCuePoints() {
    return this.cuePoints;
  }

  getAdPosition() {
    if (!this.currentAdData && !this.adBreakData) return null;

    // Try to determine position from current playback time
    const currentTime = this.player.currentTime();
    const duration = this.player.duration();

    if (currentTime < 5) {
      return 'pre';
    } else if (duration && currentTime > duration - 10) {
      return 'post';
    } else {
      return 'mid';
    }
  }

  getDuration() {
    if (this.currentAdData?.duration !== undefined) {
      return this.currentAdData.duration * 1000; // Convert to milliseconds
    }
    return null;
  }

  getVideoId() {
    return this.currentAdData?.adId || null;
  }

  getAdCreativeId() {
    return this.currentAdData?.creativeId || null;
  }

  getTitle() {
    return this.currentAdData?.title || null;
  }

  getSrc() {
    return this.streamData?.url || null;
  }

  getPlayhead() {
    if (this.streamManager) {
      try {
        const streamTime = this.streamManager.getStreamTime();
        return streamTime * 1000; // Convert to milliseconds
      } catch (error) {
        // Fallback to player current time
        return this.player.currentTime() * 1000;
      }
    }
    return this.player.currentTime() * 1000;
  }

  getAdPartner() {
    return 'google-dai';
  }

  getClickThroughUrl() {
    return this.currentAdData?.clickThroughUrl || null;
  }

  getStreamType() {
    // Determine if this is VOD or Live
    if (this.streamData?.streamType) {
      return this.streamData.streamType;
    }
    // Try to infer from player
    const duration = this.player.duration();
    return duration === Infinity ? 'live' : 'vod';
  }

  // Additional helper methods
  isLiveStream() {
    return this.getStreamType() === 'live';
  }

  getCurrentAdBreak() {
    return this.adBreakData;
  }

  getCurrentAd() {
    return this.currentAdData;
  }

  getStreamData() {
    return this.streamData;
  }
}
