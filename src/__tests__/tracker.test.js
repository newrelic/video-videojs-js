import VideojsTracker from '../tracker';

// Mock Video.js player
const createMockPlayer = (overrides = {}) => ({
  tech: jest.fn().mockReturnValue({
    vhs: null,
    hls: null,
    shakaPlayer_: null,
    hls_: null
  }),
  currentTime: jest.fn().mockReturnValue(10),
  duration: jest.fn().mockReturnValue(100),
  currentSrc: jest.fn().mockReturnValue('http://example.com/video.mp4'),
  muted: jest.fn().mockReturnValue(false),
  playbackRate: jest.fn().mockReturnValue(1),
  autoplay: jest.fn().mockReturnValue(false),
  isFullscreen: jest.fn().mockReturnValue(false),
  preload: jest.fn().mockReturnValue('metadata'),
  language: jest.fn().mockReturnValue('en'),
  videoHeight: jest.fn().mockReturnValue(720),
  videoWidth: jest.fn().mockReturnValue(1280),
  name: jest.fn().mockReturnValue('videojs'),
  version: '8.0.0',
  error: jest.fn().mockReturnValue(null),
  audioTracks: jest.fn().mockReturnValue([]),
  on: jest.fn(),
  off: jest.fn(),
  mediainfo: null,
  ads: null,
  ima: null,
  absoluteTime: null,
  ...overrides
});

const createMockOptions = (overrides = {}) => ({
  info: {
    beacon: 'test-beacon',
    licenseKey: 'test-license',
    applicationID: 'test-app-id'
  },
  customData: {},
  ...overrides
});

