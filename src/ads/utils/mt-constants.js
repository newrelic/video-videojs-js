/**
 * MediaTailor Constants
 * Contains all regex patterns, config defaults, and constant values for AWS MediaTailor ad tracking
 */

// HLS manifest regex patterns used while scanning raw MediaTailor playlists.
// Example inputs:
// - #EXT-X-CUE-OUT:DURATION=29.988
// - #EXT-X-DISCONTINUITY
// - #EXT-X-MAP:URI="https://segments.mediatailor.../init.mp4"
export const REGEX_CUE_OUT = /#EXT-X-CUE-OUT:DURATION=([\d.]+)/; // Captures the numeric ad break duration from a MediaTailor CUE-OUT tag so the tracker can seed an ad break before CUE-IN arrives
export const REGEX_DISCONTINUITY = /#EXT-X-DISCONTINUITY/; // Detects HLS discontinuity boundaries, which MediaTailor playlists can use around ad/content transitions and pod boundaries
export const REGEX_MAP = /#EXT-X-MAP:URI="([^"]+)"/; // Captures the MAP URI from fMP4 playlists so MAP changes can be used to split one avail into multiple ad pods

// MediaTailor URL and manifest regex patterns.
// These are used to derive the tracking endpoint and to read manifest refresh metadata
// directly from HLS and DASH payloads.
export const REGEX_SESSION_ID = /sessionId=([^&]+)/; // Captures the session id from a sessionized playback URL query string such as ?aws.sessionId=abc123 so we can construct the MediaTailor tracking endpoint
export const REGEX_TRACKING_PATH_SEGMENT = /\/v1\/(master|session|dash)\//; // Matches the playback path prefix in URLs like /v1/master/... or /v1/dash/... so it can be rewritten to /v1/tracking/...
export const REGEX_MANIFEST_FILE_SUFFIX = /\/[^/]*\.(m3u8|mpd).*$/; // Matches the trailing manifest filename and any query string, such as /master.m3u8?... or /index.mpd?..., so it can be replaced with /{sessionId}
export const REGEX_HLS_TARGET_DURATION = /#EXT-X-TARGETDURATION:(\d+)/; // Captures the HLS target duration value from a line like #EXT-X-TARGETDURATION:6, which we use as the live polling cadence when available
export const REGEX_DASH_MINIMUM_UPDATE_PERIOD = /minimumUpdatePeriod="([^"]+)"/; // Captures the DASH MPD minimumUpdatePeriod attribute, for example minimumUpdatePeriod="PT5S", so live polling follows the manifest's declared refresh rate
export const REGEX_ISO_8601_DURATION = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/; // Parses ISO 8601 duration values like PT5S, PT1M14S, or PT1H2M3.5S into hour, minute, and second groups for DASH timing calculations

// MediaTailor string markers used across tracker selection and manifest parsing
export const HLS_MANIFEST_EXTENSION = '.m3u8'; // Identifies HLS manifest URLs and child playlist references
export const DASH_MANIFEST_EXTENSION = '.mpd'; // Identifies DASH manifest URLs
export const MEDIATAILOR_HOST_MARKER = '.mediatailor.'; // Identifies MediaTailor playback URLs when selecting this ads tracker
export const MT_HLS_CUE_OUT_TAG = '#EXT-X-CUE-OUT'; // Marks the start of an HLS ad break in MediaTailor manifests
export const MT_HLS_CUE_IN_TAG = '#EXT-X-CUE-IN'; // Marks the end of an HLS ad break in MediaTailor manifests
export const HLS_SEGMENT_DURATION_TAG = '#EXTINF:'; // Carries HLS segment duration values used to advance manifest time
export const HLS_TAG_PREFIX = '#'; // Distinguishes HLS tags from playlist URI lines in manifest scans
export const SCTE35_SCHEME_MARKER = 'scte35'; // Identifies SCTE-35 DASH signaling in schemeIdUri values
export const DASH_SCTE35_EVENT_STREAM_SELECTOR =
  'EventStream[schemeIdUri*="scte35"], EventStream[schemeIdUri*="SCTE35"]'; // Selects DASH EventStream nodes that carry SCTE-35 ad markers
export const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl'; // MIME type used to detect Safari/native HLS playback support

// MediaTailor URL Patterns
export const MT_SEGMENT_PATTERN = 'segments.mediatailor'; // Identifies MediaTailor ad segments (AWS default hostname)
export const MT_DEFAULT_AD_SEGMENT_PATH = '/tm/'; // Default ad-segment path per AWS CDN integration guide (custom-CDN setups)

export const TRACKING_API_TIMEOUT_MS = 5000; // Keep tracking metadata requests within the guide's 5s end-to-end budget
export const DEFAULT_LIVE_POLL_INTERVAL_MS = 5000; // Temporary fallback until manifest metadata provides cadence
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
