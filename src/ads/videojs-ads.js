import * as nrvideo from 'newrelic-video-core'
import { version } from '../../package.json'

export default class VideojsAdsTracker extends nrvideo.VideoTracker {
  getTrackerName () {
    return 'videojs-ads'
  }

  getTrackerVersion () {
    return version
  }

  isMuted () {
    return this.player.muted()
  }

  getRenditionHeight () {
    return null
  }

  getRenditionWidth () {
    return null
  }

  getPlayerName () {
    return 'contrib-ads'
  }

  getPlayerVersion () {
    return this.player.ads.VERSION
  }

  registerListeners () {
    nrvideo.Log.debugCommonVideoEvents(this.player, [
      null,
      'ads-request',
      'ads-load',
      'adstart',
      'adend',
      'adskip',
      'adserror',
      'ads-click',
      'ads-pod-started',
      'ads-pod-ended',
      'ads-first-quartile',
      'ads-midpoint',
      'ads-third-quartile',
      'ads-pause',
      'ads-play',
      'adtimeout'
    ])

    // Register listeners
    this.player.on('ads-request', this.onAdrequest.bind(this))
    this.player.on('ads-load', this.onAdload.bind(this))
    this.player.on('adstart', this.onAdstart.bind(this))
    this.player.on('adend', this.onAdend.bind(this))
    this.player.on('adskip', this.onAdskip.bind(this))
    this.player.on('adserror', this.onAdserror.bind(this))
    this.player.on('ads-click', this.onAdsClick.bind(this))
    this.player.on('ads-pod-started', this.onPodStart.bind(this))
    this.player.on('ads-pod-ended', this.onPodEnd.bind(this))
    this.player.on('ads-first-quartile', this.onFirstQuartile.bind(this))
    this.player.on('ads-midpoint', this.onMidpoint.bind(this))
    this.player.on('ads-third-quartile', this.onThirdQuartile.bind(this))
    this.player.on('ads-pause', this.onAdspause.bind(this))
    this.player.on('ads-play', this.onAdsplay.bind(this))
  }

  unregisterListeners () {
    // unregister listeners
    this.player.off('ads-request', this.onAdrequest)
    this.player.off('ads-load', this.onAdload)
    this.player.off('adstart', this.onAdstart)
    this.player.off('adend', this.onAdend)
    this.player.off('adskip', this.onAdskip)
    this.player.off('adserror', this.onAdserror)
    this.player.off('ads-click', this.onAdsClick)
    this.player.off('ads-pod-started', this.onPodStart)
    this.player.off('ads-pod-ended', this.onPodEnd)
    this.player.off('ads-first-quartile', this.onFirstQuartile)
    this.player.off('ads-midpoint', this.onMidpoint)
    this.player.off('ads-third-quartile', this.onThirdQuartile)
    this.player.off('ads-pause', this.onAdspause)
    this.player.off('ads-play', this.onAdsplay)
  }

  onAdrequest (e) {
    this.sendRequest()
    this.sendDownload({ state: 'ads-request' })
  }

  onAdload (e) {
    this.sendDownload({ state: 'ads-load' })
  }

  onAdstart (e) {
    this.sendRequest()
    this.sendStart()
  }

  onAdend (e) {
    this.sendEnd()
  }

  onAdskip (e) {
    this.sendEnd({ skipped: true })
  }

  onAdserror (e) {
    this.sendError()
  }

  onAdsClick (e) {
    this.sendAdClick()
  }

  onPodStart (e) {
    this.sendAdBreakStart()
  }

  onPodEnd (e) {
    this.sendAdBreakEnd()
  }

  onFirstQuartile () {
    this.sendAdQuartile({ quartile: 1 })
  }

  onMidpoint () {
    this.sendAdQuartile({ quartile: 2 })
  }

  onThirdQuartile () {
    this.sendAdQuartile({ quartile: 3 })
  }

  onAdspause () {
    this.sendPause()
  }

  onAdsplay () {
    this.sendResume()
  }
}
