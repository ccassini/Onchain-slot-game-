export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz';

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '10143');
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

export const GAME_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_GAME_MANAGER_ADDRESS || '0xf11e64527F6D8D5f4B35b73a247fa7F134a6Dad3').trim();
export const CHIP_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_CHIP_TOKEN_ADDRESS || '0xE3E1e1aA5BcA634b9D26b94EEE01a0A8999Ec35c').trim();

// Debug log'ları
console.log("Environment variables loaded:", {
  NEXT_PUBLIC_GAME_MANAGER_ADDRESS: process.env.NEXT_PUBLIC_GAME_MANAGER_ADDRESS,
  NEXT_PUBLIC_CHIP_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_CHIP_TOKEN_ADDRESS,
  GAME_MANAGER_ADDRESS,
  CHIP_TOKEN_ADDRESS
});

export const MONAD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ['https://testnet.monadexplorer.com/'],
};

export const DEFAULT_CHIP_SYMBOL = 'CHIP';

export function isValidAddress(address?: string | null): address is string {
  if (!address) return false;
  const normalized = address.toLowerCase();
  const stripped = normalized.replace(/^0x/, '');
  const isZero = /^0+$/.test(stripped);
  return /^0x[a-f0-9]{40}$/i.test(address) && !isZero;
}
