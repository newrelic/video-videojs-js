# Introduction

This document provides an overview of the Events and Attributes used for media monitoring in New Relic with the Video.js Tracker.

# Glossary

This section defines the key terms used in the context of New Relic Media monitoring:

## Event Types

- **videoAction**: Events triggered by general video interactions, such as starting, pausing, or seeking.
- **videoAdAction**: Events related to ad playback, such as starting, completing, or skipping an ad.
- **videoErrorAction**: Events triggered by errors encountered during video or ad playback.
- **videoCustomAction**: Custom events defined to capture specific actions or interactions beyond default event types.

## Attribute

An Attribute is a piece of data associated with an event. Attributes provide additional context or details about the event, such as the video's title, duration, or playback position.

- Most attributes are included with every event.
- Some attributes are specific to certain event types, such as ad-related data sent with ad events.

# Bitrate Metrics

The Video.js Tracker captures four distinct bitrate metrics to provide comprehensive insight into video quality and network performance.

## contentBitrate
**Type:** Number (bits per second)  
**Description:** The encoding bitrate of the currently playing rendition from the manifest. Represents the actual content bitrate being consumed during playback.  
**Source Properties:**
- VHS: `tech.vhs.playlists.media().attributes['AVERAGE-BANDWIDTH']` or `tech.vhs.playlists.media().attributes.BANDWIDTH`
- hls.js: `tech.levels[currentLevel].bitrate`
- Shaka: `tech.getStats().streamBandwidth`  
**Use Case:** Indicates the quality level being consumed. Updates when ABR switches to a different rendition.

## contentManifestBitrate
**Type:** Number (bits per second)  
**Description:** The highest available bitrate from all renditions in the manifest. Represents the maximum quality capability of the stream.  
**Formula:** `Math.max(...playlists.map(p => p.attributes.BANDWIDTH))`  
**Source Properties:**
- VHS: `Math.max(...tech.vhs.playlists.master.playlists.map(p => p.attributes.BANDWIDTH))`
- hls.js: `Math.max(...tech.levels.map(l => l.bitrate))`
- Shaka: `Math.max(...tech.getVariantTracks().map(t => t.videoBandwidth + t.audioBandwidth))`  
**Use Case:** Indicates the peak quality capability of the stream. Static value that doesn't change during playback.

## contentSegmentDownloadBitrate
**Type:** Number (bits per second)  
**Description:** ABR (Adaptive Bitrate) estimated bandwidth from the player's stats object. This is the bandwidth estimate used by the ABR algorithm to make quality switching decisions.  
**Source Properties:**
- VHS: `tech.vhs.stats.bandwidth`
- hls.js: `tech.stats.bandwidth`
- Shaka: `tech.getStats().estimatedBandwidth`  
**Use Case:** Tracks the ABR algorithm's bandwidth estimation. Useful for understanding why the player switches quality levels.

## contentNetworkDownloadBitrate
**Type:** Number (bits per second)  
**Description:** Instantaneous download throughput from the most recent segment download. Represents raw network download speed.  
**Source Properties:**
- VHS: `tech.vhs.throughput`
- hls.js: `tech.throughput`
- Shaka: `tech.getStats().estimatedBandwidth`  
**Use Case:** Tracks instantaneous network throughput. Can be volatile and spike during buffer-ahead behavior.

## Bitrate Comparison

| Metric | What It Measures | Changes Frequency | Typical Use |
|--------|------------------|-------------------|-------------|
| **contentBitrate** | Current rendition encoding bitrate | On quality switch | Actual quality being played |
| **contentManifestBitrate** | Peak stream capability | Never (static) | Stream quality ceiling |
| **contentSegmentDownloadBitrate** | ABR bandwidth estimate | On stats refresh | ABR decision tracking |
| **contentNetworkDownloadBitrate** | Instantaneous download speed | Every segment download | Raw network throughput |

## Example Values

During typical playback of a 6 Mbps max stream playing at 2 Mbps quality:

```javascript
{
  contentBitrate: 2000000,                      // Currently playing 2 Mbps rendition
  contentManifestBitrate: 6000000,              // Highest available is 6 Mbps (static)
  contentSegmentDownloadBitrate: 4200000,       // ABR estimates 4.2 Mbps available
  contentNetworkDownloadBitrate: 8500000        // Last segment downloaded at 8.5 Mbps
}
```

# Event Type Reference

## VideoAction

