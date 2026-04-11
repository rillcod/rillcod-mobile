const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Windows: Metro defaults to Watchman (`resolver.useWatchman: true`). If Watchman is missing,
// broken, or never becomes ready, file-map waits until timeout → "Failed to start watch mode."
// Node fallback watcher is reliable on Win32 (see metro-file-map Watcher.js).
if (process.platform === 'win32') {
  config.resolver.useWatchman = false;
}

// Ensure reanimated worklets are resolved correctly
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
