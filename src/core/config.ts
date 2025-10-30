export type PayoutTier = "low" | "medium" | "high" | "jackpot";

export interface SymbolConfig {
    difficulty: number;
    baseWeight: number;
    payoutTier: PayoutTier;
    volatilityScore: number;
}

export const SLOT_LAYOUT = {
    canvas: {
        width: 1280,
        height: 900,
    },
    reels: {
        count: 5,
        visibleRows: 6,
        width: 190,
        gap: 12,
        leftOffset: 40,
        symbolScale: 0.8,
    },
    spin: {
        shiftingDelay: 150,
        baseSpeed: 100,
        normalDelay: 300,
        turboDelay: 150,
    },
    rng: {
        targetRTP: 0.94,
        floorRTP: 0.9,
        ceilingRTP: 0.985,
        adjustmentStep: 0.65,
        minWeightMultiplier: 0.25,
        maxWeightMultiplier: 3.2,
        payoutTierScaling: {
            low: 0.45,
            medium: 0.85,
            high: 1.3,
            jackpot: 1.85,
        } as Record<PayoutTier, number>,
        streak: {
            trigger: 5,
            boostPerLoss: 0.18,
            maxBoost: 1.2,
        },
        trend: {
            window: 40,
            droughtThreshold: 0.28,
            droughtBoost: 0.45,
        },
    },
    symbols: {
        "1": { difficulty: 1, baseWeight: 420, payoutTier: "low", volatilityScore: 1 },
        "2": { difficulty: 2, baseWeight: 280, payoutTier: "low", volatilityScore: 1.05 },
        "3": { difficulty: 3, baseWeight: 180, payoutTier: "medium", volatilityScore: 1.1 },
        "4": { difficulty: 4, baseWeight: 90, payoutTier: "high", volatilityScore: 1.25 },
        "5": { difficulty: 5, baseWeight: 45, payoutTier: "high", volatilityScore: 1.35 },
        "wild": { difficulty: 6, baseWeight: 12, payoutTier: "jackpot", volatilityScore: 1.5 },
    } as Record<string, SymbolConfig>,
    payouts: {
        "1": { 3: 0.6, 4: 1.1, 5: 2.4, 6: 3.5 },
        "2": { 3: 0.9, 4: 1.8, 5: 3.6, 6: 5.5 },
        "3": { 3: 1.6, 4: 3.4, 5: 7.5, 6: 11 },
        "4": { 3: 2.8, 4: 6.4, 5: 14, 6: 22 },
        "5": { 3: 4.2, 4: 10.5, 5: 25, 6: 40 },
        "wild": { 3: 6, 4: 16, 5: 45, 6: 80 },
    },
    paylines: [
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2],
        [3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4],
        [5, 5, 5, 5, 5],
        [0, 1, 2, 3, 4],
        [1, 2, 3, 4, 5],
        [5, 4, 3, 2, 1],
        [4, 3, 2, 1, 0],
        [2, 1, 2, 1, 2],
        [3, 4, 3, 4, 3],
        [2, 3, 4, 3, 2],
        [3, 2, 1, 2, 3],
        [1, 2, 2, 2, 1],
        [4, 3, 3, 3, 4],
        [1, 0, 1, 0, 1],
        [4, 5, 4, 5, 4],
        [0, 1, 0, 1, 0],
        [5, 4, 5, 4, 5],
    ],
};

export type SlotLayout = typeof SLOT_LAYOUT;
export type SymbolKey = keyof typeof SLOT_LAYOUT.symbols;
