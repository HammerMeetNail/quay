const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

class PreviewManifestPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('QuayNextManifest', compilation => {
      compilation.hooks.processAssets.tap({name: 'QuayNextManifest', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE}, () => {
        const entries = compilation.getAssets().map(asset => asset.name).filter(name => /^assets\/[a-zA-Z0-9._-]+\.(js|css|woff2?|ttf|eot|svg|png|jpg)$/.test(name));
        compilation.emitAsset('asset-manifest.json', new compiler.webpack.sources.RawSource(JSON.stringify(Object.fromEntries(entries.map(name => [name, name])), null, 2)));
      });
    });
  }
}
module.exports = {
  mode: 'production', context: __dirname, entry: './src/next/index.tsx', devtool: false,
  output: {path: path.resolve(__dirname, 'dist-next'), filename: 'assets/[name].[contenthash].js', chunkFilename: 'assets/[name].[contenthash].js', assetModuleFilename: 'assets/[hash][ext]', publicPath: '/__quay_next_preview__/', clean: {keep: '.gitignore'}},
  resolve: {extensions: ['.tsx', '.ts', '.js', '.mjs']},
  module: {rules: [
    {test: /\.tsx?$/, include: path.resolve(__dirname, 'src/next'), use: {loader: 'ts-loader', options: {configFile: 'tsconfig.next.json', transpileOnly: true, compilerOptions: {noEmit: false}}}},
    {test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader']},
    {test: /\.(woff2?|ttf|eot|svg|png|jpe?g)$/, type: 'asset/resource'},
  ]},
  plugins: [new HtmlWebpackPlugin({template: './src/next/index.html', scriptLoading: 'defer'}), new MiniCssExtractPlugin({filename: 'assets/[name].[contenthash].css'}), new PreviewManifestPlugin()],
  optimization: {splitChunks: {chunks: 'all'}, runtimeChunk: 'single'},
  performance: {hints: 'warning', maxEntrypointSize: 800000, maxAssetSize: 600000},
  stats: 'errors-warnings',
};
