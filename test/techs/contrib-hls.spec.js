import ContribHlsTech from '../../src/techs/contrib-hls.js';

function makeTech({ vhs } = {}) {
  return { vhs, el: () => ({ player: {} }) };
}

describe('ContribHlsTech', () => {
  describe('getSrc', () => {
    it('returns the manifest URL even when the <video> tag currentSrc is a blob: URL', () => {
      const tech = makeTech({
        vhs: { playlists: { master: { uri: 'https://cdn.example.com/manifest.m3u8' } } },
      });
      const t = new ContribHlsTech(tech);
      expect(t.getSrc()).toBe('https://cdn.example.com/manifest.m3u8');
    });

    it('returns null when the manifest has not loaded yet', () => {
      const tech = makeTech({ vhs: { playlists: {} } });
      const t = new ContribHlsTech(tech);
      expect(t.getSrc()).toBeNull();
    });

    it('returns null when vhs is missing', () => {
      const tech = makeTech({ vhs: null });
      const t = new ContribHlsTech(tech);
      expect(t.getSrc()).toBeNull();
    });
  });

  describe('isUsing', () => {
    it('is true when the tech exposes vhs', () => {
      expect(ContribHlsTech.isUsing(makeTech({ vhs: {} }))).toBe(true);
    });

    it('is false when the tech has no vhs', () => {
      expect(ContribHlsTech.isUsing(makeTech({ vhs: null }))).toBe(false);
    });
  });
});
