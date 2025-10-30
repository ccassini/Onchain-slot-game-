const path = require("path");
const rspack = require("@rspack/core");
const HTMLPlugin = require("html-webpack-plugin");
require("dotenv").config();
const IS_DEV_MODE = process.argv.reduce((acc, arg) => acc || arg.includes("development"), false);

const BUILD_PATH = path.resolve("dist");

module.exports = {
  devtool: IS_DEV_MODE && "cheap-module-source-map",
  entry: {
    main: "./src/index.ts",
    game: "./src/game.ts"
  },
  output: {
    path: BUILD_PATH,
    filename: "[name].[contenthash:8].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "src/web3/shims/asyncStorage.ts"),
    },
  },
  module: {
    rules: getLoaders(),
  },
  plugins: getPlugins(),
  devServer: {
    static: {
      directory: path.join(__dirname, BUILD_PATH),
    },
    compress: false,
    port: 4200,
    hot: true,
  },
  optimization: getOptimizations(),
};

function getOptimizations() {
  return {
    minimize: !IS_DEV_MODE,
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 10,
        },
        ethers: {
          test: /[\\/]node_modules[\\/]ethers[\\/]/,
          name: "ethers",
          chunks: "all",
          priority: 20,
        },
        pixi: {
          test: /[\\/]node_modules[\\/]pixi\.js[\\/]/,
          name: "pixi",
          chunks: "all",
          priority: 20,
        },
        blockchain: {
          test: /[\\/]src[\\/]web3[\\/]/,
          name: "blockchain",
          chunks: "all",
          priority: 15,
        },
        common: {
          name: "common",
          minChunks: 2,
          chunks: "all",
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    runtimeChunk: {
      name: (entrypoint: any) => `runtime-${entrypoint.name}`,
    },
    usedExports: true,
    sideEffects: false,
  };
}

function getLoaders() {
  return [
    {
      test: /\.tsx?$/,
      exclude: [/node_modules/],
      loader: "builtin:swc-loader",
      options: {
        jsc: {
          parser: {
            syntax: "typescript",
          },
        },
      },
      type: "javascript/auto",
    },
  ];
}

function getPlugins() {
  return [
    new HTMLPlugin({ 
      template: "./src/index.html",
      filename: "index.html",
      chunks: ["main"]
    }),
    new HTMLPlugin({ 
      template: "./src/game.html",
      filename: "game.html",
      chunks: ["game"]
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: "./src/public/", to: "public/" },
        { from: "./src/styles/", to: "styles/" },
        { from: "./src/assets/", to: "assets/" },
      ],
    }),
    new rspack.DefinePlugin({
      "process.env.NEXT_PUBLIC_RPC_URL": JSON.stringify(process.env.NEXT_PUBLIC_RPC_URL || ""),
      "process.env.NEXT_PUBLIC_CHAIN_ID": JSON.stringify(process.env.NEXT_PUBLIC_CHAIN_ID || ""),
      "process.env.NEXT_PUBLIC_GAME_MANAGER_ADDRESS": JSON.stringify(process.env.NEXT_PUBLIC_GAME_MANAGER_ADDRESS || ""),
      "process.env.NEXT_PUBLIC_CHIP_TOKEN_ADDRESS": JSON.stringify(process.env.NEXT_PUBLIC_CHIP_TOKEN_ADDRESS || ""),
    }),
  ];
}