| Attribute Name           | Definition                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| actionName               | The specific action being performed in the video player, such as play, pause, resume, content buffering, etc.                                      |
| appId                    | The ID of your application, as recorded by New Relic.                                                                                              |
| appName                  | The name of the application.                                                                                                                       |
| playerName               | The name of the video player.                                                                                                                      |
| playerVersion            | The version of the video player.                                                                                                                   |
| deviceType               | The specific type of the device: iPhone 8, iPad Pro, etc.                                                                                          |
| deviceGroup              | The category of the device, such as iPhone or Tablet.                                                                                              |
| deviceManufacturer       | The manufacturer of the device, such as Motorola or HTC.                                                                                           |
| deviceModel              | The model number of the device.                                                                                                                    |
| deviceName               | The device's name.                                                                                                                                 |
| deviceSize               | The display size of the device: Small, normal, large, xlarge.                                                                                      |
| deviceUuid               | A unique identifier assigned at the time of app installation by New Relic.                                                                         |
| viewSession              | Trackers will generate unique IDs for every new video session. This could be the session ID from the client.                                       |
| viewId                   | Trackers will generate unique IDs for every new video iteration.                                                                                   |
| contentId                | The ID of the video.                                                                                                                               |
| contentTitle             | The title of the video.                                                                                                                            |
| contentIsLive            | True if the video is live.                                                                                                                         |
| contentBitrate           | Encoding bitrate (in bits per second) of the currently playing rendition from the manifest.                                                        |
| contentManifestBitrate   | Highest available bitrate (in bits per second) from all renditions in the manifest. Represents maximum stream quality capability.                  |
| contentSegmentDownloadBitrate | ABR estimated bandwidth (in bits per second) from the player's stats object. Used by ABR algorithm for quality switching decisions.           |
| contentNetworkDownloadBitrate | Instantaneous download throughput (in bits per second) from the most recent segment download. Represents raw network download speed.          |
| contentRenditionName     | Name of the rendition (e.g., 1080p).                                                                                                               |
| contentRenditionHeight   | Rendition actual Height (before re-scaling).                                                                                                       |
| contentRenditionWidth    | Rendition actual Width (before re-scaling).                                                                                                        |
| contentDuration          | Duration of the video, in ms.                                                                                                                      |
| contentPlayhead          | Playhead (currentTime) of the video, in ms.                                                                                                        |
| contentLanguage          | Language of the video. We recommend using locale notation, e.g., en_US.                                                                            |
| contentSrc               | URL of the resource being played.                                                                                                                  |
| contentPlayrate          | Playrate (speed) of the video, e.g., 1.0, 0.5, 1.25.                                                                                               |
| contentIsFullscreen      | True if the video is currently fullscreen.                                                                                                         |
| contentIsMuted           | True if the video is currently muted.                                                                                                              |
| contentCdn               | The CDN serving the content.                                                                                                                       |
| contentIsAutoplayed      | If the player was auto-played.                                                                                                                     |
| contentPreload           | The player preload attribute.                                                                                                                      |
| contentFps               | Current FPS (Frames per second).                                                                                                                   |
| isBackgroundEvent        | If the player is hidden by another window.                                                                                                         |
| totalAdPlaytime          | Total time ad is played for this video session.                                                                                                    |
| elapsedTime              | Time that has passed since the last event.                                                                                                         |
| bufferType               | When buffer starts, i.e., initial, seek, pause & connection.                                                                                       |
| timeSinceLastError       | Time in milliseconds since the last content error occurred. Only included after an error has occurred.                                             |
| asn                      | Autonomous System Number: a unique number identifying a group of IP networks that serves the content to the end user.                              |
| asnLatitude              | The latitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's latitude.   |
| asnLongitude             | The longitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's longitude. |
| asnOrganization          | The organization that owns the Autonomous System Number. Often an ISP, sometimes a private company or institution.                                 |
| timestamp                | The time (date, hour, minute, second) at which the interaction occurred.                                                                           |
| instrumentation.provider | Player/agent name.                                                                                                                                 |
| instrumentation.name     | Name of the instrumentation collecting the data.                                                                                                   |
| instrumentation.version  | Agent's version.                                                                                                                                   |

**QoE (Quality of Experience) Attributes** - These attributes are sent with `actionName = QOE_AGGGREGATE` events:

