const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const {sources, Compilation} = require('webpack');
class AssetManifestPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('QuayNextManifest', compilation => {
      compilation.hooks.processAssets.tap({name:'QuayNextManifest',stage:Compilation.PROCESS_ASSETS_STAGE_REPORT}, assets => {
        const manifest=Object.fromEntries(Object.keys(assets).filter(name=>name.startsWith('assets/')&&!name.endsWith('.map')&&!name.endsWith('.txt')).map(name=>[name,name]));
        compilation.emitAsset('asset-manifest.json',new sources.RawSource(JSON.stringify(manifest,null,2)));
      });
    });
  }
}
module.exports={
  mode:'production',context:__dirname,entry:'./src/next/main.tsx',devtool:false,
  output:{path:path.resolve(__dirname,'dist-next'),filename:'assets/[name].[contenthash].js',chunkFilename:'assets/[name].[contenthash].js',publicPath:'/__quay_next_preview__/',clean:true,assetModuleFilename:'assets/[name].[contenthash][ext]'},
  resolve:{extensions:['.tsx','.ts','.js']},
  module:{rules:[
    {test:/\.tsx?$/,include:path.resolve(__dirname,'src/next'),use:{loader:'ts-loader',options:{configFile:'tsconfig.next.json',compilerOptions:{noEmit:false}}}},
    {test:/\.css$/,use:[MiniCssExtractPlugin.loader,'css-loader']},
    {test:/\.(woff2?|ttf|eot|svg|png|jpg|ico)$/,type:'asset/resource'},
  ]},
  plugins:[new HtmlWebpackPlugin({template:'src/next/index.html',scriptLoading:'defer'}),new MiniCssExtractPlugin({filename:'assets/[name].[contenthash].css'}),new AssetManifestPlugin()],
  optimization:{splitChunks:{chunks:'all'},runtimeChunk:'single'},performance:{hints:'warning',maxEntrypointSize:700000,maxAssetSize:450000},
};
