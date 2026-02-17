export default class ShakaTech {
  constructor(tech) {
    this.tech = tech.shakaPlayer;
    this.player = tech.el().player; // Store player reference for playback bitrate calculation
  }

  getSrc(tech) {
    try {
      return this.tech.getManifestUri();
    } catch (err) {}
    return null;
  }

  getRenditionBitrate(tech) {
    try {
      return this.tech.getStats().streamBandwidth;
    } catch (err) {}
    return null;
  }

  getRenditionWidth(tech) {
    try {
      var tracks = this.tech.getVariantTracks();
      for (var i in tracks) {
        var track = tracks[i];
        if (track.active && track.type === 'video') {
          return track.width;
        }
      }
    } catch (err) {}
    return null;
  }

  getRenditionHeight(tech) {
    try {
      var tracks = this.tech.getVariantTracks();
      for (var i in tracks) {
        var track = tracks[i];
        if (track.active && track.type === 'video') {
          return track.height;
        }
      }
    } catch (err) {}
    return null;
  }

  getBitrate() {
    // Calculate playback bitrate (actual content consumption rate)
    return this.getContentBitratePlayback();
  }

  getContentBitratePlayback() {
    try {
      var stats = this.tech.getStats();
      if (stats) {
        // Shaka's estimatedBandwidth is the actual measured network bandwidth
        // This is the closest equivalent to playback bitrate calculation
        if (stats.estimatedBandwidth && stats.estimatedBandwidth > 0) {
          return stats.estimatedBandwidth;
        }

        // Fallback to streamBandwidth (bitrate of current variant from manifest)
        if (stats.streamBandwidth && stats.streamBandwidth > 0) {
          return stats.streamBandwidth;
        }
      }
    } catch (err) {}
    return null;
  }
}

ShakaTech.isUsing = function (tech) {
  return !!tech.shakaPlayer;
};
