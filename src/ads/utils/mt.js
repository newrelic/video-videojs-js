/**
 * MediaTailor Utility Functions
 * Helper functions for AWS MediaTailor ad tracking
 */

import {
  REGEX_CUE_OUT,
  REGEX_DISCONTINUITY,
  REGEX_MAP,
  MT_SEGMENT_PATTERN,
  MIN_AD_DURATION,
  AD_TIMING_TOLERANCE,
  STREAM_TYPE,
  MANIFEST_TYPE,
  AD_POSITION,
  AD_SOURCE,
  QUARTILES,
} from './mt-constants.js';

/**
 * Generates timestamp string for logging (HH:MM:SS.mmm format)
 */
export function getTimestamp() {
  const now = new Date();
  return now.toISOString().substring(11, 23);
}

/**
 * Detects manifest format from URL (.m3u8 = HLS, .mpd = DASH)
 */
export function detectManifestType(url) {
  if (url.includes('.m3u8')) {
    return MANIFEST_TYPE.HLS;
  } else if (url.includes('.mpd')) {
    return MANIFEST_TYPE.DASH;
  }
  return MANIFEST_TYPE.HLS; // Default fallback
}

/**
 * Detects stream type from player duration (Infinity = Live, else = VOD)
 */
export function detectStreamType(duration) {
  return duration === Infinity ? STREAM_TYPE.LIVE : STREAM_TYPE.VOD;
}

/**
 * Extracts tracking URL from sessionized manifest URL
 */
