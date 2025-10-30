import { BrowserProvider, Contract, formatUnits, parseUnits, toBeHex, zeroPadValue } from "ethers";
import SmartAccountService from "./SmartAccountService";
import { CHIP_TOKEN_ADDRESS, DEFAULT_CHIP_SYMBOL, GAME_MANAGER_ADDRESS, isValidAddress } from "./config";
import { CHIP_TOKEN_ABI, GAME_MANAGER_ABI } from "./abi";

type StatusListener = (state: BlockchainState) => void;

type ScenarioRequest = {
  scenarioId: number;
  betAmountTokens: bigint;
  multiplierBps?: bigint;
  expectedPayoutTokens?: bigint;
};

export interface BlockchainState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  shortAddress: string | null;
  chipBalance: string;
  chipBalanceRaw: bigint;
  chipSymbol: string;
  gameManagerConfigured: boolean;
  chipTokenConfigured: boolean;
}

const BASIS_POINTS_FACTOR = 1_000_000n;
const ALLOWANCE_BUFFER = 100n;

export default class BlockchainService {
  private readonly smartAccountService = new SmartAccountService();
  private provider: BrowserProvider | null = null;
  private smartAccountAddress: string | null = null;
  private chipContract: Contract | null = null;
  private gameManagerContract: Contract | null = null;
  private chipSymbol = DEFAULT_CHIP_SYMBOL;
  private chipDecimals = 18;
  private chipBalance: bigint = 0n;
  private connecting = false;
  private listeners: StatusListener[] = [];

  constructor() {
    this.smartAccountService.onChange((address) => {
      this.smartAccountAddress = address;
      if (address && this.provider) {
        this.refreshChipBalance().catch(console.error);
      }
      this.notify();
    });
  }

  public subscribe(listener: StatusListener) {
    this.listeners.push(listener);
    listener(this.getState());
  }

  public getState(): BlockchainState {
    return {
      connected: Boolean(this.smartAccountAddress),
      connecting: this.connecting,
      address: this.smartAccountAddress,
      shortAddress: this.smartAccountAddress ? this.shortenAddress(this.smartAccountAddress) : null,
      chipBalance: this.formatBalance(this.chipBalance),
      chipBalanceRaw: this.chipBalance,
      chipSymbol: this.chipSymbol,
      gameManagerConfigured: isValidAddress(GAME_MANAGER_ADDRESS),
      chipTokenConfigured: isValidAddress(CHIP_TOKEN_ADDRESS),
    };
  }

  public async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    this.notify();

