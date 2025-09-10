/* global google */
import nrvideo from '@newrelic/video-core';
import VideojsAdsTracker from './videojs-ads';

export default class ImaAdsTracker extends VideojsAdsTracker {
  static isUsing(player) {
    return player.ima && typeof google !== 'undefined';
  }

  getTrackerName() {
    return 'ima-ads';
  }

  getPlayerName() {
    return 'ima';
  }

  getPlayerVersion() {
    return (
      'ima: ' + google.ima.VERSION + '; contrib-ads: ' + this.player.ads.VERSION
    );
  }

  getCuePoints() {
    return this.player.ima.getAdsManager().getCuePoints();
  }

  getAdPosition() {
    if (
      this.lastAdData &&
      this.lastAdData.podInfo &&
      this.lastAdData.podInfo.podIndex !== undefined
    ) {
      const podIndex = this.lastAdData.podInfo.podIndex;

      if (podIndex === 0) {
        return 'pre';
      } else if (podIndex === -1) {
        return 'post';
      } else {
        return 'mid';
      }
    }
    return null;
  }

  getDuration() {
    if (this.lastAdData && this.lastAdData.duration !== undefined) {
      return this.lastAdData.duration * 1000;
    }
    return null;
  }

  getVideoId() {
    if (this.lastAdData && this.lastAdData.adId) {
      return this.lastAdData.adId;
    }
    return null;
  }

  getAdCreativeId() {
    if (this.lastAdData && this.lastAdData.creativeId) {
      return this.lastAdData.creativeId;
    }
    return null;
  }

  getSrc() {
    if (this.lastAdData && this.lastAdData.mediaUrl) {
      return this.lastAdData.mediaUrl;
    }
    return null;
  }

  getTitle() {
    if (this.lastAdData && this.lastAdData.title) {
      return this.lastAdData.title;
    }
    return null;
  }

  getPlayhead() {
    let manager = this.player.ima.getAdsManager();
    if (manager) {
      return (this.getDuration() - manager.getRemainingTime()) * 1000;
    }
  }

  getPlayrate() {
    return this.player.playbackRate();
  }

  getAdPartner() {
    return 'ima';
  }

  getWebkitBitrate() {
    const adVideoElement = this.getAdVideoElement();
    if (adVideoElement && adVideoElement.webkitVideoDecodedByteCount) {
      let bitrate;
      if (this._lastAdWebkitBitrate > 0) {
        const current = adVideoElement.webkitVideoDecodedByteCount;
        const delta = current - this._lastAdWebkitBitrate;
        const seconds = this.getHeartbeat() / 1000;
        bitrate = Math.round((delta / seconds) * 8);
      }
      
      this._lastAdWebkitBitrate = adVideoElement.webkitVideoDecodedByteCount;
      return bitrate || null;
    }
    return null;
  }

  getRenditionBitrate() {
    this.lastAdData = this.getAdData();
    return this.lastAdData?.renditionBitrate;
  }

  registerListeners() {
    // Shortcut events
    let e = google.ima.AdEvent.Type;
    let AD_ERROR = google.ima.AdErrorEvent.Type.AD_ERROR;

    //store ad data
    this.lastAdData = null;
    // debug
    nrvideo.Log.debugCommonVideoEvents(this.player.ima.addEventListener, [
      null,
      e.ALL_ADS_COMPLETED,
      e.LINEAR_CHANGED,
      e.COMPLETE,
      e.USER_CLOSE,
      e.IMPRESSION,
      e.CONTENT_PAUSE_REQUESTED,
      e.CONTENT_RESUME_REQUESTED,
      e.SKIPPED,
      e.SKIPPABLE_STATE_CHANGED,
      e.LOADED,
      e.PAUSED,
      e.RESUMED,
      e.STARTED,
      e.AD_CAN_PLAY,
      e.AD_METADATA,
      e.EXPANDED_CHANGED,
      e.AD_BREAK_READY,
      e.LOG,
      e.CLICK,
      e.FIRST_QUARTILE,
      e.MIDPOINT,
      e.THIRD_QUARTILE,
      AD_ERROR,
    ]);

    // Register listeners
    this.player.ima.addEventListener(e.LOADED, this.onLoaded.bind(this));
    this.player.ima.addEventListener(e.STARTED, this.onStart.bind(this));
    this.player.ima.addEventListener(e.PAUSED, this.onPaused.bind(this));
    this.player.ima.addEventListener(e.RESUMED, this.onResumed.bind(this));
    this.player.ima.addEventListener(e.COMPLETE, this.onComplete.bind(this));
    this.player.ima.addEventListener(e.SKIPPED, this.onSkipped.bind(this));
    this.player.ima.addEventListener(e.CLICK, this.onClick.bind(this));
    this.player.ima.addEventListener(
      e.FIRST_QUARTILE,
      this.onFirstQuartile.bind(this)
    );
    this.player.ima.addEventListener(e.MIDPOINT, this.onMidpoint.bind(this));
    this.player.ima.addEventListener(
      e.THIRD_QUARTILE,
      this.onThirdQuartile.bind(this)
    );
    this.player.ima.addEventListener(AD_ERROR, this.onError.bind(this));
  }

