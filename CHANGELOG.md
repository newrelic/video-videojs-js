## [5.0.0](https://github.com/newrelic/video-videojs-js/compare/v4.2.1...v5.0.0) (2026-09-17)

- **Breaking change:** This release adds a `package.json#exports` map. Deep imports into internal paths of this package will no longer resolve — only the root export (`@newrelic/video-videojs-js`) and the new `/browser` subpath are valid import targets. Update any direct deep-imports before upgrading.

### New features

- **`/browser` subpath export:** A `@newrelic/video-videojs-js/browser` entry point is now available that excludes unused Vega/connected-device code, reducing bundle size for browser consumers.
- **`notifyAdSkipped()` (MediaTailor):** Host apps with a custom skip-ad UI can report a user-initiated skip. Emits the skipped ad-end event when in an ad; no-op otherwise. Mirrors the equivalent API on the iOS/Android trackers.
- **`stopTracking()` (MediaTailor):** Reversible teardown that stops polling and unregisters listeners without disposing the tracker, so it can be resumed later. Shares the method name used by the iOS/Android trackers.
- **`AD_ERROR` events (MediaTailor):** Non-terminal failures now surface as `AD_ERROR` events in NRDB with a semantic `errorCode` (`NO_FILL`, `ADS_TIMEOUT`, `TRACKING_FETCH_FAILED`, `TOKEN_EXPIRED`, `MISSING_AVAIL_START`, `MANIFEST_TRACKING_MISMATCH`) instead of only appearing in the debug log.
- **`adPrimaryId` attribute (MediaTailor):** `AD_START`, `AD_END`, and `AD_QUARTILE` now carry `adPrimaryId` (the VAST `creativeId`, falling back to `availId:adId`) so `count(DISTINCT adPrimaryId)` counts true creatives, not per-avail ad IDs.

### Improvements

- **`@newrelic/video-core` updated to 5.1.0**, which includes a TypeScript conversion, upstream bug fixes, and dependency patches.
- **Configurable poll cadence (MediaTailor):** `config.ad.pollIntervalMs` overrides the manifest-derived live poll interval (clamped to 100–5000 ms) for battery- or CPU-constrained clients. Behavior is unchanged when the option is omitted.
- **Tracking URL from HLS manifest (MediaTailor):** The tracker now reads the tracking endpoint from an `#EXT-X-DATERANGE CLASS="tracking"` tag when present, removing the need to pass an explicit `trackingUrl` on non-AWS CDNs. An explicit option still takes precedence.
- **Source-change reset (MediaTailor):** Swapping `player.src()` now resets the tracker — cancels in-flight fetches, clears the stale ad schedule, and re-derives the tracking endpoint — instead of continuing to poll the previous session's endpoint.

### Bug fixes

- MediaTailor: Only the first ad in a multi-ad pod was tracked. The paging loop re-fetched the same avail on every page; the tracker now fetches the full window in a single tokenless request.
- MediaTailor: The tracking endpoint could not be derived for implicit-session media-playlist URLs, so Tier-1 ad detection never ran for those sessions.
- MediaTailor: `config.ad.segmentPrefix` was silently ignored because it was mapped to the wrong internal key.
- MediaTailor: A DASH period was classified as an ad when only one of several representations resolved to an ad-marked URL. Classification now requires every representation to match.
- MediaTailor: `AD_END` was not fired when a pod ended before its enclosing break boundary, causing completions to be undercounted.
- MediaTailor: Pod-count mismatches between manifest and tracking data silently corrupted break geometry; the tracker now reconciles counts explicitly and emits `MANIFEST_TRACKING_MISMATCH`.
- MediaTailor: Avails with a missing `startTimeInSeconds` were silently dropped, undercounting impressions in NRDB; the tracker now falls back to the first ad's start and emits `MISSING_AVAIL_START`.
- MediaTailor: Live sliding-window re-merges duplicated or dropped ad breaks when start times jittered; breaks now deduplicate by stable identity (`availId` + `availProgramDateTime`).
- MediaTailor: No-fill avails emitted phantom `AD_START`/quartile events; they now emit only break boundaries plus `AD_ERROR(NO_FILL)`.
- MediaTailor: Expired tracking pagination tokens (`HTTP 400`) were not handled; the token is now dropped and retried once before emitting `TOKEN_EXPIRED` and stopping polling.
- MediaTailor: Manifest fetches did not re-check `isDisposed` after each `await`, risking state mutation on a disposed tracker.
- `AD_RESUME` was fired on first play into an ad, not only after a genuine pause.
- Disposing mid-ad did not emit the outstanding `AD_END`/`AD_BREAK_END`, leaving the break dangling.
- DASH EventStream `presentationTime` values were treated as raw ticks instead of being converted to seconds, misplacing ads at wrong offsets.
- HLS `#EXT-X-CUE-OUT`-parsed ad breaks did not initialize quartile flags, causing quartile events to fire more than once per ad.

## [4.2.1](https://github.com/newrelic/video-videojs-js/compare/v4.2.0...v4.2.1) (2026-06-18)

