/**
 * @jest-environment jsdom
 */

describe('Register Plugin', () => {
  let mockVideojs;
  let mockPlayer;
  let mockTracker;

  beforeEach(() => {
    // Mock nrvideo global for the plugin
    global.nrvideo = {
      VideojsTracker: jest.fn().mockImplementation(() => mockTracker),
      Core: {
        addTracker: jest.fn()
      }
    };

    mockTracker = {
      id: 'test-tracker-123'
    };

    mockPlayer = {
      newrelictracker: null
    };

    mockVideojs = {
      registerPlugin: jest.fn(),
      plugin: jest.fn() // Fallback for Video.js 5
    };

    // Clear any existing global videojs
    delete global.videojs;

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up modules cache to allow re-importing
    jest.resetModules();
    delete global.videojs;
    delete global.nrvideo;
  });

  test('should register plugin when videojs is available with registerPlugin method', () => {
    global.videojs = mockVideojs;

    // Import the module after setting up the global
    require('../register-plugin');

    expect(mockVideojs.registerPlugin).toHaveBeenCalledWith('newrelic', expect.any(Function));
    expect(mockVideojs.plugin).not.toHaveBeenCalled();
  });

  test('should use plugin method as fallback for Video.js 5', () => {
    global.videojs = {
      plugin: jest.fn()
      // No registerPlugin method (Video.js 5)
    };

    require('../register-plugin');

    expect(global.videojs.plugin).toHaveBeenCalledWith('newrelic', expect.any(Function));
  });

  test('should not register plugin when videojs is not available', () => {
    // No global videojs

    expect(() => {
      require('../register-plugin');
    }).not.toThrow();

    // Should not have attempted to call any methods
  });

  test('plugin function should create new tracker when none exists', () => {
    global.videojs = mockVideojs;
    require('../register-plugin');

    // Get the registered plugin function
    const pluginFunction = mockVideojs.registerPlugin.mock.calls[0][1];

    // Call the plugin function with mockPlayer as 'this'
    const result = pluginFunction.call(mockPlayer, {});

    expect(global.nrvideo.VideojsTracker).toHaveBeenCalledWith(mockPlayer);
    expect(global.nrvideo.Core.addTracker).toHaveBeenCalledWith(mockTracker);
    expect(mockPlayer.newrelictracker).toBe(mockTracker);
    expect(result).toBe(mockTracker);
  });

  test('plugin function should return existing tracker when already exists', () => {
    global.videojs = mockVideojs;
    require('../register-plugin');

    const existingTracker = { id: 'existing-tracker' };
    mockPlayer.newrelictracker = existingTracker;

    const pluginFunction = mockVideojs.registerPlugin.mock.calls[0][1];
    const result = pluginFunction.call(mockPlayer, {});

    expect(global.nrvideo.VideojsTracker).not.toHaveBeenCalled();
    expect(global.nrvideo.Core.addTracker).not.toHaveBeenCalled();
    expect(result).toBe(existingTracker);
  });

  test('plugin function should work with options parameter', () => {
    global.videojs = mockVideojs;
    require('../register-plugin');

    const pluginFunction = mockVideojs.registerPlugin.mock.calls[0][1];
    const options = { licenseKey: 'test-key' };

    const result = pluginFunction.call(mockPlayer, options);

    expect(global.nrvideo.VideojsTracker).toHaveBeenCalledWith(mockPlayer);
    expect(result).toBe(mockTracker);
  });

  test('should handle missing nrvideo global gracefully', () => {
    delete global.nrvideo;
    global.videojs = mockVideojs;

    expect(() => {
      require('../register-plugin');
    }).not.toThrow();

    const pluginFunction = mockVideojs.registerPlugin.mock.calls[0][1];

    expect(() => {
      pluginFunction.call(mockPlayer, {});
    }).toThrow(); // Will throw because nrvideo is not defined
  });

  test('should handle videojs with neither registerPlugin nor plugin', () => {
    global.videojs = {
      // Neither registerPlugin nor plugin method
      someOtherMethod: jest.fn()
    };

    expect(() => {
      require('../register-plugin');
    }).toThrow(); // Will throw because registerPlugin/plugin is not defined
  });
});