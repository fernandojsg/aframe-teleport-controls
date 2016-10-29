var webpack = require('webpack');

var outputFilename = 'build.js';

var PLUGINS = [];
if (process.env.NODE_ENV === 'production') {
  PLUGINS.push(new webpack.optimize.UglifyJsPlugin());
  outputFilename = 'examples/build.js';
}

module.exports = {
  entry: './examples/main.js',
  output: {
    path: __dirname,
    filename: outputFilename
  },
  plugins: PLUGINS
};
