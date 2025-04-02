import * as nrvideo from 'newrelic-video-core';
import pkg from '../package.json';
import ContribHlsTech from './techs/contrib-hls';
import HlsJsTech from './techs/hls-js';
import ShakaTech from './techs/shaka';
import VideojsAdsTracker from './ads/videojs-ads';
import ImaAdsTracker from './ads/ima';
import BrightcoveImaAdsTracker from './ads/brightcove-ima';
import FreewheelAdsTracker from './ads/freewheel';

export default class VideojsTracker extends nrvideo.VideoTracker {
  constructor(player, options) {
    super(player, options);
    this.isContentEnd = false;
    this.imaAdCuePoints = '';
  }

  getTech() {
    let tech = this.player.tech({ IWillNotUseThisInPlugins: true });

    if (tech) {
      if (ContribHlsTech.isUsing(tech)) {
        return new ContribHlsTech(tech);
      } else if (HlsJsTech.isUsing(tech)) {
        return new HlsJsTech(tech);
      } else if (ShakaTech.isUsing(tech)) {
        return new ShakaTech(tech);
      }
    }
  }

  getTrackerName() {
    return 'videojs';
  }

  getInstrumentationProvider() {
    return 'New Relic';
  }

  getInstrumentationName() {
    return this.getPlayerName();
  }

  getInstrumentationVersion() {
    return this.getPlayerVersion();
  }

  getTrackerVersion() {
    return pkg.version;
  }

  getPlayhead() {
    if (
      this.player.ads &&
      this.player.ads.state === 'ads-playback' &&
      this.player.ads.snapshot &&
      this.player.ads.snapshot.currentTime
    ) {
      return this.player.ads.snapshot.currentTime * 1000;
    } else if (this.player.absoluteTime) {
      return this.player.absoluteTime() * 1000;
    } else {
      return this.player.currentTime() * 1000;
    }
  }

  getDuration() {
    if (
      this.player.mediainfo &&
      typeof this.player.mediainfo.duration !== 'undefined'
    ) {
      return this.player.mediainfo.duration * 1000; // Brightcove
    } else {
      return this.player.duration() * 1000;
    }
  }

  getTitle() {
    return this.player?.mediainfo?.name; // Brightcove
  }

  getId() {
    return this.player?.mediainfo?.id; // Brightcove
  }

  getLanguage() {
    return this.player?.language();
  }

  getSrc() {
    let tech = this.getTech();
    if (tech && tech.getSrc) {
      return tech.getSrc();
    } else {
      return this.player.currentSrc();
    }
  }

  getPlayerName() {
    return this.player?.name() || 'videojs';
  }

  getPlayerVersion() {
    return typeof videojs !== 'undefined' && videojs.VERSION;
  }

  isMuted() {
    return this.player.muted();
  }

  getBitrate() {
    let tech = this.getTech();
    return tech?.tech?.stats?.bandwidth;
  }

  getRenditionName() {
    let tech = this.getTech();
    if (tech && tech.getRenditionName) {
      return tech.getRenditionName();
    }
  }

  getRenditionBitrate() {
    let tech = this.getTech();

    if (tech && tech.getRenditionBitrate) {
      return tech.getRenditionBitrate();
    }
  }

  getRenditionHeight() {
    let tech = this.getTech();

    if (tech && tech.getRenditionHeight) {
      return tech.getRenditionHeight();
    }
    return this.player.videoHeight();
  }

  getRenditionWidth() {
    let tech = this.getTech();
    if (tech && tech.getRenditionWidth) {
      return tech.getRenditionWidth();
    }
    return this.player.videoWidth();
  }

  getPlayrate() {
    return this.player.playbackRate();
  }

  isAutoplayed() {
    return this.player.autoplay();
  }

  isFullscreen() {
    return this.player.isFullscreen();
  }

  getPreload() {
    return this.player.preload();
  }