  unregisterListeners() {
    // Shortcut events
    let e = google.ima.AdEvent.Type;
    let AD_ERROR = google.ima.AdErrorEvent.Type.AD_ERROR;

    // unregister listeners
    this.player.ima.removeEventListener(e.LOADED, this.onLoaded);
    this.player.ima.removeEventListener(e.STARTED, this.onLoaded.bind(this));
    this.player.ima.removeEventListener(e.IMPRESSION, this.onImpression);
    this.player.ima.removeEventListener(e.PAUSED, this.onPaused);
    this.player.ima.removeEventListener(e.RESUMED, this.onResumed);
    this.player.ima.removeEventListener(e.COMPLETE, this.onComplete);
    this.player.ima.removeEventListener(e.SKIPPED, this.onSkipped);
    this.player.ima.removeEventListener(e.CLICK, this.onClick);
    this.player.ima.removeEventListener(e.FIRST_QUARTILE, this.onFirstQuartile);
    this.player.ima.removeEventListener(e.MIDPOINT, this.onMidpoint);
    this.player.ima.removeEventListener(e.THIRD_QUARTILE, this.onThirdQuartile);
    this.player.ima.removeEventListener(AD_ERROR, this.onError);
    //clear ad data
    this.lastAdData = null;
  }

  onLoaded(e) {
    this.lastAdData = this.getAdData();
    this.sendRequest();
  }

  onStart(e) {
    this.lastAdData = this.getAdData();
    this._lastAdWebkitBitrate = 0;
    this.sendStart();
  }

  onComplete(e) {
    this.sendEnd();
    this.lastAdData = null; // Clear the data
  }

  onSkipped(e) {
    this.sendEnd({ skipped: true });
    this.lastAdData = null; // Clear the data
  }

  onError(e) {
    const adError = e.getError();

    const errorCode = adError.getErrorCode();
    const errorMessage = adError.getMessage();
    this.sendError({ adError, errorCode, errorMessage });
  }

  onClick(e) {
    this.sendAdClick();
  }

  onFirstQuartile() {
    this.sendAdQuartile({ adQuartile: 1 });
  }

  onMidpoint() {
    this.sendAdQuartile({ adQuartile: 2 });
  }

  onThirdQuartile() {
    this.sendAdQuartile({ adQuartile: 3 });
  }

  onPaused() {
    this.sendPause();
  }

  onResumed() {
    this.sendResume();
  }

  getAdData() {
    try {
      const adsManager = this.player.ima.getAdsManager();
      if (adsManager) {
        const currentAd = adsManager.getCurrentAd();
        if (currentAd) {
          return {
            adId: currentAd.getAdId(),
            creativeId: currentAd.getCreativeId(),
            duration: currentAd.getDuration(),
            mediaUrl: currentAd.getMediaUrl(),
            title: currentAd.getTitle(),
            podInfo: currentAd.getAdPodInfo()?.data,
            renditionBitrate: currentAd.getVastMediaBitrate(),
            // Add other properties as needed
          };
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  getAdVideoElement() {
    if (this.player.ima && this.player.ima.controller && this.player.ima.controller.adUi) {
      const adContainerDiv = this.player.ima.controller.adUi.adContainerDiv;
      if (adContainerDiv) {
        const adVideoElement = adContainerDiv.querySelector('video');
        if (adVideoElement) {
          return adVideoElement;
        }
      }
    }
  }
}