| Attribute Name           | Definition                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| startupTime      | Time from CONTENT_REQUEST to CONTENT_START in milliseconds. Measures video startup performance. Only included if value is not null.                |
| peakBitrate      | Maximum contentBitrate (in bits per second) observed during content playback. Tracks the highest quality achieved. Only included if value > 0.     |
| hadStartupError | Boolean indicating if CONTENT_ERROR occurred before CONTENT_START. True if video failed to start due to an error.                                 |
| hadPlaybackError | Boolean indicating if CONTENT_ERROR occurred at any time during content playback.                                                                |
| totalRebufferingTime | Total milliseconds spent rebuffering during content playback (excludes initial buffering).                                                      |
| rebufferingRatio | Rebuffering time as a percentage of total playtime. Calculated as (totalRebufferingTime / totalPlaytime) × 100.                                    |
| totalPlaytime    | Total milliseconds user spent watching content (excludes pausing, buffering, and ads). Represents actual content viewing time.                     |
| averageBitrate   | Average bitrate (in bits per second) across all content playback weighted by playtime.                                                             |

### List of possible Video Actions

| Action Name              | Definition                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| PLAYER_READY             | The player is ready to start sending events.                                                     |
| DOWNLOAD                 | Downloading data.                                                                                |
| CONTENT_REQUEST          | Content video has been requested.                                                                |
| CONTENT_START            | Content video started (first frame shown).                                                       |
| CONTENT_END              | Content video ended.                                                                             |
| CONTENT_PAUSE            | Content video paused.                                                                            |
| CONTENT_RESUME           | Content video resumed.                                                                           |
| CONTENT_SEEK_START       | Content video seek started.                                                                      |
| CONTENT_SEEK_END         | Content video seek ended.                                                                        |
| CONTENT_BUFFER_START     | Content video buffering started.                                                                 |
| CONTENT_BUFFER_END       | Content video buffering ended.                                                                   |
| CONTENT_HEARTBEAT        | Content video heartbeat, an event that happens once every 30 seconds while the video is playing. |
| CONTENT_RENDITION_CHANGE | Content video stream quality changed.                                                            |
| QOE_AGGGREGATE           | Quality of Experience aggregate event containing QoE KPI metrics for content playback.           |

## VideoAdAction

| Attribute Name           | Definition                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| actionName               | The specific action being performed in the video player, such as play, pause, resume, content buffering, etc.                                      |
| appId                    | The ID of your application, as recorded by New Relic.                                                                                              |
| appName                  | The name of the application.                                                                                                                       |
| playerName               | The name of the video player.                                                                                                                      |
| playerVersion            | The version of the video player.                                                                                                                   |
| deviceType               | The specific type of the device: iPhone 8, iPad Pro, etc.                                                                                          |
| deviceGroup              | The category of the device, such as iPhone or Tablet.                                                                                              |
| deviceManufacturer       | The manufacturer of the device, such as Motorola or HTC.                                                                                           |
| deviceModel              | The model number of the device.                                                                                                                    |
| viewSession              | Trackers will generate unique IDs for every new video session. This could be the session ID from the client.                                       |
| viewId                   | Trackers will generate unique IDs for every new video iteration.                                                                                   |
| adId                     | The ID of the ad video.                                                                                                                            |
| adTitle                  | The title of the ad video.                                                                                                                         |
| adBitrate                | Bitrate (in bits per second) of the ad video.                                                                                                      |
| adRenditionName          | Name of the rendition (e.g., 1080p).                                                                                                               |
| adRenditionHeight        | Rendition actual Height (before re-scaling).                                                                                                       |
| adRenditionWidth         | Rendition actual Width (before re-scaling).                                                                                                        |
| adDuration               | Duration of the ad video, in ms.                                                                                                                   |
| adPlayhead               | Playhead (currentTime) of the ad video, in ms.                                                                                                     |
| adLanguage               | Language of the ad video. We recommend using locale notation, e.g., en_US.                                                                         |
| adSrc                    | URL of the ad resource being played.                                                                                                               |
| adCdn                    | The CDN serving the ad content.                                                                                                                    |
| adIsMuted                | True if the ad video is currently muted.                                                                                                           |
| adFps                    | Current FPS (Frames per second).                                                                                                                   |
| adQuartile               | Quartile of the ad. 0 before first, 1 after first quartile, 2 after midpoint, 3 after third quartile, 4 when completed.                            |
| adPosition               | The position of the ad (pre-roll, mid-roll, post-roll).                                                                                            |
| adCreativeId             | The creative ID of the ad.                                                                                                                         |
| adPartner                | The ad partner, e.g., ima, freewheel.                                                                                                              |
| isBackgroundEvent        | If the player is hidden by another window.                                                                                                         |
| bufferType               | When buffer starts, i.e., initial, seek, pause & connection.                                                                                       |
| timeSinceLastAdError     | Time in milliseconds since the last ad error occurred. Only included after an ad error has occurred.                                               |
| asn                      | Autonomous System Number: a unique number identifying a group of IP networks that serves the content to the end user.                              |
| asnLatitude              | The latitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's latitude.   |
| asnLongitude             | The longitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's longitude. |
| asnOrganization          | The organization that owns the Autonomous System Number. Often an ISP, sometimes a private company or institution.                                 |
| timestamp                | The time (date, hour, minute, second) at which the interaction occurred.                                                                           |
| elapsedTime              | Time that has passed since the last event.                                                                                                         |
| instrumentation.provider | Player/agent name.                                                                                                                                 |
| instrumentation.name     | Name of the instrumentation collecting the data.                                                                                                   |
| instrumentation.version  | Agent's version.                                                                                                                                   |

