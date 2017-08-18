import * as nrvideo from 'newrelic-video-core'
import VideojsAdsTracker from './videojs-ads'

export default class ImaAdsTracker extends VideojsAdsTracker {
  static isUsing (player) {
    return !!player.ima3
  }

  getTrackerName () {
    return 'brightcove-ads'
  }

  getPlayhead () {
    return this.player.ima3.adPlayer.currentTime()
  }

  registerListeners () {
    // Console all events if logLevel=DEBUG
    nrvideo.Log.debugCommonVideoEvents(this.player, [
      null,
      'ima3-ready',
      'ima3error',
      'ima3-ad-error',
      'ima3-started',
      'ima3-complete',
      'ima3-paused',
      'ima3-resumed',
      'ads-request',
      'ads-load',
      'ads-ad-started',
      'ads-ad-ended',
      'ads-pause',
      'ads-play',
      'ads-click',
      'ads-pod-started',
      'ads-pod-ended',
      'ads-allpods-completed'
    ])

    // Enable playhead monitor
    this.monitorPlayhead(true, false)

    // Register listeners
    this.player.on('ima3-started', this.imaStartedListener.bind(this))
    this.player.on('ima3-paused', this.imaPausedListener.bind(this))
    this.player.on('ima3-resumed', this.imaResumedListener.bind(this))
    this.player.on('ima3-complete', this.imaCompleteListener.bind(this))
    this.player.on('ima3-skipped', this.imaSkippedListener.bind(this))
    this.player.on('adserror', this.errorListener.bind(this))
    this.player.on('ads-click', this.clickListener.bind(this))
  }

  imaStartedListener (e) {
    this.sendRequest()
    this.sendStart()
  }

  imaPausedListener (e) {
    this.sendPause()
  }

  imaResumedListener (e) {
    this.sendResume()
  }

  imaCompleteListener (e) {
    this.sendEnd()
  }

  imaSkippedListener (e) {
    this.sendEnd({ skipped: true })
  }

  errorListener (e) {
    this.sendError()
  }

  clickListener (e) {
    this.sendClick()
  }

  unregisterListeners () {
    // unregister listeners
    this.player.off('ima3-started', this.imaStartedListener)
    this.player.off('ima3-paused', this.imaPausedListener)
    this.player.off('ima3-resumed', this.imaResumedListener)
    this.player.off('ima3-complete', this.imaCompleteListener)
    this.player.off('ima3-skipped', this.imaSkippedListener)
    this.player.off('adserror', this.errorListener)
    this.player.off('ads-click', this.clickListener)
  }
}
