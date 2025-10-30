import Loader from "./Loader";
import Background from "./Background";
import ReelsContainer from "./ReelsContainer";
import Scoreboard, { ScoreboardState } from "./Scoreboard";
import VictoryScreen from "./VictoryScreen";
import { Application } from "pixi.js";
import { SLOT_LAYOUT } from "./config";
import { slotRngEngine } from "./SlotRngEngine";
import { evaluateSpin, SpinResult } from "./SpinEvaluator";
import { scenarioEngine, ScenarioResult } from "./ScenarioEngine";
import type { BlockchainState } from "../web3/BlockchainService";

type ChainMetadata = {
    txHash?: string;
};

export default class Game {
    public app: Application;
    private loader!: Loader;
    private reelsContainer!: ReelsContainer;
    private scoreboard!: Scoreboard;
    private victoryScreen!: VictoryScreen;
    private isSpinning = false;
    private isAutoSpinning = false;
    private autoSpinCount = 0;
    private autoSpinTotal = 0;
    private isTurboMode = false;
    private currentScenario: ScenarioResult | null = null;
    private blockchainService: any = null;
    private latestBlockchainState: BlockchainState | null = null;
    private historyListElement: HTMLUListElement | null = null;
    private historyEmptyElement: HTMLLIElement | null = null;
    private historyClearButton: HTMLButtonElement | null = null;
    private readonly historyMaxEntries = 40;

    constructor() {
        this.app = new Application();
    }

    private async getBlockchainService() {
        if (!this.blockchainService) {
            const { default: BlockchainService } = await import("../web3/BlockchainService");
            this.blockchainService = new BlockchainService();
        }
        return this.blockchainService;
    }

    public async init() {
        const infoPanelHeight = 100;
        const canvasHeight = window.innerHeight - infoPanelHeight;

        await this.app.init({
            width: SLOT_LAYOUT.canvas.width,
            height: Math.min(SLOT_LAYOUT.canvas.height, canvasHeight),
        });

        this.loader = new Loader(this.app);

        const gameArea = document.getElementById("game-area");
        if (gameArea) {
            gameArea.innerHTML = "";
            gameArea.appendChild(this.app.canvas);
            this.app.canvas.style.position = "relative";
            this.app.canvas.style.zIndex = "1";
        }

        await this.loader.loadAssets();
        this.createScene();
        this.createReels();
        this.createScoreboard();
        this.createVictoryScreen();
        this.createControlPanel();
        this.setupHistoryPanel();
        await this.setupWalletPanel();
    }

    private createScene() {
        const bg = new Background(this.app);
        this.app.stage.addChild(bg.sprite);
    }

    private createControlPanel() {
        this.setupControlPanel();
    }

    private createReels() {
        this.reelsContainer = new ReelsContainer(this.app);
        this.app.stage.addChild(this.reelsContainer.container);
    }

    private createScoreboard() {
        this.scoreboard = new Scoreboard(this.app, this.handleScoreboardStateChange.bind(this));
    }

    private createVictoryScreen() {
        this.victoryScreen = new VictoryScreen(this.app);
        this.app.stage.addChild(this.victoryScreen.container);
    }

    private handleScoreboardStateChange(_: ScoreboardState) {
        this.updateControlPanel();
    }

