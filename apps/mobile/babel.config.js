module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ─── WatermelonDB: decorators (legacy mode) ───────────────────────
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // ─── Path aliases (sincronizado con tsconfig.json paths) ─────────
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@lib': './src/lib',
            '@features': './src/features',
            '@navigation': './src/navigation',
            '@components': './src/components',
          },
        },
      ],
      // ─── Reanimated 4: plugin migrado a react-native-worklets ────────
      'react-native-worklets/plugin',
    ],
  };
};
