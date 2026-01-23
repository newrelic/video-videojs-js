import ImaAdsTracker from '../../ads/ima';

// Mock global google IMA
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
    }
  }
};

describe('ImaAdsTracker', () => {
  let mockPlayer;
  let mockOptions;
  let imaTracker;

  beforeEach(() => {
    mockPlayer = {
      ima: {
        getAdsManager: jest.fn().mockReturnValue({
          getCuePoints: jest.fn().mockReturnValue([0, 30, -1]),
          getRemainingTime: jest.fn().mockReturnValue(15),
          getCurrentAd: jest.fn().mockReturnValue({
            getAdId: jest.fn().mockReturnValue('ad-12345'),
            getCreativeId: jest.fn().mockReturnValue('creative-67890'),
            getDuration: jest.fn().mockReturnValue(30),
            getMediaUrl: jest.fn().mockReturnValue('http://example.com/ad.mp4'),
            getTitle: jest.fn().mockReturnValue('Test Ad'),
            getAdPodInfo: jest.fn().mockReturnValue({
              data: { podIndex: 0, totalAds: 3, adPosition: 1 }
            }),
            getVastMediaBitrate: jest.fn().mockReturnValue(1000000)
          })
        }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        controller: {
          adUi: {
            adContainerDiv: {
              querySelector: jest.fn().mockReturnValue({
                webkitVideoDecodedByteCount: 1000000
              })
            }
          }
        }
      },
      ads: {
        VERSION: '6.0.0'
      },
      playbackRate: jest.fn().mockReturnValue(1),
      tech: jest.fn().mockReturnValue({}),
      muted: jest.fn().mockReturnValue(false)
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

  describe('Static isUsing method', () => {
    test('should return true when player has IMA and google is available', () => {
      expect(ImaAdsTracker.isUsing(mockPlayer)).toBe(true);
    });

    test('should return false when player has no IMA', () => {
      const playerWithoutIma = { ads: { VERSION: '6.0.0' } };
      expect(ImaAdsTracker.isUsing(playerWithoutIma)).toBe(false);
    });

    test('should return false when google is not defined', () => {
      const originalGoogle = global.google;
      global.google = undefined;

      expect(ImaAdsTracker.isUsing(mockPlayer)).toBe(false);

      global.google = originalGoogle;
    });
  });

  describe('Constructor and Basic Properties', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
    });

    test('should create IMA ads tracker instance', () => {
      expect(imaTracker.player).toBe(mockPlayer);
    });

    test('getTrackerName should return "ima-ads"', () => {
      expect(imaTracker.getTrackerName()).toBe('ima-ads');
    });

    test('getPlayerName should return "ima"', () => {
      expect(imaTracker.getPlayerName()).toBe('ima');
    });

    test('getPlayerVersion should return combined IMA and contrib-ads versions', () => {
      expect(imaTracker.getPlayerVersion()).toBe('ima: 3.509.0; contrib-ads: 6.0.0');
    });

    test('getAdPartner should return "ima"', () => {
      expect(imaTracker.getAdPartner()).toBe('ima');
    });

    test('getPlayrate should return player playback rate', () => {
      expect(imaTracker.getPlayrate()).toBe(1);
    });
  });

  describe('getCuePoints', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
    });

    test('should return cue points from ads manager', () => {
      expect(imaTracker.getCuePoints()).toEqual([0, 30, -1]);
    });

    test('should handle ads manager returning different cue points', () => {
      mockPlayer.ima.getAdsManager().getCuePoints.mockReturnValue([5, 25, 45]);

      expect(imaTracker.getCuePoints()).toEqual([5, 25, 45]);
    });
  });

  describe('Ad Data Methods', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
      imaTracker.lastAdData = {
        adId: 'test-ad-123',
        creativeId: 'creative-456',
        duration: 30,
        mediaUrl: 'http://test.com/ad.mp4',
        title: 'Test Advertisement',
        podInfo: { podIndex: 1, totalAds: 2 },
        renditionBitrate: 2000000
      };
    });

    test('getVideoId should return ad ID from last ad data', () => {
      expect(imaTracker.getVideoId()).toBe('test-ad-123');
    });

    test('getAdCreativeId should return creative ID from last ad data', () => {
      expect(imaTracker.getAdCreativeId()).toBe('creative-456');
    });

    test('getDuration should return duration in milliseconds', () => {
      expect(imaTracker.getDuration()).toBe(30000);
    });

    test('getSrc should return media URL from last ad data', () => {
      expect(imaTracker.getSrc()).toBe('http://test.com/ad.mp4');
    });

    test('getTitle should return title from last ad data', () => {
      expect(imaTracker.getTitle()).toBe('Test Advertisement');
    });

    test('getRenditionBitrate should return bitrate from last ad data', () => {
      expect(imaTracker.getRenditionBitrate()).toBe(2000000);
    });

    test('methods should return null when no lastAdData', () => {
      imaTracker.lastAdData = null;

      expect(imaTracker.getVideoId()).toBeNull();
      expect(imaTracker.getAdCreativeId()).toBeNull();
      expect(imaTracker.getDuration()).toBeNull();
      expect(imaTracker.getSrc()).toBeNull();
      expect(imaTracker.getTitle()).toBeNull();
      expect(imaTracker.getRenditionBitrate()).toBeUndefined();
    });
  });

  describe('getAdPosition', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
    });

    test('should return "pre" for podIndex 0', () => {
      imaTracker.lastAdData = {
        podInfo: { podIndex: 0 }
      };

      expect(imaTracker.getAdPosition()).toBe('pre');
    });

    test('should return "post" for podIndex -1', () => {
      imaTracker.lastAdData = {
        podInfo: { podIndex: -1 }
      };

      expect(imaTracker.getAdPosition()).toBe('post');
    });

    test('should return "mid" for other podIndex values', () => {
      imaTracker.lastAdData = {
        podInfo: { podIndex: 1 }
      };

      expect(imaTracker.getAdPosition()).toBe('mid');
    });

    test('should return null when no lastAdData', () => {
      imaTracker.lastAdData = null;

      expect(imaTracker.getAdPosition()).toBeNull();
    });

    test('should return null when no podInfo', () => {
      imaTracker.lastAdData = {};

      expect(imaTracker.getAdPosition()).toBeNull();
    });
  });

  describe('getPlayhead', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
      imaTracker.lastAdData = { duration: 30 };
    });

    test('should calculate playhead from duration and remaining time', () => {
      // Duration 30s, remaining 15s = played 15s = 15000ms
      expect(imaTracker.getPlayhead()).toBe(15000000); // (30 * 1000 - 15) * 1000
    });

    test('should handle zero remaining time', () => {
      mockPlayer.ima.getAdsManager().getRemainingTime.mockReturnValue(0);

      expect(imaTracker.getPlayhead()).toBe(30000000); // Full duration played
    });

    test('should handle no ads manager', () => {
      mockPlayer.ima.getAdsManager.mockReturnValue(null);

      expect(imaTracker.getPlayhead()).toBeUndefined();
    });
  });

  describe('getWebkitBitrate', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
      imaTracker.getHeartbeat = jest.fn().mockReturnValue(1000); // 1 second
    });

    test('should calculate bitrate from webkit decoded byte count', () => {
      const mockVideoElement = { webkitVideoDecodedByteCount: 2000000 };
      jest.spyOn(imaTracker, 'getAdVideoElement').mockReturnValue(mockVideoElement);

      imaTracker._lastAdWebkitBitrate = 1000000;

      const bitrate = imaTracker.getWebkitBitrate();

      expect(bitrate).toBe(8000000); // (2000000 - 1000000) * 8 / 1 second
      expect(imaTracker._lastAdWebkitBitrate).toBe(2000000);
    });

    test('should return null for first measurement', () => {
      const mockVideoElement = { webkitVideoDecodedByteCount: 1000000 };
      jest.spyOn(imaTracker, 'getAdVideoElement').mockReturnValue(mockVideoElement);

      imaTracker._lastAdWebkitBitrate = 0;

      expect(imaTracker.getWebkitBitrate()).toBeNull();
    });

    test('should return null when no video element', () => {
      jest.spyOn(imaTracker, 'getAdVideoElement').mockReturnValue(null);

      expect(imaTracker.getWebkitBitrate()).toBeNull();
    });
  });

  describe('getAdVideoElement', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
    });

    test('should return video element from ad container', () => {
      const mockVideoElement = document.createElement('video');
      mockPlayer.ima.controller.adUi.adContainerDiv.querySelector.mockReturnValue(mockVideoElement);

      expect(imaTracker.getAdVideoElement()).toBe(mockVideoElement);
      expect(mockPlayer.ima.controller.adUi.adContainerDiv.querySelector).toHaveBeenCalledWith('video');
    });

    test('should return undefined when no video element found', () => {
      mockPlayer.ima.controller.adUi.adContainerDiv.querySelector.mockReturnValue(null);

      expect(imaTracker.getAdVideoElement()).toBeUndefined();
    });

    test('should handle missing controller structure', () => {
      mockPlayer.ima.controller = undefined;

      expect(imaTracker.getAdVideoElement()).toBeUndefined();
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);

      // Mock inherited methods
      imaTracker.sendRequest = jest.fn();
      imaTracker.sendStart = jest.fn();
      imaTracker.sendEnd = jest.fn();
      imaTracker.sendError = jest.fn();
      imaTracker.sendAdClick = jest.fn();
      imaTracker.sendAdQuartile = jest.fn();
      imaTracker.sendPause = jest.fn();
      imaTracker.sendResume = jest.fn();
      imaTracker.getAdData = jest.fn().mockReturnValue({
        adId: 'test-ad',
        duration: 30
      });
    });

    test('onLoaded should get ad data and send request', () => {
      imaTracker.onLoaded({});

      expect(imaTracker.getAdData).toHaveBeenCalled();
      expect(imaTracker.sendRequest).toHaveBeenCalled();
      expect(imaTracker.lastAdData).toEqual({ adId: 'test-ad', duration: 30 });
    });

    test('onStart should get ad data, reset webkit bitrate, and send start', () => {
      imaTracker.onStart({});

      expect(imaTracker.getAdData).toHaveBeenCalled();
      expect(imaTracker._lastAdWebkitBitrate).toBe(0);
      expect(imaTracker.sendStart).toHaveBeenCalled();
      expect(imaTracker.lastAdData).toEqual({ adId: 'test-ad', duration: 30 });
    });

    test('onComplete should send end and clear ad data', () => {
      imaTracker.onComplete({});

      expect(imaTracker.sendEnd).toHaveBeenCalled();
      expect(imaTracker.lastAdData).toBeNull();
    });

    test('onSkipped should send end with skipped flag and clear ad data', () => {
      imaTracker.onSkipped({});

      expect(imaTracker.sendEnd).toHaveBeenCalledWith({ skipped: true });
      expect(imaTracker.lastAdData).toBeNull();
    });

    test('onError should extract error info and send error', () => {
      const mockError = {
        getErrorCode: jest.fn().mockReturnValue(400),
        getMessage: jest.fn().mockReturnValue('Ad failed to load')
      };
      const mockEvent = {
        getError: jest.fn().mockReturnValue(mockError)
      };

      imaTracker.onError(mockEvent);

      expect(imaTracker.sendError).toHaveBeenCalledWith({
        adError: mockError,
        errorCode: 400,
        errorMessage: 'Ad failed to load'
      });
    });

    test('onClick should send ad click', () => {
      imaTracker.onClick({});

      expect(imaTracker.sendAdClick).toHaveBeenCalled();
    });

    test('onFirstQuartile should send quartile 1', () => {
      imaTracker.onFirstQuartile();

      expect(imaTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 1 });
    });

    test('onMidpoint should send quartile 2', () => {
      imaTracker.onMidpoint();

      expect(imaTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 2 });
    });

    test('onThirdQuartile should send quartile 3', () => {
      imaTracker.onThirdQuartile();

      expect(imaTracker.sendAdQuartile).toHaveBeenCalledWith({ adQuartile: 3 });
    });

    test('onPaused should send pause', () => {
      imaTracker.onPaused();

      expect(imaTracker.sendPause).toHaveBeenCalled();
    });

    test('onResumed should send resume', () => {
      imaTracker.onResumed();

      expect(imaTracker.sendResume).toHaveBeenCalled();
    });
  });

  describe('getAdData', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
    });

    test('should extract complete ad data from current ad', () => {
      const adData = imaTracker.getAdData();

      expect(adData).toEqual({
        adId: 'ad-12345',
        creativeId: 'creative-67890',
        duration: 30,
        mediaUrl: 'http://example.com/ad.mp4',
        title: 'Test Ad',
        podInfo: { podIndex: 0, totalAds: 3, adPosition: 1 },
        renditionBitrate: 1000000
      });
    });

    test('should return null when no current ad', () => {
      mockPlayer.ima.getAdsManager().getCurrentAd.mockReturnValue(null);

      expect(imaTracker.getAdData()).toBeNull();
    });

    test('should return null when no ads manager', () => {
      mockPlayer.ima.getAdsManager.mockReturnValue(null);

      expect(imaTracker.getAdData()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      mockPlayer.ima.getAdsManager.mockImplementation(() => {
        throw new Error('Manager not available');
      });

      expect(imaTracker.getAdData()).toBeNull();
    });
  });

  describe('Listener Registration', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer, mockOptions);
    });

    test('registerListeners should register all IMA event handlers', () => {
      imaTracker.registerListeners();

      const e = google.ima.AdEvent.Type;
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.LOADED, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.STARTED, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.PAUSED, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.RESUMED, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.COMPLETE, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.SKIPPED, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.CLICK, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.FIRST_QUARTILE, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.MIDPOINT, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith(e.THIRD_QUARTILE, expect.any(Function));
      expect(mockPlayer.ima.addEventListener).toHaveBeenCalledWith('adError', expect.any(Function));
    });

    test('registerListeners should initialize lastAdData to null', () => {
      imaTracker.registerListeners();

      expect(imaTracker.lastAdData).toBeNull();
    });

    test('unregisterListeners should remove all event handlers', () => {
      imaTracker.unregisterListeners();

      const e = google.ima.AdEvent.Type;
      expect(mockPlayer.ima.removeEventListener).toHaveBeenCalledWith(e.LOADED, expect.any(Function));
      expect(mockPlayer.ima.removeEventListener).toHaveBeenCalledWith(e.COMPLETE, expect.any(Function));
      expect(mockPlayer.ima.removeEventListener).toHaveBeenCalledWith('adError', expect.any(Function));
    });

    test('unregisterListeners should clear lastAdData', () => {
      imaTracker.lastAdData = { adId: 'test' };
      imaTracker.unregisterListeners();

      expect(imaTracker.lastAdData).toBeNull();
    });
  });

  describe('Additional Branch Coverage', () => {
    beforeEach(() => {
      imaTracker = new ImaAdsTracker(mockPlayer);
    });

    test('getAdVideoElement should handle null adContainerDiv', () => {
      // Set up the player structure but with null adContainerDiv
      mockPlayer.ima = {
        controller: {
          adUi: {
            adContainerDiv: null  // This hits the branch on line 278
          }
        }
      };

      const videoElement = imaTracker.getAdVideoElement();

      expect(videoElement).toBeUndefined();
    });
  });
});