    private setupControlPanel() {
        const spinBtn = document.getElementById("spin-btn") as HTMLButtonElement;
        const betDecreaseBtn = document.getElementById("bet-decrease") as HTMLButtonElement;
        const betIncreaseBtn = document.getElementById("bet-increase") as HTMLButtonElement;
        const payTableBtn = document.getElementById("pay-table-btn") as HTMLButtonElement;
        const autoBtn = document.getElementById("auto-btn") as HTMLButtonElement;
        const turboBtn = document.getElementById("turbo-btn") as HTMLButtonElement;
        const depositOpenBtn = document.getElementById("deposit-open-btn") as HTMLButtonElement;

        spinBtn?.addEventListener("click", () => { void this.handleStart(); });
        betDecreaseBtn?.addEventListener("click", () => this.scoreboard.adjustBet(-1));
        betIncreaseBtn?.addEventListener("click", () => this.scoreboard.adjustBet(1));
        payTableBtn?.addEventListener("click", () => this.showPayTable());
        autoBtn?.addEventListener("click", () => this.toggleAutoMode());
        turboBtn?.addEventListener("click", () => this.toggleTurboMode());
        depositOpenBtn?.addEventListener("click", () => this.showDepositModal());

        this.updateControlPanel();
    }

    private showPayTable() {
        const modal = document.getElementById("pay-table-modal") as HTMLElement | null;
        const closeBtn = document.querySelector(".close") as HTMLElement | null;

        if (!modal) return;

        modal.style.display = "block";

        const close = () => {
            modal.style.display = "none";
            closeBtn?.removeEventListener("click", close);
            window.removeEventListener("click", outsideClose);
        };

        const outsideClose = (event: MouseEvent) => {
            if (event.target === modal) {
                close();
            }
        };

        closeBtn?.addEventListener("click", close);
        window.addEventListener("click", outsideClose);
    }

    private showDepositModal() {
        const modal = document.getElementById("deposit-modal") as HTMLElement | null;
        const closeBtn = modal?.querySelector(".close") as HTMLElement | null;
        const depositBtn = document.getElementById("deposit-btn") as HTMLButtonElement;
        const depositAmount = document.getElementById("deposit-amount") as HTMLInputElement;
        const chipAmount = document.getElementById("chip-amount") as HTMLElement;
        const depositStatus = document.getElementById("deposit-status") as HTMLElement;

        if (!modal) return;

        modal.style.display = "block";
        depositAmount.value = "0.1";
        this.updateChipPreview();

        const close = () => {
            modal.style.display = "none";
            closeBtn?.removeEventListener("click", close);
            window.removeEventListener("click", outsideClose);
            depositBtn?.removeEventListener("click", handleDeposit);
            depositAmount?.removeEventListener("input", this.updateChipPreview);
        };

        const outsideClose = (event: MouseEvent) => {
            if (event.target === modal) {
                close();
            }
        };

        const handleDeposit = async () => {
            if (!depositAmount || !depositBtn || !depositStatus) return;

            const amount = depositAmount.value;
            if (!amount || parseFloat(amount) < 0.1) {
                depositStatus.textContent = "Minimum deposit is 0.1 MON";
                depositStatus.className = "deposit-status error";
                return;
            }

            depositBtn.disabled = true;
            depositBtn.textContent = "Processing...";
            depositStatus.textContent = "Processing deposit...";
            depositStatus.className = "deposit-status loading";

            try {
                const blockchainService = await this.getBlockchainService();
                console.log("Starting deposit process...", { amount });
                console.log("Blockchain service state:", blockchainService.getState());
                
                if (!blockchainService.getState().connected) {
                    throw new Error("Please connect your wallet first");
                }
                
                const txHash = await blockchainService.buyChips(amount);
                console.log("Deposit successful!", { txHash });
                
                depositStatus.textContent = `Deposit successful! TX: ${txHash.slice(0, 10)}...`;
                depositStatus.className = "deposit-status success";
                
                // Update balance
                await blockchainService.refreshChipBalance();
                this.updateWalletPanel();
                
                // Close modal after 3 seconds
                setTimeout(() => {
                    close();
                }, 3000);
            } catch (error: any) {
                console.error("Deposit failed:", error);
                depositStatus.textContent = `Deposit failed: ${error.message || error.toString()}`;
                depositStatus.className = "deposit-status error";
            } finally {
                depositBtn.disabled = false;
                depositBtn.textContent = "Deposit MON";
            }
        };

        closeBtn?.addEventListener("click", close);
        window.addEventListener("click", outsideClose);
        depositBtn?.addEventListener("click", handleDeposit);
        depositAmount?.addEventListener("input", this.updateChipPreview.bind(this));
    }

