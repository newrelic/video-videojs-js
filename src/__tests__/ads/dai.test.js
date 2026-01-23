import DaiAdsTracker from '../../ads/dai';

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
    sendAdClick() {}
  };
});

describe('DaiAdsTracker', () => {
  let mockPlayer;
  let mockStreamManager;
  let daiTracker;

  beforeEach(() => {
    mockPlayer = {
      imaDai: jest.fn(),
      dai: { VERSION: '1.0.0' },
      ima: { dai: true },
      streamManager: true,
      tech: jest.fn().mockReturnValue({}),
      muted: jest.fn().mockReturnValue(false),
      ads: { VERSION: '6.0.0' }
    };

    mockStreamManager = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getStreamData: jest.fn().mockReturnValue({
        streamId: 'test-stream-123',
        videoUrl: 'http://example.com/stream.m3u8',
        adTagParameters: { key: 'value' }
      }),
      getCurrentAdData: jest.fn().mockReturnValue({
        adId: 'dai-ad-123',
        title: 'DAI Test Ad',
        duration: 30,
        position: 'pre',
        creative: { id: 'creative-456' }
      }),
      getCuePoints: jest.fn().mockReturnValue([0, 30, 60, -1])
    };

    // Ensure google.ima.dai.api is properly mocked
    if (!global.google.ima.dai) {
      global.google.ima.dai = {
        api: {
          StreamEvent: {
            Type: {
              LOADED: 'loaded',
              STREAM_INITIALIZED: 'stream_initialized',
              ERROR: 'error',
              AD_BREAK_STARTED: 'ad_break_started',
              AD_BREAK_ENDED: 'ad_break_ended',
              AD_PERIOD_STARTED: 'ad_period_started',
              AD_PERIOD_ENDED: 'ad_period_ended',
              STARTED: 'started',
              FIRST_QUARTILE: 'firstquartile',
              MIDPOINT: 'midpoint',
              THIRD_QUARTILE: 'thirdquartile',
              COMPLETE: 'complete',
              SKIPPED: 'skipped',
              PAUSED: 'paused',
              RESUMED: 'resumed',
              CLICKED: 'clicked',
              VIDEO_CLICKED: 'video_clicked',
              AD_ERROR: 'ad_error',
              CUEPOINTS_CHANGED: 'cuepoints_changed',
              TIMED_METADATA: 'timed_metadata'
            }
          }
        }
      };
    }

    jest.clearAllMocks();
  });

  describe('Static isUsing method', () => {
    test('should return true when player has imaDai function', () => {
      expect(DaiAdsTracker.isUsing(mockPlayer)).toBe(true);
    });

    test('should return true when player has dai with VERSION', () => {
      const playerWithDai = { dai: { VERSION: '1.0.0' } };
      expect(DaiAdsTracker.isUsing(playerWithDai)).toBe(true);
    });

    test('should return true when player has ima.dai', () => {
      const playerWithImaDai = { ima: { dai: true } };
      expect(DaiAdsTracker.isUsing(playerWithImaDai)).toBe(true);
    });

    test('should return true when player has streamManager', () => {
      const playerWithStreamManager = { streamManager: true };
      expect(DaiAdsTracker.isUsing(playerWithStreamManager)).toBe(true);
    });

    test('should return false when player has none of the DAI indicators', () => {
      const plainPlayer = { someOtherProperty: 'value' };
      expect(DaiAdsTracker.isUsing(plainPlayer)).toBe(false);
    });

    test('should return false when dai has no VERSION', () => {
      const playerNoDaiVersion = { dai: {} };
      expect(DaiAdsTracker.isUsing(playerNoDaiVersion)).toBe(false);
    });
  });

  describe('Constructor', () => {
    test('should create DAI tracker with initial state', () => {
      daiTracker = new DaiAdsTracker(mockPlayer);

      expect(daiTracker.player).toBe(mockPlayer);
      expect(daiTracker.streamManager).toBeNull();
      expect(daiTracker.currentAdData).toBeNull();
      expect(daiTracker.adBreakData).toBeNull();
      expect(daiTracker.streamData).toBeNull();
      expect(daiTracker.cuePoints).toEqual([]);
      expect(daiTracker.initialized).toBe(false);
      expect(daiTracker.eventHandlers).toBeNull();
    });

    test('should extend VideojsAdsTracker', () => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      expect(typeof daiTracker.getTrackerName).toBe('function');
    });
  });

  describe('setStreamManager', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      jest.spyOn(daiTracker, 'setupStreamManagerListeners');
    });

    test('should set stream manager and setup listeners', () => {
      daiTracker.setStreamManager(mockStreamManager);

      expect(daiTracker.streamManager).toBe(mockStreamManager);
      expect(daiTracker.setupStreamManagerListeners).toHaveBeenCalled();
      expect(daiTracker.initialized).toBe(true);
    });

    test('should handle null stream manager', () => {
      daiTracker.setStreamManager(null);

      expect(daiTracker.streamManager).toBeNull();
      expect(daiTracker.setupStreamManagerListeners).toHaveBeenCalled();
      expect(daiTracker.initialized).toBe(true);
    });
  });

  describe('setupStreamManagerListeners', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
    });

    test('should setup event handlers when streamManager and DAI API available', () => {
      daiTracker.streamManager = mockStreamManager;

      daiTracker.setupStreamManagerListeners();

      expect(daiTracker.eventHandlers).toBeDefined();
      expect(Object.keys(daiTracker.eventHandlers)).toContain('loaded');
      expect(Object.keys(daiTracker.eventHandlers)).toContain('ad_break_started');
      expect(Object.keys(daiTracker.eventHandlers)).toContain('started');
    });

    test('should register event listeners with streamManager', () => {
      daiTracker.streamManager = mockStreamManager;

      daiTracker.setupStreamManagerListeners();

      expect(mockStreamManager.addEventListener).toHaveBeenCalledTimes(9); // Number of defined DAI events
      expect(mockStreamManager.addEventListener).toHaveBeenCalledWith('loaded', expect.any(Function));
      expect(mockStreamManager.addEventListener).toHaveBeenCalledWith('ad_break_started', expect.any(Function));
    });

    test('should not setup listeners when no streamManager', () => {
      daiTracker.streamManager = null;

      daiTracker.setupStreamManagerListeners();

      expect(daiTracker.eventHandlers).toBeNull();
    });

    test('should not setup listeners when DAI API not available', () => {
      daiTracker.streamManager = mockStreamManager;
      const originalDai = global.google.ima.dai;
      global.google.ima.dai = undefined;

      daiTracker.setupStreamManagerListeners();

      expect(daiTracker.eventHandlers).toBeNull();

      global.google.ima.dai = originalDai;
    });
  });

  describe('getTrackerName', () => {
    test('should return "dai-ads"', () => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      expect(daiTracker.getTrackerName()).toBe('dai-ads');
    });
  });

  describe('getPlayerName', () => {
    test('should return "dai"', () => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      expect(daiTracker.getPlayerName()).toBe('dai');
    });
  });

  describe('getAdPartner', () => {
    test('should return "dai"', () => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      expect(daiTracker.getAdPartner()).toBe('dai');
    });
  });

  describe('Data retrieval methods', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      daiTracker.streamManager = mockStreamManager;
    });

    describe('getCuePoints', () => {
      test('should return cue points from stream manager', () => {
        expect(daiTracker.getCuePoints()).toEqual([0, 30, 60, -1]);
      });

      test('should return empty array when no stream manager', () => {
        daiTracker.streamManager = null;
        expect(daiTracker.getCuePoints()).toEqual([]);
      });

      test('should handle stream manager without getCuePoints method', () => {
        daiTracker.streamManager = {};
        expect(daiTracker.getCuePoints()).toEqual([]);
      });
    });

    describe('getCurrentAdData', () => {
      test('should return current ad data from stream manager', () => {
        const adData = daiTracker.getCurrentAdData();
        expect(adData).toEqual({
          adId: 'dai-ad-123',
          title: 'DAI Test Ad',
          duration: 30,
          position: 'pre',
          creative: { id: 'creative-456' }
        });
      });

      test('should return null when no stream manager', () => {
        daiTracker.streamManager = null;
        expect(daiTracker.getCurrentAdData()).toBeNull();
      });

      test('should handle stream manager without getCurrentAdData method', () => {
        daiTracker.streamManager = {};
        expect(daiTracker.getCurrentAdData()).toBeNull();
      });
    });

    describe('getStreamData', () => {
      test('should return stream data from stream manager', () => {
        const streamData = daiTracker.getStreamData();
        expect(streamData).toEqual({
          streamId: 'test-stream-123',
          videoUrl: 'http://example.com/stream.m3u8',
          adTagParameters: { key: 'value' }
        });
      });

      test('should return null when no stream manager', () => {
        daiTracker.streamManager = null;
        expect(daiTracker.getStreamData()).toBeNull();
      });
    });
  });

  describe('Ad data getters from currentAdData', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      daiTracker.currentAdData = {
        adId: 'test-dai-ad',
        title: 'Test DAI Advertisement',
        duration: 30,
        position: 'mid',
        creative: { id: 'creative-789' },
        mediaUrl: 'http://example.com/dai-ad.mp4'
      };
    });

    test('getVideoId should return ad ID', () => {
      expect(daiTracker.getVideoId()).toBe('test-dai-ad');
    });

    test('getTitle should return ad title', () => {
      expect(daiTracker.getTitle()).toBe('Test DAI Advertisement');
    });

    test('getDuration should return duration in milliseconds', () => {
      expect(daiTracker.getDuration()).toBe(30000);
    });

    test('getAdPosition should return ad position', () => {
      expect(daiTracker.getAdPosition()).toBe('mid');
    });

    test('getSrc should return media URL', () => {
      expect(daiTracker.getSrc()).toBe('http://example.com/dai-ad.mp4');
    });

    test('getAdCreativeId should return creative ID', () => {
      expect(daiTracker.getAdCreativeId()).toBe('creative-789');
    });

    test('methods should return null when no currentAdData', () => {
      daiTracker.currentAdData = null;

      expect(daiTracker.getVideoId()).toBeNull();
      expect(daiTracker.getTitle()).toBeNull();
      expect(daiTracker.getDuration()).toBeNull();
      expect(daiTracker.getAdPosition()).toBeNull();
      expect(daiTracker.getSrc()).toBeNull();
      expect(daiTracker.getAdCreativeId()).toBeNull();
    });

    test('methods should handle missing properties gracefully', () => {
      daiTracker.currentAdData = { adId: 'partial-data' };

      expect(daiTracker.getVideoId()).toBe('partial-data');
      expect(daiTracker.getTitle()).toBeNull();
      expect(daiTracker.getDuration()).toBeNull();
      expect(daiTracker.getAdPosition()).toBeNull();
      expect(daiTracker.getSrc()).toBeNull();
      expect(daiTracker.getAdCreativeId()).toBeNull();
    });
  });
  describe('Stream Event Handlers', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
      daiTracker.streamManager = mockStreamManager;

      // Mock parent class methods
      daiTracker.sendRequest = jest.fn();
      daiTracker.sendDownload = jest.fn();
      daiTracker.sendError = jest.fn();
      daiTracker.sendStart = jest.fn();
      daiTracker.sendEnd = jest.fn();
      daiTracker.sendPause = jest.fn();
      daiTracker.sendResume = jest.fn();
      daiTracker.sendAdQuartile = jest.fn();
      daiTracker.sendAdClick = jest.fn();
      daiTracker.sendAdBreakStart = jest.fn();
      daiTracker.sendAdBreakEnd = jest.fn();

      // Mock data extraction methods
      daiTracker.extractStreamData = jest.fn().mockReturnValue({ streamId: 'test-stream' });
      daiTracker.extractErrorData = jest.fn().mockReturnValue({ code: 'ERROR_001', message: 'Stream error' });
      daiTracker.extractAdBreakData = jest.fn().mockReturnValue({ adBreakId: 'break-001' });
      daiTracker.extractAdData = jest.fn().mockReturnValue({ adId: 'ad-001' });
      daiTracker.extractCuePoints = jest.fn().mockReturnValue([{ time: 30 }]);
    });

    describe('Stream Events', () => {
      test('onStreamLoaded should extract stream data and send request', () => {
        const event = { streamData: 'mock-stream' };

        daiTracker.onStreamLoaded(event);

        expect(daiTracker.extractStreamData).toHaveBeenCalledWith(event);
        expect(daiTracker.sendRequest).toHaveBeenCalled();
      });

      test('onStreamInitialized should send download event', () => {
        const event = { streamInitialized: true };

        daiTracker.onStreamInitialized(event);

        expect(daiTracker.sendDownload).toHaveBeenCalledWith({ state: 'stream-initialized' });
      });

      test('onStreamError should extract error data and send error', () => {
        const event = { error: 'stream-error' };

        daiTracker.onStreamError(event);

        expect(daiTracker.extractErrorData).toHaveBeenCalledWith(event);
        expect(daiTracker.sendError).toHaveBeenCalled();
      });
    });

    describe('Ad Break Events', () => {
      test('onAdBreakStarted should extract ad break data and send start', () => {
        const event = { adBreak: 'mock-break' };

        daiTracker.onAdBreakStarted(event);

        expect(daiTracker.extractAdBreakData).toHaveBeenCalledWith(event);
        expect(daiTracker.sendAdBreakStart).toHaveBeenCalled();
      });

      test('onAdBreakEnded should send ad break end', () => {
        const event = { adBreakEnded: true };

        daiTracker.onAdBreakEnded(event);

        expect(daiTracker.sendAdBreakEnd).toHaveBeenCalled();
      });
    });

    describe('Ad Period Events', () => {
      test('onAdPeriodStarted should call onAdBreakStarted when no current break', () => {
        const event = { adPeriod: 'mock-period' };
        daiTracker.adBreakData = null; // No current break
        const spy = jest.spyOn(daiTracker, 'onAdBreakStarted');

        daiTracker.onAdPeriodStarted(event);

        expect(spy).toHaveBeenCalledWith(event);
      });

      test('onAdPeriodEnded should just log and not send end', () => {
        const event = { adPeriodEnded: true };

        // This should not throw and should not call sendEnd
        expect(() => daiTracker.onAdPeriodEnded(event)).not.toThrow();
        expect(daiTracker.sendEnd).not.toHaveBeenCalled();
      });
    });

    describe('Individual Ad Events', () => {
      test('onAdStarted should extract ad data and send start', () => {
        const event = { ad: 'mock-ad' };

        daiTracker.onAdStarted(event);

        expect(daiTracker.extractAdData).toHaveBeenCalledWith(event);
        expect(daiTracker.sendStart).toHaveBeenCalled();
      });

      test('onAdComplete should send end', () => {
        const event = { adCompleted: true };

        daiTracker.onAdComplete(event);

        expect(daiTracker.sendEnd).toHaveBeenCalled();
      });

      test('onAdSkipped should send end with skipped flag', () => {
        const event = { adSkipped: true };

        daiTracker.onAdSkipped(event);

        expect(daiTracker.sendEnd).toHaveBeenCalledWith({ skipped: true });
      });

      test('onAdPaused should send pause', () => {
        const event = { adPaused: true };

        daiTracker.onAdPaused(event);

        expect(daiTracker.sendPause).toHaveBeenCalled();
      });

      test('onAdResumed should send resume', () => {
        const event = { adResumed: true };

        daiTracker.onAdResumed(event);

        expect(daiTracker.sendResume).toHaveBeenCalled();
      });

      test('onAdFirstQuartile should send first quartile', () => {
        const event = { quartile: 1 };

        daiTracker.onAdFirstQuartile(event);

        expect(daiTracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 1 });
      });

      test('onAdMidpoint should send midpoint quartile', () => {
        const event = { quartile: 2 };

        daiTracker.onAdMidpoint(event);

        expect(daiTracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 2 });
      });

      test('onAdThirdQuartile should send third quartile', () => {
        const event = { quartile: 3 };

        daiTracker.onAdThirdQuartile(event);

        expect(daiTracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 3 });
      });

      test('onAdClicked should send ad click', () => {
        const event = { clickUrl: 'http://example.com/click' };

        daiTracker.onAdClicked(event);

        expect(daiTracker.sendAdClick).toHaveBeenCalled();
      });

      test('onAdError should send error', () => {
        const event = { adError: 'mock-error' };

        daiTracker.onAdError(event);

        expect(daiTracker.sendError).toHaveBeenCalledWith(event);
      });
    });

    describe('Cue Points and Metadata Events', () => {
      test('onCuePointsChanged should extract and store cue points', () => {
        const event = { cuePoints: 'mock-cues' };

        daiTracker.onCuePointsChanged(event);

        expect(daiTracker.extractCuePoints).toHaveBeenCalledWith(event);
        expect(daiTracker.cuePoints).toEqual([{ time: 30 }]);
      });

      test('onTimedMetadata should handle metadata events', () => {
        const event = { metadata: 'mock-metadata' };

        // This method exists but may just log - test that it doesn't throw
        expect(() => daiTracker.onTimedMetadata(event)).not.toThrow();
      });
    });
  });

  describe('Data Extraction Methods', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
    });

    test('extractStreamData should extract and return stream data', () => {
      const mockStreamData = {
        streamId: 'stream-123',
        url: 'http://stream.com/manifest.m3u8',
        adTagParameters: { param1: 'value1' }
      };
      const event = {
        getStreamData: jest.fn().mockReturnValue(mockStreamData)
      };
      daiTracker.getStreamType = jest.fn().mockReturnValue('live');

      const result = daiTracker.extractStreamData(event);

      expect(result).toEqual({
        streamId: 'stream-123',
        url: 'http://stream.com/manifest.m3u8',
        adTagParameters: { param1: 'value1' },
        streamType: 'live'
      });
    });

    test('extractStreamData should handle errors gracefully', () => {
      const event = {
        getStreamData: jest.fn().mockImplementation(() => { throw new Error('Stream error'); })
      };

      const result = daiTracker.extractStreamData(event);

      expect(result).toEqual({});
    });

    test('extractAdBreakData should extract and return ad break data', () => {
      const mockAdBreak = {
        id: 'break-123',
        title: 'Pre-roll Break',
        ads: ['ad1', 'ad2', 'ad3']
      };
      const event = {
        getAdBreak: jest.fn().mockReturnValue(mockAdBreak)
      };
      daiTracker.getAdPosition = jest.fn().mockReturnValue('pre-roll');

      const result = daiTracker.extractAdBreakData(event);

      expect(result).toEqual({
        adBreakId: 'break-123',
        adBreakTitle: 'Pre-roll Break',
        adCount: 3,
        position: 'pre-roll'
      });
    });

    test('extractAdBreakData should handle errors gracefully', () => {
      const event = {
        getAdBreak: jest.fn().mockImplementation(() => { throw new Error('AdBreak error'); })
      };

      const result = daiTracker.extractAdBreakData(event);

      expect(result).toEqual({});
    });

    test('extractAdData should extract and return ad data', () => {
      const mockAd = {
        getAdId: jest.fn().mockReturnValue('ad-456'),
        getTitle: jest.fn().mockReturnValue('Test Advertisement'),
        getDuration: jest.fn().mockReturnValue(30),
        getCreativeId: jest.fn().mockReturnValue('creative-789'),
        getDescription: jest.fn().mockReturnValue('Ad description'),
        getAdvertiserName: jest.fn().mockReturnValue('Advertiser Co'),
        getClickThroughUrl: jest.fn().mockReturnValue('http://click.com'),
        getDealId: jest.fn().mockReturnValue('deal-123'),
        getWrapperAdIds: jest.fn().mockReturnValue(['wrapper-1'])
      };
      const event = {
        getAd: jest.fn().mockReturnValue(mockAd)
      };
      daiTracker.getAdPosition = jest.fn().mockReturnValue('mid-roll');

      const result = daiTracker.extractAdData(event);

      expect(result).toEqual({
        adId: 'ad-456',
        creativeId: 'creative-789',
        duration: 30,
        title: 'Test Advertisement',
        description: 'Ad description',
        advertiserName: 'Advertiser Co',
        clickThroughUrl: 'http://click.com',
        dealId: 'deal-123',
        wrapperAdIds: ['wrapper-1'],
        position: 'mid-roll'
      });
    });

    test('extractAdData should handle errors gracefully', () => {
      const event = {
        getAd: jest.fn().mockImplementation(() => { throw new Error('Ad error'); })
      };

      const result = daiTracker.extractAdData(event);

      expect(result).toEqual({});
    });

    test('extractErrorData should extract and return error data', () => {
      const mockError = {
        getErrorCode: jest.fn().mockReturnValue('ERR_001'),
        getMessage: jest.fn().mockReturnValue('Stream failed to load'),
        getInnerError: jest.fn().mockReturnValue('Network timeout')
      };
      const event = {
        getError: jest.fn().mockReturnValue(mockError)
      };

      const result = daiTracker.extractErrorData(event);

      expect(result).toEqual({
        errorCode: 'ERR_001',
        errorMessage: 'Stream failed to load',
        innerError: 'Network timeout'
      });
    });

    test('extractErrorData should handle errors gracefully', () => {
      const event = {
        getError: jest.fn().mockImplementation(() => { throw new Error('Error extraction failed'); })
      };

      const result = daiTracker.extractErrorData(event);

      expect(result).toEqual({ errorMessage: 'Unknown DAI error' });
    });

    test('extractCuePoints should extract and return cue points', () => {
      const mockCuePoints = [
        { time: 15000, type: 'adBreak' },
        { time: 45000, type: 'adBreak' }
      ];
      const event = {
        getCuepoints: jest.fn().mockReturnValue(mockCuePoints)  // Note: lowercase 'p'
      };

      const result = daiTracker.extractCuePoints(event);

      expect(result).toEqual(mockCuePoints);
    });

    test('extractCuePoints should handle errors gracefully', () => {
      const event = {
        getCuepoints: jest.fn().mockImplementation(() => { throw new Error('CuePoints error'); })  // Note: lowercase 'p'
      };

      const result = daiTracker.extractCuePoints(event);

      expect(result).toEqual([]);
    });
  });


  describe('Additional Coverage Methods', () => {
    beforeEach(() => {
      daiTracker = new DaiAdsTracker(mockPlayer);
    });

    test('getPlayerVersion should return dai VERSION when available', () => {
      mockPlayer.dai = { VERSION: '1.2.3' };

      const version = daiTracker.getPlayerVersion();

      expect(version).toBe('1.2.3');
    });

    test('getPlayerVersion should return ima-dai VERSION when dai not available', () => {
      mockPlayer.dai = undefined;
      mockPlayer.ima = { VERSION: '2.3.4' };

      const version = daiTracker.getPlayerVersion();

      expect(version).toBe('ima-dai: 2.3.4');
    });

    test('getPlayerVersion should return unknown when no version available', () => {
      mockPlayer.dai = undefined;
      mockPlayer.ima = undefined;

      const version = daiTracker.getPlayerVersion();

      expect(version).toBe('unknown');
    });

    test('getAdCuePoints should return cuePoints array', () => {
      daiTracker.cuePoints = [{ time: 15 }, { time: 45 }];

      const cuePoints = daiTracker.getAdCuePoints();

      expect(cuePoints).toEqual([{ time: 15 }, { time: 45 }]);
    });

    test('getBitrate should return tech bandwidth when available', () => {
      // Mock the getTech method
      daiTracker.getTech = jest.fn().mockReturnValue({
        tech: {
          stats: { bandwidth: 5000000 }
        }
      });

      const bitrate = daiTracker.getBitrate();

      expect(bitrate).toBe(5000000);
    });

    test('getBitrate should return undefined when no tech stats', () => {
      // Mock the getTech method
      daiTracker.getTech = jest.fn().mockReturnValue({});

      const bitrate = daiTracker.getBitrate();

      expect(bitrate).toBeUndefined();
    });

    test('getRenditionBitrate should return bitrate from tech', () => {
      // Mock the getTech method
      daiTracker.getTech = jest.fn().mockReturnValue({
        getRenditionBitrate: jest.fn().mockReturnValue(3000000)
      });

      const bitrate = daiTracker.getRenditionBitrate();

      expect(bitrate).toBe(3000000);
    });

    test('getRenditionBitrate should return undefined when no tech method', () => {
      // Mock the getTech method
      daiTracker.getTech = jest.fn().mockReturnValue({});

      const bitrate = daiTracker.getRenditionBitrate();

      expect(bitrate).toBeUndefined();
    });

    test('isLiveStream should return true for live streams', () => {
      daiTracker.streamData = { streamType: 'live' };

      const isLive = daiTracker.isLiveStream();

      expect(isLive).toBe(true);
    });

    test('isLiveStream should return false for vod streams', () => {
      daiTracker.streamData = { streamType: 'vod' };

      const isLive = daiTracker.isLiveStream();

      expect(isLive).toBe(false);
    });

    test('getCurrentAdBreak should return current ad break data', () => {
      daiTracker.adBreakData = { id: 'break-1', title: 'Pre-roll' };

      const adBreak = daiTracker.getCurrentAdBreak();

      expect(adBreak).toEqual({ id: 'break-1', title: 'Pre-roll' });
    });

    test('getCurrentAd should return current ad data', () => {
      daiTracker.currentAdData = { id: 'ad-1', title: 'Test Ad' };

      const ad = daiTracker.getCurrentAd();

      expect(ad).toEqual({ id: 'ad-1', title: 'Test Ad' });
    });

    test('getAdPosition should return position from currentAdData when available', () => {
      // Test explicit position in currentAdData
      daiTracker.currentAdData = { position: 'pre-roll' };
      expect(daiTracker.getAdPosition()).toBe('pre-roll');

      daiTracker.currentAdData = { position: 'mid-roll' };
      expect(daiTracker.getAdPosition()).toBe('mid-roll');

      daiTracker.currentAdData = { position: 'post-roll' };
      expect(daiTracker.getAdPosition()).toBe('post-roll');
    });

    test('getAdPosition should return null when no position data available', () => {
      // Test when currentAdData exists but no position
      daiTracker.currentAdData = { id: 'ad-123' };
      expect(daiTracker.getAdPosition()).toBeNull();

      // Test when no currentAdData and no adBreakData
      daiTracker.currentAdData = null;
      daiTracker.adBreakData = null;
      expect(daiTracker.getAdPosition()).toBeNull();
    });

    test('getStreamType should return stream type from streamData', () => {
      // Test explicit streamType in streamData
      daiTracker.streamData = { streamType: 'live' };
      const streamType = daiTracker.getStreamType();
      expect(streamType).toBe('live');

      daiTracker.streamData = { streamType: 'vod' };
      const streamType2 = daiTracker.getStreamType();
      expect(streamType2).toBe('vod');
    });

    test('getStreamType should infer from player duration when no streamData', () => {
      // Test live stream inference (duration = Infinity)
      daiTracker.streamData = null;
      mockPlayer.duration = jest.fn().mockReturnValue(Infinity);

      const liveType = daiTracker.getStreamType();
      expect(liveType).toBe('live');

      // Test vod stream inference (finite duration)
      mockPlayer.duration = jest.fn().mockReturnValue(120);

      const vodType = daiTracker.getStreamType();
      expect(vodType).toBe('vod');
    });

    test('getAdPosition should use timing fallback when adBreakData exists', () => {
      // Setup conditions for timing fallback: no currentAdData but adBreakData exists
      daiTracker.currentAdData = null;
      daiTracker.adBreakData = { id: 'break-1' }; // This prevents early return

      // Test pre-roll timing (currentTime < 5)
      mockPlayer.currentTime = jest.fn().mockReturnValue(2);
      mockPlayer.duration = jest.fn().mockReturnValue(120);

      const prePosition = daiTracker.getAdPosition();
      expect(prePosition).toBe('pre');

      // Test post-roll timing (currentTime > duration - 10)
      mockPlayer.currentTime = jest.fn().mockReturnValue(115);
      mockPlayer.duration = jest.fn().mockReturnValue(120);

      const postPosition = daiTracker.getAdPosition();
      expect(postPosition).toBe('post');

      // Test mid-roll timing (in between)
      mockPlayer.currentTime = jest.fn().mockReturnValue(60);
      mockPlayer.duration = jest.fn().mockReturnValue(120);

      const midPosition = daiTracker.getAdPosition();
      expect(midPosition).toBe('mid');
    });

    test('getAdPosition timing fallback should handle edge cases', () => {
      // Setup for timing fallback
      daiTracker.currentAdData = null;
      daiTracker.adBreakData = { id: 'break-1' };

      // Test when currentTime method is missing
      mockPlayer.currentTime = undefined;
      mockPlayer.duration = jest.fn().mockReturnValue(120);

      const position1 = daiTracker.getAdPosition();
      expect(position1).toBe('pre'); // Should default to pre when currentTime is 0

      // Test when duration method is missing
      mockPlayer.currentTime = jest.fn().mockReturnValue(50);
      mockPlayer.duration = undefined;

      const position2 = daiTracker.getAdPosition();
      expect(position2).toBe('mid'); // Should default to mid when no duration

      // Test when duration is 0
      mockPlayer.currentTime = jest.fn().mockReturnValue(50);
      mockPlayer.duration = jest.fn().mockReturnValue(0);

      const position3 = daiTracker.getAdPosition();
      expect(position3).toBe('mid'); // Should default to mid when duration is 0
    });

    test('getAdCreativeId should use stream manager fallback', () => {
      // Test fallback to stream manager when currentAdData has no creativeId
      daiTracker.currentAdData = { adId: 'test' }; // No creativeId or creative
      daiTracker.streamManager = {
        getCurrentAdData: jest.fn().mockReturnValue({
          creative: { id: 'fallback-creative-123' }
        })
      };

      const creativeId = daiTracker.getAdCreativeId();

      expect(creativeId).toBe('fallback-creative-123');
      expect(daiTracker.streamManager.getCurrentAdData).toHaveBeenCalled();
    });

    test('getTitle should use stream manager fallback', () => {
      // Test fallback to stream manager when currentAdData has no title
      daiTracker.currentAdData = { adId: 'test' }; // No title
      daiTracker.streamManager = {
        getCurrentAdData: jest.fn().mockReturnValue({
          title: 'Fallback Title'
        })
      };

      const title = daiTracker.getTitle();

      expect(title).toBe('Fallback Title');
      expect(daiTracker.streamManager.getCurrentAdData).toHaveBeenCalled();
    });

    test('getSrc should use stream manager fallback', () => {
      // Test fallback to stream manager when currentAdData has no mediaUrl
      daiTracker.currentAdData = { adId: 'test' }; // No mediaUrl
      daiTracker.streamData = null; // No streamData either
      daiTracker.streamManager = {
        getStreamData: jest.fn().mockReturnValue({
          videoUrl: 'https://fallback-stream.com/video.m3u8'
        })
      };

      const src = daiTracker.getSrc();

      expect(src).toBe('https://fallback-stream.com/video.m3u8');
      expect(daiTracker.streamManager.getStreamData).toHaveBeenCalled();
    });

    test('getPlayhead should handle streamManager error gracefully', () => {
      // Test the try/catch block in getPlayhead when streamManager throws
      daiTracker.streamManager = {
        getStreamTime: jest.fn().mockImplementation(() => {
          throw new Error('StreamManager error');
        })
      };
      mockPlayer.currentTime = jest.fn().mockReturnValue(5.5);

      const playhead = daiTracker.getPlayhead();

      // Should fallback to player current time * 1000
      expect(playhead).toBe(5500);
    });
  });

});