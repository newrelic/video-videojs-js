import {
  getTimestamp,
  detectManifestType,
  detectStreamType,
  extractTrackingUrl,
  isMediaTailorSegment,
  determineAdPosition,
  findAdBreakIndex,
  calculateQuartiles,
  getQuartilesToFire,
  findActiveAdBreak,
  findActivePod,
  isValidAdBreak,
  mergeAdSchedules,
  parseHLSManifestForAds,
  detectAdsFromVHSPlaylist,
  enrichScheduleWithTracking,
  extractTargetDuration,
  getHLSMasterManifest,
  getHLSMediaPlaylist,
  getDASHManifest,
  parseDASHManifestForAds,
  getTrackingMetadata,
  extractMediaPlaylistUrl,
} from '../../../src/ads/utils/mt.js';
import { STREAM_TYPE, MANIFEST_TYPE, AD_POSITION } from '../../../src/ads/utils/mt-constants.js';

describe('MediaTailor Utility Functions', () => {
  describe('getTimestamp', () => {
    test('should return timestamp in HH:MM:SS.mmm format', () => {
      const timestamp = getTimestamp();
      expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    });
  });

  describe('detectManifestType', () => {
    test('should detect HLS from .m3u8 URL', () => {
      const url = 'https://example.mediatailor.aws/master.m3u8';
      expect(detectManifestType(url)).toBe(MANIFEST_TYPE.HLS);
    });

    test('should detect DASH from .mpd URL', () => {
      const url = 'https://example.mediatailor.aws/manifest.mpd';
      expect(detectManifestType(url)).toBe(MANIFEST_TYPE.DASH);
    });

    test('should default to HLS for unknown format', () => {
      const url = 'https://example.com/video';
      expect(detectManifestType(url)).toBe(MANIFEST_TYPE.HLS);
    });
  });

  describe('detectStreamType', () => {
    test('should detect VOD stream from finite duration', () => {
      expect(detectStreamType(600)).toBe(STREAM_TYPE.VOD);
      expect(detectStreamType(1200.5)).toBe(STREAM_TYPE.VOD);
    });

    test('should detect LIVE stream from Infinity duration', () => {
      expect(detectStreamType(Infinity)).toBe(STREAM_TYPE.LIVE);
    });
  });

  describe('extractTrackingUrl', () => {
    test('should extract tracking URL from sessionized HLS URL', () => {
      const manifestUrl =
        'https://example.mediatailor.aws/v1/master/123/config/master.m3u8?aws.sessionId=abc123';
      const trackingUrl = extractTrackingUrl(manifestUrl);
      expect(trackingUrl).toContain('/v1/tracking/');
      expect(trackingUrl).toContain('abc123');
    });

    test('should extract tracking URL from sessionized DASH URL', () => {
      const manifestUrl =
        'https://example.mediatailor.aws/v1/dash/123/config/manifest.mpd?aws.sessionId=xyz789';
      const trackingUrl = extractTrackingUrl(manifestUrl);
      expect(trackingUrl).toContain('/v1/tracking/');
      expect(trackingUrl).toContain('xyz789');
    });

    test('should return null if no sessionId found', () => {
      const manifestUrl = 'https://example.mediatailor.aws/v1/master/123/config/master.m3u8';
      expect(extractTrackingUrl(manifestUrl)).toBeNull();
    });
  });

  describe('isMediaTailorSegment', () => {
    test('should identify MediaTailor segment by URI', () => {
      const segment = {
        uri: 'https://segments.mediatailor.aws/ad.ts',
      };
      expect(isMediaTailorSegment(segment)).toBe(true);
    });

    test('should identify MediaTailor segment by MAP URI', () => {
      const segment = {
        map: {
          uri: 'https://segments.mediatailor.aws/map.mp4',
        },
      };
      expect(isMediaTailorSegment(segment)).toBe(true);
    });

    test('should return false for non-MediaTailor segment', () => {
      const segment = {
        uri: 'https://content.example.com/video.ts',
      };
      expect(isMediaTailorSegment(segment)).toBe(false);
    });
  });

  describe('determineAdPosition', () => {
    test('should return PRE_ROLL for first ad in VOD', () => {
      expect(determineAdPosition(0, 3, STREAM_TYPE.VOD)).toBe(AD_POSITION.PRE_ROLL);
    });

    test('should return MID_ROLL for middle ad in VOD', () => {
      expect(determineAdPosition(1, 3, STREAM_TYPE.VOD)).toBe(AD_POSITION.MID_ROLL);
    });

    test('should return POST_ROLL for last ad in VOD', () => {
      expect(determineAdPosition(2, 3, STREAM_TYPE.VOD)).toBe(AD_POSITION.POST_ROLL);
    });

    test('should return null for LIVE stream', () => {
      expect(determineAdPosition(0, 3, STREAM_TYPE.LIVE)).toBeNull();
      expect(determineAdPosition(1, 3, STREAM_TYPE.LIVE)).toBeNull();
    });
  });

  describe('findAdBreakIndex', () => {
    test('should find ad break by start time with tolerance', () => {
      const schedule = [
        { startTime: 120.0 },
        { startTime: 300.0 },
        { startTime: 480.0 },
      ];
      expect(findAdBreakIndex(schedule, 120.2)).toBe(0);
      expect(findAdBreakIndex(schedule, 300.3)).toBe(1);
      expect(findAdBreakIndex(schedule, 479.8)).toBe(2);
    });

    test('should return -1 if no match found', () => {
      const schedule = [{ startTime: 120.0 }];
      expect(findAdBreakIndex(schedule, 200.0)).toBe(-1);
    });
  });

  describe('calculateQuartiles', () => {
    test('should calculate correct quartile thresholds', () => {
      const quartiles = calculateQuartiles(40);
      expect(quartiles.q1).toBe(10);
      expect(quartiles.q2).toBe(20);
      expect(quartiles.q3).toBe(30);
    });
  });

  describe('getQuartilesToFire', () => {
    test('should return Q1 when progress reaches 25%', () => {
      const quartiles = getQuartilesToFire(10, 40, { q1: false, q2: false, q3: false });
      expect(quartiles).toHaveLength(1);
      expect(quartiles[0].quartile).toBe(1);
    });

    test('should return Q1 and Q2 when progress reaches 50%', () => {
      const quartiles = getQuartilesToFire(20, 40, { q1: false, q2: false, q3: false });
      expect(quartiles).toHaveLength(2);
      expect(quartiles[0].quartile).toBe(1);
      expect(quartiles[1].quartile).toBe(2);
    });

    test('should not return already fired quartiles', () => {
      const quartiles = getQuartilesToFire(20, 40, { q1: true, q2: false, q3: false });
      expect(quartiles).toHaveLength(1);
      expect(quartiles[0].quartile).toBe(2);
    });

    test('should return all three quartiles when reaching 75%', () => {
      const quartiles = getQuartilesToFire(30, 40, { q1: false, q2: false, q3: false });
      expect(quartiles).toHaveLength(3);
    });
  });

  describe('findActiveAdBreak', () => {
    const schedule = [
      { startTime: 120.0, endTime: 150.0 },
      { startTime: 300.0, endTime: 330.0 },
      { startTime: 480.0, endTime: 510.0 },
    ];

    test('should find active ad break at current time', () => {
      expect(findActiveAdBreak(schedule, 125.0)).toBe(schedule[0]);
      expect(findActiveAdBreak(schedule, 305.0)).toBe(schedule[1]);
      expect(findActiveAdBreak(schedule, 495.0)).toBe(schedule[2]);
    });

    test('should return undefined when not in ad break', () => {
      expect(findActiveAdBreak(schedule, 100.0)).toBeUndefined();
      expect(findActiveAdBreak(schedule, 200.0)).toBeUndefined();
      expect(findActiveAdBreak(schedule, 600.0)).toBeUndefined();
    });
  });

  describe('findActivePod', () => {
    const adBreak = {
      pods: [
        { startTime: 120.0, endTime: 135.0 },
        { startTime: 135.0, endTime: 150.0 },
      ],
    };

    test('should find active pod at current time', () => {
      expect(findActivePod(adBreak, 125.0)).toBe(adBreak.pods[0]);
      expect(findActivePod(adBreak, 140.0)).toBe(adBreak.pods[1]);
    });

    test('should return null when not in any pod', () => {
      const result1 = findActivePod(adBreak, 100.0);
      const result2 = findActivePod(adBreak, 160.0);
      // Both should be falsy (null or undefined)
      expect(result1 == null).toBe(true);
      expect(result2 == null).toBe(true);
    });

    test('should return null for ad break with no pods', () => {
      const result1 = findActivePod({ pods: [] }, 125.0);
      const result2 = findActivePod({}, 125.0);
      // Both should be falsy (null or undefined)
      expect(result1 == null).toBe(true);
      expect(result2 == null).toBe(true);
    });
  });

  describe('isValidAdBreak', () => {
    test('should validate ad breaks above minimum duration', () => {
      expect(isValidAdBreak({ duration: 1.0 })).toBe(true);
      expect(isValidAdBreak({ duration: 30.0 })).toBe(true);
    });

    test('should reject ad breaks below minimum duration', () => {
      expect(isValidAdBreak({ duration: 0.3 })).toBe(false);
      expect(isValidAdBreak({ duration: 0.0 })).toBe(false);
    });
  });

  describe('mergeAdSchedules', () => {
    test('should merge new ads into existing schedule', () => {
      const existing = [{ startTime: 120.0, id: 'ad1' }];
      const newAds = [
        { startTime: 300.0, id: 'ad2' },
        { startTime: 480.0, id: 'ad3' },
      ];
      const merged = mergeAdSchedules(existing, newAds);
      expect(merged).toHaveLength(3);
      expect(merged[0].startTime).toBe(120.0);
      expect(merged[1].startTime).toBe(300.0);
      expect(merged[2].startTime).toBe(480.0);
    });

    test('should deduplicate ads by start time', () => {
      const existing = [{ startTime: 120.0, id: 'ad1', confirmedByTracking: false }];
      const newAds = [{ startTime: 120.2, id: 'ad1-updated' }];
      const merged = mergeAdSchedules(existing, newAds);
      expect(merged).toHaveLength(1);
    });

    test('should enrich unconfirmed ads with tracking data', () => {
      const existing = [{ startTime: 120.0, confirmedByTracking: false, title: null }];
      const newAds = [{ startTime: 120.1, confirmedByTracking: true, title: 'Test Ad' }];
      const merged = mergeAdSchedules(existing, newAds);
      expect(merged[0].confirmedByTracking).toBe(true);
      expect(merged[0].title).toBe('Test Ad');
    });
  });

  describe('parseHLSManifestForAds', () => {
    test('should parse single ad break with CUE-OUT/CUE-IN', () => {
      const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:6.0
segment1.ts
#EXT-X-CUE-OUT:DURATION=30.0
#EXTINF:6.0
ad_segment1.ts
#EXTINF:6.0
ad_segment2.ts
#EXT-X-CUE-IN
#EXTINF:6.0
segment2.ts`;

      const ads = parseHLSManifestForAds(manifest);
      expect(ads).toHaveLength(1);
      expect(ads[0].startTime).toBe(6.0);
      expect(ads[0].duration).toBe(12.0);
    });

    test('should parse multiple ad breaks', () => {
      const manifest = `#EXTM3U
#EXTINF:6.0
segment1.ts
#EXT-X-CUE-OUT:DURATION=15.0
#EXTINF:6.0
ad1.ts
#EXT-X-CUE-IN
#EXTINF:6.0
segment2.ts
#EXT-X-CUE-OUT:DURATION=15.0
#EXTINF:6.0
ad2.ts
#EXT-X-CUE-IN`;

      const ads = parseHLSManifestForAds(manifest);
      expect(ads).toHaveLength(2);
    });

    test('should filter out ads below minimum duration', () => {
      const manifest = `#EXTM3U
#EXT-X-CUE-OUT:DURATION=0.2
#EXTINF:0.1
tiny_ad.ts
#EXT-X-CUE-IN`;

      const ads = parseHLSManifestForAds(manifest);
      expect(ads).toHaveLength(0);
    });
  });

  describe('detectAdsFromVHSPlaylist', () => {
    test('should detect ad break from MediaTailor segments', () => {
      const playlist = {
        segments: [
          { uri: 'content1.ts', duration: 6.0 },
          { uri: 'https://segments.mediatailor.aws/ad1.ts', duration: 6.0 },
          { uri: 'https://segments.mediatailor.aws/ad2.ts', duration: 6.0 },
          { uri: 'content2.ts', duration: 6.0 },
        ],
        discontinuityStarts: [1],
      };

      const ads = detectAdsFromVHSPlaylist(playlist);
      expect(ads).toHaveLength(1);
      expect(ads[0].duration).toBe(12.0);
      expect(ads[0].startTime).toBe(6.0);
    });

    test('should detect multiple pods in one break', () => {
      const playlist = {
        segments: [
          { uri: 'content1.ts', duration: 6.0 },
          {
            uri: 'https://segments.mediatailor.aws/ad1.ts',
            duration: 6.0,
            map: { uri: 'map1.mp4' },
          },
          {
            uri: 'https://segments.mediatailor.aws/ad2.ts',
            duration: 6.0,
            map: { uri: 'map2.mp4' },
          },
          { uri: 'content2.ts', duration: 6.0 },
        ],
        discontinuityStarts: [1, 2],
      };

      const ads = detectAdsFromVHSPlaylist(playlist);
      expect(ads).toHaveLength(1);
      expect(ads[0].pods).toHaveLength(2);
    });
  });

  describe('enrichScheduleWithTracking', () => {
    test('should enrich existing ad with tracking metadata', () => {
      const schedule = [
        {
          startTime: 120.0,
          confirmedByTracking: false,
          pods: [],
        },
      ];

      const trackingAvails = [
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
      ];

      const newAds = enrichScheduleWithTracking(schedule, trackingAvails);
      expect(schedule[0].id).toBe('avail-123');
      expect(schedule[0].title).toBe('Test Ad');
      expect(schedule[0].confirmedByTracking).toBe(true);
      expect(newAds).toHaveLength(0);
    });

    test('should add new ad from tracking if not in schedule', () => {
      const schedule = [];
      const trackingAvails = [
        {
          availId: 'avail-789',
          durationInSeconds: 15.0,
          ads: [
            {
              adId: 'ad-999',
              adTitle: 'New Ad',
              startTimeInSeconds: 300.0,
              durationInSeconds: 15.0,
            },
          ],
        },
      ];

      const newAds = enrichScheduleWithTracking(schedule, trackingAvails);
      expect(newAds).toHaveLength(1);
      expect(newAds[0].id).toBe('avail-789');
      expect(newAds[0].startTime).toBe(300.0);
    });
  });

  describe('extractTargetDuration', () => {
    test('should extract target duration from manifest', () => {
      const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXTINF:6.0`;

      expect(extractTargetDuration(manifest)).toBe(6);
    });

    test('should return null if no target duration found', () => {
      const manifest = `#EXTM3U
#EXT-X-VERSION:3`;

      expect(extractTargetDuration(manifest)).toBeNull();
    });
  });

  describe('Async Fetch Functions', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('getHLSMasterManifest', () => {
      test('should fetch and parse master manifest', async () => {
        const mockManifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
https://example.com/playlist.m3u8`;

        global.fetch.mockResolvedValue({
          text: jest.fn().mockResolvedValue(mockManifest),
        });

        const result = await getHLSMasterManifest('https://example.com/master.m3u8');
        expect(result.masterText).toBe(mockManifest);
        expect(result.mediaPlaylistUrl).toContain('playlist.m3u8');
      });
    });

    describe('getHLSMediaPlaylist', () => {
      test('should fetch media playlist', async () => {
        const mockPlaylist = '#EXTM3U\n#EXTINF:6.0\nsegment.ts';

        global.fetch.mockResolvedValue({
          text: jest.fn().mockResolvedValue(mockPlaylist),
        });

        const result = await getHLSMediaPlaylist('https://example.com/playlist.m3u8');
        expect(result).toBe(mockPlaylist);
      });
    });

    describe('getDASHManifest', () => {
      test('should fetch DASH manifest', async () => {
        const mockMPD = '<MPD></MPD>';

        global.fetch.mockResolvedValue({
          text: jest.fn().mockResolvedValue(mockMPD),
        });

        const result = await getDASHManifest('https://example.com/manifest.mpd');
        expect(result).toBe(mockMPD);
      });
    });

    describe('getTrackingMetadata', () => {
      test('should fetch tracking metadata successfully', async () => {
        const mockData = { avails: [] };

        global.fetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockData),
        });

        const result = await getTrackingMetadata('https://example.com/tracking/123');
        expect(result).toEqual(mockData);
      });

      test('should handle fetch timeout', async () => {
        // Mock a timeout scenario - function creates AbortController that times out
        const mockAbortError = new Error('Aborted');
        mockAbortError.name = 'AbortError';

        global.fetch.mockRejectedValue(mockAbortError);

        await expect(
          getTrackingMetadata('https://example.com/tracking/123', 100)
        ).rejects.toThrow();
      });

      test('should handle HTTP errors', async () => {
        global.fetch.mockResolvedValue({
          ok: false,
          status: 500,
        });

        await expect(getTrackingMetadata('https://example.com/tracking/123')).rejects.toThrow();
      });
    });
  });

  describe('parseDASHManifestForAds', () => {
    test('should parse DASH EventStream for SCTE-35 markers', () => {
      // This is a simplified test due to DOMParser mock limitations
      const xmlText = `<?xml version="1.0"?>
<MPD>
  <EventStream schemeIdUri="urn:scte:scte35:2014:xml">
    <Event presentationTime="120" duration="30" id="event1">
    </Event>
  </EventStream>
</MPD>`;

      // Mock DOMParser for this specific test
      global.DOMParser = class {
        parseFromString() {
          return {
            documentElement: {
              getAttribute: () => '1',
            },
            querySelector: () => null,
            querySelectorAll: (selector) => {
              if (selector.includes('EventStream')) {
                return [
                  {
                    getAttribute: (attr) => {
                      if (attr === 'schemeIdUri') return 'urn:scte:scte35:2014:xml';
                      if (attr === 'timescale') return null;
                      return '';
                    },
                    querySelectorAll: () => [
                      {
                        getAttribute: (attr) => {
                          if (attr === 'presentationTime') return '120';
                          if (attr === 'duration') return '30';
                          if (attr === 'id') return 'event1';
                          return '';
                        },
                        querySelector: () => null,
                        textContent: '',
                      },
                    ],
                  },
                ];
              }
              return [];
            },
          };
        }
      };

      const ads = parseDASHManifestForAds(xmlText);
      expect(ads).toHaveLength(1);
      expect(ads[0].startTime).toBe(120);
      expect(ads[0].duration).toBe(30);
    });
  });

  describe('extractMediaPlaylistUrl', () => {
    test('should extract first media playlist URL from master text', () => {
      const masterText = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
path/to/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000
path/to/playlist2.m3u8`;

      const baseUrl = 'https://example.com/master.m3u8';
      const result = extractMediaPlaylistUrl(masterText, baseUrl);
      expect(result).toContain('playlist.m3u8');
    });

    test('should return null if no playlist found', () => {
      const masterText = '#EXTM3U\n#EXT-X-VERSION:3';
      const result = extractMediaPlaylistUrl(masterText, 'https://example.com/');
      expect(result).toBeNull();
    });
  });
});
