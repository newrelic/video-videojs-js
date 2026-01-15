# Unit Tests

This directory contains comprehensive unit tests for the Video.js tracker implementation.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode (auto re-run on changes)
npm run test:watch
```

## Test Structure

```
test/
├── setup.js                           # Global test setup and mocks
├── ads/
│   ├── media-tailor.test.js          # MediaTailor tracker tests
│   ├── media-tailor.integration.test.js  # Integration scenarios
│   └── utils/
│       ├── mt.test.js                # MediaTailor utilities
│       └── mt-constants.test.js      # Constants
└── README.md                          # This file
```

## Test Coverage

### MediaTailor Tracker Tests
- ✅ Initialization & configuration
- ✅ HLS/DASH manifest parsing
- ✅ VOD/LIVE stream handling
- ✅ Event tracking (AD_BREAK_START, AD_START, quartiles, etc.)
- ✅ Pod transitions (multiple ads in one break)
- ✅ Tracking API integration
- ✅ Player event handlers (pause, seek, buffer)
- ✅ Live streaming with polling
- ✅ Error handling & cleanup

### Utility Functions Tests
- ✅ Manifest type detection (HLS/DASH)
- ✅ Stream type detection (VOD/LIVE)
- ✅ Ad schedule management
- ✅ Quartile calculations
- ✅ URL parsing & tracking
- ✅ Async operations & error handling

## Test Statistics

- **Test Suites:** 4
- **Test Cases:** 100+
- **Coverage Goal:** 80%+

## Debugging Tests

### Run specific test file
```bash
npm test -- test/ads/media-tailor.test.js
```

### Run specific test
```bash
npm test -- -t "should detect HLS"
```

### Enable console logs
Edit `test/setup.js` and comment out console mocks.

## CI/CD Integration

```yaml
- name: Run Tests
  run: npm test

- name: Generate Coverage
  run: npm run test:coverage
```

## Troubleshooting

**Module Not Found:** Run `npm install`

**Tests Timeout:** Increase timeout in `jest.config.js`

**Coverage Not Generated:** Use `npm run test:coverage`
