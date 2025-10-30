import { SLOT_LAYOUT, SymbolKey } from "./config";
import { evaluateSpin, resolveMultiplier, PaylineWin } from "./SpinEvaluator";

type ScenarioCategory = "loss" | "partial" | "win_low" | "win_mid" | "win_high";

interface PatternDefinition {
    type: "payline" | "column";
    symbol: SymbolKey;
    count: number;
}

interface ScenarioDefinition {
    id: number;
    category: ScenarioCategory;
    seed: number;
}

interface ScenarioResult {
    id: number;
    category: ScenarioCategory;
    grid: string[][];
    baseMultiplier: number;
}

type Prng = () => number;

const TOTAL_SCENARIOS = 100_000;
const LOSS_SCENARIOS = 50_000;
const PARTIAL_SCENARIOS = 30_000;
const WIN_LOW_SCENARIOS = 12_000;
const WIN_MID_SCENARIOS = 6_000;
const WIN_HIGH_SCENARIOS = 2_000;

const SYMBOL_KEYS = Object.keys(SLOT_LAYOUT.symbols) as SymbolKey[];

const PARTIAL_PATTERNS: PatternDefinition[] = [
    { type: "payline", symbol: "1", count: 3 },
    { type: "payline", symbol: "2", count: 3 },
    { type: "column", symbol: "1", count: 3 },
    { type: "column", symbol: "2", count: 3 },
];

const WIN_LOW_PATTERNS: PatternDefinition[] = [
    { type: "payline", symbol: "1", count: 4 },
    { type: "payline", symbol: "2", count: 4 },
    { type: "payline", symbol: "3", count: 3 },
    { type: "column", symbol: "1", count: 5 },
    { type: "column", symbol: "2", count: 4 },
];

const WIN_MID_PATTERNS: PatternDefinition[] = [
    { type: "payline", symbol: "wild", count: 3 },
    { type: "payline", symbol: "4", count: 4 },
    { type: "payline", symbol: "5", count: 4 },
    { type: "column", symbol: "3", count: 5 },
    { type: "column", symbol: "4", count: 5 },
];

const WIN_HIGH_PATTERNS: PatternDefinition[] = [
    { type: "payline", symbol: "5", count: 5 },
    { type: "column", symbol: "4", count: 6 },
    { type: "column", symbol: "5", count: 6 },
    { type: "column", symbol: "wild", count: 4 },
    { type: "column", symbol: "wild", count: 5 },
    { type: "column", symbol: "wild", count: 6 },
];

class ScenarioEngine {
    private readonly deck: ScenarioDefinition[];
    private cursor = 0;

    constructor() {
        const basePrng = createPrng(0xc0deface);
        this.deck = buildScenarioDefinitions(basePrng);
    }

    nextScenario(): ScenarioResult {
        // Rastgele scenario seç
        const randomIndex = Math.floor(Math.random() * this.deck.length);
        const definition = this.deck[randomIndex];

        const scenarioPrng = createPrng(definition.seed);
        const { grid, multiplier } = buildScenarioGrid(definition.category, scenarioPrng);

        // 100k scenario'dan rastgele bir ID oluştur (0-99999 arası)
        const randomScenarioId = Math.floor(Math.random() * 100000);
        
        return {
            id: randomScenarioId,
            category: definition.category,
            grid,
            baseMultiplier: multiplier,
        };
    }
}

export const scenarioEngine = new ScenarioEngine();

function buildScenarioDefinitions(prng: Prng): ScenarioDefinition[] {
    const declaredTotal = LOSS_SCENARIOS + PARTIAL_SCENARIOS + WIN_LOW_SCENARIOS + WIN_MID_SCENARIOS + WIN_HIGH_SCENARIOS;
    if (declaredTotal !== TOTAL_SCENARIOS) {
        throw new Error("Scenario distribution does not match total scenario count");
    }

    const categories: ScenarioCategory[] = [];
    pushMany(categories, "loss", LOSS_SCENARIOS);
    pushMany(categories, "partial", PARTIAL_SCENARIOS);
    pushMany(categories, "win_low", WIN_LOW_SCENARIOS);
    pushMany(categories, "win_mid", WIN_MID_SCENARIOS);
    pushMany(categories, "win_high", WIN_HIGH_SCENARIOS);

    shuffle(categories, prng);

    return categories.map((category, index) => ({
        id: index,
        category,
        seed: prngInt32(prng),
    }));
}

