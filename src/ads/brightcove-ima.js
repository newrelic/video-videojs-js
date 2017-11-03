import * as nrvideo from 'newrelic-video-core'
import VideojsAdsTracker from './videojs-ads'

export default class BrightcoveImaAdsTracker extends VideojsAdsTracker {
  static isUsing (player) {
    return !!player.ima3
  }

  getTrackerName () {
    return 'brightcove-ima-ads'
  }

  getPlayerName () {
    return 'brightcove-ima-ads'
  }

  getPlayhead () {
    return this.player.ima3.adPlayer.currentTime()
  }

  registerListeners () {
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

    this.player.on('ima3-started', this.onStarted.bind(this))
    this.player.on('ima3-paused', this.onPaused.bind(this))
    this.player.on('ima3-resumed', this.onResume.bind(this))
    this.player.on('ima3-complete', this.onComplete.bind(this))
    this.player.on('ima3-skipped', this.onSkipped.bind(this))
    this.player.on('adserror', this.onError.bind(this))
    this.player.on('ads-click', this.onClick.bind(this))
  }

  unregisterListeners () {
    this.player.off('ima3-started', this.onStarted)
    this.player.off('ima3-paused', this.onPaused)
    this.player.off('ima3-resumed', this.onResume)
    this.player.off('ima3-complete', this.onComplete)
    this.player.off('ima3-skipped', this.onSkipped)
    this.player.off('adserror', this.onError)
    this.player.off('ads-click', this.onClick)
  }

  onStarted (e) {
    this.sendRequest()
    this.sendStart()
  }

  onPaused (e) {
    this.sendPause()
  }

  onResume (e) {
    this.sendResume()
  }

  onComplete (e) {
    this.sendEnd()
  }

  onSkipped (e) {
    this.sendEnd({ skipped: true })
  }

  onError (e) {
    this.sendError()
  }

  onClick (e) {
    this.sendClick()
  }
}
