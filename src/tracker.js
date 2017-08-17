import * as nrvideo from 'newrelic-video-core'
import {version} from '../package.json'
import ContribHlsTech from './techs/contrib-hls'
import HlsJsTech from './techs/hls-js'
import ShakaTech from './techs/shaka'

export default class VideojsTracker extends nrvideo.Tracker {
  getTech () {
    let tech = this.player.tech({ IWillNotUseThisInPlugins: true })
    if (ContribHlsTech.isUsing(tech)) {
      return new ContribHlsTech(tech)
    } else if (HlsJsTech.isUsing(tech)) {
      return new HlsJsTech(tech)
    } else if (ShakaTech.isUsing(tech)) {
      return new ShakaTech(tech)
    }
  }

  getTrackerName () {
    return 'videojs'
  }

  getTrackerVersion () {
    return version
  }

  getPlayhead () {
    if (
      this.player.ads &&
      this.player.ads.state === 'ads-playback' &&
      this.player.ads.snapshot &&
      this.player.ads.snapshot.currentTime
    ) {
      return this.player.ads.snapshot.currentTime
    } else if (this.player.absoluteTime) {
      return this.player.absoluteTime()
    } else {
      return this.player.currentTime()
    }
  }

  getDuration () {
    if (this.player.mediainfo && typeof this.player.mediainfo.duration !== 'undefined') {
      return this.player.mediainfo.duration // Brightcove
    } else {
      return this.player.duration()
    }
  }

  getTitle () {
    if (this.player.mediainfo) {
      return this.player.mediainfo.name // Brightcove
    }
  }

  getSrc () {
    let tech = this.getTech()
    if (tech && tech.getSrc) {
      return tech.getSrc()
    } else {
      return this.player.currentSrc()
    }
  }

  getPlayerVersion () {
    return videojs.VERSION
  }

  isMuted () {
    return this.player.muted()
  }

  getRenditionName () {
    let tech = this.getTech()
    if (tech && tech.getRenditionName) {
      return tech.getRenditionName()
    }
  }

  getRenditionBitrate () {
    let tech = this.getTech()
    if (tech && tech.getRenditionBitrate) {
      return tech.getRenditionBitrate()
    }
  }

  getRenditionHeight () {
    let tech = this.getTech()
    if (tech && tech.getRenditionHeight) {
      return tech.getRenditionHeight()
    }
  }

  getRenditionWidth () {
    let tech = this.getTech()
    if (tech && tech.getRenditionWidth) {
      return tech.getRenditionWidth()
    }
  }

  getPlayrate () {
    return this.player.playbackRate()
  }

  isAutoplayed () {
    return this.player.autoplay()
  }

  registerListeners () {
    nrvideo.Log.debugCommonVideoEvents(this.player, [
      'adstart', 'adend', 'adskip', 'adsready', 'adserror', 'dispose'
    ])

    this.player.on('loadstart', this.onDownload.bind(this))
    this.player.on('loadeddata', this.onDownload.bind(this))
    this.player.on('loadedmetadata', this.onDownload.bind(this))
    this.player.on('adsready', this.onAdsready.bind(this))
    this.player.on('play', this.onPlay.bind(this))
    this.player.on('timeupdate', this.onTimeupdate.bind(this))
    this.player.on('pause', this.onPause.bind(this))
    this.player.on('playing', this.onPlaying.bind(this))
    this.player.on('abort', this.onAbort.bind(this))
    this.player.on('ended', this.onEnded.bind(this))
    this.player.on('dispose', this.onDispose.bind(this))
    this.player.on('seeking', this.onSeeking.bind(this))
    this.player.on('seeked', this.onSeeked.bind(this))
    this.player.on('error', this.onError.bind(this))
  }

  unregisterListeners () {
    this.player.off('loadstart', this.onDownload)
    this.player.off('loadeddata', this.onDownload)
    this.player.off('loadedmetadata', this.onDownload)
    this.player.off('adsready', this.onAdsready)
    this.player.off('play', this.onPlay)
    this.player.off('timeupdate', this.onTimeupdate)
    this.player.off('pause', this.onPause)
    this.player.off('playing', this.onPlaying)
    this.player.off('abort', this.onAbort)
    this.player.off('ended', this.onEnded)
    this.player.off('dispose', this.onDispose)
    this.player.off('seeking', this.onSeeking)
    this.player.off('seeked', this.onSeeked)
    this.player.off('error', this.onError)
  }

  onLoadstart (e) {
    this.sendDownload({ state: e.type })
  }

  onAdsready () {}

  onPlay () {
    this.sendRequest()
  }

  onPause () {
    this.sendPause()
  }

  onPlaying () {
    this.sendStart()
  }

  onAbort () {
    this.sendEnd()
  }

  onEnded () {
    this.sendEnd()
  }

  onDispose () {
    this.sendEnd()
  }

  onSeeking () {
    this.sendSeekStart()
  }

  onSeeked () {
    this.sendSeekEnd()
  }

  onError () {
    if (this.player.error && this.player.error()) {
      this.sendError(this.player.error())
    }
  }
}

// Static members
VideojsTracker.HlsJsTech = HlsJsTech
VideojsTracker.ContribHlsTech = ContribHlsTech
VideojsTracker.ShakaTech = ShakaTech
