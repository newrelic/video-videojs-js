export default class ShakaTech {
  constructor (tech) {
    this.tech = tech.shakaPlayer
  }

  getSrc (tech) {
    try {
      return this.tech.getManifestUri()
    } catch (err) {}
    return null
  }

  getRenditionBitrate (tech) {
    try {
      return this.tech.getStats().streamBandwidth
    } catch (err) { }
    return null
  }

  getRenditionWidth (tech) {
    try {
      var tracks = this.tech.getVariantTracks()
      for (var i in tracks) {
        var track = tracks[i]
        if (track.active && track.type === 'video') {
          return track.width
        }
      }
    } catch (err) { }
    return null
  }

  getRenditionHeight (tech) {
    try {
      var tracks = this.tech.getVariantTracks()
      for (var i in tracks) {
        var track = tracks[i]
        if (track.active && track.type === 'video') {
          return track.height
        }
      }
    } catch (err) { }
    return null
  }
}

ShakaTech.isUsing = function (tech) {
  return !!tech.shakaPlayer
}
