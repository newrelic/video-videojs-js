[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic Videojs Tracker - Development Guide

New Relic video tracking for Videojs Player.

## Requirements

- Node.js (LTS version recommended)
- npm or yarn package manager

## Setup

Install dependencies:

```shell
$ npm install
```

## Build

For development build with source maps:

```shell
$ npm run build:dev
```

For production build (minified):

```shell
$ npm run build
```

Build output is located in the `dist` folder.

## Development Workflow

1. Make your changes to the source files in `src/`
2. Run `npm run build:dev` to build with source maps
3. Test your changes using the sample files in `samples/`
4. Run `npm run build` for final production build

## Project Structure

```
src/
├── tracker.js           # Main tracker implementation
├── techs/              # Tech-specific wrappers
│   ├── contrib-hls.js  # VHS (Video.js HTTP Streaming)
│   ├── hls-js.js       # hls.js integration
│   └── shaka.js        # Shaka Player integration
└── ads/                # Ad tracking implementations
    ├── videojs-ads.js
    ├── ima.js
    ├── brightcove-ima.js
    ├── freewheel.js
    └── dai.js
```

## Testing

Test your changes using the sample HTML files:

- `samples/hls.html` - Basic HLS streaming example
- `samples/ima.html` - IMA ads integration example
- `samples/dai/index.html` - SSAI (Server-Side Ad Insertion) example

To run samples locally:

```shell
$ npm start
```

Then open `http://localhost:8080/samples/` in your browser.

## Release Process

1. Create a feature branch for your changes
2. Make your changes and test thoroughly
3. Update the version in `package.json` following semver rules:
   - **Patch** (x.x.1): Bug fixes
   - **Minor** (x.1.0): New features (backward compatible)
   - **Major** (1.0.0): Breaking changes
4. Update [CHANGELOG.md](CHANGELOG.md) with your changes
5. Create a PR with your changes
6. Once approved and merged, create a GitHub release with a tag matching the version

## Code Style

- Use ES6+ syntax
- Follow existing code patterns in the project
- Add try-catch blocks for error handling
- Document new methods with JSDoc comments
- Keep production code free of console.log statements

## Contributing

See [README.md](README.md) for contribution guidelines.
