import nrvideo from '@newrelic/video-core';

describe('Register Plugin', () => {
  let mockPlayer;
  let mockTracker;
  let originalVideojs;

  beforeAll(() => {
    // Save original videojs if it exists
    originalVideojs = global.videojs;
  });

  afterAll(() => {
    // Restore original videojs
    global.videojs = originalVideojs;
  });

  beforeEach(() => {
    // Reset modules to ensure fresh import
    jest.resetModules();

    // Mock videojs global
    global.videojs = {
      registerPlugin: jest.fn(),
      plugin: jest.fn()
    };

    mockTracker = {
      player: null
    };

    mockPlayer = {
      newrelictracker: null
    };

    // Mock nrvideo as a global since register-plugin.js references it globally
    global.nrvideo = {
      VideojsTracker: jest.fn().mockImplementation((player) => {
        mockTracker.player = player;
        return mockTracker;
      }),
      Core: {
        addTracker: jest.fn()
      }
    };
  });

  test('should register newrelic plugin when videojs is available', () => {
    // Import the register-plugin module to execute the registration
    require('../register-plugin');

    // Verify registerPlugin was called with correct parameters
    expect(global.videojs.registerPlugin).toHaveBeenCalledWith('newrelic', expect.any(Function));
  });

  test('should create tracker and add to core when plugin is invoked', () => {
    // Import the module to register the plugin
    require('../register-plugin');

    // Get the plugin function that was registered
    const pluginFunction = global.videojs.registerPlugin.mock.calls[0][1];

    // Call the plugin function with mockPlayer as 'this'
    const result = pluginFunction.call(mockPlayer, {});

    // Verify tracker was created and added
    expect(global.nrvideo.VideojsTracker).toHaveBeenCalledWith(mockPlayer);
    expect(global.nrvideo.Core.addTracker).toHaveBeenCalledWith(mockTracker);
    expect(mockPlayer.newrelictracker).toBe(mockTracker);
    expect(result).toBe(mockTracker);
  });

  test('should return existing tracker if already initialized', () => {
    // Set up existing tracker
    mockPlayer.newrelictracker = mockTracker;

    require('../register-plugin');

    // Get the plugin function that was registered
    const pluginFunction = global.videojs.registerPlugin.mock.calls[0][1];

    // Reset the VideojsTracker mock calls for this test
    global.nrvideo.VideojsTracker.mockClear();

    // Call plugin function
    const result = pluginFunction.call(mockPlayer, {});

    // Should not create new tracker, just return existing one
    expect(global.nrvideo.VideojsTracker).not.toHaveBeenCalled();
    expect(result).toBe(mockTracker);
  });

  test('should fallback to videojs.plugin if registerPlugin is not available', () => {
    // Mock scenario where only plugin method exists (Video.js 5)
    global.videojs.registerPlugin = undefined;

    require('../register-plugin');

    // Should use plugin method as fallback
    expect(global.videojs.plugin).toHaveBeenCalledWith('newrelic', expect.any(Function));
  });

  test('should not register plugin when videojs is undefined', () => {
    // Set videojs to undefined
    global.videojs = undefined;

    // This should not throw an error
    expect(() => {
      require('../register-plugin');
    }).not.toThrow();
  });
});