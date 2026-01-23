// Import to ensure coverage is tracked
import VideojsTracker from '../index';
import OriginalVideojsTracker from '../tracker';

describe('Index Module', () => {
  test('should export VideojsTracker as default', () => {
    expect(VideojsTracker).toBe(OriginalVideojsTracker);
  });

  test('should be a function/class', () => {
    expect(typeof VideojsTracker).toBe('function');
  });

  test('should be importable', () => {
    expect(VideojsTracker).toBeDefined();
    expect(VideojsTracker.name).toBe('VideojsTracker');
  });

  test('should be able to instantiate exported class', () => {
    const mockPlayer = {
      tech: jest.fn().mockReturnValue({}),
      ads: { VERSION: '6.0.0' }
    };

    // This should trigger the export to be executed
    const instance = new VideojsTracker(mockPlayer);
    expect(instance).toBeInstanceOf(VideojsTracker);
    expect(instance.getTrackerName()).toBe('videojs');
  });
});