require("dotenv").config();
const { HardhatUserConfig } = require("hardhat/config");
require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x55f06ef0b162f094c7c55fcc29750f902fb6b0ca09fa3a0d26ad459def3c8ca0";
const MONAD_RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";

console.log("Environment check:", {
  PRIVATE_KEY: PRIVATE_KEY ? "Set" : "Not set",
  RPC_URL: MONAD_RPC_URL,
  NODE_ENV: process.env.NODE_ENV
});

console.log("Hardhat config debug:", {
  PRIVATE_KEY: PRIVATE_KEY ? "Set" : "Not set",
  MONAD_RPC_URL,
  PRIVATE_KEY_LENGTH: PRIVATE_KEY ? PRIVATE_KEY.length : 0,
  ALL_ENV_KEYS: Object.keys(process.env).filter(k => k.includes('PRIVATE') || k.includes('RPC'))
});

const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monad: {
      url: MONAD_RPC_URL,
      chainId: 10143,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  defaultNetwork: "hardhat",
};

module.exports = config;
