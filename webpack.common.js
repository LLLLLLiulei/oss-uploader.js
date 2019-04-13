var path = require("path");
module.exports = {
  entry: "./src/uploader.js",
  output: {
    filename: "oss-uploader.min.js",
    library: "oss-uploader",
    libraryTarget: "umd",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/dist/"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [path.resolve(__dirname, "src")],
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: /\.js$/,
        enforce: "post",
        loader: "es3ify-loader"
      }
    ]
  }
};
