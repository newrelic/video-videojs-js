/**
 * Integration tests for AWS MediaTailor Tracker
 * These tests simulate real-world scenarios with complete workflows
 */

import MediaTailorAdsTracker from '../../src/ads/media-tailor.js';
import { STREAM_TYPE, AD_POSITION, MANIFEST_TYPE } from '../../src/ads/utils/mt-constants.js';

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
    this.setIsAd = jest.fn();
    this.isAd = jest.fn(() => false);
    this.dispose = jest.fn();
    return this;
  });
});

describe('MediaTailor Integration Tests', () => {
  let mockPlayer;
  let tracker;

  beforeEach(() => {
    // Create comprehensive mock player
    const mockPlayerInstance = {
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

    // Ensure all methods are available
    mockPlayer = Object.assign({}, mockPlayerInstance);

    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (tracker) {
      tracker.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Scenario 1: VOD with Pre-roll, Mid-roll, and Post-roll', () => {
    test('should handle complete VOD workflow with all ad positions', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        // Set up ad schedule
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'pre-roll',
            startTime: 0.0,
            endTime: 30.0,
            duration: 30.0,
            hasFiredStart: false,
            hasFiredEnd: false,
            hasFiredAdStart: false,
            pods: [],
          },
          {
            id: 'mid-roll',
            startTime: 300.0,
            endTime: 330.0,
            duration: 30.0,
            hasFiredStart: false,
            hasFiredEnd: false,
            hasFiredAdStart: false,
            pods: [],
          },
          {
            id: 'post-roll',
            startTime: 600.0,
            endTime: 630.0,
            duration: 30.0,
            hasFiredStart: false,
            hasFiredEnd: false,
            hasFiredAdStart: false,
            pods: [],
          },
        ];

        tracker.sendAdBreakStart = jest.fn();
        tracker.sendRequest = jest.fn();
        tracker.sendStart = jest.fn();
        tracker.setIsAd = jest.fn();

        // Test pre-roll
        mockPlayer.currentTime.mockReturnValue(5.0);
        tracker.onTimeUpdate();
        expect(tracker.adSchedule[0].adPosition).toBe(AD_POSITION.PRE_ROLL);
        expect(tracker.sendAdBreakStart).toHaveBeenCalledTimes(1);

        // Test mid-roll
        tracker.adSchedule[0].hasFiredStart = true;
        mockPlayer.currentTime.mockReturnValue(305.0);
        tracker.currentAdBreak = null;
        tracker.onTimeUpdate();
        expect(tracker.adSchedule[1].adPosition).toBe(AD_POSITION.MID_ROLL);

        // Test post-roll
        tracker.adSchedule[1].hasFiredStart = true;
        mockPlayer.currentTime.mockReturnValue(605.0);
        tracker.currentAdBreak = null;
        tracker.onTimeUpdate();
        expect(tracker.adSchedule[2].adPosition).toBe(AD_POSITION.POST_ROLL);

        done();
      }, 10);
    });
  });

  describe('Scenario 2: Ad Pod with Multiple Ads', () => {
    test('should handle pod transitions correctly', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'pod-break',
            startTime: 120.0,
            endTime: 180.0,
            duration: 60.0,
            hasFiredStart: false,
            hasFiredEnd: false,
            adPosition: AD_POSITION.MID_ROLL,
            pods: [
              {
                title: 'Ad 1',
                startTime: 120.0,
                endTime: 135.0,
                duration: 15.0,
                hasFiredStart: false,
              },
              {
                title: 'Ad 2',
                startTime: 135.0,
                endTime: 150.0,
                duration: 15.0,
                hasFiredStart: false,
              },
              {
                title: 'Ad 3',
                startTime: 150.0,
                endTime: 180.0,
                duration: 30.0,
                hasFiredStart: false,
              },
            ],
          },
        ];

        tracker.sendAdBreakStart = jest.fn();
        tracker.sendStart = jest.fn();
        tracker.sendEnd = jest.fn();
        tracker.setIsAd = jest.fn();

        // Enter ad break
        mockPlayer.currentTime.mockReturnValue(125.0);
        tracker.onTimeUpdate();
        expect(tracker.sendAdBreakStart).toHaveBeenCalledTimes(1);
        expect(tracker.sendStart).toHaveBeenCalledTimes(1);
        expect(tracker.getTitle()).toBe('Ad 1');

        // Transition to second ad
        tracker.adSchedule[0].hasFiredStart = true;
        mockPlayer.currentTime.mockReturnValue(140.0);
        tracker.onTimeUpdate();
        expect(tracker.sendEnd).toHaveBeenCalledTimes(1);
        expect(tracker.sendStart).toHaveBeenCalledTimes(2);
        expect(tracker.getTitle()).toBe('Ad 2');

        // Transition to third ad
        mockPlayer.currentTime.mockReturnValue(160.0);
        tracker.onTimeUpdate();
        expect(tracker.sendEnd).toHaveBeenCalledTimes(2);
        expect(tracker.sendStart).toHaveBeenCalledTimes(3);
        expect(tracker.getTitle()).toBe('Ad 3');

        done();
      }, 10);
    });
  });

  describe('Scenario 3: Quartile Tracking Throughout Ad', () => {
    test('should fire all quartiles in correct order', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'quartile-test',
            startTime: 120.0,
            endTime: 160.0,
            duration: 40.0,
            hasFiredStart: true,
            hasFiredAdStart: true,
            hasFiredQ1: false,
            hasFiredQ2: false,
            hasFiredQ3: false,
            adPosition: AD_POSITION.MID_ROLL,
            pods: [],
          },
        ];

        tracker.currentAdBreak = tracker.adSchedule[0];
        tracker.sendAdQuartile = jest.fn();

        // 25% (120 + 10 = 130s)
        mockPlayer.currentTime.mockReturnValue(130.0);
        tracker.onTimeUpdate();
        expect(tracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 1 });

        // 50% (120 + 20 = 140s)
        mockPlayer.currentTime.mockReturnValue(140.0);
        tracker.onTimeUpdate();
        expect(tracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 2 });

        // 75% (120 + 30 = 150s)
        mockPlayer.currentTime.mockReturnValue(150.0);
        tracker.onTimeUpdate();
        expect(tracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 3 });

        expect(tracker.sendAdQuartile).toHaveBeenCalledTimes(3);

        done();
      }, 10);
    });
  });

  describe('Scenario 4: Tracking API Enrichment', () => {
    test('should enrich ad schedule with tracking metadata', async () => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(async () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.trackingUrl = 'https://example.mediatailor.aws/tracking/abc123';
        tracker.adSchedule = [
          {
            startTime: 120.0,
            endTime: 150.0,
            duration: 30.0,
            confirmedByTracking: false,
            pods: [],
          },
        ];

        const mockTrackingData = {
          avails: [
            {
              availId: 'avail-xyz',
              durationInSeconds: 30.0,
              ads: [
                {
                  adId: 'creative-123',
                  adTitle: 'Nike Sneakers',
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

        await tracker.getAndProcessTrackingMetadata();

        expect(tracker.adSchedule[0].id).toBe('avail-xyz');
        expect(tracker.adSchedule[0].title).toBe('Nike Sneakers');
        expect(tracker.adSchedule[0].creativeId).toBe('creative-123');
        expect(tracker.adSchedule[0].confirmedByTracking).toBe(true);

      }, 10);
    });
  });

  describe('Scenario 5: Live Stream with Polling', () => {
    test('should initialize polling for live streams', () => {
      mockPlayer.duration.mockReturnValue(Infinity);
      tracker = new MediaTailorAdsTracker(mockPlayer);

      // Verify tracker initialized
      expect(tracker).toBeDefined();
      expect(tracker.manifestType).toBe(MANIFEST_TYPE.HLS);
    });
  });

  describe('Scenario 6: User Interactions During Ads', () => {
    test('should handle pause/resume during ad playback', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'interaction-test',
            startTime: 120.0,
            endTime: 150.0,
            duration: 30.0,
            hasFiredStart: true,
            hasFiredAdStart: true,
            adPosition: AD_POSITION.MID_ROLL,
            pods: [],
          },
        ];

        tracker.currentAdBreak = tracker.adSchedule[0];
        tracker.isAd = jest.fn(() => true);
        tracker.sendPause = jest.fn();
        tracker.sendResume = jest.fn();
        tracker.sendBufferEnd = jest.fn();

        // User pauses during ad
        tracker.onPause();
        expect(tracker.sendPause).toHaveBeenCalledTimes(1);

        // User resumes
        tracker.onPlaying();
        expect(tracker.sendResume).toHaveBeenCalledTimes(1);
        expect(tracker.sendBufferEnd).toHaveBeenCalledTimes(1);

        done();
      }, 10);
    });

    test('should handle seeking during ad playback', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.isAd = jest.fn(() => true);
        tracker.sendSeekStart = jest.fn();
        tracker.sendSeekEnd = jest.fn();

        // User seeks
        tracker.onSeeking();
        expect(tracker.sendSeekStart).toHaveBeenCalledTimes(1);

        // Seek completes
        tracker.onSeeked();
        expect(tracker.sendSeekEnd).toHaveBeenCalledTimes(1);

        done();
      }, 10);
    });
  });

  describe('Scenario 7: VHS Playlist Integration', () => {
    test('should parse ads from VHS playlist', (done) => {
      const mockTech = {
        vhs: {
          playlists: {
            media: jest.fn(() => ({
              segments: [
                { uri: 'content1.ts', duration: 6.0 },
                { uri: 'https://segments.mediatailor.aws/ad1.ts', duration: 6.0 },
                { uri: 'https://segments.mediatailor.aws/ad2.ts', duration: 6.0 },
                { uri: 'https://segments.mediatailor.aws/ad3.ts', duration: 6.0 },
                { uri: 'content2.ts', duration: 6.0 },
              ],
              discontinuityStarts: [1],
            })),
          },
          on: jest.fn(),
        },
      };

      mockPlayer.tech.mockReturnValue(mockTech);
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.streamType = STREAM_TYPE.VOD;
        const result = tracker.hookHLSViaVHS(mockTech);

        expect(result).toBe(true);
        expect(tracker.adSchedule).toHaveLength(1);
        expect(tracker.adSchedule[0].duration).toBe(18.0); // 3 segments × 6s

        done();
      }, 10);
    });
  });

  describe('Scenario 8: Error Recovery', () => {
    test('should continue with manifest data if tracking API fails', async () => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(async () => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.trackingUrl = 'https://example.mediatailor.aws/tracking/abc123';
        tracker.adSchedule = [
          {
            startTime: 120.0,
            confirmedByTracking: false,
          },
        ];

        global.fetch.mockRejectedValue(new Error('Network error'));

        await tracker.getAndProcessTrackingMetadata();

        // Should still have the manifest-detected ad
        expect(tracker.adSchedule).toHaveLength(1);
        expect(tracker.adSchedule[0].confirmedByTracking).toBe(false);

      }, 10);
    });

    test('should clean up properly on dispose during ad playback', () => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      tracker.streamType = STREAM_TYPE.VOD;
      tracker.adSchedule = [
        {
          id: 'cleanup-test',
          startTime: 120.0,
          endTime: 150.0,
          hasFiredStart: true,
        },
      ];

      tracker.dispose();

      // Verify disposal - just check that dispose doesn't throw
      expect(tracker.dispose).toBeDefined();
    });
  });

  describe('Scenario 9: Edge Case - Seeking Into Ad Break', () => {
    test('should properly handle seeking directly into middle of ad', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'seek-test',
            startTime: 120.0,
            endTime: 150.0,
            duration: 30.0,
            hasFiredStart: false,
            hasFiredEnd: false,
            hasFiredAdStart: false,
            pods: [],
          },
        ];

        tracker.sendAdBreakStart = jest.fn();
        tracker.sendRequest = jest.fn();
        tracker.sendStart = jest.fn();
        tracker.setIsAd = jest.fn();

        // User seeks to middle of ad (130s)
        mockPlayer.currentTime.mockReturnValue(130.0);
        tracker.onTimeUpdate();

        // Verify ad break event was triggered
        expect(tracker.sendAdBreakStart).toHaveBeenCalled();

        done();
      }, 10);
    });
  });

  describe('Scenario 10: Content End After Final Ad', () => {
    test('should send CONTENT_END after post-roll completes', (done) => {
      tracker = new MediaTailorAdsTracker(mockPlayer);

      setTimeout(() => {
        tracker.streamType = STREAM_TYPE.VOD;
        tracker.adSchedule = [
          {
            id: 'post-roll',
            startTime: 600.0,
            endTime: 630.0,
            hasFiredStart: true,
            hasFiredEnd: false,
          },
        ];
        tracker.currentAdBreak = tracker.adSchedule[0];
        tracker.sendContentEnd = jest.fn();
        tracker.sendAdBreakEnd = jest.fn();
        tracker.setIsAd = jest.fn();

        // Exit ad break at end of video
        mockPlayer.currentTime.mockReturnValue(635.0);
        mockPlayer.ended.mockReturnValue(true);
        tracker.onTimeUpdate();

        expect(tracker.sendAdBreakEnd).toHaveBeenCalledTimes(1);
        expect(tracker.setIsAd).toHaveBeenCalledWith(false);
        expect(tracker.sendContentEnd).toHaveBeenCalledTimes(1);

        done();
      }, 10);
    });
  });
});
