export default class ContribHlsTech {
  constructor(tech) {
    this.tech = tech.vhs;
    this.player = tech.el().player; // Store player reference for playback bitrate calculation
  }

  getRenditionName() {
    try {
      var media = this.tech.playlists.media();
      if (media && media.attributes) return media.attributes.NAME;
    } catch (err) {}
    return null;
  }

  getRenditionBitrate() {
    try {
      var media = this.tech.playlists.media();
      if (media && media.attributes) return media.attributes.BANDWIDTH;
    } catch (err) {}
    return null;
  }

  getRenditionWidth() {
    try {
      var media = this.tech.playlists.media();
      if (media && media.attributes && media.attributes.RESOLUTION) {
        return media.attributes.RESOLUTION.width;
      }
    } catch (err) {}
    return null;
  }

  getRenditionHeight() {
    try {
      var media = this.tech.playlists.media();
      if (media && media.attributes && media.attributes.RESOLUTION) {
        return media.attributes.RESOLUTION.height;
      }
    } catch (err) {}
    return null;
  }

  getBitrate() {
    // Calculate playback bitrate (actual content consumption rate)
    return this.getContentBitratePlayback();
  }

  getManifestBitrate() {
    try {
      // Return highest available bitrate from all renditions
      const playlists = this.tech.playlists.master.playlists;
      if (playlists && playlists.length > 0) {
        return Math.max(...playlists.map((p) => p.attributes.BANDWIDTH));
      }
    } catch (err) {}
    return null;
  }

  getSegmentDownloadBitrate() {
    if (
      this.tech.stats?.bandwidth !== undefined &&
      this.tech.stats.bandwidth > 0
    ) {
      return this.tech.stats.bandwidth;
    }
    return null;
  }

  getNetworkDownloadBitrate() {
    if (this.tech.throughput !== undefined && this.tech.throughput > 0) {
      return this.tech.throughput;
    }
    return null;
  }

  getContentBitratePlayback() {
    try {
      // Get the current active rendition's bitrate from manifest
      const media = this.tech.playlists.media();
      if (media && media.attributes) {
        // Use AVERAGE-BANDWIDTH if available, fallback to BANDWIDTH
        return (
          media.attributes['AVERAGE-BANDWIDTH'] ||
          media.attributes.BANDWIDTH ||
          null
        );
      }
    } catch (err) {}
    return null;
  }
}

ContribHlsTech.isUsing = function (tech) {
  return !!tech.vhs;
};
