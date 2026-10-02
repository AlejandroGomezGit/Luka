import config from '@luka/config/eslint';

export default [
  { ignores: ['.expo/', 'expo-env.d.ts', 'babel.config.js', 'metro.config.js'] },
  ...config,
];
