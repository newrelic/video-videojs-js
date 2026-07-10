// Shared manual mock for the @newrelic/video-core dependency.
// Jest auto-applies node_modules manual mocks to every spec, so specs get this
// core boundary for free — no per-file jest.mock() factory. Assert on the
// jest.fn()s (e.g. Log.warn, Core.addTracker) and reset them in beforeEach.
const Log = { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() };

class VideoTracker {
  constructor(player, options) {
    this.player = player;
    this.options = options;
  }
}

module.exports = {
  __esModule: true,
  default: { VideoTracker, Log, Core: { addTracker: jest.fn() } },
};