describe('VideojsTracker', () => {
  let mockPlayer;
  let mockOptions;
  let tracker;

  beforeEach(() => {
    mockPlayer = createMockPlayer();
    mockOptions = createMockOptions();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (tracker) {
      tracker.unregisterListeners();
    }
  });

  describe('Constructor', () => {
    test('should create tracker instance with default values', () => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);

      expect(tracker.player).toBe(mockPlayer);
      expect(tracker.isContentEnd).toBe(false);
      expect(tracker.imaAdCuePoints).toBe('');
      expect(tracker.daiInitialized).toBe(false);
    });

    test('should call nrvideo.Core.addTracker', () => {
      const nrvideo = require('@newrelic/video-core').default;

      tracker = new VideojsTracker(mockPlayer, mockOptions);

      expect(nrvideo.Core.addTracker).toHaveBeenCalledWith(tracker, mockOptions);
    });
  });

  describe('Getter Methods', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('getTrackerName should return "videojs"', () => {
      expect(tracker.getTrackerName()).toBe('videojs');
    });

    test('getInstrumentationProvider should return "New Relic"', () => {
      expect(tracker.getInstrumentationProvider()).toBe('New Relic');
    });

    test('getInstrumentationName should return player name', () => {
      expect(tracker.getInstrumentationName()).toBe('videojs');
    });

    test('getInstrumentationVersion should return player version', () => {
      expect(tracker.getInstrumentationVersion()).toBe('8.0.0');
    });

    test('getTrackerVersion should return package version', () => {
      expect(tracker.getTrackerVersion()).toBe('4.0.3');
    });
  });

  describe('getPlayhead', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return ads snapshot time when ads are playing', () => {
      mockPlayer.ads = {
        state: 'ads-playback',
        snapshot: { currentTime: 5 }
      };

      expect(tracker.getPlayhead()).toBe(5000);
    });

    test('should return absolute time when available', () => {
      mockPlayer.absoluteTime = jest.fn().mockReturnValue(15);

      expect(tracker.getPlayhead()).toBe(15000);
    });

    test('should return current time as fallback', () => {
      expect(tracker.getPlayhead()).toBe(10000);
    });
  });

  describe('getDuration', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return mediainfo duration for Brightcove', () => {
      mockPlayer.mediainfo = { duration: 120 };

      expect(tracker.getDuration()).toBe(120000);
    });

    test('should return player duration as fallback', () => {
      expect(tracker.getDuration()).toBe(100000);
    });
  });

  describe('getTitle', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return mediainfo name for Brightcove', () => {
      mockPlayer.mediainfo = { name: 'Test Video' };

      expect(tracker.getTitle()).toBe('Test Video');
    });

    test('should return undefined when no mediainfo', () => {
      expect(tracker.getTitle()).toBeUndefined();
    });
  });

  describe('getId', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return mediainfo id for Brightcove', () => {
      mockPlayer.mediainfo = { id: '12345' };

      expect(tracker.getId()).toBe('12345');
    });

    test('should return undefined when no mediainfo', () => {
      expect(tracker.getId()).toBeUndefined();
    });
  });

  describe('getSrc', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return tech source when available', () => {
      const mockTech = {
        getSrc: jest.fn().mockReturnValue('http://tech.example.com/video.mp4')
      };
      jest.spyOn(tracker, 'getTech').mockReturnValue(mockTech);

      expect(tracker.getSrc()).toBe('http://tech.example.com/video.mp4');
    });

    test('should return player current source as fallback', () => {
      jest.spyOn(tracker, 'getTech').mockReturnValue(null);

      expect(tracker.getSrc()).toBe('http://example.com/video.mp4');
    });
  });

  describe('getPlayerName', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return player name when available', () => {
      expect(tracker.getPlayerName()).toBe('videojs');
    });

    test('should return "videojs" as fallback', () => {
      mockPlayer.name = jest.fn().mockReturnValue(null);

      expect(tracker.getPlayerName()).toBe('videojs');
    });
  });

  describe('getPlayerVersion', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return player version when available', () => {
      expect(tracker.getPlayerVersion()).toBe('8.0.0');
    });

    test('should return global videojs version as fallback', () => {
      mockPlayer.version = undefined;

      expect(tracker.getPlayerVersion()).toBe('8.0.0');
    });
  });

  describe('Basic Property Getters', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('isMuted should return player muted state', () => {
      expect(tracker.isMuted()).toBe(false);
    });

    test('getLanguage should return player language', () => {
      expect(tracker.getLanguage()).toBe('en');
    });

    test('getPlayrate should return playback rate', () => {
      expect(tracker.getPlayrate()).toBe(1);
    });

    test('isAutoplayed should return autoplay setting', () => {
      expect(tracker.isAutoplayed()).toBe(false);
    });

    test('isFullscreen should return fullscreen state', () => {
      expect(tracker.isFullscreen()).toBe(false);
    });

    test('getPreload should return preload setting', () => {
      expect(tracker.getPreload()).toBe('metadata');
    });

    test('getRenditionHeight should return video height', () => {
      expect(tracker.getRenditionHeight()).toBe(720);
    });

    test('getRenditionWidth should return video width', () => {
      expect(tracker.getRenditionWidth()).toBe(1280);
    });
  });

  describe('getTech', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return ContribHlsTech when using contrib-hls', () => {
      const mockTech = { vhs: { playlists: { media: jest.fn() } } };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = tracker.getTech();
      expect(tech).toBeDefined();
    });

    test('should return HlsJsTech when using hls.js', () => {
      const mockTech = { vhs_: { levels: [], currentLevel: 0 } };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = tracker.getTech();
      expect(tech).toBeDefined();
    });

    test('should return ShakaTech when using Shaka Player', () => {
      const mockTech = {
        shakaPlayer: {
          getManifestUri: jest.fn(),
          getStats: jest.fn().mockReturnValue({ streamBandwidth: 1000000 }),
          getVariantTracks: jest.fn()
        }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      const tech = tracker.getTech();
      expect(tech).toBeDefined();
    });

    test('should return undefined when no tech available', () => {
      mockPlayer.tech.mockReturnValue(null);

      expect(tracker.getTech()).toBeUndefined();
    });
  });

  describe('getBitrate', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should return VHS bitrate when available', () => {
      const mockTech = {
        vhs: {
          playlists: {
            media: jest.fn().mockReturnValue({
              attributes: { BANDWIDTH: 1000000 }
            })
          }
        }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      expect(tracker.getBitrate()).toBe(1000000);
    });

    test('should return HLS bitrate when available', () => {
      const mockTech = {
        hls: {
          playlists: {
            media: jest.fn().mockReturnValue({
              attributes: { BANDWIDTH: 2000000 }
            })
          }
        }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      expect(tracker.getBitrate()).toBe(2000000);
    });

    test('should return Shaka Player bitrate when available', () => {
      const mockTech = {
        shakaPlayer_: {
          getStats: jest.fn().mockReturnValue({ streamBandwidth: 1500000 })
        }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      expect(tracker.getBitrate()).toBe(1500000);
    });

    test('should return HLS.js bitrate when available', () => {
      const mockTech = {
        hls_: {
          levels: [
            { bitrate: 500000 },
            { bitrate: 1000000 },
            { bitrate: 2000000 }
          ],
          currentLevel: 1
        }
      };
      mockPlayer.tech.mockReturnValue(mockTech);

      expect(tracker.getBitrate()).toBe(1000000);
    });

    test('should return DASH.js bitrate when available', () => {
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn().mockReturnValue(1),
        getBitrateInfoListFor: jest.fn().mockReturnValue([
          { bitrate: 500000 },
          { bitrate: 1000000 }
        ])
      };

      expect(tracker.getBitrate()).toBe(2000000); // audio + video
    });

    test('should return null when no bitrate available', () => {
      mockPlayer.tech.mockReturnValue({});

      expect(tracker.getBitrate()).toBeNull();
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
      // Mock the parent class methods
      tracker.sendDownload = jest.fn();
      tracker.sendRequest = jest.fn();
      tracker.sendPause = jest.fn();
      tracker.sendResume = jest.fn();
      tracker.sendBufferEnd = jest.fn();
      tracker.sendBufferStart = jest.fn();
      tracker.sendSeekStart = jest.fn();
      tracker.sendSeekEnd = jest.fn();
      tracker.sendStart = jest.fn();
      tracker.sendEnd = jest.fn();
      tracker.sendError = jest.fn();
    });

    test('onDownload should send download event', () => {
      const event = { type: 'loadstart' };
      tracker.onDownload(event);

      expect(tracker.sendDownload).toHaveBeenCalledWith({ state: 'loadstart' });
    });

    test('onPlay should send request event', () => {
      tracker.onPlay();

      expect(tracker.sendRequest).toHaveBeenCalled();
    });

    test('onPause should send pause event', () => {
      tracker.onPause();

      expect(tracker.sendPause).toHaveBeenCalled();
    });

    test('onPlaying should send resume and buffer end events', () => {
      tracker.onPlaying();

      expect(tracker.sendResume).toHaveBeenCalled();
      expect(tracker.sendBufferEnd).toHaveBeenCalled();
    });

    test('onAbort should send end event', () => {
      tracker.onAbort();

      expect(tracker.sendEnd).toHaveBeenCalled();
    });

    test('onSeeking should send seek start event', () => {
      tracker.onSeeking();

      expect(tracker.sendSeekStart).toHaveBeenCalled();
    });

    test('onSeeked should send seek end event', () => {
      tracker.onSeeked();

      expect(tracker.sendSeekEnd).toHaveBeenCalled();
    });

    test('onWaiting should send buffer start event', () => {
      tracker.onWaiting();

      expect(tracker.sendBufferStart).toHaveBeenCalled();
    });

    test('onTimeupdate should send start when playhead > 0.1', () => {
      jest.spyOn(tracker, 'getPlayhead').mockReturnValue(1000);
      tracker.onTimeupdate();

      expect(tracker.sendStart).toHaveBeenCalled();
    });

    test('onTimeupdate should not send start when playhead <= 0.1', () => {
      jest.spyOn(tracker, 'getPlayhead').mockReturnValue(0.05);
      tracker.onTimeupdate();

      expect(tracker.sendStart).not.toHaveBeenCalled();
    });

    test('onError should send error event with code and message', () => {
      const error = { code: 4, message: 'Video not found' };
      mockPlayer.error.mockReturnValue(error);

      tracker.onError();

      expect(tracker.sendError).toHaveBeenCalledWith({
        errorCode: 4,
        errorMessage: 'Video not found'
      });
    });

    test('onError should not send error when no error', () => {
      mockPlayer.error.mockReturnValue(null);

      tracker.onError();

      expect(tracker.sendError).not.toHaveBeenCalled();
    });
  });

  describe('onEnded', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
      tracker.sendEnd = jest.fn();
    });

    test('should send end immediately when no ads tracker', () => {
      tracker.onEnded();

      expect(tracker.sendEnd).toHaveBeenCalled();
    });

    test('should set isContentEnd when ads tracker exists', () => {
      tracker.adsTracker = { someMethod: jest.fn() };

      tracker.onEnded();

      expect(tracker.isContentEnd).toBe(true);
      expect(tracker.sendEnd).not.toHaveBeenCalled();
    });

    test('should send end when content end and no post-roll ads', () => {
      tracker.adsTracker = { someMethod: jest.fn() };
      tracker.imaAdCuePoints = [0, 30]; // No -1 means no post-roll

      tracker.onEnded();

      expect(tracker.sendEnd).toHaveBeenCalled();
    });
  });

  describe('onDispose', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
      tracker.sendEnd = jest.fn();
    });

    test('should send end event', () => {
      tracker.onDispose();

      expect(tracker.sendEnd).toHaveBeenCalled();
    });
  });

  describe('Listener Registration', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('registerListeners should register all event handlers', () => {
      tracker.registerListeners();

      // Verify key events are registered
      expect(mockPlayer.on).toHaveBeenCalledWith('loadstart', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('play', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('seeking', expect.any(Function));
      expect(mockPlayer.on).toHaveBeenCalledWith('seeked', expect.any(Function));
    });

    test('unregisterListeners should remove all event handlers', () => {
      tracker.unregisterListeners();

      // Verify key events are unregistered
      expect(mockPlayer.off).toHaveBeenCalledWith('loadstart', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('play', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPlayer.off).toHaveBeenCalledWith('ended', expect.any(Function));
    });
  });

  describe('Ad Tracking Integration', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
      tracker.setAdsTracker = jest.fn();
    });

    test('onAdsready should set ImaAdsTracker when IMA is available', () => {
      mockPlayer.ima = {
        getAdsManager: jest.fn().mockReturnValue({
          getCuePoints: jest.fn().mockReturnValue([0, 30, -1])
        })
      };

      tracker.onAdsready();

      expect(tracker.setAdsTracker).toHaveBeenCalled();
    });

    test('onAdStart should set currentAdPlaying flag', () => {
      tracker.onAdStart();

      expect(tracker.currentAdPlaying).toBe(true);
    });

    test('onAdEnd should send end when content ended', () => {
      tracker.isContentEnd = true;
      tracker.sendEnd = jest.fn();

      tracker.onAdEnd();

      expect(tracker.sendEnd).toHaveBeenCalled();
    });

    test('onStreamManager should set DAI tracker', () => {
      const mockStreamManager = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      const event = { StreamManager: mockStreamManager };

      tracker.onStreamManager(event);

      expect(tracker.setAdsTracker).toHaveBeenCalled();
    });
  });

  describe('Branch Coverage Tests', () => {
    beforeEach(() => {
      tracker = new VideojsTracker(mockPlayer, mockOptions);
    });

    test('should test DASH player fallback branches', () => {
      // Test when player.dash.mediaPlayer is used (not player.mediaPlayer)
      mockPlayer.mediaPlayer = null;
      mockPlayer.dash = {
        mediaPlayer: {
          getQualityFor: jest.fn().mockReturnValue(0),
          getBitrateInfoListFor: jest.fn()
            .mockReturnValueOnce([{ bitrate: 128000 }]) // audio
            .mockReturnValueOnce([{ bitrate: 1500000 }]) // video
        }
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(1628000); // 128000 + 1500000
    });

    test('should handle missing DASH player methods', () => {
      // Test when DASH player exists but missing required methods
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn().mockReturnValue(0)
        // Missing getBitrateInfoListFor method
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBeNull(); // Should not crash and return null
    });

    test('should handle DASH audio/video bitrate edge cases', () => {
      // Test when audio quality index is invalid
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn()
          .mockReturnValueOnce(-1) // invalid audio quality
          .mockReturnValueOnce(1),  // valid video quality
        getBitrateInfoListFor: jest.fn()
          .mockReturnValueOnce([{ bitrate: 128000 }]) // audio list
          .mockReturnValueOnce([
            { bitrate: 1000000 },
            { bitrate: 2000000 }
          ]) // video list
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(2000000); // Should get 0 + 2000000 = 2000000
    });

    test('should handle tech wrapper fallback branches', () => {
      // Test when no DASH player but tech wrapper is available
      mockPlayer.mediaPlayer = null;
      mockPlayer.dash = null;

      const mockTechWrapper = {
        getBitrate: jest.fn().mockReturnValue(1200000)
      };
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper);

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(1200000);
    });

    test('should handle tech wrapper with stats bandwidth fallback', () => {
      // Test the tech.stats.bandwidth fallback branch in getBitrate
      mockPlayer.mediaPlayer = null;
      mockPlayer.dash = null;

      const mockTechWrapper = {
        getBitrate: null, // No getBitrate method
        tech: {
          stats: { bandwidth: 800000 }
        }
      };
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper);

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(800000);
    });

    test('should test conditional branches in getRenditionBitrate', () => {
      // Test different branches in getRenditionBitrate method
      const mockTechWrapper = {
        getRenditionBitrate: jest.fn().mockReturnValue(1500000)
      };
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper);

      const bitrate = tracker.getRenditionBitrate();
      expect(bitrate).toBe(1500000);

      // Test when no tech wrapper - should return undefined
      tracker.getTech = jest.fn().mockReturnValue(null);
      const bitrate2 = tracker.getRenditionBitrate();
      expect(bitrate2).toBeUndefined();
    });

    test('should test isMuted method', () => {
      // Test when player.muted() returns true
      mockPlayer.muted = jest.fn().mockReturnValue(true);
      expect(tracker.isMuted()).toBe(true);

      // Test when player.muted() returns false
      mockPlayer.muted = jest.fn().mockReturnValue(false);
      expect(tracker.isMuted()).toBe(false);
    });

    test('should test getRenditionWidth and getRenditionHeight branches', () => {
      // Test getRenditionWidth with tech wrapper
      const mockTechWrapper = {
        getRenditionWidth: jest.fn().mockReturnValue(1920)
      };
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper);

      const width = tracker.getRenditionWidth();
      expect(width).toBe(1920);

      // Test getRenditionHeight with tech wrapper
      const mockTechWrapper2 = {
        getRenditionHeight: jest.fn().mockReturnValue(1080)
      };
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper2);

      const height = tracker.getRenditionHeight();
      expect(height).toBe(1080);

      // Test getRenditionHeight fallback to player.videoHeight()
      tracker.getTech = jest.fn().mockReturnValue(null);
      mockPlayer.videoHeight = jest.fn().mockReturnValue(720);

      const height2 = tracker.getRenditionHeight();
      expect(height2).toBe(720);
    });

    test('should test error handling branches', () => {
      // Test onError with different error formats
      const error1 = { code: 4, message: 'Network error' };
      mockPlayer.error.mockReturnValue(error1);
      tracker.sendError = jest.fn();

      tracker.onError();
      expect(tracker.sendError).toHaveBeenCalledWith({
        errorCode: 4,
        errorMessage: 'Network error'
      });

      // Test with no error code
      const error2 = { message: 'Unknown error' };
      mockPlayer.error.mockReturnValue(error2);

      tracker.onError();
      expect(tracker.sendError).toHaveBeenCalledWith({
        errorCode: undefined,
        errorMessage: 'Unknown error'
      });
    });

    test('should test IMA ads ready branches and ad start cue points', () => {
      tracker.setAdsTracker = jest.fn();

      // Test onAdsready with IMA tracker
      // Mock ImaAdsTracker.isUsing to return true
      const originalImaUsing = require('../ads/ima').default.isUsing;
      require('../ads/ima').default.isUsing = jest.fn().mockReturnValue(true);

      tracker.adsTracker = null; // Ensure no existing ads tracker

      tracker.onAdsready();

      expect(tracker.setAdsTracker).toHaveBeenCalled();

      // Restore the original method
      require('../ads/ima').default.isUsing = originalImaUsing;

      // Test onAdStart cue points assignment
      const mockAdsManager = {
        getCuePoints: jest.fn().mockReturnValue([0, 15, 30, -1])
      };

      mockPlayer.ima = {
        getAdsManager: jest.fn().mockReturnValue(mockAdsManager)
      };

      // Ensure imaAdCuePoints starts as undefined for the conditional branch
      tracker.imaAdCuePoints = undefined;

      tracker.onAdStart();

      expect(tracker.currentAdPlaying).toBe(true);
      expect(tracker.imaAdCuePoints).toEqual([0, 15, 30, -1]);

      // Test when imaAdCuePoints already exists (conditional branch)
      tracker.imaAdCuePoints = [0, 10, 20];
      tracker.onAdStart();
      expect(tracker.imaAdCuePoints).toEqual([0, 10, 20]); // Should not change
    });

    test('should test ad end conditional branches', () => {
      tracker.sendEnd = jest.fn();

      // Test when content has ended
      tracker.isContentEnd = true;
      tracker.onAdEnd();
      expect(tracker.sendEnd).toHaveBeenCalled();

      // Test when content hasn't ended
      tracker.sendEnd.mockClear();
      tracker.isContentEnd = false;
      tracker.onAdEnd();
      expect(tracker.sendEnd).not.toHaveBeenCalled();
    });

    test('should test VHS bitrate extraction branches', () => {
      // Test VHS playlists media branch
      const mockTech = {
        vhs: {
          playlists: {
            media: jest.fn().mockReturnValue({
              attributes: { BANDWIDTH: 2500000 }
            })
          }
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech);

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(2500000);

      // Test when VHS playlists.media returns null
      mockTech.vhs.playlists.media = jest.fn().mockReturnValue(null);
      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBeNull();
    });

    test('should test all onAdsready tracker type branches', () => {
      tracker.setAdsTracker = jest.fn();
      tracker.adsTracker = null; // No existing tracker

      // Mock all tracker isUsing methods to return false initially
      const BrightcoveImaAdsTracker = require('../ads/brightcove-ima').default;
      const ImaAdsTracker = require('../ads/ima').default;
      const FreewheelAdsTracker = require('../ads/freewheel').default;
      const VideojsAdsTracker = require('../ads/videojs-ads').default;

      const originalBrightcove = BrightcoveImaAdsTracker.isUsing;
      const originalIma = ImaAdsTracker.isUsing;
      const originalFreewheel = FreewheelAdsTracker.isUsing;

      // Test Brightcove IMA branch
      BrightcoveImaAdsTracker.isUsing = jest.fn().mockReturnValue(true);
      ImaAdsTracker.isUsing = jest.fn().mockReturnValue(false);
      FreewheelAdsTracker.isUsing = jest.fn().mockReturnValue(false);

      tracker.onAdsready();
      expect(tracker.setAdsTracker).toHaveBeenCalled();

      // Reset and test IMA branch
      tracker.setAdsTracker.mockClear();
      tracker.adsTracker = null;
      BrightcoveImaAdsTracker.isUsing = jest.fn().mockReturnValue(false);
      ImaAdsTracker.isUsing = jest.fn().mockReturnValue(true);
      FreewheelAdsTracker.isUsing = jest.fn().mockReturnValue(false);

      tracker.onAdsready();
      expect(tracker.setAdsTracker).toHaveBeenCalled();

      // Reset and test Freewheel branch
      tracker.setAdsTracker.mockClear();
      tracker.adsTracker = null;
      BrightcoveImaAdsTracker.isUsing = jest.fn().mockReturnValue(false);
      ImaAdsTracker.isUsing = jest.fn().mockReturnValue(false);
      FreewheelAdsTracker.isUsing = jest.fn().mockReturnValue(true);

      tracker.onAdsready();
      expect(tracker.setAdsTracker).toHaveBeenCalled();

      // Reset and test generic fallback branch
      tracker.setAdsTracker.mockClear();
      tracker.adsTracker = null;
      BrightcoveImaAdsTracker.isUsing = jest.fn().mockReturnValue(false);
      ImaAdsTracker.isUsing = jest.fn().mockReturnValue(false);
      FreewheelAdsTracker.isUsing = jest.fn().mockReturnValue(false);

      tracker.onAdsready();
      expect(tracker.setAdsTracker).toHaveBeenCalled();

      // Test when adsTracker already exists (should not create new one)
      tracker.setAdsTracker.mockClear();
      tracker.adsTracker = { existing: true };

      tracker.onAdsready();
      expect(tracker.setAdsTracker).not.toHaveBeenCalled();

      // Restore original methods
      BrightcoveImaAdsTracker.isUsing = originalBrightcove;
      ImaAdsTracker.isUsing = originalIma;
      FreewheelAdsTracker.isUsing = originalFreewheel;
    });

    test('should test HLS.js bitrate extraction branches', () => {
      // Test HLS.js specific path
      const mockTech = {
        hls_: {
          levels: [
            { bitrate: 1000000 },
            { bitrate: 2000000 },
            { bitrate: 4000000 }
          ],
          currentLevel: 1
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech);

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(2000000);

      // Test when currentLevel is out of bounds
      mockTech.hls_.currentLevel = 5;
      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBeNull();

      // Test when levels is null
      mockTech.hls_.levels = null;
      mockTech.hls_.currentLevel = 0;
      const bitrate3 = tracker.getBitrate();
      expect(bitrate3).toBeNull();
    });

    test('should test additional DASH bitrate edge cases', () => {
      // Test when video bitrate list is invalid
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn()
          .mockReturnValueOnce(0) // audio quality
          .mockReturnValueOnce(1), // video quality
        getBitrateInfoListFor: jest.fn()
          .mockReturnValueOnce([{ bitrate: 128000 }]) // audio list
          .mockReturnValueOnce(null) // video list is null
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(128000); // Should get audio only

      // Test when both audio and video quality are invalid
      mockPlayer.mediaPlayer.getQualityFor = jest.fn()
        .mockReturnValueOnce(-1) // invalid audio quality
        .mockReturnValueOnce(-1); // invalid video quality
      mockPlayer.mediaPlayer.getBitrateInfoListFor = jest.fn()
        .mockReturnValueOnce([{ bitrate: 128000 }])
        .mockReturnValueOnce([{ bitrate: 2000000 }]);

      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBe(0); // Should get 0 + 0 = 0
    });

    test('should test onEnded with post-roll ads detection', () => {
      tracker.sendEnd = jest.fn();

      // Test with ads tracker and post-roll ads (-1 indicates post-roll)
      tracker.adsTracker = { existing: true };
      tracker.imaAdCuePoints = [0, 30, -1]; // Has post-roll
      tracker.isContentEnd = false;

      tracker.onEnded();

      expect(tracker.isContentEnd).toBe(true);
      expect(tracker.sendEnd).not.toHaveBeenCalled(); // Should wait for post-roll

      // Test with no post-roll ads
      tracker.sendEnd.mockClear();
      tracker.imaAdCuePoints = [0, 30]; // No -1 means no post-roll
      tracker.isContentEnd = false;

      tracker.onEnded();

      expect(tracker.isContentEnd).toBe(true);
      expect(tracker.sendEnd).toHaveBeenCalled(); // Should send end immediately
    });

    test('should test getTech method edge cases', () => {
      // Test when player.tech throws an error - method will throw (no error handling)
      mockPlayer.tech = jest.fn().mockImplementation(() => {
        throw new Error('Tech not available');
      });

      expect(() => {
        tracker.getTech();
      }).toThrow('Tech not available');

      // Test when tech is null
      mockPlayer.tech = jest.fn().mockReturnValue(null);
      const tech2 = tracker.getTech();
      expect(tech2).toBeUndefined();
    });

    test('should test complex VHS nested conditionals', () => {
      // Test VHS with different playlist structures
      const mockTech1 = {
        vhs: {
          playlists: null // No playlists
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech1);
      expect(tracker.getBitrate()).toBeNull();

      // Test VHS without playlists property
      const mockTech2 = {
        vhs: {} // No playlists property
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech2);
      expect(tracker.getBitrate()).toBeNull();

      // Test tech without vhs
      const mockTech3 = {
        someOtherProperty: true
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech3);
      expect(tracker.getBitrate()).toBeNull();
    });

    test('should test timeupdate playhead threshold branches', () => {
      tracker.sendStart = jest.fn();

      // Test exactly at threshold
      jest.spyOn(tracker, 'getPlayhead').mockReturnValue(0.1);
      tracker.onTimeupdate();
      expect(tracker.sendStart).not.toHaveBeenCalled();

      // Test just above threshold
      jest.spyOn(tracker, 'getPlayhead').mockReturnValue(0.101);
      tracker.onTimeupdate();
      expect(tracker.sendStart).toHaveBeenCalled();
    });

    test('should test more DASH conditional branches', () => {
      // Test DASH when getQualityFor method is missing
      mockPlayer.mediaPlayer = {
        getBitrateInfoListFor: jest.fn().mockReturnValue([{ bitrate: 128000 }])
        // Missing getQualityFor method
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBeNull();

      // Test DASH when getBitrateInfoListFor method is missing
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn().mockReturnValue(0)
        // Missing getBitrateInfoListFor method
      };

      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBeNull();
    });

    test('should test seeking and seeked event handlers', () => {
      tracker.sendSeekStart = jest.fn();
      tracker.sendSeekEnd = jest.fn();

      tracker.onSeeking();
      expect(tracker.sendSeekStart).toHaveBeenCalled();

      tracker.onSeeked();
      expect(tracker.sendSeekEnd).toHaveBeenCalled();
    });

    test('should test waiting event handler', () => {
      tracker.sendBufferStart = jest.fn();

      tracker.onWaiting();
      expect(tracker.sendBufferStart).toHaveBeenCalled();
    });

    test('should test more tech wrapper conditional paths', () => {
      // Reset mock player to clean state
      mockPlayer.videoWidth = jest.fn().mockReturnValue(1280);
      mockPlayer.videoHeight = jest.fn().mockReturnValue(1280);

      // Test when tech wrapper exists but has no methods
      const mockTechWrapper = {}; // Empty tech wrapper
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper);

      expect(tracker.getBitrate()).toBeNull();
      expect(tracker.getRenditionBitrate()).toBeUndefined();

      // Both getRenditionWidth and getRenditionHeight fall back to player methods
      expect(tracker.getRenditionWidth()).toBe(1280); // Falls back to videoWidth()
      expect(tracker.getRenditionHeight()).toBe(1280); // Falls back to videoHeight()

      // Test videoWidth/videoHeight fallbacks
      mockPlayer.videoWidth = jest.fn().mockReturnValue(1920);
      mockPlayer.videoHeight = jest.fn().mockReturnValue(1080);
      expect(tracker.getRenditionWidth()).toBe(1920);
      expect(tracker.getRenditionHeight()).toBe(1080);
    });

    test('should test edge cases in video bitrate calculations', () => {
      // Test DASH when video quality is valid but bitrate list is empty
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn()
          .mockReturnValueOnce(0) // audio quality
          .mockReturnValueOnce(1), // video quality
        getBitrateInfoListFor: jest.fn()
          .mockReturnValueOnce([{ bitrate: 128000 }]) // audio list
          .mockReturnValueOnce([]) // empty video list
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(128000); // Should get audio only

      // Test when audio bitrate list is empty but video is valid
      mockPlayer.mediaPlayer.getQualityFor = jest.fn()
        .mockReturnValueOnce(0) // audio quality
        .mockReturnValueOnce(0); // video quality
      mockPlayer.mediaPlayer.getBitrateInfoListFor = jest.fn()
        .mockReturnValueOnce([]) // empty audio list
        .mockReturnValueOnce([{ bitrate: 2000000 }]); // video list

      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBe(2000000); // Should get video only
    });

    test('should test Shaka player getBitrate path', () => {
      // Test Shaka player stats bandwidth
      const mockTech = {
        shakaPlayer_: {
          getStats: jest.fn().mockReturnValue({
            streamBandwidth: 3000000
          })
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech);

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(3000000);

      // Test when getStats returns null
      mockTech.shakaPlayer_.getStats = jest.fn().mockReturnValue(null);
      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBeNull();

      // Test when getStats throws error - will propagate error (no error handling in code)
      mockTech.shakaPlayer_.getStats = jest.fn().mockImplementation(() => {
        throw new Error('Stats not available');
      });

      expect(() => {
        tracker.getBitrate();
      }).toThrow('Stats not available');
    });

    test('should test alternative Shaka player property paths', () => {
      // Test shaka_ property path
      const mockTech1 = {
        shaka_: {
          getStats: jest.fn().mockReturnValue({
            streamBandwidth: 1500000
          })
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech1);

      const bitrate1 = tracker.getBitrate();
      expect(bitrate1).toBe(1500000);

      // Test shakaPlayer property path (not shakaPlayer_)
      const mockTech2 = {
        shakaPlayer: {
          getStats: jest.fn().mockReturnValue({
            streamBandwidth: 2500000
          })
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech2);

      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBe(2500000);
    });

    test('should test missing tech wrapper branches', () => {
      // Reset player state to ensure clean test
      mockPlayer.videoWidth = jest.fn().mockReturnValue(1280);
      mockPlayer.videoHeight = jest.fn().mockReturnValue(1280);

      // Test when getTech returns null/undefined
      tracker.getTech = jest.fn().mockReturnValue(null);

      expect(tracker.getRenditionBitrate()).toBeUndefined();
      expect(tracker.getRenditionName()).toBeUndefined(); // Returns undefined
      expect(tracker.getRenditionWidth()).toBe(1280); // Falls back to player
      expect(tracker.getRenditionHeight()).toBe(1280); // Falls back to player
    });

    test('should test getRenditionName with tech wrapper', () => {
      // Test with tech wrapper that has getRenditionName method
      const mockTechWrapper = {
        getRenditionName: jest.fn().mockReturnValue('720p')
      };
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper);

      const name = tracker.getRenditionName();
      expect(name).toBe('720p');

      // Test when tech wrapper exists but no getRenditionName method
      const mockTechWrapper2 = {};
      tracker.getTech = jest.fn().mockReturnValue(mockTechWrapper2);

      const name2 = tracker.getRenditionName();
      expect(name2).toBeUndefined(); // Returns undefined
    });

    test('should test additional getBitrate edge cases', () => {
      // Test when no tech at all
      mockPlayer.tech = jest.fn().mockReturnValue(null);
      mockPlayer.mediaPlayer = null;
      mockPlayer.dash = null;

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBeNull();

      // Test tech without any streaming properties
      const mockTech = {
        randomProperty: true
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech);

      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBeNull();
    });

    test('should test DASH player complex nested conditionals', () => {
      // Test when DASH player exists but methods return invalid data
      mockPlayer.mediaPlayer = {
        getQualityFor: jest.fn()
          .mockReturnValueOnce(undefined) // undefined audio quality
          .mockReturnValueOnce(null), // null video quality
        getBitrateInfoListFor: jest.fn()
          .mockReturnValueOnce([{ bitrate: 128000 }])
          .mockReturnValueOnce([{ bitrate: 2000000 }])
      };

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBe(0); // Should get 0 + 0 = 0

      // Test when getBitrateInfoListFor returns undefined
      mockPlayer.mediaPlayer.getQualityFor = jest.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1);
      mockPlayer.mediaPlayer.getBitrateInfoListFor = jest.fn()
        .mockReturnValueOnce(undefined) // undefined audio list
        .mockReturnValueOnce(undefined); // undefined video list

      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBe(0);
    });

    test('should test HLS.js edge case branches', () => {
      // Test when levels array exists but currentLevel is negative
      const mockTech = {
        hls_: {
          levels: [{ bitrate: 1000000 }],
          currentLevel: -1
        }
      };
      mockPlayer.tech = jest.fn().mockReturnValue(mockTech);

      const bitrate = tracker.getBitrate();
      expect(bitrate).toBeNull();

      // Test when levels array exists but currentLevel is too high
      mockTech.hls_.currentLevel = 10;
      const bitrate2 = tracker.getBitrate();
      expect(bitrate2).toBeNull();

      // Test when currentLevel is valid but level object is malformed
      mockTech.hls_.currentLevel = 0;
      mockTech.hls_.levels = [{}]; // Level without bitrate property

      const bitrate3 = tracker.getBitrate();
      expect(bitrate3).toBeNull(); // Should return null at end of getBitrate function
    });

    test('OnAdsAllpodsCompleted should set FreewheelAdsCompleted flag', () => {
      // Test the OnAdsAllpodsCompleted method to cover lines 443-444
      expect(tracker.FreewheelAdsCompleted).toBeUndefined();

      tracker.OnAdsAllpodsCompleted();

      expect(tracker.FreewheelAdsCompleted).toBe(true);
      // The method should bind onEnded but not call it (just bind)
      expect(typeof tracker.onEnded).toBe('function');
    });
  });
});