### New features

- Added optional automatic rendition/quality-level change tracking: integrates with the `videojs-contrib-quality-levels` plugin (when present) to report quality transitions along with the previous and new bitrate, with graceful fallback when the plugin isn't loaded.

## [4.2.0](https://github.com/newrelic/video-videojs-js/compare/v4.1.2...v4.2.0) (2026-06-10)

### Features

- **MediaTailor Custom CDN Support:** Replaced URL-based auto-detection with explicit opt-in
  - Customers now pass `mediatailor: true` (or `mediatailor: { trackingUrl, adSegmentPrefix }`) to enable the tracker — supports both default AWS hostnames and custom CDN domains
  - Added `MT_DEFAULT_AD_SEGMENT_PATH` (`/tm/`) constant for AWS-recommended CDN ad-segment path; ad segments rewritten to a custom CDN domain under `/tm/` are detected automatically
  - `isMediaTailorSegment()` now checks the default AWS segments hostname, the `/tm/` path, and an optional customer-supplied `adSegmentPrefix`
  - Threaded `adSegmentPrefix` through HLS (VHS) and DASH manifest parsing
  - Added explicit session initialisation via `mediatailor: { trackingUrl }` for POST `/v1/session/` flows

- **Ad Tracking Configuration:** Introduced `config.ad.type` to control ad tracker selection
  - Exposed `AD_TRACKING` constant with CSAI (flat value covering IMA / Brightcove IMA / Freewheel / generic) and SSAI sub-types (`DAI`, `MT`)
  - SSAI requires an explicit sub-type — each platform needs its own SDK and cannot be auto-detected
  - `SSAI.MT` implies `mediatailor: true`
  - When `config.ad.type` is unset, falls back to CSAI auto-detection with a warning (backward compatible for v4.1.2 users)
  - Co-located `segmentPrefix` and `trackingUrl` under `config.ad`
  - Added `DaiAdsTracker` to static exports

- **Logging Improvements:**
  - Exposed `VideojsTracker.Log` as a static so UMD callers can set log level
  - Logs active ad segment detection mode at tracker startup
  - Logs the matched ad segment detection path on first ad break (once per session)
  - Logs which CSAI framework was auto-detected (BrightcoveIma / IMA / Freewheel / generic)
  - Replaced `console.log/warn/error` with `nrvideo.Log` across MediaTailor files

### Bug Fixes

- **Buffer End:** Fixed buffer end handling in tracker
- **Plugin Registration:** Fixed `register-plugin.js` silently dropping the options object and not forwarding it to the `TrackerJS` constructor

### Documentation

- **README & SSAI Docs:** Updated for custom CDN support, clarified when `trackingUrl` and `adSegmentPrefix` overrides are needed, cleaned up `sessionId` references
- **SSAI Troubleshooting:** Corrected `adSegmentPrefix` references to `config.ad.segmentPrefix`

### Samples

- **MediaTailor Lab:** Rewrote sample app with a clean minimal UI — license key / app ID / playback URL / format toggle, smart Load button (handles both session init and direct playback URLs), NR log level toggle, debug log showing detected mode, credentials persisted in localStorage

## [4.1.2](https://github.com/newrelic/video-videojs-js/compare/v4.1.1...v4.1.2) (2026-05-11)

### Features

- **AWS MediaTailor Support:** Added comprehensive support for AWS MediaTailor SSAI with DASH
  - Implemented MediaTailor tracker with manifest polling and ad tracking
  - Added MediaTailor lab sample for testing and demonstration
  - Enhanced DASH support for MediaTailor integration
  - Added unit test cases for MediaTailor functionality
  - Improved MediaTailor tracker reliability and event handling

### Bug Fixes

- **Bitrate Data Types:** Updated bitrate data types for improved accuracy and consistency
- **Manifest Fetch Error Handling:** Added proper error handling for manifest fetch failures
- **MediaTailor Configuration:** Moved MediaTailor config variables to global scope for better accessibility

### Documentation

- **SSAI Documentation:** Updated SSAI documentation to include MediaTailor integration details
- **MediaTailor Naming:** Clarified MediaTailor helper and state naming conventions

### Build & Infrastructure

- **Release Workflow:** Standardized release workflow with smart detection
- **Dependencies:** Updated semantic-release dependencies and package-lock.json
- **Cleanup:** Removed unrelated test infrastructure files, scripts, and dependencies

## [4.1.1](https://github.com/newrelic/video-videojs-js/compare/v4.1.0...v4.1.1) (2026-04-17)

### Documentation

- **README.md:** Added Best Practices section (contentTitle, userId, custom attributes, gradual rollout with feature flags)
- **README.md:** Promoted Bitrate Metrics to top-level section with detailed table format and NRQL query examples
- **README.md:** Updated Data Model event descriptions to include heartbeats and media errors
- **README.md:** Fixed DATAMODEL.md link casing
- **README.md:** Updated Table of Contents with new sections (Prerequisites, Best Practices, Bitrate Metrics)
- **README.md:** Renamed Contributing to Contribute for consistency across trackers

