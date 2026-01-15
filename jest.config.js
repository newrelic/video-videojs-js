module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: [
    '**/test/**/*.test.js',
    '**/test/**/*.spec.js',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/index.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  verbose: true,
};
