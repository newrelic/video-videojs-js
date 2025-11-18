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

export default class VideojsTracker extends nrvideo.VideoTracker {
  constructor(player, options) {
    super(player, options);
    this.isContentEnd = false;
    this.imaAdCuePoints = '';
    this.daiInitialized = false;
    nrvideo.Core.addTracker(this, options);
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
    let videoBitrate = 0;
    let audioBitrate = 0;
    let totalBitrate = 0;

    if (this.player) {
      const tech = this.player.tech({ IWillNotUseThisInPlugins: true });

      if (tech) {
        let playlists, currentMedia;

        // Method 1: Try VHS (Video HTTP Streaming) - most common for HLS/DASH
        if (tech.vhs && tech.vhs.playlists && tech.vhs.playlists.media) {
          playlists = tech.vhs.playlists;
          currentMedia = tech.vhs.playlists.media();
        } else if (tech.hls && tech.hls.playlists && tech.hls.playlists.media) {
          playlists = tech.hls.playlists;
          currentMedia = tech.hls.playlists.media();
        }

        if (currentMedia && currentMedia.attributes) {
          if (currentMedia.attributes.BANDWIDTH) {
            videoBitrate = currentMedia.attributes.BANDWIDTH;
          }

          // Get audio bitrate if available
          const audioTracks = this.player.audioTracks();
          let activeAudioTrack;

          if (audioTracks && audioTracks.length > 0) {
            for (let i = 0; i < audioTracks.length; i++) {
              if (audioTracks[i].enabled) {
                activeAudioTrack = audioTracks[i];
                break;
              }
            }
          }

          if (activeAudioTrack && currentMedia.attributes.AUDIO) {
            let masterPlaylist;
            if (playlists) {
              masterPlaylist = playlists.master || playlists.main;
            }

            if (
              masterPlaylist &&
              masterPlaylist.mediaGroups &&
              masterPlaylist.mediaGroups.AUDIO
            ) {
              const audioGroup =
                masterPlaylist.mediaGroups.AUDIO[currentMedia.attributes.AUDIO];
              const audioMediaInfo =
                audioGroup && audioGroup[activeAudioTrack.id];

              if (
                audioMediaInfo &&
                audioMediaInfo.playlists &&
                audioMediaInfo.playlists[0]
              ) {
                const audioPlaylist = audioMediaInfo.playlists[0].attributes;
                if (audioPlaylist && audioPlaylist.BANDWIDTH) {
                  audioBitrate = audioPlaylist.BANDWIDTH;
                }
              }
            }
          }

          totalBitrate = videoBitrate + audioBitrate;

          return totalBitrate; // Return in bps
        }

        // Method 2: Try Shaka Player
        const shakaPlayer =
          tech.shakaPlayer_ || tech.shaka_ || tech.shakaPlayer;
        if (shakaPlayer && typeof shakaPlayer.getStats === 'function') {
          const stats = shakaPlayer.getStats();
          if (stats && stats.streamBandwidth) {
            return stats.streamBandwidth;
          }
        }

        // Method 3: Try HLS.js
        const hlsJs = tech.hls_;
        if (hlsJs && hlsJs.levels && hlsJs.currentLevel >= 0) {
          const currentLevel = hlsJs.levels[hlsJs.currentLevel];
          if (currentLevel && currentLevel.bitrate) {
            return currentLevel.bitrate;
          }
        }
      }

      // Method 4: Try DASH.js
      let dashPlayer;
      if (this.player.mediaPlayer) {
        dashPlayer = this.player.mediaPlayer;
      } else if (this.player.dash && this.player.dash.mediaPlayer) {
        dashPlayer = this.player.dash.mediaPlayer;
      }

      if (
        dashPlayer &&
        typeof dashPlayer.getQualityFor === 'function' &&
        typeof dashPlayer.getBitrateInfoListFor === 'function'
      ) {
        // Get audio bitrate
        const audioQuality = dashPlayer.getQualityFor('audio');
        const audioBitrateList = dashPlayer.getBitrateInfoListFor('audio');
        if (
          audioQuality !== undefined &&
          audioBitrateList &&
          audioBitrateList[audioQuality] &&
          audioBitrateList[audioQuality].bitrate
        ) {
          audioBitrate = audioBitrateList[audioQuality].bitrate;
        }

        // Get video bitrate
        const videoQuality = dashPlayer.getQualityFor('video');
        const videoBitrateList = dashPlayer.getBitrateInfoListFor('video');
        if (
          videoQuality !== undefined &&
          videoBitrateList &&
          videoBitrateList[videoQuality] &&
          videoBitrateList[videoQuality].bitrate
        ) {
          videoBitrate = videoBitrateList[videoQuality].bitrate;
        } else {
          videoBitrate = videoBitrate || 0;
        }

        totalBitrate = audioBitrate + videoBitrate;
        return totalBitrate;
      }
    }

    // Fallback: Try tech-specific implementations from your wrappers
    const techWrapper = this.getTech();
    if (techWrapper) {
      if (
        techWrapper.getBitrate &&
        typeof techWrapper.getBitrate === 'function'
      ) {
        return techWrapper.getBitrate();
      }

      if (
        techWrapper.tech &&
        techWrapper.tech.stats &&
        techWrapper.tech.stats.bandwidth
      ) {
        return techWrapper.tech.stats.bandwidth;
      }
    }

    return null;
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
  }

  onDownload(e) {
    this.sendDownload({ state: e.type });

    // Check if MediaTailor should be used after the source is loaded
    // Only check on 'loadstart' to avoid multiple checks
    if (
      !this.adsTracker &&
      e.type === 'loadstart' &&
      MediaTailorAdsTracker.isUsing(this.player)
    ) {
      console.log(
        'VideojsTracker: Creating MediaTailorAdsTracker after source load'
      );
      this.setAdsTracker(new MediaTailorAdsTracker(this.player));
    }
  }

  // DAI methods
  onStreamManager(event) {
    if (!this.adsTracker && event.StreamManager) {
      const daiTracker = new DaiAdsTracker(this.player);
      daiTracker.setStreamManager(event.StreamManager);
      this.setAdsTracker(daiTracker);
    }
  }
  // DAI methods end

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
    const errorMessage = error.message;
    if (this.player.error && this.player.error()) {
      this.sendError({ errorCode, errorMessage });
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
  MediaTailorAdsTracker,
};
