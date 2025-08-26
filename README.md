[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic Videojs Tracker Agent

The New Relic Videojs Tracker enhances your media applications by tracking video events, playback errors, and other activities, providing comprehensive insights into performance and user interactions.

- The Videojs tracker is available as a ready-to-use JavaScript snippet for easy copy-paste integration.
- New Relic Videojs tracker auto-detects events emitted by Videojs Player.
- Ensure that the **Browser agent** is successfully instrumented before deploying the media tracker.
- For questions and feedback on this package, please visit the [Explorer's Hub](https://discuss.newrelic.com), New Relic's community support forum.
- Looking to contribute to the Player Name agent code base? See [DEVELOPING.md](./DEVELOPING.md) for instructions on building and testing the browser agent library, and Contributors.

## Adding The Videojs Tracker To Your Project

To integrate New Relic Tracker Agent into your web application effectively, you'll need to instrument the Browser Agent code first and then add the player script. Below is a guide on how to do this within your HTML file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Relic Tracker Integration</title>
    <script src="path/to/browser-agent.js"></script>
    <!-- snippet code generated  -->
    <script src="path/to/videojs-tracker.js"></script>
  </head>
  <body>
    <!-- Your HTML content -->
  </body>
</html>
```

## Adding the agent package to your project

To make the tracker available to your application, install via [NPM](https://docs.npmjs.com/cli/v8/commands/npm-install) or [Yarn](https://classic.yarnpkg.com/lang/en/docs/cli/install/).

```shell
$ npm install @newrelic/video-videojs
```

```shell
$ yarn add @newrelic/video-videojs
```

## Instantiating the Videojs Tracker


> [!NOTE]
> **Attention:**  
> This version uses the latest **standalone** version of the Videojs Tracker, In order to initialize it you need to do the following:

Steps to get NREUM config
 - Create a New Relic account and obtain your license key.
 - Install the New Relic Streaming video agent in your application.
 - Configure the video agent with your license key and application ID.

The NREUM config looks like this:

```javascript
info = {
  beacon: "staging-bam-cell.nr-data.net",
  licenseKey: "NRBR-3xxxxxxxxxxxxx",
  applicationID: "2521xxxx",
};
```

```javascript
import VideojsTracker from "@newrelic/video-videojs";

// pass player version
player.version = videojs.VERSION;

// create options 
const options = {
  info: info
}

// initialize VideojsTracker with player and options
const tracker = new VideojsTracker(player, options);

// ================================================= //

//For setting custom attributes const tracker
const tracker = new VideojsTracker(player, {
  customData: {
    contentTitle: 'Override Existing Title',
    customPlayerName: 'myGreatPlayer',
    customPlayerVersion: '9.4.2',
  },
});

// For setting userId
tracker.setUserId('userId');

// set tracker interval, between 1s - 5mins
tracker.setHarvestInterval(1000)

// For Sending custom Action with Attributes
tracker.sendCustom('CustomAction', { data: "custom-test" })

```

## Support for SSAI 

> [!NOTE]
> **Attention:**  
> This version supports tracking for SSAI (Server-Side Ad Insertion), checkout examples in [/samples/dai/index.html](./samples/dai/index.html)


## Data Model

To understand which actions and attributes are captured and emitted by the Videojs Player under different event types, see [DataModel.md](./DATAMODEL.md).

## Support

New Relic hosts and moderates an online forum where customers can interact with New Relic employees as well as other customers to get help and share best practices. Like all official New Relic open source projects, there's a related Community topic in the New Relic [Explorer's Hub](https://discuss.newrelic.com).

We encourage you to bring your experiences and questions to the [Explorer's Hub](https://discuss.newrelic.com) where our community members collaborate on solutions and new ideas.

## Contributing

We encourage your contributions to improve New Relic Videojs Tracker! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project. If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company, please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [our bug bounty program](https://docs.newrelic.com/docs/security/security-privacy/information-security/report-security-vulnerabilities/).

## License

New Relic Videojs Tracker is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
