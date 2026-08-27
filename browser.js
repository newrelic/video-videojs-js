// Filesystem fallback for tools that don't understand package.json#exports.
// Modern resolvers use the "./browser" entry in #exports instead.
module.exports = require('./dist/cjs/browser/index.js');
