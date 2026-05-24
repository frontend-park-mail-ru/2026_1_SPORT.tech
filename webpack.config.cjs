const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isDev = process.env.NODE_ENV === 'development';

class ServiceWorkerManifestPlugin {
  constructor(templatePath) {
    this.templatePath = templatePath;
  }

  apply(compiler) {
    const pluginName = 'ServiceWorkerManifestPlugin';
    const { Compilation, sources } = compiler.webpack;

    compiler.hooks.thisCompilation.tap(pluginName, compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
        },
        assets => {
          const assetUrls = Object.keys(assets)
            .filter(name => name !== 'sw.js' && !name.endsWith('.map') && !name.endsWith('.LICENSE.txt'))
            .map(name => `/${name.replace(/\\/g, '/')}`)
            .sort();
          const precacheUrls = Array.from(new Set(['/', ...assetUrls]));
          const template = fs.readFileSync(this.templatePath, 'utf8');
          const cacheVersion = crypto
            .createHash('sha256')
            .update(compilation.hash || '')
            .update(template)
            .update(JSON.stringify(precacheUrls))
            .digest('hex')
            .slice(0, 12);
          const source = template
            .replace(
              /const CACHE_VERSION = ['"][^'"]+['"]; \/\/ __CACHE_VERSION__/,
              `const CACHE_VERSION = ${JSON.stringify(cacheVersion)}; // __CACHE_VERSION__`
            )
            .replace(
              /const PRECACHE_URLS = \[[\s\S]*?\]; \/\/ __PRECACHE_URLS__/,
              `const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)}; // __PRECACHE_URLS__`
            );

          compilation.emitAsset('sw.js', new sources.RawSource(source));
        }
      );
    });
  }
}

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
        { from: 'public/static', to: 'static', noErrorOnMissing: true },
        { from: 'public/favicon.svg', to: 'favicon.svg' }
      ]
    }),
    new ServiceWorkerManifestPlugin(path.resolve(__dirname, 'public/sw.js'))
  ]
};
