if (typeof videojs !== 'undefined') {
// Cross-compatibility for Video.js 5 and 6.
  const registerPlugin = videojs.registerPlugin || videojs.plugin

  /**
   * Register newrelic's video.js plugin.
   *
   * In the plugin function, the value of `this` is a video.js `Player`
   * instance. You cannot rely on the player being in a "ready" state here,
   * depending on how the plugin is invoked. This may or may not be important
   * to you; if not, remove the wait for "ready"!
   */
  registerPlugin('newrelic', function (options) {
    if (!this.newrelictracker) {
      this.newrelictracker = new nrvideo.VideojsTracker(this)
      nrvideo.Core.addTracker(this.newrelictracker)
    }
    return this.newrelictracker
  })
}
