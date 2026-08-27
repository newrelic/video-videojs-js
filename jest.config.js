module.exports = {
  testEnvironment: "jsdom",
  watchman: false,
  transform: { '^.+\\.jsx?$': 'babel-jest' },
  testMatch: ['**/test/**/*.spec.js'],
  moduleNameMapper: {
    '^@newrelic/video-core$': '<rootDir>/node_modules/@newrelic/video-core/__mock__.js'
  },
  collectCoverageFrom: ['src/**/*.js'],
};
