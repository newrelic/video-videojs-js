export default class HlsJs {
  constructor(tech) {
    this.tech = tech.vhs_;
    this.player = tech.el().player; // Store player reference for currentTime
  }

  getResource(tech) {
    return this.tech.url;
  }

  getRenditionName(tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel];
      if (level && level.name) return level.name;
    } catch (err) {}
    return null;
  }

  getRenditionBitrate(tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel];
      if (level && level.bitrate) return level.bitrate;
    } catch (err) {}
    return null;
  }

  getRenditionWidth(tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel];
      if (level && level.width) return level.width;
    } catch (err) {}
    return null;
  }

  getRenditionHeight(tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel];
      if (level && level.height) return level.height;
    } catch (err) {}
    return null;
  }

  getBitrate() {
    // Default uses playback bitrate (Method 4)
    return this.getContentBitratePlayback();
  }

  getContentBitratePlayback() {
    try {
      // Get the current active level's bitrate from manifest
      const level = this.tech.levels[this.tech.currentLevel];
      if (level && level.bitrate) {
        return level.bitrate;
      }
    } catch (err) {}
    return null;
  }

  getManifestBitrate() {
    try {
      // Return highest available bitrate from all renditions
      if (this.tech.levels && this.tech.levels.length > 0) {
        return Math.max(...this.tech.levels.map(l => l.bitrate));
      }
    } catch (err) {}
    return null;
  }

  getSegmentDownloadBitrate() {
    try {
      // VHS stats.bandwidth
      if (this.tech.stats && this.tech.stats.bandwidth > 0)
        return this.tech.stats.bandwidth;
    } catch (err) {}
    return null;
  }

  getNetworkDownloadBitrate() {
    if (this.tech.throughput && this.tech.throughput > 0) {
      return this.tech.throughput;
    }
    return null;
  }
}

HlsJs.isUsing = function (tech) {
  return !!tech.vhs_;
};
