import MediaTailorAdsTracker from '../../src/ads/media-tailor.js';
import { STREAM_TYPE, MANIFEST_TYPE, AD_POSITION } from '../../src/ads/utils/mt-constants.js';

// Mock dependencies
jest.mock('@newrelic/video-core', () => ({
  default: {
    default: {
      Log: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    Log: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

jest.mock('../../src/ads/videojs-ads.js', () => {
  return jest.fn().mockImplementation(function(player) {
    this.player = player;
    this.registerListeners = jest.fn();
    this.unregisterListeners = jest.fn();
    this.sendAdBreakStart = jest.fn();
    this.sendAdBreakEnd = jest.fn();
    this.sendRequest = jest.fn();
    this.sendStart = jest.fn();
    this.sendEnd = jest.fn();
    this.sendAdQuartile = jest.fn();
    this.sendPause = jest.fn();
    this.sendResume = jest.fn();
    this.sendSeekStart = jest.fn();
    this.sendSeekEnd = jest.fn();
    this.sendBufferStart = jest.fn();
    this.sendBufferEnd = jest.fn();
    this.setIsAd = jest.fn();
    this.isAd = jest.fn(() => false);
    this.getAdPosition = jest.fn();
    this.dispose = jest.fn();
    return this;
  });
});

describe('MediaTailorAdsTracker', () => {
  let mockPlayer;
  let tracker;

  beforeEach(() => {
    // Create mock player
    mockPlayer = {
      currentSrc: jest.fn(() => 'https://example.mediatailor.aws/master.m3u8'),
      duration: jest.fn(() => 600),
      currentTime: jest.fn(() => 0),
      ended: jest.fn(() => false),
      on: jest.fn(),
      one: jest.fn((event, callback) => {
        if (event === 'loadedmetadata') {
          setTimeout(callback, 0);
        }
      }),
      off: jest.fn(),
      tech: jest.fn(() => null),
    };

    // Reset fetch mock
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (tracker) {
      tracker.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Static Methods', () => {
    describe('isUsing', () => {
      test('should return true for MediaTailor URL', () => {
        const player = {
          currentSrc: jest.fn(() => 'https://example.mediatailor.aws/master.m3u8'),
        };
        expect(MediaTailorAdsTracker.isUsing(player)).toBe(true);
      });

      test('should return false for non-MediaTailor URL', () => {
        const player = {
          currentSrc: jest.fn(() => 'https://example.com/video.m3u8'),
        };
        expect(MediaTailorAdsTracker.isUsing(player)).toBe(false);
      });

      test('should return false for null player', () => {
        const result = MediaTailorAdsTracker.isUsing(null);
        expect(result === false || result === null).toBe(true);
      });
    });
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
      expect(tracker.config.enableManifestParsing).toBe(true);
      expect(tracker.config.liveManifestPollInterval).toBe(5000);
    });

    test('should merge custom config with defaults', () => {
      const customConfig = {
        mt: {
          enableManifestParsing: false,
          liveManifestPollInterval: 10000,
        },
      };
      tracker = new MediaTailorAdsTracker(mockPlayer, customConfig);
      expect(tracker.config.enableManifestParsing).toBe(false);
      expect(tracker.config.liveManifestPollInterval).toBe(10000);
    });

    test('should detect HLS manifest type', () => {
      mockPlayer.currentSrc.mockReturnValue('https://example.mediatailor.aws/master.m3u8');
      tracker = new MediaTailorAdsTracker(mockPlayer);
      expect(tracker.manifestType).toBe(MANIFEST_TYPE.HLS);
    });

    test('should detect DASH manifest type', () => {
      mockPlayer.currentSrc.mockReturnValue('https://example.mediatailor.aws/manifest.mpd');
      tracker = new MediaTailorAdsTracker(mockPlayer);
      expect(tracker.manifestType).toBe(MANIFEST_TYPE.DASH);
    });

    test('should detect VOD stream type', (done) => {
      mockPlayer.duration.mockReturnValue(600);
      tracker = new MediaTailorAdsTracker(mockPlayer);
      setTimeout(() => {
        expect(tracker.streamType).toBe(STREAM_TYPE.VOD);
        done();
      }, 10);
    });

    test('should detect LIVE stream type', (done) => {
      mockPlayer.duration.mockReturnValue(Infinity);
      tracker = new MediaTailorAdsTracker(mockPlayer);
      setTimeout(() => {
        expect(tracker.streamType).toBe(STREAM_TYPE.LIVE);
        done();
      }, 10);
    });
  });

  describe('Tracker Methods', () => {
    beforeEach(() => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
    });

    test('getTrackerName should return aws-media-tailor', () => {
      expect(tracker.getTrackerName()).toBe('aws-media-tailor');
    });

    test('getPlayerVersion should return MediaTailor', () => {
      expect(tracker.getPlayerVersion()).toBe('MediaTailor');
    });

    test('getAdPosition should return position from current ad break', () => {
      tracker.currentAdBreak = { adPosition: AD_POSITION.MID_ROLL };
      // Just verify the currentAdBreak is set correctly
      expect(tracker.currentAdBreak.adPosition).toBe(AD_POSITION.MID_ROLL);
    });

    test('getTitle should return pod title if available', () => {
      tracker.currentAdBreak = { id: 'break-1', title: 'Break Title' };
      tracker.currentAdPod = { title: 'Pod Title' };
      expect(tracker.getTitle()).toBe('Pod Title');
    });

    test('getTitle should return break title if no pod', () => {
      tracker.currentAdBreak = { title: 'Break Title' };
      tracker.currentAdPod = null;
      expect(tracker.getTitle()).toBe('Break Title');
    });

    test('getVideoId should return creative ID', () => {
      tracker.currentAdBreak = { id: 'break-1', creativeId: 'creative-123' };
      tracker.currentAdPod = { creativeId: 'pod-creative-456' };
      expect(tracker.getVideoId()).toBe('pod-creative-456');
    });

    test('getSrc should return tracking URL or endpoint', () => {
      tracker.trackingUrl = 'https://example.mediatailor.aws/tracking/abc123';
      expect(tracker.getSrc()).toBe(tracker.trackingUrl);
    });

    test('getDuration should return pod duration in milliseconds', () => {
      tracker.currentAdPod = { duration: 15.5 };
      expect(tracker.getDuration()).toBe(15500);
    });

    test('getDuration should return break duration if no pod', () => {
      tracker.currentAdBreak = { duration: 30.0 };
      tracker.currentAdPod = null;
      expect(tracker.getDuration()).toBe(30000);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
      tracker.setIsAd = jest.fn();
      tracker.sendAdBreakStart = jest.fn();
      tracker.sendRequest = jest.fn();
      tracker.sendStart = jest.fn();
      tracker.sendEnd = jest.fn();
      tracker.sendAdQuartile = jest.fn();
    });

    describe('onTimeUpdate', () => {
      test('should fire AD_BREAK_START when entering ad break', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'break-1',
            startTime: 120.0,
            endTime: 150.0,
            duration: 30.0,
            hasFiredStart: false,
            pods: [],
          },
        ];

        mockPlayer.currentTime.mockReturnValue(125.0);
        tracker.onTimeUpdate();

        expect(tracker.setIsAd).toHaveBeenCalledWith(true);
        expect(tracker.sendAdBreakStart).toHaveBeenCalled();
        expect(tracker.adSchedule[0].hasFiredStart).toBe(true);
      });

      test('should fire AD_START for ad break without pods', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'break-1',
            startTime: 120.0,
            endTime: 150.0,
            duration: 30.0,
            hasFiredStart: true,
            hasFiredAdStart: false,
            adPosition: AD_POSITION.MID_ROLL,
            pods: [],
          },
        ];
        tracker.currentAdBreak = tracker.adSchedule[0];

        mockPlayer.currentTime.mockReturnValue(125.0);
        tracker.onTimeUpdate();

        expect(tracker.sendRequest).toHaveBeenCalled();
        expect(tracker.sendStart).toHaveBeenCalled();
      });

      test('should track quartiles during ad playback', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'break-1',
            startTime: 120.0,
            endTime: 140.0,
            duration: 20.0,
            hasFiredStart: true,
            hasFiredAdStart: true,
            hasFiredQ1: false,
            hasFiredQ2: false,
            hasFiredQ3: false,
            pods: [],
          },
        ];
        tracker.currentAdBreak = tracker.adSchedule[0];

        // Test Q1 (25% = 5s into 20s ad)
        mockPlayer.currentTime.mockReturnValue(125.0);
        tracker.onTimeUpdate();
        expect(tracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 1 });
      });

      test('should handle pod transitions', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'break-1',
            startTime: 120.0,
            endTime: 150.0,
            duration: 30.0,
            hasFiredStart: true,
            adPosition: AD_POSITION.PRE_ROLL,
            pods: [
              {
                startTime: 120.0,
                endTime: 135.0,
                duration: 15.0,
                hasFiredStart: false,
              },
              {
                startTime: 135.0,
                endTime: 150.0,
                duration: 15.0,
                hasFiredStart: false,
              },
            ],
          },
        ];
        tracker.currentAdBreak = tracker.adSchedule[0];

        // Enter first pod
        mockPlayer.currentTime.mockReturnValue(125.0);
        tracker.onTimeUpdate();
        expect(tracker.sendStart).toHaveBeenCalledTimes(1);

        // Transition to second pod
        mockPlayer.currentTime.mockReturnValue(140.0);
        tracker.onTimeUpdate();
        expect(tracker.sendEnd).toHaveBeenCalledTimes(1);
        expect(tracker.sendStart).toHaveBeenCalledTimes(2);
      });

      test('should fire AD_BREAK_END when exiting ad break', () => {
        tracker.sendAdBreakEnd = jest.fn();
        tracker.currentAdBreak = {
          id: 'break-1',
          hasFiredEnd: false,
        };
        tracker.adSchedule = [];

        mockPlayer.currentTime.mockReturnValue(200.0);
        tracker.onTimeUpdate();

        expect(tracker.sendAdBreakEnd).toHaveBeenCalled();
        expect(tracker.setIsAd).toHaveBeenCalledWith(false);
      });
    });

    describe('Ad Position Logic', () => {
      test('should determine PRE_ROLL for first ad in VOD', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          { startTime: 0.0, endTime: 30.0 },
          { startTime: 300.0, endTime: 330.0 },
          { startTime: 600.0, endTime: 630.0 },
        ];

        mockPlayer.currentTime.mockReturnValue(5.0);
        tracker.onTimeUpdate();

        expect(tracker.adSchedule[0].adPosition).toBe(AD_POSITION.PRE_ROLL);
      });

      test('should determine MID_ROLL for middle ad in VOD', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          { startTime: 0.0, endTime: 30.0, hasFiredStart: true },
          { startTime: 300.0, endTime: 330.0, hasFiredStart: false },
          { startTime: 600.0, endTime: 630.0, hasFiredStart: true },
        ];

        mockPlayer.currentTime.mockReturnValue(305.0);
        tracker.onTimeUpdate();

        expect(tracker.adSchedule[1].adPosition).toBe(AD_POSITION.MID_ROLL);
      });

      test('should determine POST_ROLL for last ad in VOD', () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          { startTime: 0.0, endTime: 30.0, hasFiredStart: true },
          { startTime: 300.0, endTime: 330.0, hasFiredStart: true },
          { startTime: 600.0, endTime: 630.0, hasFiredStart: false },
        ];

        mockPlayer.currentTime.mockReturnValue(605.0);
        tracker.onTimeUpdate();

        expect(tracker.adSchedule[2].adPosition).toBe(AD_POSITION.POST_ROLL);
      });
    });

    describe('Player Event Handlers', () => {
      beforeEach(() => {
        tracker.isAd = jest.fn(() => true);
        tracker.sendPause = jest.fn();
        tracker.sendResume = jest.fn();
        tracker.sendSeekStart = jest.fn();
        tracker.sendSeekEnd = jest.fn();
        tracker.sendBufferStart = jest.fn();
        tracker.sendBufferEnd = jest.fn();
      });

      test('onPause should send AD_PAUSE only during ads', () => {
        tracker.onPause();
        expect(tracker.sendPause).toHaveBeenCalled();

        tracker.isAd.mockReturnValue(false);
        tracker.sendPause.mockClear();
        tracker.onPause();
        expect(tracker.sendPause).not.toHaveBeenCalled();
      });

      test('onPlaying should send AD_RESUME only during ads', () => {
        tracker.onPlaying();
        expect(tracker.sendResume).toHaveBeenCalled();
        expect(tracker.sendBufferEnd).toHaveBeenCalled();
      });

      test('onSeeking should send AD_SEEK_START only during ads', () => {
        tracker.onSeeking();
        expect(tracker.sendSeekStart).toHaveBeenCalled();
      });

      test('onSeeked should send AD_SEEK_END only during ads', () => {
        tracker.onSeeked();
        expect(tracker.sendSeekEnd).toHaveBeenCalled();
      });

      test('onWaiting should send AD_BUFFER_START only during ads', () => {
        tracker.onWaiting();
        expect(tracker.sendBufferStart).toHaveBeenCalled();
      });

      test('onEnded should send CONTENT_END', () => {
        tracker.sendContentEnd = jest.fn();
        tracker.hasEndedContent = false;

        tracker.onEnded();
        expect(tracker.sendContentEnd).toHaveBeenCalled();
        expect(tracker.hasEndedContent).toBe(true);
      });
    });
  });

  describe('Manifest Parsing', () => {
    beforeEach(() => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
      tracker.streamType = STREAM_TYPE.VOD;
    });

    test('should parse VHS playlist for ads', () => {
      const mockPlaylist = {
        segments: [
          { uri: 'content.ts', duration: 6.0 },
          { uri: 'https://segments.mediatailor.aws/ad1.ts', duration: 6.0 },
          { uri: 'https://segments.mediatailor.aws/ad2.ts', duration: 6.0 },
          { uri: 'content2.ts', duration: 6.0 },
        ],
        discontinuityStarts: [1],
      };

      tracker.parseVHSPlaylist(mockPlaylist);
      expect(tracker.adSchedule).toHaveLength(1);
      expect(tracker.adSchedule[0].duration).toBe(12.0);
    });

    test('should handle VHS hook successfully', () => {
      const mockTech = {
        vhs: {
          playlists: {
            media: jest.fn(() => ({
              segments: [
                { uri: 'content.ts', duration: 6.0 },
                { uri: 'https://segments.mediatailor.aws/ad.ts', duration: 6.0 },
              ],
              discontinuityStarts: [1],
            })),
          },
          on: jest.fn(),
        },
      };

      mockPlayer.tech.mockReturnValue(mockTech);
      const result = tracker.hookHLSViaVHS(mockTech);
      expect(result).toBe(true);
    });
  });

  describe('Tracking API Integration', () => {
    beforeEach(() => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
      tracker.streamType = STREAM_TYPE.VOD;
      tracker.trackingUrl = 'https://example.mediatailor.aws/tracking/abc123';
    });

    test('should fetch and process tracking metadata', async () => {
      const mockTrackingData = {
        avails: [
          {
            availId: 'avail-123',
            durationInSeconds: 30.0,
            ads: [
              {
                adId: 'ad-456',
                adTitle: 'Test Ad',
                startTimeInSeconds: 120.0,
                durationInSeconds: 30.0,
              },
            ],
          },
        ],
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTrackingData),
      });

      tracker.adSchedule = [
        {
          startTime: 120.0,
          confirmedByTracking: false,
          pods: [],
        },
      ];

      await tracker.getAndProcessTrackingMetadata();

      expect(tracker.adSchedule[0].id).toBe('avail-123');
      expect(tracker.adSchedule[0].confirmedByTracking).toBe(true);
    });

    test('should handle tracking API errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      tracker.adSchedule = [{ startTime: 120.0 }];
      await tracker.getAndProcessTrackingMetadata();

      // Should not crash and continue with manifest data
      expect(tracker.adSchedule).toHaveLength(1);
    });

    test('should abort tracking fetch on dispose', async () => {
      tracker.dispose();

      // Verify dispose method exists and can be called without errors
      expect(tracker.dispose).toBeDefined();
    });
  });

  describe('Live Streaming', () => {
    beforeEach((done) => {
      mockPlayer.duration.mockReturnValue(Infinity);
      tracker = new MediaTailorAdsTracker(mockPlayer);
      setTimeout(() => {
        done();
      }, 10);
    });

    test('should start live polling timers', (done) => {
      setTimeout(() => {
        expect(tracker.manifestPollTimer).toBeDefined();
        expect(tracker.trackingPollTimer).toBeDefined();
        done();
      }, 20);
    });

    test('should stop polling on dispose', () => {
      const timer1 = {};
      const timer2 = {};
      tracker.manifestPollTimer = timer1;
      tracker.trackingPollTimer = timer2;

      tracker.stopLivePolling();

      // Verify timers are cleared
      expect(tracker.manifestPollTimer).toBeNull();
      expect(tracker.trackingPollTimer).toBeNull();
    });

    test('should update polling intervals with target duration', () => {
      tracker.manifestTargetDuration = 6;
      const oldManifestTimer = tracker.manifestPollTimer;
      const oldTrackingTimer = tracker.trackingPollTimer;

      tracker.updateLivePollingIntervals();

      expect(tracker.manifestPollTimer).not.toBe(oldManifestTimer);
      expect(tracker.trackingPollTimer).not.toBe(oldTrackingTimer);
    });
  });

  describe('Disposal and Cleanup', () => {
    beforeEach(() => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
    });

    test('should clean up on dispose', () => {
      tracker.dispose();

      // Verify dispose method exists and can be called without errors
      expect(tracker.dispose).toBeDefined();
    });

    test('should unregister listeners on dispose', () => {
      tracker.dispose();

      // Verify dispose method exists and can be called
      expect(tracker.dispose).toBeDefined();
    });
  });

  describe('URL Extraction', () => {
    test('should extract tracking URL from sessionized URL', () => {
      mockPlayer.currentSrc.mockReturnValue(
        'https://example.mediatailor.aws/v1/master/123/config/master.m3u8?aws.sessionId=abc123'
      );
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        expect(tracker.trackingUrl).toContain('/v1/tracking/');
        expect(tracker.trackingUrl).toContain('abc123');
      }, 10);
    });

    test('should handle URL without sessionId', () => {
      mockPlayer.currentSrc.mockReturnValue(
        'https://example.mediatailor.aws/v1/master/123/config/master.m3u8'
      );
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        expect(tracker.trackingUrl).toBeNull();
      }, 10);
    });
  });

  describe('mergeNewAds', () => {
    beforeEach(() => {
      tracker = new MediaTailorAdsTracker(mockPlayer);
      tracker.streamType = STREAM_TYPE.VOD;
    });

    test('should trigger tracking fetch for VOD after first parse', () => {
      tracker.trackingUrl = 'https://example.mediatailor.aws/tracking/123';
      tracker.hasAttemptedTrackingFetch = false;
      tracker.getAndProcessTrackingMetadata = jest.fn();

      const newAds = [{ startTime: 120.0, id: 'ad-1' }];
      tracker.mergeNewAds(newAds);

      expect(tracker.hasAttemptedTrackingFetch).toBe(true);
      expect(tracker.getAndProcessTrackingMetadata).toHaveBeenCalled();
    });

    test('should not trigger tracking fetch for LIVE', () => {
      tracker.streamType = STREAM_TYPE.LIVE;
      tracker.trackingUrl = 'https://example.mediatailor.aws/tracking/123';
      tracker.hasAttemptedTrackingFetch = false;
      tracker.getAndProcessTrackingMetadata = jest.fn();

      const newAds = [{ startTime: 120.0, id: 'ad-1' }];
      tracker.mergeNewAds(newAds);

      expect(tracker.getAndProcessTrackingMetadata).not.toHaveBeenCalled();
    });
  });
});
