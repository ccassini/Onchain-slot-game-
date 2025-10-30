import { Application, Container } from "pixi.js";

export interface ScoreboardState {
    outOfMoney: boolean;
    bet: number;
    money: number;
    winAmount: number;
}

export default class Scoreboard {
    public container: Container;
    public outOfMoney = false;

    private readonly onStateChange?: (state: ScoreboardState) => void;

    private readonly minBet = 5;
    private readonly maxBet = 200;
    private readonly betStep = 5;

    private money = 100;
    private bet = 5;
    private currentWinAmount = 0;
    private cumulativeWinAmount = 0;
    private lastWager = this.bet;
    private externalBankroll = false;

    constructor(_app: Application, onStateChange?: (state: ScoreboardState) => void) {
        this.onStateChange = onStateChange;
        this.container = new Container();
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }

    public decrement(): boolean {
        if (this.money < this.bet) {
            this.updateOutOfMoneyFlag();
            this.notifyStateChange();
            return false;
        }

        if (!this.externalBankroll) {
            this.money -= this.bet;
        }

        this.lastWager = this.bet;
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
        return true;
    }

    public increment() {
        const payout = this.lastWager * 2;
        if (!this.externalBankroll) {
            this.money += payout;
        }
        this.currentWinAmount = payout;
        this.cumulativeWinAmount += payout;
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }
    
    public addWin(amount: number) {
        if (!this.externalBankroll) {
            this.money += amount;
        }
        this.currentWinAmount = amount;
        this.cumulativeWinAmount += amount;
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }

    public setBalance(amount: number) {
        const normalized = Number.isFinite(amount) ? amount : 0;
        this.money = Math.max(0, normalized);
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }

    public setLastWin(amount: number) {
        const normalized = Number.isFinite(amount) ? amount : 0;
        const win = Math.max(0, normalized);
        if (win > 0) {
            this.cumulativeWinAmount += win;
        }
        this.currentWinAmount = win;
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }

    public clearWin() {
        if (this.currentWinAmount === 0) return;
        this.currentWinAmount = 0;
        this.notifyStateChange();
    }

    public setExternalBankroll(enabled: boolean) {
        this.externalBankroll = enabled;
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }

    public get currentBet(): number {
        return this.bet;
    }

    public get balance(): number {
        return this.money;
    }

    public get lastWinAmount(): number {
        return this.currentWinAmount;
    }

    public get totalWinAmount(): number {
        return this.cumulativeWinAmount;
    }

    public canPlaceBet(): boolean {
        return this.money >= this.bet;
    }

    public adjustBet(direction: 1 | -1) {
        const target = this.bet + direction * this.betStep;
        this.setBet(target);
    }

    public setBetFromExternal(value: number) {
        this.setBet(value);
    }

    private setBet(value: number) {
        const clamped = this.clampBet(value);
        if (clamped === this.bet) return;

        this.bet = clamped;
        this.updateOutOfMoneyFlag();
        this.notifyStateChange();
    }

    private clampBet(value: number): number {
        if (value <= this.minBet) return this.minBet;
        if (value >= this.maxBet) return this.maxBet;
        const steps = Math.round(value / this.betStep);
        return Math.max(this.minBet, Math.min(this.maxBet, steps * this.betStep));
    }

    private updateOutOfMoneyFlag() {
        this.outOfMoney = this.money <= 0 || this.money < this.bet;
    }

    private notifyStateChange() {
        this.onStateChange?.({
            outOfMoney: this.outOfMoney,
            bet: this.bet,
            money: this.money,
            winAmount: this.currentWinAmount,
        });
    }
}

