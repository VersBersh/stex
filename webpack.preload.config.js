const path = require('path');

module.exports = {
  target: 'electron-preload',
  mode: 'development',
  entry: {
    index: './src/preload/index.ts',
    'settings-preload': './src/preload/settings-preload.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/preload'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: { configFile: 'tsconfig.preload.json' },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    electron: 'commonjs electron',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
