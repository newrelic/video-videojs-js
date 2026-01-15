// Test setup file for global configuration

// Mock console methods to avoid noise during tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock DOMParser for DASH tests
global.DOMParser = class DOMParser {
  parseFromString(str, mimeType) {
    // Simple mock implementation
    return {
      documentElement: {},
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
    };
  }
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock AbortController
global.AbortController = class AbortController {
  constructor() {
    this.signal = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  }
  abort() {}
};
