require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

if (!process.env.PRIVATE_KEY) {
  throw new Error("Please set PRIVATE_KEY in your .env file");
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MONAD_RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
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
      accounts: [PRIVATE_KEY],
    },
  },
  defaultNetwork: "hardhat",
};