    private updateChipPreview() {
        const depositAmount = document.getElementById("deposit-amount") as HTMLInputElement;
        const chipAmount = document.getElementById("chip-amount") as HTMLElement;
        
        if (!depositAmount || !chipAmount) return;
        
        const monAmount = parseFloat(depositAmount.value) || 0;
        // 1 MON = 1000 CHIP, 0.1 MON = 100 CHIP
        const chipAmountValue = Math.floor(monAmount * 1000);
        chipAmount.textContent = `${chipAmountValue} CHIP`;
    }

    private toggleAutoMode() {
        const autoBtn = document.getElementById("auto-btn") as HTMLButtonElement;

        if (this.isAutoSpinning) {
            this.handleStopAuto();
            if (autoBtn) {
                autoBtn.textContent = "AUTO | OFF";
                autoBtn.style.background = "#333";
                autoBtn.style.color = "#fff";
            }
        } else {
            this.handleAutoSpin(10);
            if (autoBtn) {
                autoBtn.textContent = "AUTO | ON";
                autoBtn.style.background = "#ffd700";
                autoBtn.style.color = "#000";
            }
        }
    }

    public handleAutoSpin(spins: number) {
        this.isAutoSpinning = true;
        this.autoSpinTotal = spins;
        this.autoSpinCount = 0;
        this.updateControlPanel();

        setTimeout(() => {
            if (this.isAutoSpinning) {
                void this.handleStart();
            }
        }, 500);
    }

    public handleStopAuto() {
        this.isAutoSpinning = false;
        this.autoSpinCount = 0;
        this.autoSpinTotal = 0;

        const autoBtn = document.getElementById("auto-btn") as HTMLButtonElement;
        if (autoBtn) {
            autoBtn.textContent = "AUTO | OFF";
            autoBtn.style.background = "#333";
            autoBtn.style.color = "#fff";
        }

        this.updateControlPanel();
    }

    private handleAutoSpinComplete() {
        this.autoSpinCount += 1;

        if (this.autoSpinCount < this.autoSpinTotal && this.isAutoSpinning) {
            setTimeout(() => {
                if (this.isAutoSpinning) {
                    void this.handleStart();
                }
            }, 1000);
        } else {
            this.handleStopAuto();
        }
    }

    private toggleTurboMode() {
        this.isTurboMode = !this.isTurboMode;
        const turboBtn = document.getElementById("turbo-btn") as HTMLButtonElement;

        if (turboBtn) {
            if (this.isTurboMode) {
                turboBtn.textContent = "TURBO | ON";
                turboBtn.style.background = "#ff6b35";
                turboBtn.style.color = "#fff";
            } else {
                turboBtn.textContent = "TURBO | OFF";
                turboBtn.style.background = "#333";
                turboBtn.style.color = "#fff";
            }
        }
    }

