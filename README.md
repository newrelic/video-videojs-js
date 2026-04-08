[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic Video.js Tracker

[![npm version](https://badge.fury.io/js/%40newrelic%2Fvideo-videojs.svg)](https://badge.fury.io/js/%40newrelic%2Fvideo-videojs)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The New Relic Video.js Tracker provides comprehensive video analytics for applications using Video.js Player. Track video events, monitor playback quality, identify errors, and gain deep insights into user engagement and streaming performance.

## Features

- 🎯 **Automatic Event Detection** - Captures Video.js player events automatically without manual instrumentation
- 📊 **Comprehensive Bitrate Tracking** - Four distinct bitrate metrics for complete quality analysis
- 🎬 **Ad Tracking Support** - Full support for IMA, Freewheel, and SSAI (Server-Side Ad Insertion)
- 🔧 **Multi-Tech Support** - Works with VHS, hls.js, and Shaka Player
- 📈 **QoE Metrics** - Quality of Experience aggregation for startup time, buffering, and playback quality
- 🎨 **Event Segregation** - Organized event types: `VideoAction`, `VideoAdAction`, `VideoErrorAction`, `VideoCustomAction`
- 🚀 **Easy Integration** - NPM package or direct script include

## Table of Contents

- [Installation](#installation)
  - [Option 1: NPM/Yarn](#option-1-install-via-npmyarn)
  - [Option 2: Direct Script Include](#option-2-direct-script-include-without-npm)
- [Usage](#usage)
- [Configuration Options](#configuration-options)
- [API Reference](#api-reference)
- [Ad Tracking Support](#ad-tracking-support)
- [Data Model](#data-model)
- [Support](#support)
- [Contributing](#contributing)
- [License](#license)

## Installation

### Option 1: Install via NPM/Yarn

Install the package using your preferred package manager:

**NPM:**

```bash
npm install @newrelic/video-videojs
```

**Yarn:**

```bash
yarn add @newrelic/video-videojs
```

### Option 2: Direct Script Include (Without NPM)

For quick integration without a build system, include the tracker directly in your HTML:

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Video.js Player -->
    <link href="https://vjs.zencdn.net/7.20.3/video-js.css" rel="stylesheet" />
    <script src="https://vjs.zencdn.net/7.20.3/video.js"></script>

    <!-- New Relic Video.js Tracker -->
    <script src="path/to/newrelic-video-videojs.min.js"></script>
  </head>
  <body>
    <video id="myVideo" class="video-js" controls width="640" height="480">
      <source src="https://your-video-source.mp4" type="video/mp4" />
    </video>

    <script>
      // Initialize Video.js player
      var player = videojs('myVideo');

      // Configure New Relic tracker with info from one.newrelic.com
      const options = {
        info: {
          licenseKey: 'YOUR_LICENSE_KEY',
          beacon: 'YOUR_BEACON_URL',
          applicationId: 'YOUR_APP_ID',
        },
      };

      // Initialize tracker
      const tracker = new VideojsTracker(player, options);
    </script>
  </body>
</html>
```

**Setup Steps:**

1. **Get Configuration** - Visit [one.newrelic.com](https://one.newrelic.com) and complete the video agent onboarding to obtain your credentials (`licenseKey`, `beacon`, `applicationId`)
2. **Download Tracker** - Get `newrelic-video-videojs.min.js` from:
   - [GitHub Releases](https://github.com/newrelic/video-videojs-js/releases) (recommended)
   - Build from source: `npm run build` → `dist/umd/newrelic-video-videojs.min.js`
3. **Integrate** - Include the script in your HTML and initialize with your configuration

## Usage

### Getting Your Configuration

Before initializing the tracker, obtain your New Relic configuration:

1. Log in to [one.newrelic.com](https://one.newrelic.com)
2. Navigate to the video agent onboarding flow
3. Copy your credentials: `licenseKey`, `beacon`, and `applicationId`

### Basic Setup

```javascript
import VideojsTracker from '@newrelic/video-videojs';

// Initialize Video.js player
const player = videojs('myVideo');

// Set player version (required)
player.version = videojs.VERSION;

// Configure tracker with credentials from one.newrelic.com
const options = {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationId: 'YOUR_APP_ID',
  },
};

// Initialize tracker
const tracker = new VideojsTracker(player, options);
```

### Advanced Configuration

```javascript
const options = {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationId: 'YOUR_APP_ID',
  },
  config: {
    qoeAggregate: true, // Enable QoE event aggregation
    qoeIntervalFactor: 2, // Send QoE events every 2 harvest cycles
  },
  customData: {
    contentTitle: 'My Video Title',
    customPlayerName: 'MyCustomPlayer',
    customAttribute: 'customValue',
  },
};

const tracker = new VideojsTracker(player, options);
```

## Configuration Options

### QoE (Quality of Experience) Settings

| Option              | Type    | Default | Description                                                                                                                                                                              |
| ------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qoeAggregate`      | boolean | `false` | Enable Quality of Experience event aggregation. Set to `true` to collect QoE metrics like startup time, buffering, and average bitrate.                                                  |
| `qoeIntervalFactor` | number  | `1`     | Controls QoE event frequency. A value of `N` sends QoE events once every N harvest cycles. Must be a positive integer. QoE events are always included on first and final harvest cycles. |

### Custom Data

Add custom attributes to all events:

```javascript
customData: {
  contentTitle: 'My Video Title',      // Override video title
  customPlayerName: 'MyPlayer',        // Custom player identifier
  customPlayerVersion: '1.0.0',        // Custom player version
  userId: '12345',                     // User identifier
  // Add any custom attributes you need
}
```

## API Reference

### Core Methods

#### `tracker.setUserId(userId)`

Set a unique identifier for the current user.

```javascript
tracker.setUserId('user-12345');
```

#### `tracker.setHarvestInterval(milliseconds)`

Configure how frequently data is sent to New Relic. Accepts values between 1000ms (1 second) and 300000ms (5 minutes).

```javascript
tracker.setHarvestInterval(30000); // Send data every 30 seconds
```

#### `tracker.sendCustom(actionName, attributes)`

Send custom events with arbitrary attributes.

```javascript
tracker.sendCustom('VideoBookmarked', {
  timestamp: Date.now(),
  position: player.currentTime(),
  userId: 'user-12345',
  bookmarkId: 'bookmark-789',
});
```

#### `tracker.setOptions(options)`

Update tracker configuration after initialization.

```javascript
tracker.setOptions({
  customData: {
    contentTitle: 'New Video Title',
    season: '1',
    episode: '3',
  },
});
```

### Example: Complete Integration

```javascript
import VideojsTracker from '@newrelic/video-videojs';

// Initialize player and tracker
const player = videojs('myVideo');
player.version = videojs.VERSION;

const tracker = new VideojsTracker(player, {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationId: 'YOUR_APP_ID',
  },
  config: {
    qoeAggregate: true,
  },
});

// Set user context
tracker.setUserId('user-12345');

// Configure reporting interval
tracker.setHarvestInterval(30000);

// Send custom events
player.on('userEngagement', () => {
  tracker.sendCustom('UserEngaged', {
    action: 'like',
    timestamp: Date.now(),
  });
});
```

## Ad Tracking Support

The tracker provides comprehensive ad tracking capabilities:

### Supported Ad Technologies

- **IMA (Interactive Media Ads)** - Google IMA SDK integration
- **Freewheel** - Freewheel ad platform support
- **SSAI (Server-Side Ad Insertion)** - Dynamic Ad Insertion (DAI) support

### SSAI/DAI Integration

Server-Side Ad Insertion is fully supported with automatic detection and tracking:

```javascript
// SSAI is automatically detected - no additional configuration needed
const tracker = new VideojsTracker(player, options);

// The tracker will automatically capture:
// - Ad breaks, starts, and completions
// - Ad quartiles and click events
// - SSAI-specific metadata
```

**Example:** See [samples/dai/index.html](./samples/dai/index.html) for a complete SSAI implementation.

## Data Model

The tracker captures comprehensive video analytics across four event types:

- **VideoAction** - Playback events (play, pause, buffer, seek, quality changes)
- **VideoAdAction** - Ad events (ad start, quartiles, completions, clicks)
- **VideoErrorAction** - Error events (playback failures, network errors)
- **VideoCustomAction** - Custom events defined by your application

### Bitrate Metrics

Four distinct bitrate metrics provide complete quality analysis:

- `contentBitrate` - Current rendition encoding bitrate
- `contentManifestBitrate` - Maximum available quality
- `contentSegmentDownloadBitrate` - ABR bandwidth estimate
- `contentNetworkDownloadBitrate` - Instantaneous throughput

**Full Documentation:** See [datamodel.md](./datamodel.md) for complete event and attribute reference.

## Support

Should you need assistance with New Relic products, you are in good hands with several support channels.

If the issue has been confirmed as a bug or is a feature request, please file a [GitHub issue](../../issues).

### Support Channels

- **[New Relic Documentation](https://docs.newrelic.com)**: Comprehensive guidance for using our platform
- **[New Relic Community](https://discuss.newrelic.com)**: The best place to engage in troubleshooting questions
- **[New Relic University](https://learn.newrelic.com)**: A range of online training for New Relic users of every level
- **[New Relic Technical Support](https://support.newrelic.com)**: 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan)

### Additional Resources

- **[datamodel.md](./datamodel.md)** - Complete event and attribute reference
- **[DEVELOPING.md](./DEVELOPING.md)** - Building and testing instructions
- **[REVIEW.md](./REVIEW.md)** - Code review guidelines

## Contributing

We encourage your contributions to improve the Video.js Tracker! Keep in mind that when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA (which is required if your contribution is on behalf of a company), drop us an email at opensource@newrelic.com.

For more details on how best to contribute, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### A Note About Vulnerabilities

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through our [bug bounty program](https://docs.newrelic.com/docs/security/security-privacy/information-security/report-security-vulnerabilities/).

### Acknowledgments

If you would like to contribute to this project, review [these guidelines](./CONTRIBUTING.md).

To all contributors, we thank you! Without your contribution, this project would not be what it is today.

## License

The Video.js Tracker is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

The Video.js Tracker also uses source code from third-party libraries. Full details on which libraries are used and the terms under which they are licensed can be found in the [third-party notices document](./THIRD_PARTY_NOTICES.md).
