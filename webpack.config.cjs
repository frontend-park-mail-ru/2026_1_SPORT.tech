const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isDev = process.env.NODE_ENV === 'development';

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? '[name].js' : '[name].[contenthash].js',
    chunkFilename: isDev ? '[name].chunk.js' : '[name].[contenthash].chunk.js',
    clean: true,
    publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-typescript']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.hbs$/,
        type: 'asset/source'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: true,
      scriptLoading: 'module'
    }),
    new CopyWebpackPlugin({
      patterns: [
        // Статические ресурсы из public/static (CSS, изображения и пр.)
        { from: 'public/static', to: 'static', noErrorOnMissing: true },
        // Service Worker
        { from: 'public/sw.js', to: 'sw.js', noErrorOnMissing: true },
        // Манифест PWA
        { from: 'public/manifest.json', to: 'manifest.json', noErrorOnMissing: true },
        // Иконки для PWA
        { from: 'public/icons', to: 'icons', noErrorOnMissing: true }
      ]
    })
  ]
};