export function extractTrackingUrl(manifestUrl) {
  const match = manifestUrl.match(/sessionId=([^&]+)/);

  if (!match) {
    return null;
  }

  const sessionId = match[1];

  // Convert: /v1/master/.../master.m3u8?aws.sessionId=xxx → /v1/tracking/xxx
  const trackingUrl = manifestUrl
    .replace(/\/v1\/(master|session|dash)\//, '/v1/tracking/')
    .replace(/\/(master\.m3u8|manifest\.mpd).*$/, `/${sessionId}`);

  return trackingUrl;
}

/**
 * Checks if segment is a MediaTailor ad segment
 */
export function isMediaTailorSegment(segment) {
  // Check MAP URL for MediaTailor pattern
  if (segment.map && segment.map.uri && segment.map.uri.includes(MT_SEGMENT_PATTERN)) {
    return true;
  }
  // Check segment URL for MediaTailor pattern
  if (segment.uri && segment.uri.includes(MT_SEGMENT_PATTERN)) {
    return true;
  }
  return false;
}

/**
 * Determines ad position based on schedule index (VOD only, Live returns null)
 */
export function determineAdPosition(adBreakIndex, totalAdBreaks, streamType) {
  if (streamType === STREAM_TYPE.LIVE) {
    return null; // Live streams have no position concept
  }

  // VOD: Determine position by schedule index
  if (adBreakIndex === 0) {
    return AD_POSITION.PRE_ROLL; // First ad
  } else if (adBreakIndex === totalAdBreaks - 1) {
    return AD_POSITION.POST_ROLL; // Last ad
  } else {
    return AD_POSITION.MID_ROLL; // Middle ad
  }
}

/**
 * Finds ad break index in schedule by start time
 */
export function findAdBreakIndex(adSchedule, startTime) {
  return adSchedule.findIndex(
    (ad) => Math.abs(ad.startTime - startTime) < AD_TIMING_TOLERANCE
  );
}

/**
 * Calculates quartile thresholds for an ad duration
 */
export function calculateQuartiles(duration) {
  return {
    q1: duration * QUARTILES.Q1,
    q2: duration * QUARTILES.Q2,
    q3: duration * QUARTILES.Q3,
  };
}

/**
 * Checks which quartile events should fire based on progress
 */
export function getQuartilesToFire(progress, duration, firedQuartiles) {
  const quartiles = calculateQuartiles(duration);
  const toFire = [];

  if (progress >= quartiles.q1 && !firedQuartiles.q1) {
    toFire.push({ quartile: 1, key: 'q1' });
  }
  if (progress >= quartiles.q2 && !firedQuartiles.q2) {
    toFire.push({ quartile: 2, key: 'q2' });
  }
  if (progress >= quartiles.q3 && !firedQuartiles.q3) {
    toFire.push({ quartile: 3, key: 'q3' });
  }

  return toFire;
}

/**
 * Finds active ad break at current playhead time
 */
export function findActiveAdBreak(adSchedule, currentTime) {
  return adSchedule.find(
    (ad) => currentTime >= ad.startTime && currentTime < ad.endTime
  );
}

/**
 * Finds active pod within ad break at current playhead time
 */
export function findActivePod(adBreak, currentTime) {
  if (!adBreak || !adBreak.pods || adBreak.pods.length === 0) {
    return null;
  }

  return adBreak.pods.find(
    (pod) => currentTime >= pod.startTime && currentTime < pod.endTime
  );
}

/**
 * Validates if ad break duration meets minimum threshold
 */
export function isValidAdBreak(adBreak) {
  return adBreak.duration > MIN_AD_DURATION;
}

/**
 * Merges new ads into existing schedule (deduplicates by start time)
 */
export function mergeAdSchedules(existingSchedule, newAds) {
  const scheduleMap = new Map();

  // Add existing ads to map (keyed by rounded start time)
  existingSchedule.forEach((ad) => {
    const key = Math.round(ad.startTime);
    scheduleMap.set(key, ad);
  });

  // Merge new ads
  const merged = [];
  newAds.forEach((newAd) => {
    const key = Math.round(newAd.startTime);
    const existingAd = scheduleMap.get(key);

    if (!existingAd) {
      merged.push(newAd);
      scheduleMap.set(key, newAd);
    } else if (!existingAd.confirmedByTracking && newAd.confirmedByTracking) {
      Object.assign(existingAd, newAd);
    }
  });

  // Combine and sort by start time
  const finalSchedule = [...existingSchedule, ...merged];
  finalSchedule.sort((a, b) => a.startTime - b.startTime);

  return finalSchedule;
}

/**
 * Parses HLS manifest text for CUE-OUT/CUE-IN markers
 */
export function parseHLSManifestForAds(manifestText) {
  const lines = manifestText.split('\n');
  const adBreaks = [];

  let currentTime = 0;
  let currentAdBreak = null;
  let currentPodStartTime = null;
  let lastMapUrl = null;
  let adPods = [];
  let isInAdBreak = false;

  for (const line of lines) {
    // Detect DISCONTINUITY marker
    if (REGEX_DISCONTINUITY.test(line)) {
      if (isInAdBreak && lastMapUrl) {
        const mapMatch = line.match(REGEX_MAP);
        const mapUrl = mapMatch ? mapMatch[1] : null;

        if (mapUrl && mapUrl !== lastMapUrl) {
          // New MAP = new pod boundary
          if (currentPodStartTime !== null) {
            const podDuration = currentTime - currentPodStartTime;
            adPods.push({
              startTime: currentPodStartTime,
              duration: podDuration,
              endTime: currentTime,
              mapUrl: lastMapUrl,
            });
          }
          currentPodStartTime = currentTime;
          lastMapUrl = mapUrl;
        }
      }
    }

    // Detect MAP URL changes
    const mapMatch = line.match(REGEX_MAP);
    if (mapMatch && isInAdBreak) {
      const mapUrl = mapMatch[1];
      if (mapUrl && mapUrl !== lastMapUrl) {
        // New MAP = new pod
        if (currentPodStartTime !== null) {
          const podDuration = currentTime - currentPodStartTime;
          adPods.push({
            startTime: currentPodStartTime,
            duration: podDuration,
            endTime: currentTime,
            mapUrl: lastMapUrl,
          });
        }
        currentPodStartTime = currentTime;
        lastMapUrl = mapUrl;
      }
    }

    // Detect CUE-OUT (ad break start)
    if (line.startsWith('#EXT-X-CUE-OUT')) {
      const durationMatch = line.match(REGEX_CUE_OUT);
      const duration = durationMatch ? parseFloat(durationMatch[1]) : null;

      isInAdBreak = true;
      adPods = [];
      currentAdBreak = {
        id: `avail-${currentTime}`,
        startTime: currentTime,
        duration: duration,
        endTime: null,
        pods: [],
        hasFiredStart: false,
        hasFiredEnd: false,
        hasFiredAdStart: false,
        confirmedByTracking: false,
      };
    }

    // Detect CUE-IN (ad break end)
    if (line.startsWith('#EXT-X-CUE-IN')) {
      if (currentAdBreak) {
        // Close final pod
        if (currentPodStartTime !== null) {
          const podDuration = currentTime - currentPodStartTime;
          adPods.push({
            startTime: currentPodStartTime,
            duration: podDuration,
            endTime: currentTime,
            mapUrl: lastMapUrl,
          });
        }

        // Calculate actual duration
        const actualDuration = currentTime - currentAdBreak.startTime;

        // Filter zero-duration false positives
        if (actualDuration >= MIN_AD_DURATION) {
          currentAdBreak.duration = actualDuration;
          currentAdBreak.endTime = currentTime;
          currentAdBreak.pods = adPods;
          adBreaks.push(currentAdBreak);
        }

        // Reset state
        currentAdBreak = null;
        isInAdBreak = false;
        currentPodStartTime = null;
        lastMapUrl = null;
        adPods = [];
      }
    }

    // Track time via EXTINF
    if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1]);
      if (!isNaN(duration)) {
        currentTime += duration;
      }
    }
  }

  // Handle unclosed ad break
  if (currentAdBreak && currentAdBreak.duration) {
    currentAdBreak.endTime = currentAdBreak.startTime + currentAdBreak.duration;
    currentAdBreak.pods = adPods;
    adBreaks.push(currentAdBreak);
  }

  return adBreaks;
}

