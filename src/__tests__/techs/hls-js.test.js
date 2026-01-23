import HlsJs from '../../techs/hls-js';

describe('HlsJs Tech Wrapper', () => {
  let mockTech;
  let hlsJs;

  beforeEach(() => {
    mockTech = {
      vhs_: {
        url: 'http://example.com/playlist.m3u8',
        levels: [
          {
            name: 'low',
            bitrate: 500000,
            width: 640,
            height: 360
          },
          {
            name: 'medium',
            bitrate: 1000000,
            width: 1280,
            height: 720
          },
          {
            name: 'high',
            bitrate: 2000000,
            width: 1920,
            height: 1080
          }
        ],
        currentLevel: 1
      }
    };
  });

  describe('Constructor', () => {
    test('should create instance with tech.vhs_', () => {
      hlsJs = new HlsJs(mockTech);

      expect(hlsJs.tech).toBe(mockTech.vhs_);
    });
  });

  describe('Static isUsing method', () => {
    test('should return true when tech has vhs_', () => {
      expect(HlsJs.isUsing(mockTech)).toBe(true);
    });

    test('should return false when tech has no vhs_', () => {
      const techWithoutVhs = { someOtherProperty: 'value' };

      expect(HlsJs.isUsing(techWithoutVhs)).toBe(false);
    });

    test('should return false when tech.vhs_ is null', () => {
      const techWithNullVhs = { vhs_: null };

      expect(HlsJs.isUsing(techWithNullVhs)).toBe(false);
    });

    test('should return false when tech.vhs_ is undefined', () => {
      const techWithUndefinedVhs = { vhs_: undefined };

      expect(HlsJs.isUsing(techWithUndefinedVhs)).toBe(false);
    });
  });

  describe('getResource', () => {
    beforeEach(() => {
      hlsJs = new HlsJs(mockTech);
    });

    test('should return the URL from tech', () => {
      expect(hlsJs.getResource()).toBe('http://example.com/playlist.m3u8');
    });

    test('should return undefined when tech has no url', () => {
      hlsJs.tech.url = undefined;

      expect(hlsJs.getResource()).toBeUndefined();
    });
  });

  describe('getRenditionName', () => {
    beforeEach(() => {
      hlsJs = new HlsJs(mockTech);
    });

    test('should return current level name', () => {
      expect(hlsJs.getRenditionName()).toBe('medium');
    });

    test('should return null when current level has no name', () => {
      mockTech.vhs_.levels[1].name = undefined;

      expect(hlsJs.getRenditionName()).toBeNull();
    });

    test('should return null when current level is invalid', () => {
      mockTech.vhs_.currentLevel = 999;

      expect(hlsJs.getRenditionName()).toBeNull();
    });

    test('should return null when levels is undefined', () => {
      mockTech.vhs_.levels = undefined;

      expect(hlsJs.getRenditionName()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      // Make levels access throw an error
      Object.defineProperty(mockTech.vhs_, 'levels', {
        get() {
          throw new Error('Access denied');
        }
      });

      expect(hlsJs.getRenditionName()).toBeNull();
    });
  });

  describe('getRenditionBitrate', () => {
    beforeEach(() => {
      hlsJs = new HlsJs(mockTech);
    });

    test('should return current level bitrate', () => {
      expect(hlsJs.getRenditionBitrate()).toBe(1000000);
    });

    test('should return null when current level has no bitrate', () => {
      mockTech.vhs_.levels[1].bitrate = undefined;

      expect(hlsJs.getRenditionBitrate()).toBeNull();
    });

    test('should return null when current level is invalid', () => {
      mockTech.vhs_.currentLevel = -1;

      expect(hlsJs.getRenditionBitrate()).toBeNull();
    });

    test('should return null when levels is null', () => {
      mockTech.vhs_.levels = null;

      expect(hlsJs.getRenditionBitrate()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      // Make currentLevel access throw an error
      Object.defineProperty(mockTech.vhs_, 'currentLevel', {
        get() {
          throw new Error('Access denied');
        }
      });

      expect(hlsJs.getRenditionBitrate()).toBeNull();
    });
  });

  describe('getRenditionWidth', () => {
    beforeEach(() => {
      hlsJs = new HlsJs(mockTech);
    });

    test('should return current level width', () => {
      expect(hlsJs.getRenditionWidth()).toBe(1280);
    });

    test('should return null when current level has no width', () => {
      mockTech.vhs_.levels[1].width = undefined;

      expect(hlsJs.getRenditionWidth()).toBeNull();
    });

    test('should return null when current level is out of bounds', () => {
      mockTech.vhs_.currentLevel = 10;

      expect(hlsJs.getRenditionWidth()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      mockTech.vhs_.levels = undefined;

      expect(hlsJs.getRenditionWidth()).toBeNull();
    });
  });

  describe('getRenditionHeight', () => {
    beforeEach(() => {
      hlsJs = new HlsJs(mockTech);
    });

    test('should return current level height', () => {
      expect(hlsJs.getRenditionHeight()).toBe(720);
    });

    test('should return null when current level has no height', () => {
      mockTech.vhs_.levels[1].height = undefined;

      expect(hlsJs.getRenditionHeight()).toBeNull();
    });

    test('should return null when levels array is empty', () => {
      mockTech.vhs_.levels = [];

      expect(hlsJs.getRenditionHeight()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      // Mock a getter that throws
      Object.defineProperty(mockTech.vhs_, 'levels', {
        get() {
          throw new TypeError('Cannot read property');
        }
      });

      expect(hlsJs.getRenditionHeight()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle tech with partial vhs_ object', () => {
      const partialTech = {
        vhs_: {
          // Missing levels and currentLevel
        }
      };

      hlsJs = new HlsJs(partialTech);

      expect(hlsJs.getRenditionName()).toBeNull();
      expect(hlsJs.getRenditionBitrate()).toBeNull();
      expect(hlsJs.getRenditionWidth()).toBeNull();
      expect(hlsJs.getRenditionHeight()).toBeNull();
    });

    test('should handle negative currentLevel', () => {
      mockTech.vhs_.currentLevel = -1;
      hlsJs = new HlsJs(mockTech);

      expect(hlsJs.getRenditionName()).toBeNull();
      expect(hlsJs.getRenditionBitrate()).toBeNull();
      expect(hlsJs.getRenditionWidth()).toBeNull();
      expect(hlsJs.getRenditionHeight()).toBeNull();
    });

    test('should handle level with zero values', () => {
      mockTech.vhs_.levels[1] = {
        name: '',
        bitrate: 0,
        width: 0,
        height: 0
      };
      hlsJs = new HlsJs(mockTech);

      expect(hlsJs.getRenditionName()).toBeNull(); // Empty string is falsy
      expect(hlsJs.getRenditionBitrate()).toBeNull(); // 0 is falsy
      expect(hlsJs.getRenditionWidth()).toBeNull(); // 0 is falsy
      expect(hlsJs.getRenditionHeight()).toBeNull(); // 0 is falsy
    });
  });
});