const path = require('path');

module.exports = {
  target: 'electron-main',
  mode: 'development',
  entry: {
    index: './src/main/index.ts',
    preload: './src/main/preload.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
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
          options: { configFile: 'tsconfig.main.json' },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    electron: 'commonjs electron',
    'electron-store': 'commonjs electron-store',
    naudiodon: 'commonjs naudiodon',
    ws: 'commonjs ws',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