/**
 * Detects ads from VHS playlist using discontinuityStarts and MediaTailor segments
 */
export function detectAdsFromVHSPlaylist(playlist) {
  const segments = playlist.segments;
  const discontinuityStarts = playlist.discontinuityStarts || [];
  const adBreaks = [];

  let currentAdBreak = null;
  let currentPod = null;
  let currentTime = 0;

  segments.forEach((segment, index) => {
    const isMTSegment = isMediaTailorSegment(segment);
    const hasDiscontinuity = discontinuityStarts.includes(index);

    if (isMTSegment) {
      // Discontinuity marks new pod boundary
      if (hasDiscontinuity && currentPod) {
        currentPod.endTime = currentTime;
        if (currentPod.duration > MIN_AD_DURATION) {
          currentAdBreak.pods.push(currentPod);
        }
        currentPod = null;
      }

      // Start new ad break if not in one
      if (!currentAdBreak) {
        currentAdBreak = {
          id: `avail-${currentTime}`,
          startTime: currentTime,
          duration: 0,
          endTime: null,
          source: 'vhs-discontinuity',
          confirmedByTracking: false,
          hasFiredStart: false,
          hasFiredEnd: false,
          hasFiredAdStart: false,
          hasFiredQ1: false,
          hasFiredQ2: false,
          hasFiredQ3: false,
          pods: [],
        };
      }

      // Start new pod if not in one
      if (!currentPod) {
        currentPod = {
          startTime: currentTime,
          duration: 0,
          endTime: null,
          hasFiredStart: false,
          hasFiredQ1: false,
          hasFiredQ2: false,
          hasFiredQ3: false,
        };
      }

      // Accumulate durations
      const segmentDuration = segment.duration || 0;
      currentAdBreak.duration += segmentDuration;
      currentPod.duration += segmentDuration;
    } else {
      // Not MediaTailor segment - end ad break
      if (currentAdBreak) {
        // Close current pod
        if (currentPod) {
          currentPod.endTime = currentTime;
          if (currentPod.duration > MIN_AD_DURATION) {
            currentAdBreak.pods.push(currentPod);
          }
          currentPod = null;
        }

        // Close ad break
        currentAdBreak.endTime = currentTime;
        if (currentAdBreak.duration > MIN_AD_DURATION) {
          adBreaks.push(currentAdBreak);
        }
        currentAdBreak = null;
      }
    }

    currentTime += segment.duration || 0;
  });

  // Handle unclosed pod/ad break at end
  if (currentAdBreak) {
    if (currentPod) {
      currentPod.endTime = currentTime;
      if (currentPod.duration > MIN_AD_DURATION) {
        currentAdBreak.pods.push(currentPod);
      }
    }
    currentAdBreak.endTime = currentTime;
    if (currentAdBreak.duration > MIN_AD_DURATION) {
      adBreaks.push(currentAdBreak);
    }
  }

  return adBreaks;
}

/**
 * Enriches ad schedule with tracking API metadata
 */
