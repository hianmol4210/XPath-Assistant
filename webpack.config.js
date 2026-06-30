const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: {
      devtools: './src/devtools/index.tsx',
      background: './src/background/serviceWorker.ts',
      content: './src/content/contentScript.ts',
      'devtools-page': './src/devtools-page/devtools.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    mode: isDev ? 'development' : 'production',
    devtool: isDev ? 'cheap-module-source-map' : false,
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                noEmit: false,
                declaration: false,
                declarationMap: false,
              },
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader',
          ],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new HtmlWebpackPlugin({
        template: './src/devtools/devtools.html',
        filename: 'devtools.html',
        chunks: ['devtools'],
      }),
      new HtmlWebpackPlugin({
        template: './src/devtools-page/devtools-page.html',
        filename: 'devtools-page.html',
        chunks: ['devtools-page'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/manifest.json', to: 'manifest.json' },
          { from: 'public/icons', to: 'icons', noErrorOnMissing: true },
        ],
      }),
    ],
    optimization: {
      // No code splitting - Chrome extensions need self-contained bundles per entry
      splitChunks: false,
      runtimeChunk: false,
    },
  };
};