    public async handleStart() {
        if (this.isSpinning) return;

        const wagerAmount = this.scoreboard.currentBet;
        const blockchainService = await this.getBlockchainService();
        const walletState = this.latestBlockchainState ?? blockchainService.getState();
        const usingBlockchain = walletState.connected && walletState.chipTokenConfigured && walletState.gameManagerConfigured;

        if (this.scoreboard.outOfMoney || !usingBlockchain) {
            alert("Connect your MetaMask wallet on Monad and ensure CHIP/GameManager addresses are configured.");
            return;
        }

        const onChainBalance = parseFloat(walletState.chipBalance);
        if (!Number.isFinite(onChainBalance) || onChainBalance < wagerAmount) {
            alert("Insufficient CHIP balance for this bet.");
            return;
        }

        this.isSpinning = true;
        this.updateControlPanel();

        if (!this.scoreboard.decrement()) {
            this.isSpinning = false;
            this.updateControlPanel();
            return;
        }

        slotRngEngine.beginSpin(wagerAmount);
        this.scoreboard.clearWin();
        const scenario = scenarioEngine.nextScenario();
        this.currentScenario = scenario;
        const targetGrid = scenario.grid;

        const betTokens = blockchainService.toTokenAmount(wagerAmount);
        // Don't calculate expectedPayoutTokens here - let the contract determine the payout
        // const multiplierBps = this.blockchainService.multiplierToBps(scenario.baseMultiplier);
        // const expectedPayoutTokens = this.blockchainService.payoutFromBasisPoints(betTokens, multiplierBps);

        let chainOutcome: { payout: bigint; txHash: string; payoutBps: bigint } | null = null;

        console.log("Playing scenario:", {
            scenarioId: scenario.id,
            category: scenario.category,
            baseMultiplier: scenario.baseMultiplier,
            betTokens: betTokens.toString(),
            // multiplierBps: multiplierBps.toString(),
            // expectedPayout: expectedPayoutTokens.toString()
        });

        try {
            chainOutcome = await blockchainService.playScenario({
                scenarioId: scenario.id,
                betAmountTokens: betTokens,
                // multiplierBps,
                // expectedPayoutTokens,
            });
        } catch (error) {
            console.error("Blockchain play failed", error);
            alert(`Transaction failed: ${(error as Error)?.message ?? "unknown error"}`);
            this.isSpinning = false;
            this.updateControlPanel();
            return;
        }

        try {
            const symbolGrid = await this.reelsContainer.spin(this.isTurboMode, targetGrid);
            const spinResult = evaluateSpin(symbolGrid, wagerAmount);
            const payoutNumber = chainOutcome
                ? blockchainService.tokenAmountToNumber(chainOutcome.payout)
                : spinResult.totalWin;
            spinResult.totalWin = payoutNumber;

            slotRngEngine.completeSpin({
                payout: spinResult.totalWin,
                primarySymbol: spinResult.primarySymbol,
                winningLines: spinResult.winningLines.length,
            });

            const updatedState = blockchainService.getState();
            const balanceNumber = parseFloat(updatedState.chipBalance);
            if (Number.isFinite(balanceNumber)) {
                this.scoreboard.setExternalBankroll(true);
                this.scoreboard.setBalance(balanceNumber);
                if (this.scoreboard.currentBet > this.scoreboard.balance) {
                    this.scoreboard.setBetFromExternal(this.scoreboard.balance);
                }
            }

            this.scoreboard.setLastWin(payoutNumber);

            if (chainOutcome && chainOutcome.payout > 0n) {
                this.victoryScreen.show();
            }

            this.logHistoryEntry(
                scenario,
                spinResult,
                wagerAmount,
                chainOutcome ? { txHash: chainOutcome.txHash } : undefined,
            );
        } finally {
            this.isSpinning = false;
            this.updateControlPanel();

            if (this.isAutoSpinning) {
                this.handleAutoSpinComplete();
            }
        }
    }

    private setupHistoryPanel() {
        this.historyListElement = document.getElementById("history-list") as HTMLUListElement;
        this.historyClearButton = document.getElementById("history-clear-btn") as HTMLButtonElement;

        if (this.historyClearButton) {
            this.historyClearButton.onclick = () => this.handleHistoryClear();
        }

        if (this.historyListElement) {
            this.historyListElement.innerHTML = "";
            this.historyEmptyElement = document.createElement("li");
            this.historyEmptyElement.className = "history-empty";
            this.historyEmptyElement.textContent = "Spins will appear here.";
            this.historyListElement.appendChild(this.historyEmptyElement);
        }
    }

    private handleHistoryClear() {
        if (!this.historyListElement) return;
        this.historyListElement.innerHTML = "";
        if (this.historyEmptyElement) {
            this.historyListElement.appendChild(this.historyEmptyElement);
        }
    }

