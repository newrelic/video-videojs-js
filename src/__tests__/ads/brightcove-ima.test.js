import BrightcoveImaAdsTracker from '../../ads/brightcove-ima';

// Mock VideojsAdsTracker parent class
jest.mock('../../ads/videojs-ads', () => {
  return class MockVideojsAdsTracker {
    constructor(player) {
      this.player = player;
    }
    getTrackerName() { return 'videojs-ads'; }
    sendRequest() {}
    sendStart() {}
    sendEnd() {}
    sendError() {}
    sendPause() {}
    sendResume() {}
    sendAdQuartile() {}
  };
});

describe('BrightcoveImaAdsTracker', () => {
  let mockPlayer;
  let brightcoveTracker;

  beforeEach(() => {
    mockPlayer = {
      ima3: {
        adPlayer: {
          currentTime: jest.fn().mockReturnValue(15.5)
        },
        controller: {
          onAdsManagerLoaded: jest.fn(),
          onAdStarted: jest.fn(),
          onAdComplete: jest.fn(),
          onAdError: jest.fn(),
          onAdPaused: jest.fn(),
          onAdResumed: jest.fn(),
          onAdSkipped: jest.fn(),
          onAdClicked: jest.fn(),
          onAdFirstQuartile: jest.fn(),
          onAdMidpoint: jest.fn(),
          onAdThirdQuartile: jest.fn()
        }
      },
      on: jest.fn(),
      off: jest.fn(),
      tech: jest.fn().mockReturnValue({}),
      muted: jest.fn().mockReturnValue(false),
      ads: { VERSION: '6.0.0' }
    };

    jest.clearAllMocks();
  });

  describe('Static isUsing method', () => {
    test('should return true when player has ima3', () => {
      expect(BrightcoveImaAdsTracker.isUsing(mockPlayer)).toBe(true);
    });

    test('should return false when player has no ima3', () => {
      const playerWithoutIma3 = { someProperty: 'value' };
      expect(BrightcoveImaAdsTracker.isUsing(playerWithoutIma3)).toBe(false);
    });

    test('should return false when ima3 is null', () => {
      const playerWithNullIma3 = { ima3: null };
      expect(BrightcoveImaAdsTracker.isUsing(playerWithNullIma3)).toBe(false);
    });

    test('should return false when ima3 is undefined', () => {
      const playerWithUndefinedIma3 = { ima3: undefined };
      expect(BrightcoveImaAdsTracker.isUsing(playerWithUndefinedIma3)).toBe(false);
    });

    test('should return true when ima3 is an empty object', () => {
      const playerWithEmptyIma3 = { ima3: {} };
      expect(BrightcoveImaAdsTracker.isUsing(playerWithEmptyIma3)).toBe(true);
    });
  });

  describe('Constructor and Basic Properties', () => {
    beforeEach(() => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);
    });

    test('should create Brightcove IMA tracker instance', () => {
      expect(brightcoveTracker.player).toBe(mockPlayer);
    });

    test('should extend VideojsAdsTracker', () => {
      expect(typeof brightcoveTracker.getTrackerName).toBe('function');
    });

    test('getTrackerName should return "brightcove-ima-ads"', () => {
      expect(brightcoveTracker.getTrackerName()).toBe('brightcove-ima-ads');
    });

    test('getPlayerName should return "brightcove-ima-ads"', () => {
      expect(brightcoveTracker.getPlayerName()).toBe('brightcove-ima-ads');
    });
  });

  describe('getPlayhead', () => {
    beforeEach(() => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);
    });

    test('should return playhead from ima3 adPlayer', () => {
      expect(brightcoveTracker.getPlayhead()).toBe(15.5);
    });

    test('should handle missing ima3', () => {
      brightcoveTracker.player.ima3 = undefined;
      expect(brightcoveTracker.getPlayhead()).toBeUndefined();
    });

    test('should handle missing adPlayer', () => {
      brightcoveTracker.player.ima3.adPlayer = undefined;
      expect(brightcoveTracker.getPlayhead()).toBeUndefined();
    });

    test('should handle missing currentTime method', () => {
      brightcoveTracker.player.ima3.adPlayer = {};
      expect(brightcoveTracker.getPlayhead()).toBeUndefined();
    });

    test('should handle null player', () => {
      brightcoveTracker.player = null;
      expect(brightcoveTracker.getPlayhead()).toBeUndefined();
    });
  });

  describe('Event Listener Registration', () => {
    beforeEach(() => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);

      // Mock the parent class methods that will be called by event handlers
      brightcoveTracker.sendRequest = jest.fn();
      brightcoveTracker.sendStart = jest.fn();
      brightcoveTracker.sendEnd = jest.fn();
      brightcoveTracker.sendError = jest.fn();
      brightcoveTracker.sendPause = jest.fn();
      brightcoveTracker.sendResume = jest.fn();
      brightcoveTracker.sendAdQuartile = jest.fn();
    });

    test('registerListeners should register all Brightcove IMA events', () => {
      brightcoveTracker.registerListeners();

      // Verify all the ima3 events are registered
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-ready', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-started', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-complete', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-paused', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-resumed', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-skipped', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-clicked', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-first-quartile', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-midpoint', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-third-quartile', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3-ad-error', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ima3error', expect.any(Function));
    });

    test('unregisterListeners should remove all Brightcove IMA events', () => {
      brightcoveTracker.unregisterListeners();

      // Verify all the ima3 events are unregistered
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-ready', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-started', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-complete', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-paused', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-resumed', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-skipped', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-clicked', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-first-quartile', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-midpoint', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-third-quartile', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3-ad-error', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ima3error', expect.any(Function));
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);

      // Mock the parent class methods
      brightcoveTracker.sendRequest = jest.fn();
      brightcoveTracker.sendStart = jest.fn();
      brightcoveTracker.sendEnd = jest.fn();
      brightcoveTracker.sendError = jest.fn();
      brightcoveTracker.sendPause = jest.fn();
      brightcoveTracker.sendResume = jest.fn();
      brightcoveTracker.sendAdQuartile = jest.fn();
      brightcoveTracker.sendAdClick = jest.fn();
    });

    test('onReady should send request', () => {
      brightcoveTracker.onReady();
      expect(brightcoveTracker.sendRequest).toHaveBeenCalled();
    });

    test('onStarted should send start', () => {
      brightcoveTracker.onStarted();
      expect(brightcoveTracker.sendStart).toHaveBeenCalled();
    });

    test('onComplete should send end', () => {
      brightcoveTracker.onComplete();
      expect(brightcoveTracker.sendEnd).toHaveBeenCalled();
    });

    test('onSkipped should send end with skipped flag', () => {
      brightcoveTracker.onSkipped();
      expect(brightcoveTracker.sendEnd).toHaveBeenCalledWith({ skipped: true });
    });

    test('onPaused should send pause', () => {
      brightcoveTracker.onPaused();
      expect(brightcoveTracker.sendPause).toHaveBeenCalled();
    });

    test('onResumed should send resume', () => {
      brightcoveTracker.onResumed();
      expect(brightcoveTracker.sendResume).toHaveBeenCalled();
    });

    test('onFirstQuartile should send first quartile', () => {
      brightcoveTracker.onFirstQuartile();
      expect(brightcoveTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 1 });
    });

    test('onMidpoint should send midpoint quartile', () => {
      brightcoveTracker.onMidpoint();
      expect(brightcoveTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 2 });
    });

    test('onThirdQuartile should send third quartile', () => {
      brightcoveTracker.onThirdQuartile();
      expect(brightcoveTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 3 });
    });

    test('onError should send error with event data', () => {
      const errorEvent = {
        error: {
          code: 'VAST_LOAD_TIMEOUT',
          message: 'Failed to load VAST ad'
        }
      };

      brightcoveTracker.onError(errorEvent);
      expect(brightcoveTracker.sendError).toHaveBeenCalledWith(errorEvent);
    });

    test('onClicked should send ad click (no-op in base implementation)', () => {
      // This method exists but typically doesn't send anything in Brightcove IMA
      expect(() => {
        brightcoveTracker.onClicked();
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);
    });

    test('should handle player without ima3 controller', () => {
      mockPlayer.ima3.controller = undefined;

      expect(() => {
        brightcoveTracker.registerListeners();
      }).not.toThrow();
    });

    test('should handle completely missing ima3', () => {
      mockPlayer.ima3 = undefined;

      expect(() => {
        brightcoveTracker.getPlayhead();
      }).not.toThrow();

      expect(brightcoveTracker.getPlayhead()).toBeUndefined();
    });

    test('should handle null event in error handler', () => {
      brightcoveTracker.sendError = jest.fn();

      expect(() => {
        brightcoveTracker.onError(null);
      }).not.toThrow();

      expect(brightcoveTracker.sendError).toHaveBeenCalledWith(null);
    });

    test('should handle undefined event in error handler', () => {
      brightcoveTracker.sendError = jest.fn();

      expect(() => {
        brightcoveTracker.onError(undefined);
      }).not.toThrow();

      expect(brightcoveTracker.sendError).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Integration with Parent Class', () => {
    test('should inherit all VideojsAdsTracker methods', () => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);

      // Should have inherited methods from parent
      expect(typeof brightcoveTracker.sendRequest).toBe('function');
      expect(typeof brightcoveTracker.sendStart).toBe('function');
      expect(typeof brightcoveTracker.sendEnd).toBe('function');
      expect(typeof brightcoveTracker.sendError).toBe('function');
      expect(typeof brightcoveTracker.sendPause).toBe('function');
      expect(typeof brightcoveTracker.sendResume).toBe('function');
      expect(typeof brightcoveTracker.sendAdQuartile).toBe('function');
    });

    test('should override specific methods correctly', () => {
      brightcoveTracker = new BrightcoveImaAdsTracker(mockPlayer);

      // Should override these methods from parent
      expect(brightcoveTracker.getTrackerName()).toBe('brightcove-ima-ads');
      expect(brightcoveTracker.getPlayerName()).toBe('brightcove-ima-ads');
    });
  });
});