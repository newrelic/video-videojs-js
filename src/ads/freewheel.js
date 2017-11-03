import VideojsAdsTracker from './videojs-ads'

export default class FreewheelAdsTracker extends VideojsAdsTracker {
  static isUsing (player) {
    return !!player.FreeWheelPlugin && typeof tv !== 'undefined' && tv.freewheel
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
    if (this.player.ads.ad.currentTime) {
      return this.player.ads.ad.currentTime() * 1000
    }
  }

  getDuration () {
    if (this.player.ads.ad.duration) {
      return this.player.ads.ad.duration * 1000
    }
  }

  getSrc () {
    try {
      let acr = this.player.ads.provider.event.adInstance.getActiveCreativeRendition()
      return acr.getPrimaryCreativeRenditionAsset().getUrl()
    } catch (err) { /* do nothing */ }
  }

  getTitle () {
    try {
      let acr = this.player.ads.provider.event.adInstance.getActiveCreativeRendition()
      return acr.getPrimaryCreativeRenditionAsset().getName()
    } catch (err) { /* do nothing */ }
  }

  getAdPosition () {
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
