import '@testing-library/jest-dom';

// Global mocks for Video.js environment
global.videojs = {
  VERSION: '8.0.0'
};

// Mock global google IMA/DAI
global.google = {
  ima: {
    VERSION: '3.509.0',
    AdEvent: {
      Type: {
        LOADED: 'loaded',
        STARTED: 'started',
        PAUSED: 'paused',
        RESUMED: 'resumed',
        COMPLETE: 'complete',
        SKIPPED: 'skipped',
        CLICK: 'click',
        FIRST_QUARTILE: 'firstquartile',
        MIDPOINT: 'midpoint',
        THIRD_QUARTILE: 'thirdquartile',
        ALL_ADS_COMPLETED: 'allAdsCompleted'
      }
    },
    AdErrorEvent: {
      Type: {
        AD_ERROR: 'adError'
      }
    },
    dai: {
      api: {
        StreamEvent: {
          Type: {
            LOADED: 'loaded',
            STARTED: 'started',
            FIRST_QUARTILE: 'firstquartile',
            MIDPOINT: 'midpoint',
            THIRD_QUARTILE: 'thirdquartile',
            COMPLETE: 'complete',
            AD_BREAK_STARTED: 'ad_break_started',
            AD_BREAK_ENDED: 'ad_break_ended'
          }
        }
      }
    }
  }
};

// Mock the New Relic video core
jest.mock('@newrelic/video-core', () => ({
  __esModule: true,
  default: {
    VideoTracker: class VideoTracker {
      constructor(player, options) {
        this.player = player;
        this.options = options;
      }
      sendDownload() {}
      sendRequest() {}
      sendPause() {}
      sendResume() {}
      sendBufferStart() {}
      sendBufferEnd() {}
      sendSeekStart() {}
      sendSeekEnd() {}
      sendStart() {}
      sendEnd() {}
      sendError() {}
      sendCustom() {}
      sendAdQuartile() {}
      sendAdClick() {}
      setUserId() {}
      setHarvestInterval() {}
      setAdsTracker() {}
      registerListeners() {}
      unregisterListeners() {}
    },
    Core: {
      addTracker: jest.fn()
    },
    Log: {
      debugCommonVideoEvents: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    },
    Constants: {
      AdPositions: {
        PRE: 'pre',
        MID: 'mid',
        POST: 'post'
      }
    }
  }
}));

// Mock package.json
jest.mock('./package.json', () => ({
  version: '4.0.3',
  name: '@newrelic/video-videojs'
}));

// Mock DOM globals that might be needed
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost'
  }
});

// Mock global tv for Freewheel
global.tv = {
  freewheel: {
    SDK: {
      VERSION: '6.30.0'
    }
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
};

// Mock VideojsAdsTracker class for inheritance tests
global.VideojsAdsTracker = class VideojsAdsTracker {
  constructor(player) {
    this.player = player;
  }

  registerListeners() {
    // Mock implementation
  }

  unregisterListeners() {
    // Mock implementation
  }

  sendRequest() {}
  sendStart() {}
  sendEnd() {}
  sendPause() {}
  sendResume() {}
  sendError() {}
  sendAdBreakStart() {}
  sendAdBreakEnd() {}
  sendAdQuartile() {}
  sendAdClick() {}
  sendDownload() {}
  getTech() {
    return null;
  }
};