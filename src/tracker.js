import nrvideo from '@newrelic/video-core';
import pkg from '../package.json';
import ContribHlsTech from './techs/contrib-hls';
import HlsJsTech from './techs/hls-js';
import ShakaTech from './techs/shaka';
import VideojsAdsTracker from './ads/videojs-ads';
import ImaAdsTracker from './ads/ima';
import BrightcoveImaAdsTracker from './ads/brightcove-ima';
import FreewheelAdsTracker from './ads/freewheel';
import DaiAdsTracker from './ads/dai';
import MediaTailorAdsTracker from './ads/media-tailor';

/**
 * Explicit ad tracking modes. Pass via config.ad.type.
 *
 * CSAI (Client-Side Ad Insertion)
 *   All CSAI frameworks share the adsready event path. The tracker auto-detects
 *   the right framework (Brightcove IMA → IMA → Freewheel → generic) — no sub-type needed.
 *
 * SSAI (Server-Side Ad Insertion) — sub-type is always required.
 *   Each SSAI platform has its own SDK and a different activation path.
 *   Cannot be auto-detected — declare which one you are using.
 *   SSAI.DAI — Google DAI (google.ima.dai.api)
 *   SSAI.MT  — AWS MediaTailor
 *
 * If config.ad is not set, no ad tracking runs (safe default).
 * To add a new SSAI platform: add a key to SSAI — validation derives from this object.
 */
export const AD_TRACKING = {
  CSAI: 'csai',
  SSAI: Object.freeze({
    DAI: 'ssai:dai',
    MT:  'ssai:mt',
  }),
};

export default class VideojsTracker extends nrvideo.VideoTracker {
  constructor(player, options) {
    super(player, options);
    this.options = options;
    this.isContentEnd = false;
    this.imaAdCuePoints = '';
    this.daiInitialized = false;
    this.adTracking = options?.config?.ad?.type || null;

    // When options are provided but config.ad is not declared, no ad tracking
    // will run. Warn so the caller knows to set it explicitly.
    if (options && !this.adTracking) {
      nrvideo.Log.warn(
        'VideojsTracker: config.ad not set — no ad tracking will run. ' +
        'Set config.ad.type to enable it (e.g. AD_TRACKING.CSAI, AD_TRACKING.SSAI.MT).'
      );
    }

    // Merge config.ad options (segmentPrefix, trackingUrl) into the internal
    // mediatailor object that MediaTailorAdsTracker reads.
    if (this.adTracking === AD_TRACKING.SSAI.MT) {
      const adConfig = options?.config?.ad || {};
      this.options = Object.assign({}, this.options, {
        mediatailor: {
          segmentPrefix: adConfig.segmentPrefix,
          trackingUrl:   adConfig.trackingUrl,
          ...this.options?.mediatailor,
        },
      });
    }

    nrvideo.Core.addTracker(this, options);
  }

  /**
   * Sets the ad tracking mode at runtime.
   * Must be called before the first loadstart / adsready event to take effect.
   * @param {'csai'|'ssai:dai'|'ssai:mt'} type
   */
  setAdTracking(type) {
    const valid = [
      AD_TRACKING.CSAI,
      ...Object.values(AD_TRACKING.SSAI),
    ];
    if (!valid.includes(type)) {
      nrvideo.Log.warn(
        `VideojsTracker.setAdTracking: unknown value "${type}". Valid values: ${valid.join(', ')}`
      );
      return;
    }
    this.adTracking = type;
    nrvideo.Log.debug(`VideojsTracker: adTracking set to "${type}"`);
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
    return this.player?.version || videojs.VERSION;
  }

  isMuted() {
    return this.player.muted();
  }

  getBitrate() {
    return this.getContentBitratePlayback();
  }

  // Measures: Actual content consumption rate during playback
  getContentBitratePlayback() {
    try {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });

      // 1. Get the current active rendition (The most accurate "Playback Bitrate")
      if (tech?.vhs?.playlists?.media()) {
        const activePlaylist = tech.vhs.playlists.media();
        // Use AVERAGE-BANDWIDTH if available, fallback to BANDWIDTH
        const bitrate =
          activePlaylist.attributes['AVERAGE-BANDWIDTH'] ||
          activePlaylist.attributes.BANDWIDTH ||
          null;
        return bitrate !== null ? Math.round(bitrate) : null;
      }

