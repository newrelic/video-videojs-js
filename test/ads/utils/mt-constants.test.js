import {
  REGEX_CUE_OUT,
  REGEX_DISCONTINUITY,
  REGEX_MAP,
  MT_SEGMENT_PATTERN,
  MIN_AD_DURATION,
  AD_TIMING_TOLERANCE,
  DEFAULT_CONFIG,
  STREAM_TYPE,
  MANIFEST_TYPE,
  AD_POSITION,
  AD_SOURCE,
  QUARTILES,
} from '../../../src/ads/utils/mt-constants.js';

describe('MediaTailor Constants', () => {
  describe('Regex Patterns', () => {
    test('REGEX_CUE_OUT should match CUE-OUT with duration', () => {
      const match1 = '#EXT-X-CUE-OUT:DURATION=30.0'.match(REGEX_CUE_OUT);
      expect(match1).toBeTruthy();
      expect(match1[1]).toBe('30.0');

      const match2 = '#EXT-X-CUE-OUT:DURATION=15.5'.match(REGEX_CUE_OUT);
      expect(match2).toBeTruthy();
      expect(match2[1]).toBe('15.5');
    });

    test('REGEX_DISCONTINUITY should match discontinuity tag', () => {
      expect('#EXT-X-DISCONTINUITY'.match(REGEX_DISCONTINUITY)).toBeTruthy();
      expect('#EXTINF:6.0'.match(REGEX_DISCONTINUITY)).toBeFalsy();
    });

    test('REGEX_MAP should extract MAP URI', () => {
      const match = '#EXT-X-MAP:URI="https://example.com/map.mp4"'.match(REGEX_MAP);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('https://example.com/map.mp4');
    });
  });

  describe('MediaTailor Segment Pattern', () => {
    test('MT_SEGMENT_PATTERN should identify MediaTailor segments', () => {
      expect('https://segments.mediatailor.aws/ad.ts').toContain(MT_SEGMENT_PATTERN);
      expect('https://content.com/video.ts').not.toContain(MT_SEGMENT_PATTERN);
    });
  });

  describe('Default Configuration', () => {
    test('DEFAULT_CONFIG should have correct defaults', () => {
      expect(DEFAULT_CONFIG.enableManifestParsing).toBe(true);
      expect(DEFAULT_CONFIG.liveManifestPollInterval).toBe(5000);
      expect(DEFAULT_CONFIG.liveTrackingPollInterval).toBe(10000);
      expect(DEFAULT_CONFIG.trackingAPITimeout).toBe(5000);
    });
  });

  describe('Timing Thresholds', () => {
    test('MIN_AD_DURATION should filter false positives', () => {
      expect(MIN_AD_DURATION).toBe(0.5);
    });

    test('AD_TIMING_TOLERANCE should allow time matching', () => {
      expect(AD_TIMING_TOLERANCE).toBe(0.5);
    });
  });

  describe('Stream Types', () => {
    test('STREAM_TYPE should have VOD and LIVE', () => {
      expect(STREAM_TYPE.VOD).toBe('vod');
      expect(STREAM_TYPE.LIVE).toBe('live');
    });
  });

  describe('Manifest Types', () => {
    test('MANIFEST_TYPE should have HLS and DASH', () => {
      expect(MANIFEST_TYPE.HLS).toBe('hls');
      expect(MANIFEST_TYPE.DASH).toBe('dash');
    });
  });

  describe('Ad Position Types', () => {
    test('AD_POSITION should have pre, mid, and post', () => {
      expect(AD_POSITION.PRE_ROLL).toBe('pre');
      expect(AD_POSITION.MID_ROLL).toBe('mid');
      expect(AD_POSITION.POST_ROLL).toBe('post');
    });
  });

  describe('Ad Sources', () => {
    test('AD_SOURCE should have all detection sources', () => {
      expect(AD_SOURCE.MANIFEST_CUE).toBe('manifest-cue');
      expect(AD_SOURCE.VHS_DISCONTINUITY).toBe('vhs-discontinuity');
      expect(AD_SOURCE.TRACKING_API).toBe('tracking-api');
      expect(AD_SOURCE.DASH_EMSG).toBe('dash-emsg');
    });
  });

  describe('Quartile Percentages', () => {
    test('QUARTILES should have correct percentages', () => {
      expect(QUARTILES.Q1).toBe(0.25);
      expect(QUARTILES.Q2).toBe(0.5);
      expect(QUARTILES.Q3).toBe(0.75);
    });
  });
});
