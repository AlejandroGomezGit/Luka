const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Las migraciones de SQLite son archivos .sql que Babel incrusta (babel.config.js).
config.resolver.sourceExts.push('sql');

module.exports = config;