export function enrichScheduleWithTracking(adSchedule, trackingAvails) {
  const scheduleMap = new Map();

  // Build map of existing ads
  adSchedule.forEach((ad) => {
    const key = Math.round(ad.startTime);
    scheduleMap.set(key, ad);
  });

  // Process each avail from tracking API
  const newAds = [];
  trackingAvails.forEach((avail) => {
    const firstAd = avail.ads && avail.ads.length > 0 ? avail.ads[0] : null;
    if (!firstAd) return;

    const key = Math.round(firstAd.startTimeInSeconds);
    const existingAd = scheduleMap.get(key);

    if (existingAd) {
      // Enrich existing ad with tracking metadata
      existingAd.id = avail.availId;
      existingAd.creativeId = firstAd.adId;
      existingAd.title = firstAd.adTitle;
      existingAd.confirmedByTracking = true;

      // Enrich pods with tracking ad metadata
      if (avail.ads && avail.ads.length > 0 && existingAd.pods) {
        avail.ads.forEach((trackingAd, adIndex) => {
          if (existingAd.pods[adIndex]) {
            // Update existing pod
            existingAd.pods[adIndex].title = trackingAd.adTitle;
            existingAd.pods[adIndex].creativeId = trackingAd.adId;
            existingAd.pods[adIndex].trackingStartTime = trackingAd.startTimeInSeconds;
            existingAd.pods[adIndex].trackingDuration = trackingAd.durationInSeconds;
          } else {
            // Add new pod from tracking
            existingAd.pods.push({
              startTime: trackingAd.startTimeInSeconds,
              duration: trackingAd.durationInSeconds,
              endTime: trackingAd.startTimeInSeconds + trackingAd.durationInSeconds,
              title: trackingAd.adTitle,
              creativeId: trackingAd.adId,
              hasFiredStart: false,
              hasFiredQ1: false,
              hasFiredQ2: false,
              hasFiredQ3: false,
            });
          }
        });
      }
    } else {
      // Add new ad from tracking
      newAds.push({
        id: avail.availId,
        startTime: firstAd.startTimeInSeconds,
        duration: avail.durationInSeconds,
        endTime: firstAd.startTimeInSeconds + avail.durationInSeconds,
        title: firstAd.adTitle,
        creativeId: firstAd.adId,
        source: 'tracking-api',
        confirmedByTracking: true,
        hasFiredStart: false,
        hasFiredEnd: false,
        hasFiredAdStart: false,
        hasFiredQ1: false,
        hasFiredQ2: false,
        hasFiredQ3: false,
        pods: avail.ads.map((ad) => ({
          startTime: ad.startTimeInSeconds,
          duration: ad.durationInSeconds,
          endTime: ad.startTimeInSeconds + ad.durationInSeconds,
          title: ad.adTitle,
          creativeId: ad.adId,
          hasFiredStart: false,
          hasFiredQ1: false,
          hasFiredQ2: false,
          hasFiredQ3: false,
        })),
      });
    }
  });

  return newAds;
}

/**
 * Extracts manifest target duration from HLS manifest text
 */