      // 2. Fallback to tech wrappers (Shaka/Hls.js) if they have a getBitrate method
      const techWrapper = this.getTech();
      if (techWrapper?.getBitrate) {
        const bitrate = techWrapper.getBitrate();
        return bitrate !== null ? Math.round(bitrate) : null;
      }
    } catch (err) {
      /* ignore */
    }
    return null;
  }

  // getRenditionName() {
  //   let tech = this.getTech();
  //   if (tech && tech.getRenditionName) {
  //     return tech.getRenditionName();
  //   }
  // }

  getManifestBitrate() {
    try {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
      // tech.vhs.playlists.master.playlists contains the array of all renditions
      const allRenditions = tech?.vhs?.playlists?.master?.playlists;

      if (allRenditions && allRenditions.length > 0) {
        // Find the highest BANDWIDTH value in the list
        const maxBitrate = Math.max(
          ...allRenditions.map((p) => p.attributes.BANDWIDTH || 0),
        );
        return maxBitrate > 0 ? Math.round(maxBitrate) : null;
      }

      // Fallback to tech wrappers (Shaka/Hls.js)
      const techWrapper = this.getTech();
      if (techWrapper?.getManifestBitrate) {
        const bitrate = techWrapper.getManifestBitrate();
        return bitrate !== null ? Math.round(bitrate) : null;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  getSegmentDownloadBitrate() {
    try {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });

      // VHS stats.bandwidth
      if (tech?.vhs?.stats?.bandwidth && tech.vhs.stats.bandwidth > 0) {
        return Math.round(tech.vhs.stats.bandwidth);
      }

      // Fallback to tech wrappers (Shaka/Hls.js)
      const techWrapper = this.getTech();
      if (techWrapper?.getSegmentDownloadBitrate) {
        const bitrate = techWrapper.getSegmentDownloadBitrate();
        return bitrate !== null ? Math.round(bitrate) : null;
      }
    } catch (err) {
      /* ignore */
    }
    return null;
  }

  getNetworkDownloadBitrate() {
    const tech = this.player.tech({ IWillNotUseThisInPlugins: true });

    if (tech?.vhs?.throughput && tech.vhs.throughput > 0) {
      return Math.round(tech.vhs.throughput);
    }

    // Fallback to tech wrapper implementation
    const techWrapper = this.getTech();
    if (techWrapper?.getNetworkDownloadBitrate) {
      const bitrate = techWrapper.getNetworkDownloadBitrate();
      return bitrate !== null ? Math.round(bitrate) : null;
    }

    return null;
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

    // BIND LISTENER METHODS
    this.onDownload = this.onDownload.bind(this);
    this.onAdsready = this.onAdsready.bind(this);
    this.onAdStart = this.onAdStart.bind(this);
    this.onAdEnd = this.onAdEnd.bind(this);
    this.onPlay = this.onPlay.bind(this);
    this.onPause = this.onPause.bind(this);
    this.onPlaying = this.onPlaying.bind(this);
    this.onAbort = this.onAbort.bind(this);
    this.onEnded = this.onEnded.bind(this);
    this.onDispose = this.onDispose.bind(this);
    this.onSeeking = this.onSeeking.bind(this);
    this.onSeeked = this.onSeeked.bind(this);
    this.onError = this.onError.bind(this);
    this.onWaiting = this.onWaiting.bind(this);
    this.onTimeupdate = this.onTimeupdate.bind(this);
    this.OnAdsAllpodsCompleted = this.OnAdsAllpodsCompleted.bind(this);
    this.onStreamManager = this.onStreamManager.bind(this);
    this.onCanPlayThrough = this.onCanPlayThrough.bind(this);

    this.player.on('loadstart', this.onDownload);
    this.player.on('loadeddata', this.onDownload);
    this.player.on('loadedmetadata', this.onDownload);
    this.player.on('adsready', this.onAdsready);
    this.player.on('adstart', this.onAdStart);
    this.player.on('adend', this.onAdEnd);
    this.player.on('play', this.onPlay);
    this.player.on('pause', this.onPause);
    this.player.on('playing', this.onPlaying);
    this.player.on('abort', this.onAbort);
    this.player.on('ended', this.onEnded);
    this.player.on('dispose', this.onDispose);
    this.player.on('seeking', this.onSeeking);
    this.player.on('seeked', this.onSeeked);
    this.player.on('error', this.onError);
    this.player.on('waiting', this.onWaiting);
    this.player.on('timeupdate', this.onTimeupdate);
    this.player.on('ads-allpods-completed', this.OnAdsAllpodsCompleted);
    this.player.on('stream-manager', this.onStreamManager);
    this.player.on('canplaythrough', this.onCanPlayThrough);
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
    this.player.off('ads-allpods-completed', this.OnAdsAllpodsCompleted);
    this.player.off('stream-manager', this.onStreamManager);
    this.player.off('canplaythrough', this.onCanPlayThrough);
  }

  onDownload(e) {
    this.sendDownload({ state: e.type });

    if (
      this.adTracking === AD_TRACKING.SSAI.MT &&
      !this.adsTracker &&
      e.type === 'loadstart'
    ) {
      nrvideo.Log.debug('VideojsTracker: Creating MediaTailorAdsTracker');
      this.setAdsTracker(new MediaTailorAdsTracker(this.player, this.options));
      // MediaTailor SSAI starts with content, not ads (unlike client-side frameworks)
      this.adsTracker.setIsAd(false);
    }
  }

  // DAI methods
  onStreamManager(event) {
    if (
      this.adTracking === AD_TRACKING.SSAI.DAI &&
      !this.adsTracker &&
      event.StreamManager
    ) {
      const daiTracker = new DaiAdsTracker(this.player);
      daiTracker.setStreamManager(event.StreamManager);
      this.setAdsTracker(daiTracker);
    }
  }
  // DAI methods end

  onAdsready() {
    // SSAI platforms never fire adsready — skip when an SSAI type is explicitly set.
    if (Object.values(AD_TRACKING.SSAI).includes(this.adTracking)) return;

    // config.ad.type is not set — warn and fall back to auto-detection.
    if (!this.adTracking) {
      nrvideo.Log.warn(
        'VideojsTracker: adsready fired but config.ad.type is not set — ' +
        'attempting CSAI auto-detection for backward compatibility.'
      );
    }

    if (!this.adsTracker) {
      if (BrightcoveImaAdsTracker.isUsing(this.player)) {
        nrvideo.Log.debug('VideojsTracker: auto-detected BrightcoveImaAdsTracker');
        this.setAdsTracker(new BrightcoveImaAdsTracker(this.player));
      } else if (ImaAdsTracker.isUsing(this.player)) {
        nrvideo.Log.debug('VideojsTracker: auto-detected ImaAdsTracker');
        this.setAdsTracker(new ImaAdsTracker(this.player));
      } else if (FreewheelAdsTracker.isUsing(this.player)) {
        nrvideo.Log.debug('VideojsTracker: auto-detected FreewheelAdsTracker');
        this.setAdsTracker(new FreewheelAdsTracker(this.player));
      } else {
        nrvideo.Log.debug('VideojsTracker: no specific CSAI framework detected, using generic VideojsAdsTracker');
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

  /**
   * Check if ads tracker is currently in ad mode
   * @returns {boolean} True if ads are playing
   */
  isAdsTrackerActive() {
    // For CSAI: videojs-contrib-ads manages ad state exclusively
    if (this.player.ads) {
      return this.player.ads.state === 'ads-playback';
    }
    // For SSAI (no player.ads): check tracker's isAd flag (manually toggled)
    return this.adsTracker && this.adsTracker.isAd && this.adsTracker.isAd();
  }

  onPlay() {
    this.sendRequest();
  }

  onPause() {
    // Don't send CONTENT_PAUSE if ads are playing (ads tracker handles it)
    if (this.isAdsTrackerActive()) {
      return;
    }
    // Don't send CONTENT_PAUSE if video has ended (CONTENT_END will be sent instead)
    if (this.player.ended()) {
      return;
    }
    this.sendPause();
  }

  onCanPlayThrough() {
    // Don't send CONTENT_BUFFER_END if ads are playing (ads tracker handles it)
    if (this.isAdsTrackerActive()) {
      return;
    }
    // Send BUFFER_END when buffer fills, even if paused
    // This ensures accurate buffer duration metrics when user pauses during buffering
    this.sendBufferEnd();
  }

  onPlaying() {
    // Don't send CONTENT_RESUME if ads are playing (ads tracker handles it)
    if (this.isAdsTrackerActive()) {
      return;
    }
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
    // Don't send CONTENT_SEEK_START if ads are playing (ads tracker handles it)
    if (this.isAdsTrackerActive()) {
      return;
    }
    this.sendSeekStart();
  }

  onSeeked() {
    // Don't send CONTENT_SEEK_END if ads are playing (ads tracker handles it)
    if (this.isAdsTrackerActive()) {
      return;
    }
    this.sendSeekEnd();
  }

  onError() {
    const error = this.player.error();

    const errorCode = error.code;
    const errorMessage = error.message;
    if (this.player.error && this.player.error()) {
      this.sendError({ errorCode, errorMessage });
    }
  }

  onWaiting(e) {
    // Don't send CONTENT_BUFFER_START if ads are playing (ads tracker handles it)
    if (this.isAdsTrackerActive()) {
      return;
    }
    this.sendBufferStart();
  }

  onTimeupdate(e) {
    if (this.getPlayhead() > 0.1) {
      this.sendStart();
    }
  }
}

// Attach AD_TRACKING and Log as static properties so UMD callers can use
// VideojsTracker.AD_TRACKING and VideojsTracker.Log without importing named exports.
VideojsTracker.AD_TRACKING = AD_TRACKING;
VideojsTracker.Log = nrvideo.Log;

// Static members
export {
  HlsJsTech,
  ContribHlsTech,
  ShakaTech,
  VideojsAdsTracker,
  ImaAdsTracker,
  BrightcoveImaAdsTracker,
  FreewheelAdsTracker,
  DaiAdsTracker,
  MediaTailorAdsTracker,
};
