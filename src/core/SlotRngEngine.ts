import { SLOT_LAYOUT, SymbolConfig, SymbolKey } from "./config";

interface SpinSummary {
    payout: number;
    primarySymbol: SymbolKey | null;
    winningLines: number;
}

class SlotRngEngine {
    private totalWagered = 0;
    private totalPaid = 0;
    private lossStreak = 0;
    private recentResults: number[] = [];

    beginSpin(betAmount: number) {
        this.totalWagered += betAmount;
    }

    completeSpin(summary: SpinSummary) {
        this.totalPaid += summary.payout;
        if (summary.payout > 0) {
            this.lossStreak = 0;
        } else {
            this.lossStreak += 1;
        }

        this.recentResults.push(summary.payout);
        const { window } = SLOT_LAYOUT.rng.trend;
        if (this.recentResults.length > window) {
            this.recentResults.splice(0, this.recentResults.length - window);
        }
    }

    getNextSymbol(): SymbolKey {
        const distributions = this.computeWeights();
        const totalWeight = distributions.reduce((sum, entry) => sum + entry.weight, 0);
        let pointer = Math.random() * totalWeight;

        for (const entry of distributions) {
            pointer -= entry.weight;
            if (pointer <= 0) {
                return entry.key;
            }
        }

        return distributions[distributions.length - 1].key;
    }

    private computeWeights(): Array<{ key: SymbolKey; weight: number }> {
        const config = SLOT_LAYOUT.rng;
        const entries = Object.entries(SLOT_LAYOUT.symbols) as Array<[SymbolKey, SymbolConfig]>;

        const currentRTP = this.currentRTP;
        const diff = currentRTP - config.targetRTP;
        const payingTooMuch = diff > 0;
        const range = payingTooMuch ? config.ceilingRTP - config.targetRTP : config.targetRTP - config.floorRTP;
        const normalizedDiff = range > 0 ? Math.min(Math.abs(diff) / range, 1) : 0;

        const recentWinRate = this.recentWinRate;
        const droughtFactor = recentWinRate < config.trend.droughtThreshold
            ? 1 + (config.trend.droughtThreshold - recentWinRate) * config.trend.droughtBoost
            : 1;

        const lossStreakBoost = this.lossStreak >= config.streak.trigger
            ? Math.min(
                (this.lossStreak - config.streak.trigger + 1) * config.streak.boostPerLoss,
                config.streak.maxBoost,
            )
            : 0;

        return entries.map(([key, symbol]) => {
            const tierScale = config.payoutTierScaling[symbol.payoutTier];
            let adjustment = 1;

            if (normalizedDiff > 0) {
                const step = config.adjustmentStep * normalizedDiff * tierScale;
                adjustment += payingTooMuch ? -step : step;
            }

            if (lossStreakBoost > 0) {
                if (symbol.payoutTier !== "low") {
                    adjustment += lossStreakBoost * (tierScale / config.payoutTierScaling.high);
                } else {
                    adjustment -= lossStreakBoost * 0.25;
                }
            }

            if (symbol.payoutTier !== "low" && droughtFactor > 1) {
                adjustment *= 1 + (droughtFactor - 1) * tierScale;
            } else if (symbol.payoutTier === "low" && payingTooMuch) {
                adjustment *= 1 + normalizedDiff * 0.15;
            }

            adjustment = Math.max(config.minWeightMultiplier, Math.min(config.maxWeightMultiplier, adjustment));

            const weight = Math.max(1, symbol.baseWeight * adjustment * symbol.volatilityScore);
            return { key, weight };
        });
    }

    private get currentRTP(): number {
        if (this.totalWagered <= 0) return SLOT_LAYOUT.rng.targetRTP;
        return this.totalPaid / this.totalWagered;
    }

    private get recentWinRate(): number {
        if (!this.recentResults.length) return 0;
        const wins = this.recentResults.filter(value => value > 0).length;
        return wins / this.recentResults.length;
    }
}

export const slotRngEngine = new SlotRngEngine();
