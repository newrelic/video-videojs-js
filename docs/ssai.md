# SSAI Guide

This guide explains what customers need to know when using the Video.js tracker with server-side ad insertion (SSAI), with a focus on AWS MediaTailor.

## Supported SSAI Integrations

- AWS MediaTailor

## What Customers Need To Provide

Customers should already have:

- a working Video.js player integration
- valid New Relic streaming credentials
- a real SSAI playback URL from their ad stitching provider

For AWS MediaTailor specifically, the tracker expects a sessionized playback URL. The MediaTailor path is selected when the source URL contains `.mediatailor.`.

## What The Tracker Does Automatically

For MediaTailor streams, the tracker automatically:

1. Detects that the playback URL is a MediaTailor source.
2. Detects whether the manifest format is HLS or DASH.
3. Detects whether playback is VOD or LIVE from player state.
4. Builds the MediaTailor tracking endpoint from the playback URL when a session id is present.
5. Parses manifests to discover ad breaks.
6. Sends ad break, ad start, quartile, and ad end events.
7. Enriches ad metadata with tracking endpoint data when that data is available.

Customers do not need to pass MediaTailor-specific tracker flags for manifest parsing or live polling behavior.

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
- `adPartner = aws-mediatailor` for MediaTailor ad events

Some metadata can arrive after playback has already started if it is filled in from the MediaTailor tracking endpoint.

## Common Integration Requirements

- The player source should be the actual stitched SSAI playback URL.
- The MediaTailor URL should still contain the session identifier required to derive the tracking endpoint.
- The player tech must be able to play the provided source format.

## Troubleshooting

If MediaTailor tracking does not activate, customers should verify:

1. the source really is a MediaTailor playback URL
2. the source contains `.mediatailor.`
3. the URL is sessionized and still contains the required session identifier
4. the source MIME type passed to Video.js matches the actual manifest format

## Samples

- [samples/media-tailor-lab.html](../samples/media-tailor-lab.html) for MediaTailor testing across HLS/DASH and VOD/LIVE scenarios
