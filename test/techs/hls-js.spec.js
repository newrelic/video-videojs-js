import HlsJsTech from '../../src/techs/hls-js.js';

function makeTech({ vhs_ } = {}) {
  return { vhs_, el: () => ({ player: {} }) };
}

describe('HlsJsTech', () => {
  describe('getSrc', () => {
    it('returns the manifest URL from the Hls.js instance, not the <video> tag currentSrc', () => {
      const tech = makeTech({ vhs_: { url: 'https://cdn.example.com/manifest.m3u8' } });
      const t = new HlsJsTech(tech);
      expect(t.getSrc()).toBe('https://cdn.example.com/manifest.m3u8');
    });
  });

  describe('isUsing', () => {
    it('is true when the tech exposes vhs_', () => {
      expect(HlsJsTech.isUsing(makeTech({ vhs_: {} }))).toBe(true);
    });

    it('is false when the tech has no vhs_', () => {
      expect(HlsJsTech.isUsing(makeTech({ vhs_: null }))).toBe(false);
    });
  });
});