### List of possible Video Ad Actions

| Action Name         | Definition                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------- |
| AD_REQUEST          | Ad video has been requested.                                                                |
| AD_START            | Ad video started (first frame shown).                                                       |
| AD_END              | Ad video ended.                                                                             |
| AD_PAUSE            | Ad video paused.                                                                            |
| AD_RESUME           | Ad video resumed.                                                                           |
| AD_SEEK_START       | Ad video seek started.                                                                      |
| AD_SEEK_END         | Ad video seek ended.                                                                        |
| AD_BUFFER_START     | Ad video buffering started.                                                                 |
| AD_BUFFER_END       | Ad video buffering ended.                                                                   |
| AD_HEARTBEAT        | Ad video heartbeat, an event that happens once every 30 seconds while the ad is playing.    |
| AD_RENDITION_CHANGE | Ad video stream quality changed.                                                            |
| AD_BREAK_START      | Ad break (a block of ads) started.                                                          |
| AD_BREAK_END        | Ad break ended.                                                                             |
| AD_QUARTILE         | Ad quartile happened.                                                                       |
| AD_CLICK            | Ad has been clicked.                                                                        |

## VideoErrorAction

| Attribute Name           | Definition                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| actionName               | The specific action being performed in the video player, such as play, pause, resume, content buffering, etc.                                      |
| appId                    | The ID of your application, as recorded by New Relic.                                                                                              |
| appName                  | The name of the application.                                                                                                                       |
| playerName               | The name of the video player.                                                                                                                      |
| playerVersion            | The version of the video player.                                                                                                                   |
| deviceType               | The specific type of the device: iPhone 8, iPad Pro, etc.                                                                                          |
| deviceGroup              | The category of the device, such as iPhone or Tablet.                                                                                              |
| deviceManufacturer       | The manufacturer of the device, such as Motorola or HTC.                                                                                           |
| deviceModel              | The model number of the device.                                                                                                                    |
| viewSession              | Trackers will generate unique IDs for every new video session. This could be the session ID from the client.                                       |
| viewId                   | Trackers will generate unique IDs for every new video iteration.                                                                                   |
| contentId                | The ID of the video.                                                                                                                               |
| contentTitle             | The title of the video.                                                                                                                            |
| errorName                | Name of the error.                                                                                                                                 |
| errorCode                | Error code if it's known.                                                                                                                          |
| errorMessage             | Error message describing what went wrong.                                                                                                          |
| backTrace                | Stack trace of the error.                                                                                                                          |
| isBackgroundEvent        | If the player is hidden by another window.                                                                                                         |
| contentSrc               | Content source URL.                                                                                                                                |
| contentCdn               | Content CDN URL.                                                                                                                                   |
| asn                      | Autonomous System Number: a unique number identifying a group of IP networks that serves the content to the end user.                              |
| asnLatitude              | The latitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's latitude.   |
| asnLongitude             | The longitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's longitude. |
| asnOrganization          | The organization that owns the Autonomous System Number. Often an ISP, sometimes a private company or institution.                                 |
| elapsedTime              | Time that has passed since the last event.                                                                                                         |
| timestamp                | The time (date, hour, minute, second) at which the interaction occurred.                                                                           |
| instrumentation.provider | Player/agent name.                                                                                                                                 |
| instrumentation.name     | Name of the instrumentation collecting the data.                                                                                                   |
| instrumentation.version  | Agent's version.                                                                                                                                   |

### List of possible Video Error Actions

