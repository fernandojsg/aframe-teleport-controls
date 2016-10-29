var webpack = require('webpack');

var PLUGINS = [];
if (process.env.NODE_ENV === 'production') {
  PLUGINS.push(new webpack.optimize.UglifyJsPlugin());
}

module.exports = {
  entry: './examples/main.js',
  output: {
    path: __dirname,
    filename: 'build.js'
  },
  plugins: PLUGINS
};