  registerListeners() {
    nrvideo.Log.debugCommonVideoEvents(this.player, [
      'adstart',
      'adend',
      'adskip',
      'adsready',
      'adserror',
      'dispose',
    ]);

    this.player.on('loadstart', this.onDownload.bind(this));
    this.player.on('loadeddata', this.onDownload.bind(this));
    this.player.on('loadedmetadata', this.onDownload.bind(this));
    this.player.on('adsready', this.onAdsready.bind(this));
    this.player.on('adstart', this.onAdStart.bind(this));
    this.player.on('adend', this.onAdEnd.bind(this));
    this.player.on('play', this.onPlay.bind(this));
    this.player.on('pause', this.onPause.bind(this));
    this.player.on('playing', this.onPlaying.bind(this));
    this.player.on('abort', this.onAbort.bind(this));
    this.player.on('ended', this.onEnded.bind(this));
    this.player.on('dispose', this.onDispose.bind(this));
    this.player.on('seeking', this.onSeeking.bind(this));
    this.player.on('seeked', this.onSeeked.bind(this));
    this.player.on('error', this.onError.bind(this));
    this.player.on('waiting', this.onWaiting.bind(this));
    this.player.on('timeupdate', this.onTimeupdate.bind(this));
    this.player.on(
      'ads-allpods-completed',
      this.OnAdsAllpodsCompleted.bind(this)
    );
  }

  unregisterListeners() {
    this.player.off('loadstart', this.onDownload);
    this.player.off('loadeddata', this.onDownload);
    this.player.off('loadedmetadata', this.onDownload);
    this.player.off('adsready', this.onAdsready);
    this.player.off('adstart', this.onAdStart);
    this.player.off('adend', this.onAdEnd);
    this.player.off('play', this.onPlay);
    this.player.off('pause', this.onPause);
    this.player.off('playing', this.onPlaying);
    this.player.off('abort', this.onAbort);
    this.player.off('ended', this.onEnded);
    this.player.off('dispose', this.onDispose);
    this.player.off('seeking', this.onSeeking);
    this.player.off('seeked', this.onSeeked);
    this.player.off('error', this.onError);
    this.player.off('waiting', this.onWaiting);
    this.player.off('timeupdate', this.onTimeupdate);
    this.player.off(
      'ads-allpods-completed',
      this.OnAdsAllpodsCompleted.bind(this)
    );
  }

  onDownload(e) {
    this.sendDownload({ state: e.type });
  }

  onAdsready() {
    if (!this.adsTracker) {
      if (BrightcoveImaAdsTracker.isUsing(this.player)) {
        // BC IMA
        this.setAdsTracker(new BrightcoveImaAdsTracker(this.player));
      } else if (ImaAdsTracker.isUsing(this.player)) {
        // IMA
        this.setAdsTracker(new ImaAdsTracker(this.player));
      } else if (FreewheelAdsTracker.isUsing(this.player)) {
        // FW

        this.setAdsTracker(new FreewheelAdsTracker(this.player));
        // } else if (OnceAdsTracker.isUsing(this)) { // Once
      } else {
        // Generic
        this.setAdsTracker(new VideojsAdsTracker(this.player));
      }
    }
  }

  onAdStart() {
    this.currentAdPlaying = true;

    /* get the array with all the cue points which will be played */
    if (!this.imaAdCuePoints) {
      this.imaAdCuePoints = this.player?.ima?.getAdsManager().getCuePoints();
    }
  }
  onAdEnd() {
    if (this.isContentEnd) {
      this.sendEnd();
    }
  }

  OnAdsAllpodsCompleted() {
    this.onEnded.bind(this);
    this.FreewheelAdsCompleted = true;
  }

  onPlay() {
    this.sendRequest();
  }

  onPause() {
    this.sendPause();
  }

  onPlaying() {
    this.sendResume();
    this.sendBufferEnd();
  }

  onAbort() {
    this.sendEnd();
  }

  onEnded() {
    if (this.adsTracker) {
      this.isContentEnd = true;
      if (this.imaAdCuePoints && !this.imaAdCuePoints.includes(-1)) {
        this.sendEnd();
      }
    } else {
      this.sendEnd();
    }
  }

  onDispose() {
    this.sendEnd();
  }

  onSeeking() {
    this.sendSeekStart();
  }

  onSeeked() {
    this.sendSeekEnd();
  }

  onError() {
    const error = this.player.error();
    const errorCode = error.code;
    const errorName = error.message;
    if (this.player.error && this.player.error()) {
      this.sendError({ errorCode, errorName });
    }
  }

  onWaiting(e) {
    this.sendBufferStart();
  }

  onTimeupdate(e) {
    if (this.getPlayhead() > 0.1) {
      this.sendStart();
    }
  }
}

// Static members
export {
  HlsJsTech,
  ContribHlsTech,
  ShakaTech,
  VideojsAdsTracker,
  ImaAdsTracker,
  BrightcoveImaAdsTracker,
  FreewheelAdsTracker,
};