| Action Name   | Definition           |
| ------------- | -------------------- |
| AD_ERROR      | Ad video error.      |
| ERROR         | An error happened.   |
| CRASH         | App crash happened.  |
| CONTENT_ERROR | Content video error. |

## VideoCustomAction

| Attribute Name           | Definition                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| actionName               | The name of the PageAction, as defined by client in their code.                                                                                    |
| appId                    | The ID of your application, as recorded by New Relic.                                                                                              |
| appName                  | The name of the application.                                                                                                                       |
| playerName               | The name of the video player.                                                                                                                      |
| playerVersion            | The version of the video player.                                                                                                                   |
| deviceType               | The specific type of the device: iPhone 8, iPad Pro, etc.                                                                                          |
| deviceGroup              | The category of the device, such as iPhone or Tablet.                                                                                              |
| deviceManufacturer       | The manufacturer of the device, such as Motorola or HTC.                                                                                           |
| deviceModel              | The model number of the device.                                                                                                                    |
| viewSession              | Trackers will generate unique IDs for every new video session. This could be the session ID from the client.                                       |
| viewId                   | Trackers will generate unique IDs for every new video iteration.                                                                                   |
| contentId                | The ID of the video.                                                                                                                               |
| contentTitle             | The title of the video.                                                                                                                            |
| isBackgroundEvent        | If the player is hidden by another window.                                                                                                         |
| asn                      | Autonomous System Number: a unique number identifying a group of IP networks that serves the content to the end user.                              |
| asnLatitude              | The latitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's latitude.   |
| asnLongitude             | The longitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's longitude. |
| asnOrganization          | The organization that owns the Autonomous System Number. Often an ISP, sometimes a private company or institution.                                 |
| timestamp                | The time (date, hour, minute, second) at which the interaction occurred.                                                                           |
| instrumentation.provider | Player/agent name.                                                                                                                                 |
| instrumentation.name     | Name of the instrumentation collecting the data.                                                                                                   |
| instrumentation.version  | Agent's version.                                                                                                                                   |

# Tech Wrapper Support

The Video.js Tracker supports multiple video playback technologies through tech wrappers:

## ContribHlsTech (VHS - Video.js HTTP Streaming)
- Full support for all bitrate metrics
- Native Video.js integration
- Uses VHS-specific properties (`tech.vhs.*`)
- Supports HLS adaptive streaming

## HlsJsTech (hls.js integration)
- Full support for all bitrate metrics
- Integration with hls.js library
- Uses hls.js-specific properties (`tech.levels`, `tech.currentLevel`)
- Supports HLS adaptive streaming

## ShakaTech (Shaka Player integration)
- Full support for all bitrate metrics
- Integration with Shaka Player library
- Uses Shaka Player stats API (`tech.getStats()`, `tech.getVariantTracks()`)
- Supports DASH and HLS adaptive streaming

Each wrapper implements fallback logic to access native tech properties directly if wrapper methods fail.

# SSAI (Server-Side Ad Insertion) Support

The Video.js Tracker provides comprehensive support for SSAI via DAI (Dynamic Ad Insertion):

- Automatically detects DAI streams
- Tracks ad events from StreamManager
- Provides ad cue point tracking
- Seamless integration with Google DAI SDK
- See `samples/dai/index.html` for implementation example

# Custom Data and Events

## Custom Attributes

You can add custom attributes when initializing the tracker:

```javascript
const tracker = new VideojsTracker(player, {
  customData: {
    customPlayerName: 'myGreatPlayer',
    customPlayerVersion: '9.4.2',
    contentTitle: 'My Video Title',
    customAttribute: 'customValue'
  }
});
```

## Custom Events

Send custom events with arbitrary attributes:

```javascript
tracker.sendCustom('MyCustomEvent', {
  customData: 'test',
  userId: 123,
  anyAttribute: 'anyValue'
});
```

# API Reference

## Initialization

```javascript
const options = {
  info: {
    licenseKey: "...",
    beacon: "...",
    applicationId: "..."
  },
  config: {
    qoeAggregate: false,      // Enable QoE aggregation
    qoeIntervalFactor: 1      // QoE harvest frequency
  },
  customData: {               // Custom attributes
    key: "value"
  }
};

const tracker = new VideojsTracker(player, options);
```

## Methods

- `tracker.setUserId(userId)` - Set user identifier
- `tracker.setHarvestInterval(ms)` - Set data reporting interval (1000-300000ms)
- `tracker.sendCustom(action, attributes)` - Send custom event
- `tracker.setOptions(options)` - Update tracker options
