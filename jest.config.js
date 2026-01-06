module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Coverage configuration
  collectCoverage: false, // Only collect when explicitly requested
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'clover'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.js',
    '<rootDir>/src/**/*.test.js',
    '<rootDir>/src/**/*.spec.js'
  ],

  // Module resolution
  moduleFileExtensions: ['js', 'json'],

  // Transform files with babel
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Module name mapping for imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000
};