/* global google */
import * as nrvideo from 'newrelic-video-core';
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
    const podInfoData = this.player.ima
      ?.getAdsManager()
      ?.getCurrentAd()
      ?.getAdPodInfo()?.data?.podIndex;

    if (podInfoData === 0) {
      return 'pre';
    } else if (podInfoData === -1) {
      return 'post';
    } else {
      return 'mid';
    }
  }

  getDuration() {
    try {
      return (
        this.player.ima.getAdsManager().getCurrentAd().getDuration() * 1000
      );
    } catch (err) {
      /* do nothing */
    }
  }

  getVideoId() {
    try {
      return this.player.ima.getAdsManager().getCurrentAd().getAdId();
    } catch (err) {
      /* do nothing */
    }
  }

  getAdCreativeId() {
    try {
      return this.player.ima.getAdsManager().getCurrentAd().getCreativeId();
    } catch (err) {
      /* do nothing */
    }
  }

  getSrc() {
    try {
      return this.player.ima.getAdsManager().getCurrentAd().getMediaUrl();
    } catch (err) {
      /* do nothing */
    }
  }

  getTitle() {
    try {
      return this.player.ima.getAdsManager().getCurrentAd().getTitle();
    } catch (err) {
      /* do nothing */
    }
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

  registerListeners() {
    // Shortcut events
    let e = google.ima.AdEvent.Type;
    let AD_ERROR = google.ima.AdErrorEvent.Type.AD_ERROR;

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
  }

  onLoaded(e) {
    this.sendRequest();
  }

  onStart(e) {
    this.sendStart();
  }

  onComplete(e) {
    this.sendEnd();
  }

  onSkipped(e) {
    this.sendEnd({ skipped: true });
  }

  onError(e) {
    const adError = e.getError();

    // Optional: Extract detailed error information
    const errorCode = adError.getErrorCode();
    const errorName = adError.getMessage();
    this.sendError({ adError, errorCode, errorName });
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
}