    private logHistoryEntry(
        scenario: ScenarioResult,
        spinResult: SpinResult,
        wagerAmount: number,
        chainData?: ChainMetadata,
    ) {
        if (!this.historyListElement) return;

        if (this.historyEmptyElement && this.historyEmptyElement.parentElement === this.historyListElement) {
            this.historyListElement.removeChild(this.historyEmptyElement);
        }

        const historyItem = document.createElement("li");
        historyItem.classList.add("history-item");

        if (spinResult.totalWin > 0) {
            historyItem.classList.add("win");
        } else if (scenario.category === "partial") {
            historyItem.classList.add("partial");
        } else {
            historyItem.classList.add("lose");
        }

        const meta = document.createElement("div");
        meta.className = "history-meta";

        const idSpan = document.createElement("span");
        idSpan.textContent = `#${scenario.id}`;

        const categorySpan = document.createElement("span");
        categorySpan.className = `category ${scenario.category}`;
        categorySpan.textContent = scenario.category.replace(/_/g, " ").toUpperCase();

        meta.append(idSpan, categorySpan);
        historyItem.appendChild(meta);

        const payoff = document.createElement("div");
        payoff.className = "history-payoff";
        const formattedWin = this.formatCurrency(spinResult.totalWin);
        payoff.textContent = spinResult.totalWin > 0 ? `+${formattedWin}` : formattedWin;
        historyItem.appendChild(payoff);

        const details = document.createElement("div");
        details.className = "history-details";
        if (spinResult.winningLines.length > 0) {
            const linesSummary = spinResult.winningLines
                .map(line => `${line.symbol}×${line.count} (${this.formatCurrency(line.payout)})`)
                .join(" • ");
            details.innerHTML = `<strong>Lines:</strong> ${linesSummary}`;
        } else {
            details.textContent = "No winning lines";
        }
        historyItem.appendChild(details);

        const supplemental = document.createElement("div");
        supplemental.className = "history-details";
        const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false });
        supplemental.innerHTML = `<strong>Bet:</strong> ${this.formatCurrency(wagerAmount)}<br><strong>Time:</strong> ${timestamp}`;
        if (chainData?.txHash) {
            const shortHash = `${chainData.txHash.slice(0, 8)}…${chainData.txHash.slice(-6)}`;
            supplemental.innerHTML += `<br><strong>Tx:</strong> <a href="https://testnet.monadexplorer.com/tx/${chainData.txHash}" target="_blank" rel="noopener noreferrer">${shortHash}</a>`;
        }
        historyItem.appendChild(supplemental);

        if (this.historyListElement.firstChild) {
            this.historyListElement.insertBefore(historyItem, this.historyListElement.firstChild);
        } else {
            this.historyListElement.appendChild(historyItem);
        }

        this.trimHistory();
    }

    private trimHistory() {
        if (!this.historyListElement) return;
        while (this.historyListElement.children.length > this.historyMaxEntries) {
            const lastChild = this.historyListElement.lastElementChild;
            if (!lastChild) break;
            this.historyListElement.removeChild(lastChild);
        }
    }

    private async setupWalletPanel() {
        const connectBtn = document.getElementById("wallet-connect-btn") as HTMLButtonElement;

        if (connectBtn) {
            connectBtn.addEventListener("click", async () => {
                const blockchainService = await this.getBlockchainService();
                if (blockchainService.isConnecting()) return;
                connectBtn.disabled = true;
                connectBtn.textContent = "Connecting...";
                try {
                    await blockchainService.connect();
                    console.log("Wallet connected successfully");
                } catch (error) {
                    console.error("Wallet connection failed", error);
                    alert(`Wallet connection failed: ${(error as Error)?.message ?? "unknown error"}`);
                } finally {
                    this.updateWalletPanel();
                }
            });
        }

        const blockchainService = await this.getBlockchainService();
        blockchainService.subscribe((state: BlockchainState) => {
            this.latestBlockchainState = state;
            const usingExternal = state.connected && state.chipTokenConfigured;
            this.scoreboard.setExternalBankroll(usingExternal);
            if (usingExternal) {
                const balanceNumber = parseFloat(state.chipBalance);
                if (Number.isFinite(balanceNumber)) {
                    this.scoreboard.setBalance(balanceNumber);
                    if (this.scoreboard.currentBet > this.scoreboard.balance) {
                        this.scoreboard.setBetFromExternal(this.scoreboard.balance);
                    }
                }
            }
            this.updateWalletPanel(state);
        });
    }

    private async updateWalletPanel(state?: BlockchainState) {
        const walletState = state ?? this.latestBlockchainState ?? (await this.getBlockchainService()).getState();
        this.latestBlockchainState = walletState;

        const connectBtn = document.getElementById("wallet-connect-btn") as HTMLButtonElement;
        const addressEl = document.getElementById("wallet-address");
        const balanceWrapper = document.getElementById("wallet-balance-label");
        const balanceEl = document.getElementById("chip-balance");

        if (connectBtn) {
            if (walletState.connecting) {
                connectBtn.disabled = true;
                connectBtn.textContent = "Connecting...";
            } else if (walletState.connected) {
                connectBtn.disabled = true;
                connectBtn.textContent = "Wallet Connected";
            } else {
                connectBtn.disabled = false;
                connectBtn.textContent = "Connect Wallet";
            }
        }

        // Show/hide deposit button
        const depositBtn = document.getElementById("deposit-open-btn") as HTMLButtonElement;
        if (depositBtn) {
            depositBtn.style.display = walletState.connected ? "block" : "none";
        }

        if (addressEl) {
            addressEl.textContent = walletState.connected
                ? walletState.shortAddress ?? walletState.address ?? "Connected"
                : "Not Connected";
        }

        if (balanceWrapper && balanceWrapper.firstChild && balanceWrapper.firstChild.nodeType === Node.TEXT_NODE) {
            const symbolLabel = walletState.chipSymbol || "CHIP";
            balanceWrapper.firstChild.textContent = `${symbolLabel}: `;
        }

        if (balanceEl) {
            balanceEl.textContent = walletState.connected
                ? (walletState.chipTokenConfigured ? walletState.chipBalance : "N/A")
                : "0";
        }
    }

    private updateControlPanel() {
        const spinBtn = document.getElementById("spin-btn") as HTMLButtonElement;
        const creditValue = document.getElementById("credit-value");
        const betValue = document.getElementById("bet-value");
        const winText = document.getElementById("win-text");

        if (spinBtn) {
            spinBtn.disabled = this.isSpinning || (this.scoreboard && this.scoreboard.outOfMoney);
            spinBtn.classList.toggle("spinning", this.isSpinning);
        }

        if (creditValue) {
            creditValue.textContent = this.scoreboard ? this.scoreboard.balance.toString() : "0";
        }

        if (betValue) {
            betValue.textContent = this.scoreboard ? this.scoreboard.currentBet.toString() : "0";
        }

        if (winText) {
            winText.textContent = `WIN: ${this.formatCurrency(this.scoreboard ? this.scoreboard.lastWinAmount : 0)}`;
        }

        this.updateWalletPanel();
    }

    private formatCurrency(value: number | bigint): string {
        const numeric = typeof value === "bigint" ? Number(value) : value;
        if (!Number.isFinite(numeric)) {
            return "$0";
        }
        const abs = Math.abs(numeric);
        const fractionDigits = Number.isInteger(abs) ? 0 : 2;
        const formatted = abs.toLocaleString(undefined, {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        });
        return numeric < 0 ? `-$${formatted}` : `$${formatted}`;
    }
}