function buildScenarioGrid(category: ScenarioCategory, prng: Prng) {
    const pattern = pickPatternForCategory(category, prng);
    const expectedMultiplier = pattern ? resolveMultiplier(pattern.symbol, pattern.count) : 0;
    const maxAttempts = 200;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const baseGrid = createBaseGrid(prng, { excludeSymbol: pattern?.symbol });
        const grid = baseGrid.map(row => [...row]);

        if (pattern) {
            if (!applyPattern(grid, pattern, prng)) {
                continue;
            }
        }

        const evaluation = evaluateSpin(grid, 1);
        if (pattern) {
            if (almostEqual(evaluation.totalWin, expectedMultiplier)) {
                return { grid, multiplier: expectedMultiplier };
            }
        } else if (evaluation.totalWin === 0) {
            return { grid, multiplier: 0 };
        }
    }

    return createFallbackScenario(category, pattern, expectedMultiplier, prng);
}

function pickPatternForCategory(category: ScenarioCategory, prng: Prng): PatternDefinition | null {
    switch (category) {
        case "loss":
            return null;
        case "partial":
            return randomElement(PARTIAL_PATTERNS, prng);
        case "win_low":
            return randomElement(WIN_LOW_PATTERNS, prng);
        case "win_mid":
            return randomElement(WIN_MID_PATTERNS, prng);
        case "win_high":
            return randomElement(WIN_HIGH_PATTERNS, prng);
        default:
            return null;
    }
}

function applyPattern(grid: string[][], pattern: PatternDefinition, prng: Prng, preserveBase = false): boolean {
    const { count: reelCount, visibleRows } = SLOT_LAYOUT.reels;
    if (pattern.type === "payline") {
        if (pattern.count > reelCount) return false;
        const paylineIndex = Math.floor(prng() * SLOT_LAYOUT.paylines.length);
        const payline = SLOT_LAYOUT.paylines[paylineIndex];
        if (!payline || payline.length !== reelCount) return false;

        const filler = () => selectFillerSymbol(pattern.symbol, prng);

        for (let reel = 0; reel < payline.length; reel++) {
            const row = payline[reel];
            if (reel < pattern.count) {
                grid[row][reel] = pattern.symbol;
            } else if (!preserveBase || grid[row][reel] === pattern.symbol || grid[row][reel] === "wild") {
                grid[row][reel] = filler();
            }
        }
        return true;
    }

    if (pattern.count > visibleRows) return false;
    const columnIndex = Math.floor(prng() * reelCount);
    const filler = () => selectFillerSymbol(pattern.symbol, prng);

    for (let row = 0; row < visibleRows; row++) {
        if (row < pattern.count) {
            grid[row][columnIndex] = pattern.symbol;
        } else if (!preserveBase || grid[row][columnIndex] === pattern.symbol || grid[row][columnIndex] === "wild") {
            grid[row][columnIndex] = filler();
        }
    }
    return true;
}

function createBaseGrid(prng: Prng, options?: { excludeSymbol?: SymbolKey }): string[][] {
    const { excludeSymbol } = options ?? {};
    const { count: reelCount, visibleRows } = SLOT_LAYOUT.reels;
    const pool = SYMBOL_KEYS.filter(symbol => symbol !== excludeSymbol && symbol !== "wild");

    if (!pool.length) {
        pool.push(excludeSymbol ?? SYMBOL_KEYS[0]);
    }

    const grid: string[][] = [];
    let symbolPointer = Math.floor(prng() * pool.length);

    for (let row = 0; row < visibleRows; row++) {
        const rowValues: string[] = [];
        for (let reel = 0; reel < reelCount; reel++) {
            rowValues.push(pool[symbolPointer % pool.length]);
            symbolPointer += 1;
        }
        grid.push(rowValues);
    }

    return grid;
}

function createFallbackScenario(
    category: ScenarioCategory,
    pattern: PatternDefinition | null,
    expectedMultiplier: number,
    prng: Prng
): { grid: string[][]; multiplier: number } {
    const baseGrid = createBaseGrid(prng, { excludeSymbol: pattern?.symbol });
    const grid = baseGrid.map(row => [...row]);

    if (pattern) {
        applyPattern(grid, pattern, prng, true);
        neutraliseExtraneousWins(grid, pattern, expectedMultiplier, prng);
        return {
            grid,
            multiplier: expectedMultiplier,
        };
    }

    neutraliseLossGrid(grid, prng);
    return {
        grid,
        multiplier: 0,
    };
}