    try {
      const { provider, address } = await this.smartAccountService.connect();
      this.smartAccountAddress = address;
      this.provider = new BrowserProvider(provider);
      await this.initialiseContracts();
      await this.refreshChipBalance();
    } finally {
      this.connecting = false;
      this.notify();
    }
  }

  public isConnected(): boolean {
    return Boolean(this.smartAccountAddress);
  }

  public isConnecting(): boolean {
    return this.connecting;
  }

  public getAddress(): string | null {
    return this.smartAccountAddress;
  }

  public getChipSymbol(): string {
    return this.chipSymbol;
  }

  public getChipDecimals(): number {
    return this.chipDecimals;
  }

  public toTokenAmount(amount: number): bigint {
    const formatted = Number.isFinite(amount) ? amount : 0;
    return parseUnits(formatted.toString(), this.chipDecimals);
  }

  public tokenAmountToNumber(amount: bigint): number {
    return parseFloat(formatUnits(amount, this.chipDecimals));
  }

  public multiplierToBps(multiplier: number): bigint {
    if (!Number.isFinite(multiplier)) return 0n;
    // Contract uses BASIS_POINTS = 1_000_000 (100% = 1,000,000 bps)
    // So 1.0x = 100% = 1,000,000 bps, 1.1x = 110% = 1,100,000 bps
    const scaled = Math.round(multiplier * Number(BASIS_POINTS_FACTOR));
    return BigInt(Math.max(0, scaled));
  }

  public payoutFromBasisPoints(bet: bigint, bps: bigint): bigint {
    if (bet === 0n || bps === 0n) return 0n;
    return (bet * bps) / BASIS_POINTS_FACTOR;
  }

  public async refreshChipBalance(): Promise<void> {
    if (!this.smartAccountAddress || !this.chipContract) {
      this.chipBalance = 0n;
      this.notify();
      return;
    }

    try {
      const balance: bigint = await this.chipContract.balanceOf(this.smartAccountAddress);
      console.log("CHIP balance fetched:", {
        raw: balance.toString(),
        formatted: this.formatBalance(balance)
      });
      this.chipBalance = balance;
    } catch (error) {
      console.warn("Failed to fetch CHIP balance", error);
      this.chipBalance = 0n;
    }

    this.notify();
  }

  public getChipBalanceFormatted(): string {
    return this.formatBalance(this.chipBalance);
  }

  public async playScenario(request: ScenarioRequest): Promise<{ payout: bigint; txHash: string; payoutBps: bigint }> {
    if (!this.provider || !this.smartAccountAddress) {
      throw new Error("Wallet not connected");
    }
    if (!this.chipContract || !this.gameManagerContract) {
      throw new Error("Contracts are not configured");
    }

    console.log("=== PLAY SCENARIO DEBUG ===");
    console.log("Request:", {
      scenarioId: request.scenarioId,
      betAmountTokens: request.betAmountTokens.toString(),
      multiplierBps: request.multiplierBps?.toString(),
      expectedPayoutTokens: request.expectedPayoutTokens?.toString()
    });

    const signer = await this.provider.getSigner();
    const chipWithSigner = this.chipContract.connect(signer);
    const gameManagerWithSigner = this.gameManagerContract.connect(signer);

    await this.ensureAllowance(chipWithSigner, request.betAmountTokens);

    const scenarioKey = this.encodeScenarioId(request.scenarioId);
    console.log("Encoded scenario key:", scenarioKey);
    
    // Always fetch payout BPS from contract, ignore frontend calculation
    let payoutBps = 0n;
    try {
      payoutBps = await gameManagerWithSigner.getScenarioPayout(scenarioKey);
      console.log("Fetched payout BPS from contract:", payoutBps.toString());
    } catch (error) {
      console.warn("Unable to fetch scenario payout from chain", error);
    }

    // Calculate expected payout based on contract's payout BPS
    let expectedPayout = this.payoutFromBasisPoints(request.betAmountTokens, payoutBps);
    console.log("Expected payout:", expectedPayout.toString());

    console.log("Calling GameManager.play...");
    const tx = await gameManagerWithSigner.play(scenarioKey, request.betAmountTokens, expectedPayout);
    console.log("Play transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Play transaction confirmed");

    let payout = expectedPayout;
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = gameManagerWithSigner.interface.parseLog(log);
          if (parsed?.name === "ScenarioPlayed") {
            payout = BigInt(parsed.args?.payout?.toString() ?? payout.toString());
            break;
          }
        } catch {
          // Ignore logs that do not belong to the GameManager interface
        }
      }
    }

    await this.refreshChipBalance();

    const txHash = receipt?.hash ?? (receipt as any)?.transactionHash ?? tx.hash;
    return { payout, txHash, payoutBps };
  }

  private async initialiseContracts() {
    if (!this.provider) {
      console.warn("No provider available for contract initialization");
      return;
    }

    console.log("Initializing contracts...", { 
      CHIP_TOKEN_ADDRESS, 
      GAME_MANAGER_ADDRESS,
      isValidChip: isValidAddress(CHIP_TOKEN_ADDRESS),
      isValidGameManager: isValidAddress(GAME_MANAGER_ADDRESS)
    });

    if (isValidAddress(CHIP_TOKEN_ADDRESS)) {
      this.chipContract = new Contract(CHIP_TOKEN_ADDRESS, CHIP_TOKEN_ABI, this.provider);
      console.log("CHIP contract created:", this.chipContract);
      try {
        const [symbol, decimals] = await Promise.all([
          this.chipContract.symbol(),
          this.chipContract.decimals(),
        ]);
        this.chipSymbol = symbol ?? DEFAULT_CHIP_SYMBOL;
        this.chipDecimals = Number(decimals ?? 18);
        console.log("CHIP token metadata loaded:", { symbol: this.chipSymbol, decimals: this.chipDecimals });
      } catch (error) {
        console.warn("Failed to read CHIP token metadata", error);
        this.chipSymbol = DEFAULT_CHIP_SYMBOL;
        this.chipDecimals = 18;
      }
    } else {
      console.warn("Invalid CHIP token address:", CHIP_TOKEN_ADDRESS);
      this.chipContract = null;
      this.chipSymbol = DEFAULT_CHIP_SYMBOL;
      this.chipDecimals = 18;
    }

    if (isValidAddress(GAME_MANAGER_ADDRESS)) {
      this.gameManagerContract = new Contract(GAME_MANAGER_ADDRESS, GAME_MANAGER_ABI, this.provider);
      console.log("GameManager contract created:", this.gameManagerContract);
    } else {
      console.warn("Invalid GameManager address:", GAME_MANAGER_ADDRESS);
      this.gameManagerContract = null;
    }

    this.notify();
  }

  private async ensureAllowance(contractWithSigner: Contract, requiredAmount: bigint) {
    if (requiredAmount === 0n || !this.smartAccountAddress) return;

    console.log("Checking allowance...", {
      smartAccountAddress: this.smartAccountAddress,
      gameManagerAddress: GAME_MANAGER_ADDRESS,
      requiredAmount: requiredAmount.toString()
    });

    try {
      const existing: bigint = await contractWithSigner.allowance(this.smartAccountAddress, GAME_MANAGER_ADDRESS);
      console.log("Current allowance:", existing.toString());
      if (existing >= requiredAmount) {
        console.log("Allowance sufficient, no approval needed");
        return;
      }
    } catch (error) {
      console.warn("Failed to read CHIP allowance", error);
    }

    console.log("Approving CHIP tokens...");
    const approvalAmount = requiredAmount * ALLOWANCE_BUFFER;
    console.log("Approval amount:", approvalAmount.toString());
    
    const tx = await contractWithSigner.approve(GAME_MANAGER_ADDRESS, approvalAmount);
    console.log("Approval transaction sent:", tx.hash);
    await tx.wait();
    console.log("Approval confirmed");
  }

  private encodeScenarioId(value: number | string): string {
    // 100k scenario ID'yi 0-99 arasına hash'le
    const numericValue = typeof value === "string" ? parseInt(value) : value;
    const hashedId = numericValue % 100; // 0-99 arası
    
    return zeroPadValue(toBeHex(BigInt(hashedId)), 32);
  }

  private shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private formatBalance(balance: bigint): string {
    if (!this.chipDecimals) return balance.toString();
    try {
      return formatUnits(balance, this.chipDecimals);
    } catch {
      return balance.toString();
    }
  }

  // MON karşılığında CHIP satın alma
  public async buyChips(monAmount: string): Promise<string> {
    if (!this.provider || !this.smartAccountAddress) {
      throw new Error("Blockchain service not connected");
    }
    
    if (!this.chipContract) {
      throw new Error("CHIP token contract not configured");
    }

    const signer = await this.provider.getSigner();
    const contractWithSigner = this.chipContract.connect(signer);

    const monValue = parseUnits(monAmount, 18); // MON has 18 decimals
    const minDeposit = parseUnits("0.1", 18); // 0.1 MON minimum

    console.log("Deposit details:", {
      monAmount,
      monValue: monValue.toString(),
      minDeposit: minDeposit.toString(),
      monValueGte: monValue >= minDeposit
    });

    if (monValue < minDeposit) {
      throw new Error("Minimum deposit is 0.1 MON");
    }

    // Contract'tan CHIP_PER_MON değerini okuyalım
    try {
      const chipPerMon = await this.chipContract.CHIP_PER_MON();
      console.log("CHIP_PER_MON from contract:", chipPerMon.toString());
    } catch (error) {
      console.warn("Could not read CHIP_PER_MON from contract:", error);
    }

    const tx = await contractWithSigner.buyChips({ value: monValue });
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);

    if (!receipt) {
      throw new Error("Transaction failed");
    }

    await this.refreshChipBalance();

    return receipt.hash;
  }

  private notify() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
