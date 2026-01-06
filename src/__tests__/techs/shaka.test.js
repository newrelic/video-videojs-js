import ShakaTech from '../../techs/shaka';

describe('ShakaTech Wrapper', () => {
  let mockTech;
  let shakaTech;

  beforeEach(() => {
    mockTech = {
      shakaPlayer: {
        getManifestUri: jest.fn().mockReturnValue('http://example.com/manifest.mpd'),
        getStats: jest.fn().mockReturnValue({
          streamBandwidth: 2000000
        }),
        getVariantTracks: jest.fn().mockReturnValue([
          {
            id: 1,
            active: false,
            type: 'video',
            width: 640,
            height: 360,
            bandwidth: 500000
          },
          {
            id: 2,
            active: true,
            type: 'video',
            width: 1280,
            height: 720,
            bandwidth: 1500000
          },
          {
            id: 3,
            active: false,
            type: 'audio',
            bandwidth: 128000
          }
        ])
      }
    };
  });

  describe('Constructor', () => {
    test('should create instance with tech.shakaPlayer', () => {
      shakaTech = new ShakaTech(mockTech);

      expect(shakaTech.tech).toBe(mockTech.shakaPlayer);
    });
  });

  describe('Static isUsing method', () => {
    test('should return true when tech has shakaPlayer', () => {
      expect(ShakaTech.isUsing(mockTech)).toBe(true);
    });

    test('should return false when tech has no shakaPlayer', () => {
      const techWithoutShaka = { someOtherProperty: 'value' };

      expect(ShakaTech.isUsing(techWithoutShaka)).toBe(false);
    });

    test('should return false when tech.shakaPlayer is null', () => {
      const techWithNullShaka = { shakaPlayer: null };

      expect(ShakaTech.isUsing(techWithNullShaka)).toBe(false);
    });

    test('should return false when tech.shakaPlayer is undefined', () => {
      const techWithUndefinedShaka = { shakaPlayer: undefined };

      expect(ShakaTech.isUsing(techWithUndefinedShaka)).toBe(false);
    });
  });

  describe('getSrc', () => {
    beforeEach(() => {
      shakaTech = new ShakaTech(mockTech);
    });

    test('should return manifest URI from Shaka player', () => {
      expect(shakaTech.getSrc()).toBe('http://example.com/manifest.mpd');
    });

    test('should return null when getManifestUri throws error', () => {
      mockTech.shakaPlayer.getManifestUri.mockImplementation(() => {
        throw new Error('Manifest not available');
      });

      expect(shakaTech.getSrc()).toBeNull();
    });

    test('should return undefined when getManifestUri returns undefined', () => {
      mockTech.shakaPlayer.getManifestUri.mockReturnValue(undefined);

      expect(shakaTech.getSrc()).toBeUndefined();
    });
  });

  describe('getRenditionBitrate', () => {
    beforeEach(() => {
      shakaTech = new ShakaTech(mockTech);
    });

    test('should return streamBandwidth from stats', () => {
      expect(shakaTech.getRenditionBitrate()).toBe(2000000);
    });

    test('should return null when getStats throws error', () => {
      mockTech.shakaPlayer.getStats.mockImplementation(() => {
        throw new Error('Stats not available');
      });

      expect(shakaTech.getRenditionBitrate()).toBeNull();
    });

    test('should return undefined when stats has no streamBandwidth', () => {
      mockTech.shakaPlayer.getStats.mockReturnValue({
        // No streamBandwidth property - will return undefined
        playTime: 123
      });

      expect(shakaTech.getRenditionBitrate()).toBeUndefined();
    });

    test('should return null when getStats returns null', () => {
      mockTech.shakaPlayer.getStats.mockReturnValue(null);

      expect(shakaTech.getRenditionBitrate()).toBeNull();
    });
  });

  describe('getRenditionWidth', () => {
    beforeEach(() => {
      shakaTech = new ShakaTech(mockTech);
    });

    test('should return width of active video track', () => {
      expect(shakaTech.getRenditionWidth()).toBe(1280);
    });

    test('should return null when no active video track exists', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 1,
          active: false,
          type: 'video',
          width: 640,
          height: 360
        },
        {
          id: 2,
          active: true,
          type: 'audio'
          // No width for audio track
        }
      ]);

      expect(shakaTech.getRenditionWidth()).toBeNull();
    });

    test('should return null when getVariantTracks throws error', () => {
      mockTech.shakaPlayer.getVariantTracks.mockImplementation(() => {
        throw new Error('Tracks not available');
      });

      expect(shakaTech.getRenditionWidth()).toBeNull();
    });

    test('should return null when getVariantTracks returns empty array', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([]);

      expect(shakaTech.getRenditionWidth()).toBeNull();
    });

    test('should return undefined when active video track has no width', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 2,
          active: true,
          type: 'video',
          height: 720
          // No width property - will return undefined
        }
      ]);

      expect(shakaTech.getRenditionWidth()).toBeUndefined();
    });
  });

  describe('getRenditionHeight', () => {
    beforeEach(() => {
      shakaTech = new ShakaTech(mockTech);
    });

    test('should return height of active video track', () => {
      expect(shakaTech.getRenditionHeight()).toBe(720);
    });

    test('should return null when no active video track exists', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 1,
          active: false,
          type: 'video',
          width: 640,
          height: 360
        },
        {
          id: 2,
          active: true,
          type: 'audio'
          // No height for audio track
        }
      ]);

      expect(shakaTech.getRenditionHeight()).toBeNull();
    });

    test('should return null when getVariantTracks throws error', () => {
      mockTech.shakaPlayer.getVariantTracks.mockImplementation(() => {
        throw new TypeError('Cannot read property');
      });

      expect(shakaTech.getRenditionHeight()).toBeNull();
    });

    test('should return null when no video tracks exist', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 1,
          active: true,
          type: 'audio'
        },
        {
          id: 2,
          active: false,
          type: 'audio'
        }
      ]);

      expect(shakaTech.getRenditionHeight()).toBeNull();
    });

    test('should return undefined when active video track has no height', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 2,
          active: true,
          type: 'video',
          width: 1280
          // No height property - will return undefined
        }
      ]);

      expect(shakaTech.getRenditionHeight()).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      shakaTech = new ShakaTech(mockTech);
    });

    test('should handle multiple active video tracks (return first)', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 1,
          active: true,
          type: 'video',
          width: 640,
          height: 360
        },
        {
          id: 2,
          active: true,
          type: 'video',
          width: 1280,
          height: 720
        }
      ]);

      expect(shakaTech.getRenditionWidth()).toBe(640);
      expect(shakaTech.getRenditionHeight()).toBe(360);
    });

    test('should handle tracks with zero dimensions', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 1,
          active: true,
          type: 'video',
          width: 0,
          height: 0
        }
      ]);

      expect(shakaTech.getRenditionWidth()).toBe(0); // Returns actual 0 value
      expect(shakaTech.getRenditionHeight()).toBe(0); // Returns actual 0 value
    });

    test('should handle null variant tracks response', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue(null);

      expect(shakaTech.getRenditionWidth()).toBeNull();
      expect(shakaTech.getRenditionHeight()).toBeNull();
    });

    test('should handle malformed track objects', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          // Missing required properties
        },
        null,
        undefined,
        'invalid'
      ]);

      expect(shakaTech.getRenditionWidth()).toBeNull();
      expect(shakaTech.getRenditionHeight()).toBeNull();
    });

    test('should iterate through all tracks to find active video', () => {
      mockTech.shakaPlayer.getVariantTracks.mockReturnValue([
        {
          id: 1,
          active: false,
          type: 'video',
          width: 640,
          height: 360
        },
        {
          id: 2,
          active: true,
          type: 'audio'
        },
        {
          id: 3,
          active: true,
          type: 'video',
          width: 1920,
          height: 1080
        },
        {
          id: 4,
          active: false,
          type: 'video',
          width: 2560,
          height: 1440
        }
      ]);

      expect(shakaTech.getRenditionWidth()).toBe(1920);
      expect(shakaTech.getRenditionHeight()).toBe(1080);
    });
  });
});