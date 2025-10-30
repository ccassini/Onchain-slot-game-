import { SLOT_LAYOUT, SymbolKey } from "./config";

export interface SequenceWin {
    symbol: SymbolKey;
    count: number;
    multiplier: number;
}

export interface PaylineWin {
    id: string;
    symbol: SymbolKey;
    count: number;
    multiplier: number;
    payout: number;
}

export interface SpinResult {
    totalWin: number;
    winningLines: PaylineWin[];
    primarySymbol: SymbolKey | null;
}

export function evaluateSpin(symbolGrid: string[][], betAmount: number): SpinResult {
    const winningLines: PaylineWin[] = [];
    const { count: reelCount, visibleRows } = SLOT_LAYOUT.reels;

    SLOT_LAYOUT.paylines.forEach((line, index) => {
        if (line.length !== reelCount) return;
        const entries = line.map((row, reelIndex) => symbolGrid[row]?.[reelIndex]);
        const result = evaluateSequence(entries);
        if (!result) return;

        const payout = betAmount * result.multiplier;
        winningLines.push({
            id: `payline-${index + 1}`,
            symbol: result.symbol,
            count: result.count,
            multiplier: result.multiplier,
            payout,
        });
    });

    for (let column = 0; column < reelCount; column++) {
        const columnEntries = [];
        for (let row = 0; row < visibleRows; row++) {
            columnEntries.push(symbolGrid[row]?.[column]);
        }
        const result = evaluateSequence(columnEntries);
        if (!result) continue;

        const payout = betAmount * result.multiplier;
        winningLines.push({
            id: `column-${column + 1}`,
            symbol: result.symbol,
            count: result.count,
            multiplier: result.multiplier,
            payout,
        });
    }

    const totalWin = winningLines.reduce((sum, line) => sum + line.payout, 0);
    const primaryLine = winningLines.reduce<PaylineWin | null>((highest, current) => {
        if (!highest) return current;
        return current.payout > highest.payout ? current : highest;
    }, null);

    return {
        totalWin,
        winningLines,
        primarySymbol: primaryLine ? primaryLine.symbol : null,
    };
}

export function evaluateSequence(sequence: Array<string | undefined>): SequenceWin | null {
    const normalisedSequence = sequence.map(value => {
        if (value === undefined || !(value in SLOT_LAYOUT.symbols)) {
            return null;
        }
        return value as SymbolKey;
    });

    let primarySymbol: SymbolKey | null = null;
    let count = 0;

    for (const symbol of normalisedSequence) {
        if (symbol === null) break;

        if (!primarySymbol && symbol !== "wild") {
            primarySymbol = symbol;
        }

        if (symbol === "wild" || symbol === primarySymbol || (!primarySymbol && symbol === "wild")) {
            count += 1;
        } else {
            break;
        }
    }

    if (count < 3) return null;

    if (!primarySymbol) {
        primarySymbol = "wild";
    }

    const multiplier = resolveMultiplier(primarySymbol, count);
    if (multiplier <= 0) {
        return null;
    }

    return {
        symbol: primarySymbol,
        count,
        multiplier,
    };
}

export function resolveMultiplier(symbol: SymbolKey, count: number): number {
    const payoutTable = SLOT_LAYOUT.payouts[symbol];
    if (!payoutTable) return 0;

    const thresholds = Object.keys(payoutTable)
        .map(key => Number(key))
        .sort((a, b) => a - b);

    let multiplier = 0;
    for (const threshold of thresholds) {
        if (count >= threshold) {
            const key = String(threshold) as keyof typeof payoutTable;
            multiplier = payoutTable[key];
        }
    }

    return multiplier;
}
