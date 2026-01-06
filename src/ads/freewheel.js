import nrvideo from '@newrelic/video-core'
import VideojsAdsTracker from './videojs-ads'

export default class FreewheelAdsTracker extends VideojsAdsTracker {
  static isUsing (player) {
    return !!player.FreeWheelPlugin && typeof tv !== 'undefined' && !!tv.freewheel
  }

  getTrackerName () {
    return 'freewheel-ads'
  }

  getPlayerName () {
    return 'freewheel-ads'
  }

  getPlayerVersion () {
    return this.player.FreeWheelPlugin.VERSION
  }

  getPlayhead () {
    if (this.player.ads && this.player.ads.ad && this.player.ads.ad.currentTime) {
      return this.player.ads.ad.currentTime() * 1000
    }
  }

  getDuration () {
    if (this.player.ads && this.player.ads.ad && this.player.ads.ad.duration) {
      return this.player.ads.ad.duration * 1000
    }
  }

  getVideoId () {
    return this.player.ads && this.player.ads.ad ? this.player.ads.ad.id : undefined
  }

  getAdPartner () {
    return 'freewheel'
  }

  getAdCreativeId () {
    try {
      return this.player.ads.provider.event.adInstance.getActiveCreativeRendition().getId()
    } catch (err) { /* do nothing */ }
  }

  getSrc () {
    if (this.player.ads && this.player.ads.ad && this.player.ads.ad.creative && this.player.ads.ad.creative.url) {
      return this.player.ads.ad.creative.url
    }
    try {
      let acr = this.player.ads.provider.event.adInstance.getActiveCreativeRendition()
      return acr.getPrimaryCreativeRenditionAsset().getUrl()
    } catch (err) { /* do nothing */ }
  }

  getTitle () {
    if (this.player.ads && this.player.ads.ad && this.player.ads.ad.title) {
      return this.player.ads.ad.title
    }
    try {
      let acr = this.player.ads.provider.event.adInstance.getActiveCreativeRendition()
      return acr.getPrimaryCreativeRenditionAsset().getName()
    } catch (err) { /* do nothing */ }
  }

  getAdPosition () {
    if (this.player.ads && this.player.ads.ad && this.player.ads.ad.type) {
      switch (this.player.ads.ad.type) {
        case 'PREROLL':
          return nrvideo.Constants.AdPositions.PRE
        case 'MIDROLL':
          return nrvideo.Constants.AdPositions.MID
        case 'POSTROLL':
          return nrvideo.Constants.AdPositions.POST
      }
    }
  }

  registerListeners() {
    // Register Freewheel-specific events
    this.player.on('fw-ready', this.onReady.bind(this))
    this.player.on('fw-started', this.onStarted.bind(this))
    this.player.on('fw-complete', this.onComplete.bind(this))
    this.player.on('fw-paused', this.onPaused.bind(this))
    this.player.on('fw-resumed', this.onResumed.bind(this))
    this.player.on('fw-skipped', this.onSkipped.bind(this))
    this.player.on('fw-error', this.onError.bind(this))
    this.player.on('fw-first-quartile', this.onFirstQuartile.bind(this))
    this.player.on('fw-midpoint', this.onMidpoint.bind(this))
    this.player.on('fw-third-quartile', this.onThirdQuartile.bind(this))
  }

  unregisterListeners() {
    // Remove Freewheel-specific events
    this.player.off('fw-ready', this.onReady)
    this.player.off('fw-started', this.onStarted)
    this.player.off('fw-complete', this.onComplete)
    this.player.off('fw-paused', this.onPaused)
    this.player.off('fw-resumed', this.onResumed)
    this.player.off('fw-skipped', this.onSkipped)
    this.player.off('fw-error', this.onError)
    this.player.off('fw-first-quartile', this.onFirstQuartile)
    this.player.off('fw-midpoint', this.onMidpoint)
    this.player.off('fw-third-quartile', this.onThirdQuartile)
  }

  // Event handlers
  onReady() {
    this.sendRequest()
  }

  onStarted() {
    this.sendStart()
  }

  onComplete() {
    this.sendEnd()
  }

  onSkipped() {
    this.sendEnd({ skipped: true })
  }

  onPaused() {
    this.sendPause()
  }

  onResumed() {
    this.sendResume()
  }

  onError(event) {
    this.sendError(event)
  }

  onFirstQuartile() {
    this.sendAdQuartile({ adQuartile: 1 })
  }

  onMidpoint() {
    this.sendAdQuartile({ adQuartile: 2 })
  }

  onThirdQuartile() {
    this.sendAdQuartile({ adQuartile: 3 })
  }
}
