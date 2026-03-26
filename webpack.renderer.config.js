const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  target: 'electron-renderer',
  mode: 'development',
  entry: {
    overlay: './src/renderer/overlay/index.tsx',
    settings: './src/renderer/settings/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name]/bundle.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { configFile: 'tsconfig.renderer.json' },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/overlay/index.html',
      filename: 'overlay/index.html',
      chunks: ['overlay'],
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/settings/index.html',
      filename: 'settings/index.html',
      chunks: ['settings'],
    }),
    new webpack.DefinePlugin({
      '__SEED_EDITOR__': JSON.stringify(process.env.SEED_EDITOR === 'true'),
    }),
  ],
};
