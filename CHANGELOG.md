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
