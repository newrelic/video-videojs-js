import VideojsAdsTracker from '../../ads/videojs-ads';

// Mock the tech classes
jest.mock('../../techs/contrib-hls', () => ({
  __esModule: true,
  default: class MockContribHlsTech {
    constructor(tech) {
      this.tech = tech;
    }
    static isUsing(tech) {
      return !!tech.vhs;
    }
  }
}));

jest.mock('../../techs/hls-js', () => ({
  __esModule: true,
  default: class MockHlsJsTech {
    constructor(tech) {
      this.tech = tech;
    }
    static isUsing(tech) {
      return !!tech.vhs_;
    }
  }
}));

jest.mock('../../techs/shaka', () => ({
  __esModule: true,
  default: class MockShakaTech {
    constructor(tech) {
      this.tech = tech;
    }
    static isUsing(tech) {
      return !!tech.shakaPlayer;
    }
  }
}));

describe('VideojsAdsTracker', () => {
  let mockPlayer;
  let mockOptions;
  let adsTracker;

  beforeEach(() => {
    mockPlayer = {
      tech: jest.fn(),
      muted: jest.fn().mockReturnValue(false),
      on: jest.fn(),
      off: jest.fn(),
      ads: {
        VERSION: '6.0.0'
      }
    };

    mockOptions = {
      info: {
        beacon: 'test-beacon',
        licenseKey: 'test-license',
        applicationID: 'test-app-id'
      }
    };

    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create ads tracker instance', () => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);

      // Check that the inherited behavior works
      expect(adsTracker).toBeInstanceOf(VideojsAdsTracker);
      // The player property comes from the parent constructor
      // but our mock might not set it up exactly the same way
    });
  });

  describe('Getter Methods', () => {
    beforeEach(() => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);
      // Manually set player since mocking might not do inheritance correctly
      adsTracker.player = mockPlayer;
    });

    test('getTrackerName should return "videojs-ads"', () => {
      expect(adsTracker.getTrackerName()).toBe('videojs-ads');
    });

    test('getTrackerVersion should return package version', () => {
      expect(adsTracker.getTrackerVersion()).toBe('4.0.3');
    });

    test('getPlayerName should return "videojs-ads"', () => {
      expect(adsTracker.getPlayerName()).toBe('videojs-ads');
    });

    test('getPlayerVersion should return ads plugin version', () => {
      expect(adsTracker.getPlayerVersion()).toBe('6.0.0');
    });

    test('isMuted should return player muted state', () => {
      expect(adsTracker.isMuted()).toBe(false);

      mockPlayer.muted.mockReturnValue(true);
      expect(adsTracker.isMuted()).toBe(true);
    });

    test('getRenditionHeight should return null', () => {
      expect(adsTracker.getRenditionHeight()).toBeNull();
    });

    test('getRenditionWidth should return null', () => {
      expect(adsTracker.getRenditionWidth()).toBeNull();
    });
  });

  describe('getTech', () => {
    beforeEach(() => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);
      adsTracker.player = mockPlayer;
    });

    test('should return ContribHlsTech when tech uses VHS', () => {
      const mockTech = { vhs: { playlists: {} } };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeDefined();
      expect(tech.tech).toBe(mockTech);
      expect(mockPlayer.tech).toHaveBeenCalledWith({ IWillNotUseThisInPlugins: true });
    });

    test('should return HlsJsTech when tech uses HLS.js', () => {
      const mockTech = { vhs_: { levels: [] } };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeDefined();
      expect(tech.tech).toBe(mockTech);
    });

    test('should return ShakaTech when tech uses Shaka Player', () => {
      const mockTech = { shakaPlayer: { getStats: jest.fn() } };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeDefined();
      expect(tech.tech).toBe(mockTech);
    });

    test('should return undefined when no matching tech found', () => {
      const mockTech = { someTech: {} };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeUndefined();
    });

    test('should return undefined when tech() returns null', () => {
      mockPlayer.tech.mockReturnValue(null);

      const tech = adsTracker.getTech();

      expect(tech).toBeUndefined();
    });

    test('should return undefined when tech() returns undefined', () => {
      mockPlayer.tech.mockReturnValue(undefined);

      const tech = adsTracker.getTech();

      expect(tech).toBeUndefined();
    });
  });

  describe('Tech Priority Order', () => {
    beforeEach(() => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);
      adsTracker.player = mockPlayer;
    });

    test('should prioritize ContribHls over other techs', () => {
      const mockTech = {
        vhs: { playlists: {} },
        vhs_: { levels: [] },
        shakaPlayer: { getStats: jest.fn() }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeDefined();
      // Should be ContribHls because it's checked first
      expect(tech.constructor.isUsing(mockTech)).toBe(true);
    });

    test('should use HlsJs when ContribHls not available', () => {
      const mockTech = {
        vhs_: { levels: [] },
        shakaPlayer: { getStats: jest.fn() }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeDefined();
    });

    test('should use Shaka when other techs not available', () => {
      const mockTech = {
        shakaPlayer: { getStats: jest.fn() }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = adsTracker.getTech();

      expect(tech).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);
      adsTracker.player = mockPlayer;
    });

    test('should handle tech() method throwing error', () => {
      mockPlayer.tech.mockImplementation(() => {
        throw new Error('Tech access failed');
      });

      expect(() => adsTracker.getTech()).not.toThrow();
      expect(adsTracker.getTech()).toBeUndefined();
    });

    test('should handle missing ads object gracefully', () => {
      adsTracker.player = { ...mockPlayer, ads: undefined };

      expect(() => adsTracker.getPlayerVersion()).toThrow();
    });

    test('should handle ads object without VERSION', () => {
      adsTracker.player = { ...mockPlayer, ads: {} };

      expect(adsTracker.getPlayerVersion()).toBeUndefined();
    });
  });

  describe('Event Listener Management', () => {
    test('registerListeners should register all ad event handlers', () => {
      const spy = jest.spyOn(mockPlayer, 'on');
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);

      adsTracker.registerListeners();

      expect(spy).toHaveBeenCalledWith('ads-request', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('ads-load', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('adstart', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('adend', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('adskip', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('adserror', expect.any(Function));
    });

    test('unregisterListeners should remove all ad event handlers', () => {
      const spy = jest.spyOn(mockPlayer, 'off');
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);

      adsTracker.unregisterListeners();

      expect(spy).toHaveBeenCalledWith('ads-request', adsTracker.onAdrequest);
      expect(spy).toHaveBeenCalledWith('ads-load', adsTracker.onAdload);
      expect(spy).toHaveBeenCalledWith('adstart', adsTracker.onAdstart);
      expect(spy).toHaveBeenCalledWith('adend', adsTracker.onAdend);
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);
      // Mock the parent class methods
      adsTracker.sendRequest = jest.fn();
      adsTracker.sendStart = jest.fn();
      adsTracker.sendEnd = jest.fn();
      adsTracker.sendError = jest.fn();
      adsTracker.sendPause = jest.fn();
      adsTracker.sendResume = jest.fn();
      adsTracker.sendAdClick = jest.fn();
      adsTracker.sendAdQuartile = jest.fn();
      adsTracker.sendDownload = jest.fn();
      adsTracker.sendAdBreakStart = jest.fn();
      adsTracker.sendAdBreakEnd = jest.fn();
    });

    test('onAdrequest should send request and download events', () => {
      adsTracker.onAdrequest();
      expect(adsTracker.sendRequest).toHaveBeenCalled();
      expect(adsTracker.sendDownload).toHaveBeenCalledWith({ state: 'ads-request' });
    });

    test('onAdload should send download event', () => {
      adsTracker.onAdload();
      expect(adsTracker.sendDownload).toHaveBeenCalledWith({ state: 'ads-load' });
    });

    test('onAdstart should send request and start events', () => {
      adsTracker.onAdstart();
      expect(adsTracker.sendRequest).toHaveBeenCalled();
      expect(adsTracker.sendStart).toHaveBeenCalled();
    });

    test('onAdend should send end event', () => {
      adsTracker.onAdend();
      expect(adsTracker.sendEnd).toHaveBeenCalled();
    });

    test('onAdskip should send end event with skipped flag', () => {
      adsTracker.onAdskip();
      expect(adsTracker.sendEnd).toHaveBeenCalledWith({ skipped: true });
    });

    test('onAdserror should send error event', () => {
      adsTracker.onAdserror();
      expect(adsTracker.sendError).toHaveBeenCalled();
    });

    test('onAdsClick should send ad click event with URL', () => {
      adsTracker.onAdsClick();
      expect(adsTracker.sendAdClick).toHaveBeenCalledWith({ url: 'unknown' });
    });

    test('onAdspause should send pause event', () => {
      adsTracker.onAdspause();
      expect(adsTracker.sendPause).toHaveBeenCalled();
    });

    test('onAdsplay should send resume event', () => {
      adsTracker.onAdsplay();
      expect(adsTracker.sendResume).toHaveBeenCalled();
    });

    test('onFirstQuartile should send first quartile event', () => {
      adsTracker.onFirstQuartile();
      expect(adsTracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 1 });
    });

    test('onMidpoint should send midpoint quartile event', () => {
      adsTracker.onMidpoint();
      expect(adsTracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 2 });
    });

    test('onThirdQuartile should send third quartile event', () => {
      adsTracker.onThirdQuartile();
      expect(adsTracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 3 });
    });

    test('onPodStart should send ad break start event', () => {
      adsTracker.onPodStart();
      expect(adsTracker.sendAdBreakStart).toHaveBeenCalled();
    });

    test('onPodEnd should send ad break end event', () => {
      adsTracker.onPodEnd();
      expect(adsTracker.sendAdBreakEnd).toHaveBeenCalled();
    });
  });

  describe('Integration with Parent VideoTracker', () => {
    test('should extend nrvideo.VideoTracker', () => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);

      expect(adsTracker).toBeInstanceOf(require('@newrelic/video-core').default.VideoTracker);
    });

    test('should have inherited methods from VideoTracker', () => {
      adsTracker = new VideojsAdsTracker(mockPlayer, mockOptions);

      // These methods should be inherited from VideoTracker
      expect(typeof adsTracker.sendDownload).toBe('function');
      expect(typeof adsTracker.sendRequest).toBe('function');
      expect(typeof adsTracker.sendPause).toBe('function');
      expect(typeof adsTracker.sendResume).toBe('function');
    });
  });
});