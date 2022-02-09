export default class HlsJs {
  constructor (tech) {
    this.tech = tech.vhs_
  }

  getResource (tech) {
    return this.tech.url
  }

  getRenditionName (tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel]
      if (level && level.name) return level.name
    } catch (err) { }
    return null
  }

  getRenditionBitrate (tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel]
      if (level && level.bitrate) return level.bitrate
    } catch (err) { }
    return null
  }

  getRenditionWidth (tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel]
      if (level && level.width) return level.width
    } catch (err) { }
    return null
  }

  getRenditionHeight (tech) {
    try {
      var level = this.tech.levels[this.tech.currentLevel]
      if (level && level.height) return level.height
    } catch (err) { }
    return null
  }
}

HlsJs.isUsing = function (tech) {
  return !!tech.vhs_
}
