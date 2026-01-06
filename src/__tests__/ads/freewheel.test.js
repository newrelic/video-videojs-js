import FreewheelAdsTracker from '../../ads/freewheel';

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

describe('FreewheelAdsTracker', () => {
  let mockPlayer;
  let freewheelTracker;

  beforeEach(() => {
    // Mock the global tv.freewheel object
    global.tv = {
      freewheel: {
        SDK: {
          VERSION: '6.23.0',
          AdManager: jest.fn()
        }
      }
    };

    mockPlayer = {
      FreeWheelPlugin: {
        VERSION: '2.1.0',
        adManager: {
          getCurrentAd: jest.fn().mockReturnValue({
            getId: jest.fn().mockReturnValue('fw-ad-123'),
            getTitle: jest.fn().mockReturnValue('Freewheel Test Ad'),
            getDuration: jest.fn().mockReturnValue(30),
            getCreativeUrl: jest.fn().mockReturnValue('http://example.com/fw-ad.mp4')
          })
        }
      },
      ads: {
        VERSION: '6.0.0',
        ad: {
          id: 'fw-current-ad',
          currentTime: jest.fn().mockReturnValue(10.5),
          duration: 25,
          title: 'Current Freewheel Ad',
          creative: { url: 'http://example.com/current-ad.mp4' }
        }
      },
      on: jest.fn(),
      off: jest.fn(),
      tech: jest.fn().mockReturnValue({}),
      muted: jest.fn().mockReturnValue(false)
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.tv;
  });

  describe('Static isUsing method', () => {
    test('should return true when player has FreeWheelPlugin and tv.freewheel exists', () => {
      expect(FreewheelAdsTracker.isUsing(mockPlayer)).toBe(true);
    });

    test('should return false when player has no FreeWheelPlugin', () => {
      const playerWithoutFW = { someProperty: 'value' };
      expect(FreewheelAdsTracker.isUsing(playerWithoutFW)).toBe(false);
    });

    test('should return false when FreeWheelPlugin is null', () => {
      const playerWithNullFW = { FreeWheelPlugin: null };
      expect(FreewheelAdsTracker.isUsing(playerWithNullFW)).toBe(false);
    });

    test('should return false when tv is undefined', () => {
      delete global.tv;
      expect(FreewheelAdsTracker.isUsing(mockPlayer)).toBe(false);
    });

    test('should return false when tv.freewheel is undefined', () => {
      global.tv = {};
      expect(FreewheelAdsTracker.isUsing(mockPlayer)).toBe(false);
    });

    test('should return false when tv.freewheel is null', () => {
      global.tv = { freewheel: null };
      expect(FreewheelAdsTracker.isUsing(mockPlayer)).toBe(false);
    });
  });

  describe('Constructor and Basic Properties', () => {
    beforeEach(() => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);
    });

    test('should create Freewheel tracker instance', () => {
      expect(freewheelTracker.player).toBe(mockPlayer);
    });

    test('should extend VideojsAdsTracker', () => {
      expect(typeof freewheelTracker.getTrackerName).toBe('function');
    });

    test('getTrackerName should return "freewheel-ads"', () => {
      expect(freewheelTracker.getTrackerName()).toBe('freewheel-ads');
    });

    test('getPlayerName should return "freewheel-ads"', () => {
      expect(freewheelTracker.getPlayerName()).toBe('freewheel-ads');
    });

    test('getPlayerVersion should return FreeWheel plugin version', () => {
      expect(freewheelTracker.getPlayerVersion()).toBe('2.1.0');
    });
  });

  describe('Ad Data Methods from ads.ad object', () => {
    beforeEach(() => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);
    });

    test('getPlayhead should return current time in milliseconds', () => {
      expect(freewheelTracker.getPlayhead()).toBe(10500); // 10.5 * 1000
    });

    test('getPlayhead should return undefined when no currentTime method', () => {
      mockPlayer.ads.ad.currentTime = undefined;
      expect(freewheelTracker.getPlayhead()).toBeUndefined();
    });

    test('getPlayhead should return undefined when ads.ad is missing', () => {
      mockPlayer.ads.ad = undefined;
      expect(freewheelTracker.getPlayhead()).toBeUndefined();
    });

    test('getDuration should return duration in milliseconds', () => {
      expect(freewheelTracker.getDuration()).toBe(25000); // 25 * 1000
    });

    test('getDuration should return undefined when no duration', () => {
      mockPlayer.ads.ad.duration = undefined;
      expect(freewheelTracker.getDuration()).toBeUndefined();
    });

    test('getDuration should return undefined when ads.ad is missing', () => {
      mockPlayer.ads.ad = undefined;
      expect(freewheelTracker.getDuration()).toBeUndefined();
    });

    test('getVideoId should return ad id', () => {
      expect(freewheelTracker.getVideoId()).toBe('fw-current-ad');
    });

    test('getVideoId should return undefined when ads.ad is missing', () => {
      mockPlayer.ads.ad = undefined;
      expect(freewheelTracker.getVideoId()).toBeUndefined();
    });

    test('getTitle should return ad title', () => {
      expect(freewheelTracker.getTitle()).toBe('Current Freewheel Ad');
    });

    test('getTitle should return undefined when no title', () => {
      mockPlayer.ads.ad.title = undefined;
      expect(freewheelTracker.getTitle()).toBeUndefined();
    });

    test('getSrc should return creative URL', () => {
      expect(freewheelTracker.getSrc()).toBe('http://example.com/current-ad.mp4');
    });

    test('getSrc should return undefined when no creative', () => {
      mockPlayer.ads.ad.creative = undefined;
      expect(freewheelTracker.getSrc()).toBeUndefined();
    });

    test('getSrc should return undefined when creative has no url', () => {
      mockPlayer.ads.ad.creative = {};
      expect(freewheelTracker.getSrc()).toBeUndefined();
    });
  });

  describe('getAdPartner', () => {
    test('should return "freewheel"', () => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);
      expect(freewheelTracker.getAdPartner()).toBe('freewheel');
    });
  });

  describe('Event Listener Registration', () => {
    beforeEach(() => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);

      // Mock parent class methods
      freewheelTracker.sendRequest = jest.fn();
      freewheelTracker.sendStart = jest.fn();
      freewheelTracker.sendEnd = jest.fn();
      freewheelTracker.sendError = jest.fn();
      freewheelTracker.sendPause = jest.fn();
      freewheelTracker.sendResume = jest.fn();
      freewheelTracker.sendAdQuartile = jest.fn();
    });

    test('registerListeners should register Freewheel-specific events', () => {
      freewheelTracker.registerListeners();

      expect(mockPlayer.on).toHaveBeenCalledWith('fw-ready', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-started', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-complete', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-paused', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-resumed', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-skipped', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-error', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-first-quartile', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-midpoint', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('fw-third-quartile', expect.any(Function));
    });

    test('unregisterListeners should remove Freewheel-specific events', () => {
      freewheelTracker.unregisterListeners();

      expect(mockPlayer.off).toHaveBeenCalledWith('fw-ready', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-started', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-complete', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-paused', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-resumed', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-skipped', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-error', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-first-quartile', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-midpoint', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('fw-third-quartile', expect.any(Function));
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);

      // Mock parent class methods
      freewheelTracker.sendRequest = jest.fn();
      freewheelTracker.sendStart = jest.fn();
      freewheelTracker.sendEnd = jest.fn();
      freewheelTracker.sendError = jest.fn();
      freewheelTracker.sendPause = jest.fn();
      freewheelTracker.sendResume = jest.fn();
      freewheelTracker.sendAdQuartile = jest.fn();
    });

    test('onReady should send request', () => {
      freewheelTracker.onReady();
      expect(freewheelTracker.sendRequest).toHaveBeenCalled();
    });

    test('onStarted should send start', () => {
      freewheelTracker.onStarted();
      expect(freewheelTracker.sendStart).toHaveBeenCalled();
    });

    test('onComplete should send end', () => {
      freewheelTracker.onComplete();
      expect(freewheelTracker.sendEnd).toHaveBeenCalled();
    });

    test('onSkipped should send end with skipped flag', () => {
      freewheelTracker.onSkipped();
      expect(freewheelTracker.sendEnd).toHaveBeenCalledWith({ skipped: true });
    });

    test('onPaused should send pause', () => {
      freewheelTracker.onPaused();
      expect(freewheelTracker.sendPause).toHaveBeenCalled();
    });

    test('onResumed should send resume', () => {
      freewheelTracker.onResumed();
      expect(freewheelTracker.sendResume).toHaveBeenCalled();
    });

    test('onFirstQuartile should send first quartile', () => {
      freewheelTracker.onFirstQuartile();
      expect(freewheelTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 1 });
    });

    test('onMidpoint should send midpoint quartile', () => {
      freewheelTracker.onMidpoint();
      expect(freewheelTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 2 });
    });

    test('onThirdQuartile should send third quartile', () => {
      freewheelTracker.onThirdQuartile();
      expect(freewheelTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 3 });
    });

    test('onError should send error with event data', () => {
      const errorEvent = {
        error: {
          code: 'FW_ERROR_TIMEOUT',
          message: 'Freewheel ad request timeout'
        }
      };

      freewheelTracker.onError(errorEvent);
      expect(freewheelTracker.sendError).toHaveBeenCalledWith(errorEvent);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);
    });

    test('should handle missing FreeWheelPlugin', () => {
      mockPlayer.FreeWheelPlugin = undefined;

      expect(() => {
        freewheelTracker.getPlayerVersion();
      }).toThrow(); // Will throw because FreeWheelPlugin is undefined
    });

    test('should handle missing ads object', () => {
      mockPlayer.ads = undefined;

      expect(freewheelTracker.getPlayhead()).toBeUndefined();
      expect(freewheelTracker.getDuration()).toBeUndefined();
      expect(freewheelTracker.getVideoId()).toBeUndefined();
      expect(freewheelTracker.getTitle()).toBeUndefined();
      expect(freewheelTracker.getSrc()).toBeUndefined();
    });

    test('should handle null ads.ad object', () => {
      mockPlayer.ads.ad = null;

      expect(freewheelTracker.getPlayhead()).toBeUndefined();
      expect(freewheelTracker.getDuration()).toBeUndefined();
      expect(freewheelTracker.getVideoId()).toBeUndefined();
      expect(freewheelTracker.getTitle()).toBeUndefined();
      expect(freewheelTracker.getSrc()).toBeUndefined();
    });

    test('should handle partial ads.ad object', () => {
      mockPlayer.ads.ad = {
        id: 'partial-ad'
        // Missing other properties
      };

      expect(freewheelTracker.getVideoId()).toBe('partial-ad');
      expect(freewheelTracker.getPlayhead()).toBeUndefined();
      expect(freewheelTracker.getDuration()).toBeUndefined();
      expect(freewheelTracker.getTitle()).toBeUndefined();
      expect(freewheelTracker.getSrc()).toBeUndefined();
    });
  });

  describe('Branch Coverage Tests', () => {
    beforeEach(() => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);
    });

    test('getAdCreativeId should use alternative provider path', () => {
      // Remove simple ads.ad path and test provider path
      mockPlayer.ads.ad = null;

      // Mock the provider path that throws error to test catch branch
      mockPlayer.ads.provider = {
        event: {
          adInstance: {
            getActiveCreativeRendition: jest.fn().mockImplementation(() => {
              throw new Error('Provider error');
            })
          }
        }
      };

      const creativeId = freewheelTracker.getAdCreativeId();
      expect(creativeId).toBeUndefined(); // Catch block does nothing, returns undefined
    });

    test('getAdCreativeId should return ID from provider when available', () => {
      // Remove simple ads.ad path
      mockPlayer.ads.ad = null;

      // Mock successful provider path
      mockPlayer.ads.provider = {
        event: {
          adInstance: {
            getActiveCreativeRendition: jest.fn().mockReturnValue({
              getId: jest.fn().mockReturnValue('creative-123')
            })
          }
        }
      };

      const creativeId = freewheelTracker.getAdCreativeId();
      expect(creativeId).toBe('creative-123');
    });

    test('getSrc should use alternative provider path', () => {
      // Set up ads.ad without creative.url to force provider path
      mockPlayer.ads.ad = {
        id: 'test-ad'
        // No creative property
      };

      // Mock provider path
      mockPlayer.ads.provider = {
        event: {
          adInstance: {
            getActiveCreativeRendition: jest.fn().mockReturnValue({
              getPrimaryCreativeRenditionAsset: jest.fn().mockReturnValue({
                getUrl: jest.fn().mockReturnValue('http://provider-creative.com/ad.mp4')
              })
            })
          }
        }
      };

      const src = freewheelTracker.getSrc();
      expect(src).toBe('http://provider-creative.com/ad.mp4');
    });

    test('getSrc should handle provider path errors gracefully', () => {
      // Set up ads.ad without creative.url to force provider path
      mockPlayer.ads.ad = { id: 'test-ad' };

      // Mock provider path that throws error
      mockPlayer.ads.provider = {
        event: {
          adInstance: {
            getActiveCreativeRendition: jest.fn().mockImplementation(() => {
              throw new Error('Provider error');
            })
          }
        }
      };

      const src = freewheelTracker.getSrc();
      expect(src).toBeUndefined(); // Catch block does nothing
    });

    test('getTitle should use alternative provider path', () => {
      // Set up ads.ad without title to force provider path
      mockPlayer.ads.ad = {
        id: 'test-ad'
        // No title property
      };

      // Mock provider path
      mockPlayer.ads.provider = {
        event: {
          adInstance: {
            getActiveCreativeRendition: jest.fn().mockReturnValue({
              getPrimaryCreativeRenditionAsset: jest.fn().mockReturnValue({
                getName: jest.fn().mockReturnValue('Provider Ad Title')
              })
            })
          }
        }
      };

      const title = freewheelTracker.getTitle();
      expect(title).toBe('Provider Ad Title');
    });

    test('getTitle should handle provider path errors gracefully', () => {
      // Set up ads.ad without title
      mockPlayer.ads.ad = { id: 'test-ad' };

      // Mock provider path that throws error
      mockPlayer.ads.provider = {
        event: {
          adInstance: {
            getActiveCreativeRendition: jest.fn().mockImplementation(() => {
              throw new Error('Provider error');
            })
          }
        }
      };

      const title = freewheelTracker.getTitle();
      expect(title).toBeUndefined(); // Catch block does nothing
    });

    test('getAdPosition should return correct positions for each ad type', () => {
      // Mock nrvideo.Constants.AdPositions if it doesn't exist
      if (typeof global.nrvideo === 'undefined') {
        global.nrvideo = {};
      }
      if (typeof global.nrvideo.Constants === 'undefined') {
        global.nrvideo.Constants = {};
      }
      global.nrvideo.Constants.AdPositions = {
        PRE: 'pre',
        MID: 'mid',
        POST: 'post'
      };

      // Test PREROLL
      mockPlayer.ads.ad = { type: 'PREROLL' };
      expect(freewheelTracker.getAdPosition()).toBe('pre');

      // Test MIDROLL
      mockPlayer.ads.ad = { type: 'MIDROLL' };
      expect(freewheelTracker.getAdPosition()).toBe('mid');

      // Test POSTROLL
      mockPlayer.ads.ad = { type: 'POSTROLL' };
      expect(freewheelTracker.getAdPosition()).toBe('post');

      // Test unknown type (should return undefined)
      mockPlayer.ads.ad = { type: 'UNKNOWN' };
      expect(freewheelTracker.getAdPosition()).toBeUndefined();

      // Test no type
      mockPlayer.ads.ad = { id: 'test' };
      expect(freewheelTracker.getAdPosition()).toBeUndefined();
    });
  });

  describe('Integration with Parent Class', () => {
    test('should inherit VideojsAdsTracker methods', () => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);

      // Should have inherited methods from parent
      expect(typeof freewheelTracker.sendRequest).toBe('function');
      expect(typeof freewheelTracker.sendStart).toBe('function');
      expect(typeof freewheelTracker.sendEnd).toBe('function');
      expect(typeof freewheelTracker.sendError).toBe('function');
      expect(typeof freewheelTracker.sendPause).toBe('function');
      expect(typeof freewheelTracker.sendResume).toBe('function');
      expect(typeof freewheelTracker.sendAdQuartile).toBe('function');
    });

    test('should override specific methods correctly', () => {
      freewheelTracker = new FreewheelAdsTracker(mockPlayer);

      // Should override these methods from parent
      expect(freewheelTracker.getTrackerName()).toBe('freewheel-ads');
      expect(freewheelTracker.getPlayerName()).toBe('freewheel-ads');
      expect(freewheelTracker.getPlayerVersion()).toBe('2.1.0');
    });
  });
});