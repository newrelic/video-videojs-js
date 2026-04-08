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

  getManifestBitrate() {
    try {
      // Return highest available bitrate from all variants
      const tracks = this.tech.getVariantTracks();
      if (tracks && tracks.length > 0) {
        return Math.max(
          ...tracks.map((t) => t.videoBandwidth + (t.audioBandwidth || 0)),
        );
      }
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
      // Get the current variant's bitrate from manifest (streamBandwidth)
      var stats = this.tech.getStats();
      if (stats && stats.streamBandwidth && stats.streamBandwidth > 0) {
        return stats.streamBandwidth;
      }
    } catch (err) {}
    return null;
  }

  getSegmentDownloadBitrate() {
    try {
      // Use estimatedBandwidth for measured bitrate
      var stats = this.tech.getStats();
      if (stats && stats.estimatedBandwidth > 0) {
        return stats.estimatedBandwidth;
      }
    } catch (err) {}
    return null;
  }

  getNetworkDownloadBitrate() {
    try {
      // Shaka: use estimatedBandwidth for download bitrate (no separate property)
      var stats = this.tech.getStats();
      if (stats && stats.estimatedBandwidth > 0) {
        return stats.estimatedBandwidth;
      }
    } catch (err) {}
    return null;
  }
}

ShakaTech.isUsing = function (tech) {
  return !!tech.shakaPlayer;
};
