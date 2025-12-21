# Future Work - MediaTailor Tracker Enhancements

This document outlines potential improvements and enhancements for the AWS MediaTailor tracker. These items are refinements that would make the tracker more resilient under extreme conditions or edge cases.

---

## Performance & Scalability

### Concurrent Fetch Protection for LIVE Polling

**Description**: Add guard flags to prevent multiple simultaneous fetches during LIVE polling.

**Problem**: If a manifest or tracking API fetch takes longer than the polling interval (e.g., fetch takes 12s but poll interval is 10s), multiple requests can stack up, wasting bandwidth and potentially causing race conditions.

**Current State**:

- `isFetchingTracking` flag exists (line 106)
- `isFetchingManifest` flag exists (line 107)
- Guards are partially used but not comprehensive

**Solution**: Implement comprehensive guards at the start of each polling function to check if a fetch is already in progress and return early if so.

**Affected Files**:

- `src/ads/media-tailor.js` - Polling methods

---

### Memory Management for LIVE Streams

**Description**: Implement cleanup for old ad breaks in long-running LIVE sessions.

**Problem**: The `adSchedule` array grows indefinitely during LIVE streams. For a 24-hour stream with ads every 5 minutes, this means 288 ad break objects stored in memory, most of which are hours old and no longer relevant.

**Current State**: Ad schedule grows unbounded

**Solution**: Periodically remove ad breaks that ended more than 1 hour ago during LIVE streams.

**Affected Files**:

- `src/ads/media-tailor.js` - LIVE tracking setup
- `src/ads/media-tailor.js` - dispose() method (clear timer)

---

### Ad Lookup Performance Optimization

**Description**: Replace O(n) linear search with O(log n) binary search for ad lookups.

**Problem**: `findActiveAdBreak()` performs a linear search through all ads on every `timeupdate` event (multiple times per second). For VOD with 100+ ads, this is wasteful.

**Current State**: Linear search in `src/ads/utils/mt.js:143-147`

**Solution**: Implement binary search since the ad schedule is already sorted by start time.

**Affected Files**:

- `src/ads/utils/mt.js` - `findActiveAdBreak()` function

---

### Manifest Parse Caching

**Description**: Cache parsed manifest data to avoid redundant parsing in LIVE streams.

**Problem**: During LIVE polling, the same manifest may be fetched multiple times if it hasn't changed. Parsing the same XML/M3U8 repeatedly wastes CPU.

**Current State**: No caching, manifests parsed on every fetch

**Solution**: Implement LRU cache with ETag/Last-Modified header support to detect unchanged manifests.

**Affected Files**:

- `src/ads/media-tailor.js` - Manifest fetching methods
- `src/ads/utils/mt.js` - Manifest fetch utilities

---

## Reliability & Error Handling

### Exponential Backoff for Retry Logic

**Description**: Progressively increase delay between retry attempts instead of retrying immediately.

**Problem**: When tracking API fails, immediate retries can make the problem worse if the API is overloaded. Current implementation retries instantly with no delay.

**Current State**:

- Simple retry logic at lines 745-752
- `maxTrackingRetries = 1` (only 1 retry)
- Retries immediately with no backoff

**Solution**:

- Increase max retries from 1 to 3
- Add exponential backoff delays: 1s, 2s, 4s
- Cap maximum delay at 30 seconds
- Check disposed status during delay

**Affected Files**:

- `src/ads/media-tailor.js:113` - Increase max retries
- `src/ads/media-tailor.js:745-752` - Add delay logic

---

### Exponential Backoff for LIVE Polling

**Description**: Increase poll interval on repeated failures, reset on success.

**Problem**: If tracking API is down during a LIVE stream, the tracker keeps polling at the same 10-second interval indefinitely, wasting bandwidth and server resources.

**Current State**: Fixed polling intervals, no backoff

