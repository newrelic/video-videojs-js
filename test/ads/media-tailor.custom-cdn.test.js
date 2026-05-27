/**
 * Unit tests for custom CDN / custom domain support in the MediaTailor tracker.
 *
 * Run with: npx jest test/ads/media-tailor.custom-cdn.test.js
 * (Requires jest + babel-jest to be installed as dev dependencies.)
 */

import MediaTailorAdsTracker from '../../src/ads/media-tailor.js';
import {
  isMediaTailorSegment,
  detectAdBreaksFromVhsPlaylist,
  buildTrackingEndpointUrl,
} from '../../src/ads/utils/mt.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(src = 'https://cdn.example.com/v1/master/stream.m3u8') {
  return {
    currentSrc: () => src,
    one: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    duration: () => 300,
  };
}

function makeTmSegment(path = '/tm/ad-001.ts') {
  return { uri: `https://cdn.example.com${path}` };
}

function makeDefaultSegment() {
  return { uri: 'https://cdn.example.com/content/segment-001.ts' };
}

function makeAwsSegment() {
  return { uri: 'https://segments.mediatailor.us-east-1.amazonaws.com/ad-001.ts' };
}

function makePlaylist(segments) {
  const discontinuityStarts = [];
  segments.forEach((seg, i) => {
    if (seg._discontinuity) discontinuityStarts.push(i);
  });
  return {
    segments: segments.map(({ _discontinuity: _, ...s }) => s),
    discontinuityStarts,
    targetDuration: 6,
  };
}

// ---------------------------------------------------------------------------
// 1. isUsing() — opt-in flag is the only gate
// ---------------------------------------------------------------------------

describe('MediaTailorAdsTracker.isUsing()', () => {
  const player = makePlayer('https://cdn.example.com/live.m3u8'); // no .mediatailor. in URL

  test('returns true when mediatailor: true is set', () => {
    expect(MediaTailorAdsTracker.isUsing(player, { mediatailor: true })).toBe(true);
  });

  test('returns true when mediatailor is an object', () => {
    expect(
      MediaTailorAdsTracker.isUsing(player, {
        mediatailor: { adSegmentPrefix: '/tm/' },
      }),
    ).toBe(true);
  });

  test('returns false when options are empty — auto-detect is gone', () => {
    expect(MediaTailorAdsTracker.isUsing(player, {})).toBe(false);
  });

  test('returns false even when currentSrc contains .mediatailor.', () => {
    const awsPlayer = makePlayer(
      'https://abc123.mediatailor.us-east-1.amazonaws.com/v1/master/x/y/master.m3u8',
    );
    // Without the opt-in flag the tracker must NOT activate automatically
    expect(MediaTailorAdsTracker.isUsing(awsPlayer, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. isMediaTailorSegment() — /tm/ is matched by default
// ---------------------------------------------------------------------------

describe('isMediaTailorSegment()', () => {
  test('matches AWS default ad-segment host', () => {
    expect(isMediaTailorSegment(makeAwsSegment())).toBe(true);
  });

  test('matches /tm/ path without explicit adSegmentPrefix', () => {
    expect(isMediaTailorSegment(makeTmSegment('/tm/ad.ts'))).toBe(true);
  });

  test('does NOT match content segment', () => {
    expect(isMediaTailorSegment(makeDefaultSegment())).toBe(false);
  });

  test('matches a custom prefix when adSegmentPrefix is supplied', () => {
    const seg = { uri: 'https://cdn.example.com/special-ads/ad-001.ts' };
    expect(isMediaTailorSegment(seg, { adSegmentPrefix: '/special-ads/' })).toBe(true);
  });

  test('does NOT match custom prefix without the override', () => {
    const seg = { uri: 'https://cdn.example.com/special-ads/ad-001.ts' };
    expect(isMediaTailorSegment(seg)).toBe(false);
  });

  test('matches map URI as well as segment URI', () => {
    const seg = {
      uri: 'https://cdn.example.com/segment.ts',
      map: { uri: 'https://cdn.example.com/tm/init.mp4' },
    };
    expect(isMediaTailorSegment(seg)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. detectAdBreaksFromVhsPlaylist() — /tm/ detected without explicit prefix
// ---------------------------------------------------------------------------

describe('detectAdBreaksFromVhsPlaylist() — /tm/ default', () => {
  test('detects ad break with /tm/ segments (no adSegmentPrefix needed)', () => {
    const playlist = makePlaylist([
      { uri: 'https://cdn.test/content/seg-0.ts', duration: 6 },
      { uri: 'https://cdn.test/tm/ad-0.ts', duration: 6, _discontinuity: true },
      { uri: 'https://cdn.test/tm/ad-1.ts', duration: 6 },
      { uri: 'https://cdn.test/content/seg-1.ts', duration: 6, _discontinuity: true },
    ]);

    const breaks = detectAdBreaksFromVhsPlaylist(playlist);
    expect(breaks.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. detectAdBreaksFromVhsPlaylist() — custom prefix only works with override
// ---------------------------------------------------------------------------

describe('detectAdBreaksFromVhsPlaylist() — custom ad-segment prefix', () => {
  const playlist = makePlaylist([
    { uri: 'https://cdn.test/content/seg-0.ts', duration: 6 },
    { uri: 'https://cdn.test/special-ads/ad-0.ts', duration: 6, _discontinuity: true },
    { uri: 'https://cdn.test/special-ads/ad-1.ts', duration: 6 },
    { uri: 'https://cdn.test/content/seg-1.ts', duration: 6, _discontinuity: true },
  ]);

  test('does NOT detect ad break without the prefix override', () => {
    const breaks = detectAdBreaksFromVhsPlaylist(playlist);
    expect(breaks.length).toBe(0);
  });

  test('detects ad break when adSegmentPrefix is provided', () => {
    const breaks = detectAdBreaksFromVhsPlaylist(playlist, {
      adSegmentPrefix: '/special-ads/',
    });
    expect(breaks.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 5. trackingUrl override bypasses buildTrackingEndpointUrl
// ---------------------------------------------------------------------------

describe('trackingUrl override', () => {
  test('buildTrackingEndpointUrl returns null for custom-domain URL (no sessionId)', () => {
    const customDomainUrl =
      'https://video.customer.com/v1/master/config/stream.m3u8';
    expect(buildTrackingEndpointUrl(customDomainUrl)).toBeNull();
  });

  test('buildTrackingEndpointUrl derives URL when aws.sessionId is present', () => {
    const awsUrl =
      'https://abc123.mediatailor.us-east-1.amazonaws.com/v1/master/config/stream.m3u8?aws.sessionId=sess-abc';
    const result = buildTrackingEndpointUrl(awsUrl);
    expect(result).not.toBeNull();
    expect(result).toContain('/v1/tracking/');
  });
});
