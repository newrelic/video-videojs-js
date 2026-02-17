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
      if (this.tech.stats && this.player) {
        const stats = this.tech.stats;
        // Calculate actual playback bitrate based on content consumption
        if (stats.mediaBytesTransferred > 0 && stats.mediaRequests > 0) {
          const currentTime = this.player.currentTime(); // in seconds
          const playbackRate = this.player.playbackRate() || 1;
          const effectivePlaybackTime = currentTime / playbackRate;

          if (effectivePlaybackTime > 0) {
            const bitsTransferred = stats.mediaBytesTransferred * 8;
            return bitsTransferred / effectivePlaybackTime;
          }
        }
      }
    } catch (err) {}
    return null;
  }
}

HlsJs.isUsing = function (tech) {
  return !!tech.vhs_;
};
