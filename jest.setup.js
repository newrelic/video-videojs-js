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

// Shared mock is now handled by moduleNameMapper in jest.config.js
// However, we need to supplement it with additional mocks that might be missing

// Import the shared mock to extend it if needed
import nrvideo from '@newrelic/video-core';

// Ensure all Log methods are available
if (!nrvideo.Log.debug) nrvideo.Log.debug = jest.fn();
if (!nrvideo.Log.warn) nrvideo.Log.warn = jest.fn();
if (!nrvideo.Log.info) nrvideo.Log.info = jest.fn();
if (!nrvideo.Log.error) nrvideo.Log.error = jest.fn();

// Ensure Core.addTracker is a proper jest mock
if (nrvideo.Core && !jest.isMockFunction(nrvideo.Core.addTracker)) {
  nrvideo.Core.addTracker = jest.fn();
}

// Ensure Constants.AdPositions is available
if (!nrvideo.Constants) {
  nrvideo.Constants = {};
}
if (!nrvideo.Constants.AdPositions) {
  nrvideo.Constants.AdPositions = {
    PRE: 'pre',
    MID: 'mid',
    POST: 'post'
  };
}

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