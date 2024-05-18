const path = require("path");

module.exports = {
  entry: {
    popup: "./src/script/popup.bundle.js",
    background: "./src/script/background.bundle.js",
    content: "./src/script/content.bundle.js",
    index: "./src/script/index.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
};
