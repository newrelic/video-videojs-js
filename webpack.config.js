var path = require('path');
var webpack = require('webpack');
var TerserPlugin = require('terser-webpack-plugin');
var pkg = require('./package.json');

var license =
  "@license " +
  pkg.license +
  "\n" +
  pkg.name +
  " " +
  pkg.version +
  '\nCopyright New Relic <http://newrelic.com/>\n' +
  '@author ' +
  pkg.author;

module.exports = [
  //umd
  {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, './dist/umd'),
      filename: 'newrelic-video-videojs.min.js',
      library: 'VideojsTracker',
      libraryTarget: 'umd',
      libraryExport: 'default',
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.(?:js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['@babel/preset-env']],
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // CommonJS Build
  {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, './dist/cjs'),
      filename: 'index.js',
      // No `library` name here (unlike UMD, where it becomes the global var name) —
      // for commonjs2, a name would nest the export under module.exports[name]
      // instead of module.exports itself.
      libraryTarget: 'commonjs2', // CommonJS format
      libraryExport: 'default', // module.exports = the class itself, matching the UMD build
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['@babel/preset-env', { targets: 'defaults' }]],
            },
          },
        },
      ],
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // ES Module Build
  {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, './dist/esm'),
      filename: 'index.js',
      library: {
        type: 'module', // ES Module format
      },
    },
    experiments: {
      outputModule: true, // Enable ES Module output
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              // .babelrc unconditionally adds @babel/plugin-transform-modules-commonjs,
              // which overrides preset-env's modules:false below (babel merges plugins
              // from .babelrc on top of inline options). Disable it so this ES module
              // build actually stays ESM instead of silently becoming CommonJS.
              babelrc: false,
              presets: [
                ['@babel/preset-env', { targets: 'defaults', modules: false }],
              ],
            },
          },
        },
      ],
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // CommonJS Build (browser subpath)
  {
    entry: './src/entry-browser.js',
    output: {
      path: path.resolve(__dirname, './dist/cjs/browser'),
      filename: 'index.js',
      libraryTarget: 'commonjs2',
      libraryExport: 'default', // module.exports = the class itself, matching the UMD build
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [['@babel/preset-env', { targets: 'defaults' }]],
            },
          },
        },
      ],
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
  // ES Module Build (browser subpath)
  {
    entry: './src/entry-browser.js',
    output: {
      path: path.resolve(__dirname, './dist/esm/browser'),
      filename: 'index.js',
      library: {
        type: 'module',
      },
    },
    experiments: {
      outputModule: true,
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              // .babelrc unconditionally adds @babel/plugin-transform-modules-commonjs,
              // which overrides preset-env's modules:false below (babel merges plugins
              // from .babelrc on top of inline options). Disable it so this ES module
              // build actually stays ESM instead of silently becoming CommonJS.
              babelrc: false,
              presets: [
                ['@babel/preset-env', { targets: 'defaults', modules: false }],
              ],
            },
          },
        },
      ],
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()],
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: license,
        entryOnly: true,
      }),
    ],
  },
];
