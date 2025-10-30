export const CHIP_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount) external',
  'function buyChips() payable',
  'function CHIP_PER_MON() view returns (uint256)',
  'function MIN_DEPOSIT() view returns (uint256)',
  'function withdrawMon() external',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event ChipsPurchased(address indexed buyer, uint256 monAmount, uint256 chipAmount)'
];

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export const GAME_MANAGER_ABI = [
  'function play(bytes32 scenarioId, uint256 betAmount, uint256 expectedPayout) returns (uint256)',
  'function setScenarioPayout(bytes32 scenarioId, uint256 multiplier) external',
  'function getScenarioPayout(bytes32 scenarioId) view returns (uint256)',
  'event ScenarioPlayed(address indexed player, bytes32 indexed scenarioId, uint256 betAmount, uint256 payout)'
];