export function extractTargetDuration(manifestText) {
  const match = manifestText.match(/#EXT-X-TARGETDURATION:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function fetchTextOrThrow(url) {
  const response = await fetch(url, { credentials: 'include' });

  if (response.ok === false) {
    throw new Error(
      `Manifest request failed: ${response.status || 'unknown'} ${
        response.statusText || 'Request failed'
      }`
    );
  }

  return await response.text();
}

/**
 * Fetches HLS master manifest and returns master text + first media playlist URL
 */
export async function getHLSMasterManifest(manifestUrl) {
  const masterText = await fetchTextOrThrow(manifestUrl);

  // Find first media playlist URL
  const lines = masterText.split('\n');
  let mediaPlaylistUrl = null;

  for (const line of lines) {
    if (!line.startsWith('#') && line.includes('.m3u8')) {
      mediaPlaylistUrl = new URL(line.trim(), manifestUrl).href;
      break;
    }
  }

  return { masterText, mediaPlaylistUrl };
}

/**
 * Fetches HLS media playlist and returns text
 */
export async function getHLSMediaPlaylist(playlistUrl) {
  return await fetchTextOrThrow(playlistUrl);
}

/**
 * Fetches DASH MPD manifest and returns XML text
 */
export async function getDASHManifest(manifestUrl) {
  return await fetchTextOrThrow(manifestUrl);
}

/**
 * Parses DASH XML text for SCTE-35 EventStream markers
 * Supports multiple SCTE-35 schemeIdUri formats used by MediaTailor
 */
export function parseDASHManifestForAds(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const ads = [];

  // Check for parsing errors
  const parserError = xml.querySelector('parsererror');
  if (parserError) {
    console.error('[MT] DASH XML parse error:', parserError.textContent);
    return ads;
  }

  // Get MPD element to extract timescale if needed
  const mpd = xml.documentElement;
  const mpdTimescale = parseFloat(mpd.getAttribute('timescale') || '1');

  // Find all EventStream elements with SCTE-35
  // Common schemeIdUri values:
  // - urn:scte:scte35:2013:bin (binary SCTE-35)
  // - urn:scte:scte35:2014:xml (XML SCTE-35)
  // - urn:scte:scte35:2013:xml (older XML format)
  const eventStreams = xml.querySelectorAll(
    'EventStream[schemeIdUri*="scte35"], EventStream[schemeIdUri*="SCTE35"]'
  );

  console.log(`[MT] Found ${eventStreams.length} SCTE-35 EventStream(s) in DASH manifest`);

  eventStreams.forEach((stream, streamIndex) => {
    const schemeIdUri = stream.getAttribute('schemeIdUri');
    const value = stream.getAttribute('value') || '';
    const timescale = parseFloat(stream.getAttribute('timescale') || mpdTimescale);

    console.log(`[MT] EventStream ${streamIndex + 1}:`, {
      schemeIdUri,
      value,
      timescale,
    });

    const events = stream.querySelectorAll('Event');

    events.forEach((event, eventIndex) => {
      // Get timing attributes
      const presentationTime = parseFloat(event.getAttribute('presentationTime') || 0);
      const duration = parseFloat(event.getAttribute('duration') || 0);
      const eventId = event.getAttribute('id') || `dash-event-${presentationTime}`;

      // Convert from timescale to seconds if needed
      const startTime = timescale !== 1 ? presentationTime / timescale : presentationTime;
      const durationSeconds = timescale !== 1 ? duration / timescale : duration;

      console.log(`[MT] Event ${eventIndex + 1}:`, {
        id: eventId,
        presentationTime,
        duration,
        timescale,
        startTime,
        durationSeconds,
      });

      // Only add valid ad breaks (positive duration)
      if (durationSeconds > MIN_AD_DURATION) {
        // Try to extract SCTE-35 signal type and metadata
        let signalType = null;
        let messageData = null;

        // Check for Signal element (XML SCTE-35)
        const signal = event.querySelector('Signal, scte35\\:Signal');
        if (signal) {
          signalType = signal.querySelector('SpliceInsert, scte35\\:SpliceInsert')
            ? 'SpliceInsert'
            : signal.querySelector('TimeSignal, scte35\\:TimeSignal')
            ? 'TimeSignal'
            : 'Unknown';
        }

        // Check for binary data
        const binaryData = event.textContent?.trim();
        if (binaryData && binaryData.length > 0) {
          messageData = binaryData;
        }

        ads.push({
          id: eventId,
          startTime: startTime,
          duration: durationSeconds,
          endTime: startTime + durationSeconds,
          source: AD_SOURCE.MANIFEST_CUE,
          confirmedByTracking: false,
          hasFiredStart: false,
          hasFiredEnd: false,
          hasFiredAdStart: false,
          pods: [],
          // Additional DASH-specific metadata
          dashMetadata: {
            schemeIdUri,
            value,
            timescale,
            signalType,
            hasMessageData: !!messageData,
          },
        });
      } else {
        console.log(
          `[MT] Skipping event ${eventId} - duration too short (${durationSeconds}s < ${MIN_AD_DURATION}s)`
        );
      }
    });
  });

  console.log(`[MT] Parsed ${ads.length} valid ad break(s) from DASH manifest`);

  return ads;
}

/**
 * Fetches tracking metadata from AWS MediaTailor Tracking API
 * @param {string} trackingUrl - The tracking API URL
 * @param {number} timeout - Timeout in milliseconds
 * @param {AbortSignal} externalSignal - Optional external abort signal for cancellation
 */
export async function getTrackingMetadata(trackingUrl, timeout = 8000, externalSignal = null) {
  // Create AbortController for timeout support
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If external signal provided, listen for its abort event
  const abortHandler = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', abortHandler);
  }

  try {
    const response = await fetch(`${trackingUrl}?t=${Date.now()}`, {
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }

    if (!response.ok) {
      throw new Error(`Tracking API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
    throw error;
  }
}

/**
 * Extracts first media playlist URL from HLS master manifest text
 */
export function extractMediaPlaylistUrl(masterText, baseUrl) {
  const lines = masterText.split('\n');

  for (const line of lines) {
    if (!line.startsWith('#') && line.includes('.m3u8')) {
      return new URL(line.trim(), baseUrl).href;
    }
  }

  return null;
}
