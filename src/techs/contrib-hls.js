export default class ContribHlsTech {
  constructor (tech) {
    this.tech = tech.vhs
  }

  getRenditionName () {
    try {
      var media = this.tech.playlists.media()
      if (media && media.attributes) return media.attributes.NAME
    } catch (err) { }
    return null
  }

  getRenditionBitrate () {
    try {
      var media = this.tech.playlists.media()
      if (media && media.attributes) return media.attributes.BANDWIDTH
    } catch (err) { }
    return null
  }

  getRenditionWidth () {
    try {
      var media = this.tech.playlists.media()
      if (media && media.attributes && media.attributes.RESOLUTION) {
        return media.attributes.RESOLUTION.width
      }
    } catch (err) { }
    return null
  }

  getRenditionHeight () {
    try {
      var media = this.tech.playlists.media()
      if (media && media.attributes && media.attributes.RESOLUTION) {
        return media.attributes.RESOLUTION.height
      }
    } catch (err) { }
    return null
  }
}

ContribHlsTech.isUsing = function (tech) {
  return !!tech.vhs
}