## [4.1.0](https://github.com/newrelic/video-videojs-js/compare/v4.0.3...v4.1.0) (2026-04-08)

### Breaking Changes

- **Method Renames:** Bitrate methods renamed for clarity
  - `getMeasuredBitrate()` → `getSegmentDownloadBitrate()` - ABR bandwidth estimate from player stats
  - `getDownloadBitrate()` → `getNetworkDownloadBitrate()` - Instantaneous network throughput
  - **Note:** Most users won't be affected as these methods are primarily used internally by the tracker

### Deprecated

- **Removed `getRenditionBitrate()` method** - No longer needed with improved bitrate tracking system

### Enhancements

- **Bitrate Metrics Refactoring:**
  - Implemented consistent fallback pattern across all bitrate methods (VHS direct access → tech wrapper fallback)
  - Simplified network download bitrate to use direct throughput access
  - Enhanced bitrate tracking with four distinct metrics for comprehensive quality analysis
  - Updated all tech wrappers (VHS, hls.js, Shaka) with consistent implementations

- **Comprehensive Documentation Rewrite:**
  - **README.md:** Complete rewrite with professional structure, badges, features section, table of contents, two installation options, expanded API reference, and clear New Relic support channels
  - **datamodel.md:** Complete rewrite with comprehensive event reference, all four bitrate metrics definitions, QoE attributes, complete attribute tables for all event types, and SSAI/DAI support documentation
  - **DEVELOPING.md:** Complete development guide with setup, build instructions, project structure, testing guidelines, and release process
  - **REVIEW.md:** NEW FILE - Code review guidelines and standards for contributors

### Documentation

- Added clear instructions to obtain configuration from [one.newrelic.com](https://one.newrelic.com)
- Updated all bitrate metric definitions with accurate sources and use cases
- Added comprehensive API reference with method signatures and examples
- Enhanced support section with multiple New Relic support channels
- Added third-party library license disclosure

## [4.0.3](https://github.com/newrelic/video-videojs-js/compare/v4.0.2...v4.0.3) (2025-11-21)

### Bug Fixes

- removed github token ([f5f9ade](https://github.com/newrelic/video-videojs-js/commit/f5f9ade01c9af411d72ec74874f8d0750c5f0f66))

# CHANGELOG

## [4.0.2] - 2025-10-21

### Bug Fixes

- **Content Bitrate Detection:** Enhanced `getBitrate()` method with comprehensive Video.js tech support
  - Added VHS (Video HTTP Streaming) API support for HLS/DASH content
  - Implemented audio + video bitrate combination for total bandwidth calculation
  - Added fallback support for Shaka Player, HLS.js, and DASH.js
  - Improved bitrate detection reliability across different streaming technologies
  - Fixed issue where bitrate remained constant throughout video playback

## [4.0.1] - 2025-09-11

### Add

- Added methods for `Ad Bitrate` and `Ad Rendition Bitrate` in ima.js and dai.js

## [4.0.0] - 2025-08-26

### Major Updates:

- Upgraded `@newrelic/video-core` dependency to version `4.0.0`.
- Introduced support for SSAI (Server-Side Ad Insertion) Google DAI.
- Minor fixes to webpack configuration

## [3.1.0] - 2025-05-27

### Enhancements

- **Publishing to npm:** The package can now be published to npm, making it easily accessible.

### Build

- **Distribution Formats:** Added `cjs`, `esm`, and `umd` builds to the `dist` folder, ensuring compatibility with CommonJS, ES Modules, and UMD module formats.

## [3.0.1] - 2025-04-24

### Bug Fixes

- Resolved an issue where custom attribute definitions were not accepting options as arguments.
- **Update:** The `errorName` attribute has been deprecated and `errorMessage` is introduced as its replacement.

## [3.0.0] - 2025/02/20

### New Event Type Introduced [VideoAction, VideoErrorAction, VideoAdAction, VideoCustomAction]

- PageAction Deprecated.
- New Attributes Added,

## [0.7.1] - 2024/11/13

### Bug fix

- Added Null Handler in the `Tracker`.

## [0.7.0] - 2024/09/18

### Add

- Language attribute.

### Update

- Samples.

## [0.6.0] - 2024/05/17

### Update

- Update configuration stuff.

## [0.5.0] - 2020/05/04

### Fix

- Update dependencies to fix multiple vulnerabilities.

## [0.4.0] - 2020/04/16

### Add

- OS stuff.

### Update

- Video Core library.

## [0.3.1] - 2018/01/11

### Remove

- Remove old reference to `sendPlayerInit`.

## [0.3.0] - 2017/11/03

### Add

- Add support for `creativeId`, `adId` and `adPartner`.

## [0.2.0] - 2017/11/03

### Add

- Add support for `FreeWheel` ads.

## [0.1.2] - 2017/11/02

### Lib

- Update project to support core `0.5+`.

## [0.1.1] - 2017/10/23

### Fix

- Add aditional checks to `ima` tracker.

## [0.1.0]

- First Version
