export default class ContribHlsTech {
  constructor (tech) {
    this.tech = tech.vhs
    this.player = tech.el().player // Store player reference for playback bitrate calculation
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

  getBitrate () {
    // Calculate playback bitrate (actual content consumption rate)
    return this.getContentBitratePlayback()
  }

  getContentBitratePlayback () {
    try {
      // VHS provides stats for calculating actual playback bitrate
      if (this.tech.stats && this.player) {
        const stats = this.tech.stats

        // Calculate actual playback bitrate based on content consumption
        if (stats.mediaBytesTransferred > 0 && stats.mediaRequests > 0) {
          const currentTime = this.player.currentTime() // in seconds
          const playbackRate = this.player.playbackRate() || 1

          // Adjust playback time by playback rate
          const effectivePlaybackTime = currentTime / playbackRate

          if (effectivePlaybackTime > 0) {
            const bitsTransferred = stats.mediaBytesTransferred * 8
            return bitsTransferred / effectivePlaybackTime
          }
        }
      }

      // Fallback to VHS bandwidth estimates if stats not available
      if (this.tech.bandwidth !== undefined && this.tech.bandwidth > 0) {
        return this.tech.bandwidth
      }
      if (this.tech.systemBandwidth !== undefined && this.tech.systemBandwidth > 0) {
        return this.tech.systemBandwidth
      }
    } catch (err) { }
    return null
  }
}

ContribHlsTech.isUsing = function (tech) {
  return !!tech.vhs
}
