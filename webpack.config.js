var path = require("path");
var webpack = require("webpack");
var TerserPlugin = require("terser-webpack-plugin");
var WebpackObfuscator = require("webpack-obfuscator");
var pkg = require("./package.json");

var license =
  "@license " +
  pkg.license +
  "\n" +
  pkg.name +
  " " +
  pkg.version +
  "\nCopyright New Relic <http://newrelic.com/>\n" +
  "@author " +
  pkg.author;

module.exports = [
  //umd
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/umd"),
      filename: "videojs" + ".min.js",
      library: "VideojsTracker",
      libraryTarget: "umd",
      libraryExport: "default", 
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(?:js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env"]],
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
      new WebpackObfuscator(
        {
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          identifierNamesGenerator: "mangled",
        },
        ["excluded.js"]
      ),
    ],
  },
  // CommonJS Build
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/cjs"),
      filename: "index.js",
      library: "VideojsTracker",
      libraryTarget: "commonjs2", // CommonJS format
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults" }]],
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
      // Obfuscation Plugin
      new WebpackObfuscator(
        {
          rotateStringArray: true, // Rotate string arrays for obfuscation
          stringArray: true, // Enable string array obfuscation
          stringArrayThreshold: 0.75, // Obfuscate 75% of strings
          identifierNamesGenerator: "mangled",
        },
        ["excluded.js"] // Exclude specific files if needed
      ),
    ],
  },
  // ES Module Build
  {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "./dist/esm"),
      filename: "index.js",
      library: {
        type: "module", // ES Module format
      },
    },
    experiments: {
      outputModule: true, // Enable ES Module output
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [["@babel/preset-env", { targets: "defaults", modules: false }]],
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
      new WebpackObfuscator(
        {
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          identifierNamesGenerator: "mangled",
        },
        ["excluded.js"]
      ),
    ],
  },
];