function neutraliseExtraneousWins(
    grid: string[][],
    pattern: PatternDefinition,
    expectedMultiplier: number,
    prng: Prng
) {
    for (let attempt = 0; attempt < 64; attempt++) {
        const evaluation = evaluateSpin(grid, 1);
        const desiredWins = evaluation.winningLines.filter(
            line =>
                line.symbol === pattern.symbol &&
                line.multiplier === expectedMultiplier &&
                line.count === pattern.count
        );

        const undesiredWins = evaluation.winningLines.filter(
            line =>
                line.symbol !== pattern.symbol ||
                line.multiplier !== expectedMultiplier ||
                line.count !== pattern.count
        );

        if (!undesiredWins.length && desiredWins.length === 1 && almostEqual(evaluation.totalWin, expectedMultiplier)) {
            return;
        }

        if (undesiredWins.length) {
            disruptLine(grid, undesiredWins[0], prng);
            applyPattern(grid, pattern, prng, true);
            continue;
        }

        if (desiredWins.length > 1) {
            disruptLine(grid, desiredWins[1], prng);
            applyPattern(grid, pattern, prng, true);
            continue;
        }

        applyPattern(grid, pattern, prng, true);
    }
}

function neutraliseLossGrid(grid: string[][], prng: Prng) {
    for (let attempt = 0; attempt < 64; attempt++) {
        const evaluation = evaluateSpin(grid, 1);
        if (evaluation.totalWin === 0) {
            return;
        }
        const offender = evaluation.winningLines[0];
        if (!offender) break;
        disruptLine(grid, offender, prng);
    }

    if (evaluateSpin(grid, 1).totalWin === 0) {
        return;
    }

    const fallback = createBaseGrid(prng);
    for (let row = 0; row < fallback.length; row++) {
        for (let col = 0; col < fallback[row].length; col++) {
            grid[row][col] = fallback[row][col];
        }
    }
}

function disruptLine(grid: string[][], line: PaylineWin, prng: Prng) {
    if (line.id.startsWith("column-")) {
        const columnIndex = parseInt(line.id.split("-")[1], 10) - 1;
        if (Number.isNaN(columnIndex) || columnIndex < 0) return;
        const breakRow = Math.min(line.count - 1, grid.length - 1);
        if (breakRow < 0) return;
        grid[breakRow][columnIndex] = selectFillerSymbol(line.symbol, prng);
        return;
    }

    if (line.id.startsWith("payline-")) {
        const paylineIndex = parseInt(line.id.split("-")[1], 10) - 1;
        if (Number.isNaN(paylineIndex) || paylineIndex < 0) return;
        const payline = SLOT_LAYOUT.paylines[paylineIndex];
        if (!payline) return;
        const breakReel = Math.min(line.count - 1, payline.length - 1);
        if (breakReel < 0) return;
        const row = payline[breakReel];
        grid[row][breakReel] = selectFillerSymbol(line.symbol, prng);
    }
}

function selectFillerSymbol(patternSymbol: SymbolKey, prng: Prng): SymbolKey {
    const exclusions = [patternSymbol, "wild"];
    const choices = SYMBOL_KEYS.filter(symbol => !exclusions.includes(symbol));
    if (!choices.length) {
        return SYMBOL_KEYS.find(symbol => symbol !== patternSymbol) ?? patternSymbol;
    }
    const index = Math.floor(prng() * choices.length);
    return choices[index];
}

function randomElement<T>(items: T[], prng: Prng): T {
    const index = Math.floor(prng() * items.length);
    return items[index];
}

function pushMany(target: ScenarioCategory[], value: ScenarioCategory, count: number) {
    for (let i = 0; i < count; i++) {
        target.push(value);
    }
}

function shuffle(items: ScenarioCategory[], prng: Prng) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
}

function almostEqual(a: number, b: number) {
    return Math.abs(a - b) < 1e-6;
}

function prngInt32(prng: Prng): number {
    return Math.floor(prng() * 0xffffffff);
}

function createPrng(seed: number): Prng {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export type { ScenarioResult, ScenarioCategory };
