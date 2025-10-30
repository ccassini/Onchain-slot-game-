import detectEthereumProvider from "@metamask/detect-provider";
import { CHAIN_ID_HEX, MONAD_CHAIN_PARAMS } from "./config";

type MetaMaskProvider = (Window & typeof globalThis)["ethereum"] | any;

type SmartAccountChangedCallback = (address: string | null) => void;

export default class SmartAccountService {
  private provider: MetaMaskProvider | null = null;
  private smartAccountAddress: string | null = null;
  private callbacks: SmartAccountChangedCallback[] = [];
  private initializing = false;

  public async connect(): Promise<{ provider: MetaMaskProvider; address: string }> {
    await this.ensureProvider();
    if (!this.provider) {
      throw new Error("MetaMask provider is not available");
    }

    // Request accounts from MetaMask
    const accounts = await this.provider.request?.({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please connect your MetaMask wallet.");
    }

    await this.ensureChain();

    // Use the first account as the smart account address
    const address = accounts[0] as string;
    this.smartAccountAddress = address;
    this.registerProviderListeners();
    this.notify();

    return { provider: this.provider, address };
  }

  public getProvider(): MetaMaskProvider | null {
    return this.provider;
  }

  public getSmartAccountAddress(): string | null {
    return this.smartAccountAddress;
  }

  public onChange(callback: SmartAccountChangedCallback) {
    this.callbacks.push(callback);
  }

  private async ensureProvider() {
    if (this.provider || this.initializing) {
      return;
    }

    this.initializing = true;

    if (typeof window !== "undefined") {
      // First try direct access to ethereum
      const direct = (window as any).ethereum;
      if (direct && direct.isMetaMask) {
        this.provider = direct;
        this.initializing = false;
        return;
      }

      // Then try detection
      try {
        const detected = await detectEthereumProvider({ mustBeMetaMask: true, silent: true });
        if (detected) {
          this.provider = detected;
          this.initializing = false;
          return;
        }
      } catch (error) {
        console.warn("MetaMask detection failed:", error);
      }
    }

    // If no existing provider found, throw error
    this.initializing = false;
    throw new Error("MetaMask not found. Please install MetaMask extension.");
  }

  private async ensureChain() {
    if (!this.provider?.request) return;

    try {
      await this.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await this.provider.request({
            method: "wallet_addEthereumChain",
            params: [MONAD_CHAIN_PARAMS],
          });
        } catch (addError) {
          console.error("Failed to add Monad network:", addError);
          throw addError;
        }
      } else {
        console.error("Failed to switch to Monad network:", error);
        throw error;
      }
    }
  }

  private registerProviderListeners() {
    if (!this.provider) return;

    this.provider.on?.("accountsChanged", (accounts: string[]) => {
      this.smartAccountAddress = accounts[0] || null;
      this.notify();
    });

    this.provider.on?.("chainChanged", () => {
      this.smartAccountAddress = null;
      this.notify();
    });

    this.provider.on?.("disconnect", () => {
      this.smartAccountAddress = null;
      this.notify();
    });
  }

  private notify() {
    this.callbacks.forEach((callback) => callback(this.smartAccountAddress));
  }

  public disconnect() {
    this.smartAccountAddress = null;
    this.provider = null;
    this.notify();
  }
}