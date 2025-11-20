## [4.0.3] - 2025-11-20

* chore: make github token available to dry run step
* chore: persist credentials for github action
* chore: update release process to raise a pr to master to be compliant with branch rules
* chore: update README.md
* Merge pull request #68 from newrelic/NR-484244-add-release-github-action
* chore: adapt new npm publish changes
* chore: add scematic release steps in ci
* Merge pull request #67 from newrelic/stable
* Merge pull request #66 from newrelic/NR-425132-update-pricing-doc
* Merge pull request #64 from newrelic/fix/npm-workflow
* chore: update README.md with pricing
* fix: removed github token
* Update npm publish workflow with permissions and GITHUB_TOKEN
* Merge pull request #63 from newrelic/master

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