**Solution**: Implement dynamic polling interval that increases on failures (10s → 20s → 40s, max 60s) and resets to 10s on success.

**Affected Files**:

- `src/ads/media-tailor.js` - LIVE polling logic

---

### Ad Schedule Deduplication

**Description**: Check for existing ads before adding during LIVE schedule merges.

**Problem**: LIVE polling can potentially add duplicate ad breaks if merging logic encounters the same ad from multiple sources (manifest + tracking API at slightly different times).

**Current State**: `mergeAdSchedules()` uses simple push without uniqueness check

**Solution**: Check for duplicates using time tolerance (±2 seconds) before adding new ads to schedule.

**Affected Files**:

- `src/ads/utils/mt.js` - `mergeAdSchedules()` function

---

### Session Expiry Detection

**Description**: Detect HTTP 403/401 responses indicating expired session and automatically re-initialize.

**Problem**: MediaTailor sessions expire after a certain time. If a session expires mid-stream, tracking API calls will fail with 403/401, but the tracker doesn't detect this and continues with expired sessionId.

**Current State**: No session expiry handling

**Solution**: Detect 403/401 errors, extract session endpoint from current manifest URL, re-initialize session, and retry the original request.

**Affected Files**:

- `src/ads/media-tailor.js` - Tracking fetch error handling
- `src/ads/media-tailor.js` - New reinitializeSession() method

---

### Graceful Cleanup on Dispose During Ads

**Description**: Fire AD_END and AD_BREAK_END events if tracker is disposed while ad is playing.

**Problem**: If user changes source mid-ad, the tracker is disposed but no AD_END event is sent. Analytics shows an ad that started but never ended.

**Current State**: dispose() cleans up but doesn't fire cleanup events

**Solution**: Check if currently in ad break when dispose() is called, and fire appropriate cleanup events before disposal.

**Affected Files**:

- `src/ads/media-tailor.js:1110-1126` - dispose() method

---

### Tracking API Response Validation

**Description**: Validate API response structure before processing.

**Problem**: If AWS changes the tracking API response format or returns malformed JSON, the tracker can crash when trying to process the data.

**Current State**: Assumes response has expected structure

**Solution**: Add schema validation to check for required fields (avails array, startTimeInSeconds, durationInSeconds) before processing.

**Affected Files**:

- `src/ads/utils/mt.js` - New validation function
- `src/ads/media-tailor.js` - Call validation before processing

---

## Edge Case Handling

### VHS Late-Load Detection

**Description**: Retry VHS hook attachment if VHS tech loads after tracker initialization.

**Problem**: In rare cases, VHS tech might not be immediately available when the tracker initializes. The current implementation checks once and gives up if VHS isn't ready.

**Current State**: Single check at initialization time

**Solution**: If VHS not available initially, retry after 500ms delay before falling back to polling.

**Affected Files**:

- `src/ads/media-tailor.js` - VHS hook logic
- `src/ads/media-tailor.js` - dispose() cleanup

---

### Robust Tracking URL Extraction

**Description**: More flexible URL parsing for non-standard MediaTailor URLs.

**Problem**: The current regex-based tracking URL extraction assumes a specific URL format. If AWS changes the URL structure or uses non-standard paths, extraction fails silently.

**Current State**: Regex-based extraction in `src/ads/utils/mt.js:50-65`

**Solution**: Replace regex with URL constructor API for more robust parsing and better error handling.

**Affected Files**:

- `src/ads/utils/mt.js:50-65` - Replace regex with URL parsing

---

## Implementation Priority

While all items listed are valid improvements, they can be implemented based on actual needs:

- **Implement if experiencing issues**: Exponential backoff, concurrent fetch guards, session expiry detection
- **Implement for heavy usage**: Memory cleanup, ad lookup optimization, manifest caching
- **Implement for completeness**: Response validation, deduplication, graceful cleanup
- **Implement if edge cases occur**: VHS late-load, robust URL extraction
