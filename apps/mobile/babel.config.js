module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Incrusta los .sql de @luka/schema-sqlite en migrations.js (guía de Drizzle para Expo).
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
