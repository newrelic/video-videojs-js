# SSAI Guide

This guide explains what customers need to know when using the Video.js tracker with server-side ad insertion (SSAI), with a focus on AWS MediaTailor.

## Supported SSAI Integrations

- AWS MediaTailor

## What Customers Need To Provide

Customers should already have:

- a working Video.js player integration
- valid New Relic streaming credentials
- a real SSAI playback URL from their ad stitching provider

## Activation

Set `config.ad.type` to `AD_TRACKING.SSAI.MT` to activate the MediaTailor tracker. SSAI platforms cannot be auto-detected — each one has its own SDK and activation path, so declaring the sub-type is always required.

```javascript
import { AD_TRACKING } from '@newrelic/video-videojs';

const tracker = new VideojsTracker(player, {
  config: { ad: { type: AD_TRACKING.SSAI.MT } },
});
```

All MediaTailor-specific options live alongside `type` in `config.ad`. If you need custom CDN config:

```javascript
const tracker = new VideojsTracker(player, {
  config: {
    ad: {
      type: AD_TRACKING.SSAI.MT,
      segmentPrefix: '/your-path/',
    },
  },
});
```

## What The Tracker Does Automatically

For MediaTailor streams, the tracker automatically:

1. Detects whether the manifest format is HLS or DASH.
2. Detects whether playback is VOD or LIVE from player state.
3. Parses manifests to discover ad breaks and distinguish ad segments from content segments.
4. Sends ad break, ad start, quartile, and ad end events.
5. Enriches ad metadata when tracking data is available.
6. Reports failures as `AD_ERROR` events with a semantic `errorCode` (see [Error Reporting](#error-reporting)).
7. Recovers a stitching session on `player.src()` change — clearing the old schedule and re-deriving the tracking endpoint — and refreshes the tracking pagination cursor, retrying once and reporting `TOKEN_EXPIRED` if it expires.

## Custom CDN / Custom Domain

If you have configured CDN segment prefixes in the AWS MediaTailor console, the tracker detects ad segments automatically using the AWS-recommended `/tm/` ad-segment path convention — no extra config needed.

If your CDN ad-segment prefix uses a non-standard path (not `/tm/`), pass the path as an override:

```javascript
const tracker = new VideojsTracker(player, {
  config: {
    ad: {
      type: AD_TRACKING.SSAI.MT,
      segmentPrefix: '/your-path/',
    },
  },
});
```

### Tracking URL discovery

The tracker resolves the MediaTailor tracking endpoint in this order:

1. An explicit `config.ad.trackingUrl`, if provided.
2. An HLS `#EXT-X-DATERANGE CLASS="tracking"` tag (`X-ASSET-URI`) in the manifest — the spec's primary mechanism, which works on non-AWS CDNs.
3. Derivation from the playback manifest URL.

### Optional configuration

All options live alongside `type` in `config.ad`:

| Option | Purpose |
| --- | --- |
| `segmentPrefix` | Custom CDN ad-segment path when it isn't the AWS-recommended `/tm/`. |
| `trackingUrl` | Explicit tracking endpoint; overrides discovery. |
| `pollIntervalMs` | Overrides the live poll cadence (clamped to 100–5000 ms). Omit to follow the manifest-derived interval. |

## Supported MediaTailor Scenarios

The current implementation supports:

- HLS VOD
- HLS LIVE
- DASH VOD
- DASH LIVE
- multiple ads inside a single break when MediaTailor exposes pod structure

## Live Refresh Behavior

For LIVE playback, the tracker follows manifest-derived refresh hints.

- HLS: live cadence is derived from `EXT-X-TARGETDURATION`
- DASH: live cadence is derived from `minimumUpdatePeriod`
- fallback: if neither hint is available, the tracker uses an internal default interval

For VOD playback, the tracker does not continuously poll the manifest. It performs one tracking metadata fetch after the first playable manifest is parsed.

## Customer Expectations In New Relic

Customers should expect the tracker to report:

- ad break start and end events
- ad start and ad end events
- ad quartiles
- ad metadata such as title and creative id when available
- `adPrimaryId` — stable creative identity (VAST `creativeId`, falling back to `availId:adId`) on `AD_START`, `AD_END`, and `AD_QUARTILE`, so `count(DISTINCT adPrimaryId)` counts true creatives rather than per-avail ad IDs
- `adPartner = aws-mediatailor` for MediaTailor ad events
- `AD_ERROR` events with an `errorCode` when a failure occurs (see [Error Reporting](#error-reporting))

Some metadata can arrive after playback has already started if it is filled in from the MediaTailor tracking endpoint.

## Error Reporting

Non-terminal MediaTailor failures surface as `AD_ERROR` events carrying `errorCode`, `errorSource`, and `errorMessage`:

| `errorCode` | Meaning |
| --- | --- |
| `NO_FILL` | An avail returned no ads; break boundaries still fire but `AD_START`/quartiles are suppressed. |
| `ADS_TIMEOUT` | The tracking fetch timed out. |
| `TRACKING_FETCH_FAILED` | A non-timeout tracking fetch failure after retry. |
| `TOKEN_EXPIRED` | The tracking pagination token expired (HTTP 400) and the tokenless retry also failed; polling stops. |
| `MISSING_AVAIL_START` | An avail was missing its start time; the tracker recovered using the first ad's start. |
| `MANIFEST_TRACKING_MISMATCH` | Manifest pod count disagreed with the tracking ad count; manifest geometry was kept. |

## Public Methods

- `tracker.notifyAdSkipped()` — report a user-initiated ad skip (e.g. a "Skip Ad" button); no-op when not currently in an ad.
- `tracker.stopTracking()` — stop polling and unregister player listeners without disposing the tracker, so it can be re-initialized later.

## Common Integration Requirements

- The player source should be the actual stitched SSAI playback URL.
- The player tech must be able to play the provided source format.

## Troubleshooting

If MediaTailor tracking does not activate, verify:

1. `config.ad.type: AD_TRACKING.SSAI.MT` is set in the tracker options.
2. Segment requests are reaching the player (check the Network tab).
3. If using a custom CDN ad-segment path, verify `config.ad.segmentPrefix` matches the path configured in the AWS MediaTailor console.

## Samples

- [samples/media-tailor-lab.html](../samples/media-tailor-lab.html) for MediaTailor testing across HLS/DASH and VOD/LIVE scenarios
