import ContribHlsTech from '../../techs/contrib-hls';

describe('ContribHlsTech Wrapper', () => {
  let mockTech;
  let contribHls;

  beforeEach(() => {
    mockTech = {
      vhs: {
        playlists: {
          media: jest.fn().mockReturnValue({
            attributes: {
              NAME: 'medium-quality',
              BANDWIDTH: 1500000,
              RESOLUTION: {
                width: 1280,
                height: 720
              }
            }
          })
        }
      }
    };
  });

  describe('Constructor', () => {
    test('should create instance with tech.vhs', () => {
      contribHls = new ContribHlsTech(mockTech);

      expect(contribHls.tech).toBe(mockTech.vhs);
    });
  });

  describe('Static isUsing method', () => {
    test('should return true when tech has vhs', () => {
      expect(ContribHlsTech.isUsing(mockTech)).toBe(true);
    });

    test('should return false when tech has no vhs', () => {
      const techWithoutVhs = { someOtherProperty: 'value' };

      expect(ContribHlsTech.isUsing(techWithoutVhs)).toBe(false);
    });

    test('should return false when tech.vhs is null', () => {
      const techWithNullVhs = { vhs: null };

      expect(ContribHlsTech.isUsing(techWithNullVhs)).toBe(false);
    });

    test('should return false when tech.vhs is undefined', () => {
      const techWithUndefinedVhs = { vhs: undefined };

      expect(ContribHlsTech.isUsing(techWithUndefinedVhs)).toBe(false);
    });
  });

  describe('getRenditionName', () => {
    beforeEach(() => {
      contribHls = new ContribHlsTech(mockTech);
    });

    test('should return NAME attribute from current media', () => {
      expect(contribHls.getRenditionName()).toBe('medium-quality');
    });

    test('should return null when media has no attributes', () => {
      mockTech.vhs.playlists.media.mockReturnValue({});

      expect(contribHls.getRenditionName()).toBeNull();
    });

    test('should return null when media is null', () => {
      mockTech.vhs.playlists.media.mockReturnValue(null);

      expect(contribHls.getRenditionName()).toBeNull();
    });

    test('should return undefined when NAME attribute is undefined', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          BANDWIDTH: 1000000
          // NAME is missing - will return undefined
        }
      });

      expect(contribHls.getRenditionName()).toBeUndefined();
    });

    test('should handle errors gracefully', () => {
      mockTech.vhs.playlists.media.mockImplementation(() => {
        throw new Error('Media access failed');
      });

      expect(contribHls.getRenditionName()).toBeNull();
    });
  });

  describe('getRenditionBitrate', () => {
    beforeEach(() => {
      contribHls = new ContribHlsTech(mockTech);
    });

    test('should return BANDWIDTH attribute from current media', () => {
      expect(contribHls.getRenditionBitrate()).toBe(1500000);
    });

    test('should return null when media has no attributes', () => {
      mockTech.vhs.playlists.media.mockReturnValue({});

      expect(contribHls.getRenditionBitrate()).toBeNull();
    });

    test('should return undefined when BANDWIDTH is undefined', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          NAME: 'test'
          // BANDWIDTH is missing - will return undefined
        }
      });

      expect(contribHls.getRenditionBitrate()).toBeUndefined();
    });

    test('should handle errors gracefully', () => {
      mockTech.vhs.playlists.media.mockImplementation(() => {
        throw new TypeError('Cannot read property');
      });

      expect(contribHls.getRenditionBitrate()).toBeNull();
    });
  });

  describe('getRenditionWidth', () => {
    beforeEach(() => {
      contribHls = new ContribHlsTech(mockTech);
    });

    test('should return width from RESOLUTION attribute', () => {
      expect(contribHls.getRenditionWidth()).toBe(1280);
    });

    test('should return null when RESOLUTION is undefined', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          NAME: 'test',
          BANDWIDTH: 1000000
          // RESOLUTION is missing
        }
      });

      expect(contribHls.getRenditionWidth()).toBeNull();
    });

    test('should return undefined when RESOLUTION has no width', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          RESOLUTION: {
            height: 720
            // width is missing - will return undefined
          }
        }
      });

      expect(contribHls.getRenditionWidth()).toBeUndefined();
    });

    test('should return null when media is null', () => {
      mockTech.vhs.playlists.media.mockReturnValue(null);

      expect(contribHls.getRenditionWidth()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      mockTech.vhs.playlists.media.mockImplementation(() => {
        throw new Error('Playlists access failed');
      });

      expect(contribHls.getRenditionWidth()).toBeNull();
    });
  });

  describe('getRenditionHeight', () => {
    beforeEach(() => {
      contribHls = new ContribHlsTech(mockTech);
    });

    test('should return height from RESOLUTION attribute', () => {
      expect(contribHls.getRenditionHeight()).toBe(720);
    });

    test('should return null when RESOLUTION is undefined', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          NAME: 'test',
          BANDWIDTH: 1000000
          // RESOLUTION is missing
        }
      });

      expect(contribHls.getRenditionHeight()).toBeNull();
    });

    test('should return undefined when RESOLUTION has no height', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          RESOLUTION: {
            width: 1280
            // height is missing - will return undefined
          }
        }
      });

      expect(contribHls.getRenditionHeight()).toBeUndefined();
    });

    test('should return null when attributes is null', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: null
      });

      expect(contribHls.getRenditionHeight()).toBeNull();
    });

    test('should handle errors gracefully', () => {
      Object.defineProperty(mockTech.vhs, 'playlists', {
        get() {
          throw new Error('Playlists not available');
        }
      });

      expect(contribHls.getRenditionHeight()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      contribHls = new ContribHlsTech(mockTech);
    });

    test('should handle tech with no playlists', () => {
      mockTech.vhs.playlists = undefined;

      expect(contribHls.getRenditionName()).toBeNull();
      expect(contribHls.getRenditionBitrate()).toBeNull();
      expect(contribHls.getRenditionWidth()).toBeNull();
      expect(contribHls.getRenditionHeight()).toBeNull();
    });

    test('should handle playlists with no media method', () => {
      mockTech.vhs.playlists = {};

      expect(contribHls.getRenditionName()).toBeNull();
      expect(contribHls.getRenditionBitrate()).toBeNull();
      expect(contribHls.getRenditionWidth()).toBeNull();
      expect(contribHls.getRenditionHeight()).toBeNull();
    });

    test('should handle empty attributes object', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {}
      });

      expect(contribHls.getRenditionName()).toBeUndefined();
      expect(contribHls.getRenditionBitrate()).toBeUndefined();
      expect(contribHls.getRenditionWidth()).toBeNull();
      expect(contribHls.getRenditionHeight()).toBeNull();
    });

    test('should handle zero values in resolution', () => {
      mockTech.vhs.playlists.media.mockReturnValue({
        attributes: {
          RESOLUTION: {
            width: 0,
            height: 0
          }
        }
      });

      expect(contribHls.getRenditionWidth()).toBe(0); // Returns actual 0 value
      expect(contribHls.getRenditionHeight()).toBe(0); // Returns actual 0 value
    });

    test('should handle malformed media response', () => {
      mockTech.vhs.playlists.media.mockReturnValue('invalid');

      expect(contribHls.getRenditionName()).toBeNull();
      expect(contribHls.getRenditionBitrate()).toBeNull();
      expect(contribHls.getRenditionWidth()).toBeNull();
      expect(contribHls.getRenditionHeight()).toBeNull();
    });
  });
});