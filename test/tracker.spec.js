// Initial spec for the Video.js tracker. @newrelic/video-core is mocked at the
// boundary via the shared manual mock in __mocks__/ — we test only the videojs
// layer. See __mocks__/@newrelic/video-core.js.
import nrvideo from '@newrelic/video-core';
import VideojsTracker, { AD_TRACKING } from '../src/tracker.js';
import pkg from '../package.json';

const { Log } = nrvideo;

beforeEach(() => jest.clearAllMocks());

describe('VideojsTracker', () => {
  it('identifies itself as the videojs tracker', () => {
    const t = new VideojsTracker({}, {});
    expect(t.getTrackerName()).toBe('videojs');
    expect(t.getInstrumentationProvider()).toBe('New Relic');
  });

  it('reports the package version as the tracker version', () => {
    const t = new VideojsTracker({}, {});
    expect(t.getTrackerVersion()).toBe(pkg.version);
  });

  it('reads the ad tracking mode from config.ad.type', () => {
    const t = new VideojsTracker({}, { config: { ad: { type: AD_TRACKING.CSAI } } });
    expect(t.adTracking).toBe('csai');
  });

  it('defaults adTracking to null and warns when options lack config.ad', () => {
    const t = new VideojsTracker({}, { plugins: {} });
    expect(t.adTracking).toBeNull();
    expect(Log.warn).toHaveBeenCalled();
  });

  describe('setAdTracking', () => {
    it('accepts a valid mode', () => {
      const t = new VideojsTracker({}, {});
      t.setAdTracking(AD_TRACKING.SSAI.MT);
      expect(t.adTracking).toBe('ssai:mt');
    });

    it('rejects an unknown mode and warns', () => {
      const t = new VideojsTracker({}, {});
      t.setAdTracking('bogus');
      expect(t.adTracking).toBeNull();
      expect(Log.warn).toHaveBeenCalled();
    });
  });
});
