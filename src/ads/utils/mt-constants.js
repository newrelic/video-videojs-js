/**
 * MediaTailor Constants
 * Contains all regex patterns, config defaults, and constant values for AWS MediaTailor ad tracking
 */

// HLS Manifest Regex Patterns
export const REGEX_CUE_OUT = /#EXT-X-CUE-OUT:DURATION=([\d.]+)/; // Detects ad break start with duration
export const REGEX_DISCONTINUITY = /#EXT-X-DISCONTINUITY/; // Marks content/ad transitions
export const REGEX_MAP = /#EXT-X-MAP:URI="([^"]+)"/; // Extracts segment MAP URLs for pod detection

// MediaTailor URL Patterns
export const MT_SEGMENT_PATTERN = 'segments.mediatailor'; // Identifies MediaTailor ad segments

// Default Configuration
export const DEFAULT_CONFIG = {
  enableManifestParsing: true, // Enable client-side manifest parsing
  liveManifestPollInterval: 5000, // Poll live manifest every 5s (fallback if target duration unavailable)
  liveTrackingPollInterval: 10000, // Poll tracking API every 10s (fallback if target duration unavailable)
  trackingAPITimeout: 5000, // Tracking API fetch timeout in ms
};

// Timing Thresholds
export const MIN_AD_DURATION = 0.5; // Minimum ad duration in seconds (filter false positives)
export const AD_TIMING_TOLERANCE = 0.5; // Tolerance for matching ad times in seconds
export const POST_AD_PAUSE_THRESHOLD = 500; // Ignore pause events within 500ms after ad break (avoids false CONTENT_PAUSE)

// Stream Types
export const STREAM_TYPE = {
  VOD: 'vod', // Video on Demand
  LIVE: 'live', // Live streaming
};

// Manifest Types
export const MANIFEST_TYPE = {
  HLS: 'hls', // HTTP Live Streaming (.m3u8)
  DASH: 'dash', // Dynamic Adaptive Streaming over HTTP (.mpd)
};

// Ad Position Types (for VOD only)
export const AD_POSITION = {
  PRE_ROLL: 'pre', // First ad break
  MID_ROLL: 'mid', // Middle ad break
  POST_ROLL: 'post', // Last ad break
};

// Ad Detection Sources
export const AD_SOURCE = {
  MANIFEST_CUE: 'manifest-cue', // Detected from CUE-OUT/CUE-IN tags (HLS) or EventStream (DASH)
  VHS_DISCONTINUITY: 'vhs-discontinuity', // Detected from VHS discontinuityStarts
  TRACKING_API: 'tracking-api', // Added from tracking API response
  MANIFEST_AND_TRACKING: 'manifest+tracking', // Enriched by both sources
  DASH_EMSG: 'dash-emsg', // Detected from DASH emsg events (Shaka Player)
  DASH_EVENT_STREAM: 'dash-event-stream', // Detected from DASH EventStream (dash.js)
};

// Quartile Percentages
export const QUARTILES = {
  Q1: 0.25, // 25% progress
  Q2: 0.5, // 50% progress
  Q3: 0.75, // 75% progress
};
