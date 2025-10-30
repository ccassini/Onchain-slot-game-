import { Application, Container, Graphics, Sprite, Assets } from "pixi.js";
import Reel from "./Reel";
import { SLOT_LAYOUT, SymbolKey } from "./config";

export default class ReelsContainer {
    public readonly reels: Array<Reel> = [];
    public readonly container: Container;
    private backgroundFrame?: Graphics;
    private paylines: Array<Sprite> = [];

    constructor(app: Application) {
        const { leftOffset, count } = SLOT_LAYOUT.reels;
        this.container = new Container();

        for (let i = 0; i < count; i++) {
            const reel = new Reel(app, i);
            this.reels.push(reel);
            this.container.addChild(reel.container);
        }

        this.container.x = leftOffset;
        this.createDecorations();
    }

    async spin(isTurboMode: boolean = false, targetGrid?: string[][]): Promise<string[][]> {
        // Overall time of spinning = shiftingDelay * this.reels.length
        //
        const shiftingDelay = isTurboMode ? SLOT_LAYOUT.spin.turboDelay : SLOT_LAYOUT.spin.normalDelay;
        const start = Date.now();
        const reelsToSpin = [...this.reels];
        const scenarioGrid = targetGrid ? targetGrid.map(row => [...row]) : null;

        for await (let _ of this.infiniteSpinning(reelsToSpin)) {
            const shiftingWaitTime = (this.reels.length - reelsToSpin.length + 1) * shiftingDelay;

            if (Date.now() >= start + shiftingWaitTime) {
                const stoppedReel = reelsToSpin.shift();
                if (stoppedReel && scenarioGrid) {
                    const reelIndex = this.reels.indexOf(stoppedReel);
                    if (reelIndex >= 0) {
                        this.applyScenarioColumn(stoppedReel, reelIndex, scenarioGrid);
                    }
                }
            }

            if (!reelsToSpin.length) break;
        }

        if (scenarioGrid) {
            this.applySymbolGrid(scenarioGrid);
            return scenarioGrid;
        }

        return this.getVisibleSymbols();
    }

    private async* infiniteSpinning(reelsToSpin: Array<Reel>) {
        while (true) {
            const spinningPromises = reelsToSpin.map(reel => reel.spinOneTime());
            await Promise.all(spinningPromises);
            this.blessRNG();
            yield;
        }
    }

    private blessRNG() {
        this.reels.forEach(reel => {
            reel.refreshTopSymbol();
        });
    }
    
    public getVisibleSymbols(): string[][] {
        const { visibleRows } = SLOT_LAYOUT.reels;
        const symbols: string[][] = [];
        
        for (let row = 0; row < visibleRows; row++) {
            const rowSymbols: string[] = [];
            this.reels.forEach(reel => {
                const sprite = reel.getVisibleSymbol(row);
                const symbolName = typeof sprite.name === "string" ? sprite.name : "1";
                rowSymbols.push(symbolName);
            });
            symbols.push(rowSymbols);
        }
        
        return symbols;
    }

    private applySymbolGrid(grid: string[][]) {
        const { count: reelCount, visibleRows } = SLOT_LAYOUT.reels;
        for (let reelIndex = 0; reelIndex < reelCount; reelIndex++) {
            const symbols: string[] = [];
            for (let rowIndex = 0; rowIndex < visibleRows; rowIndex++) {
                const symbolName = grid[rowIndex]?.[reelIndex] ?? "1";
                symbols.push(symbolName);
            }
            const typedSymbols = symbols.map(symbol => symbol as SymbolKey);
            this.reels[reelIndex].setVisibleSymbols(typedSymbols);
        }
    }

    private applyScenarioColumn(reel: Reel, reelIndex: number, grid: string[][]) {
        const { visibleRows } = SLOT_LAYOUT.reels;
        const columnSymbols: SymbolKey[] = [];

        for (let rowIndex = 0; rowIndex < visibleRows; rowIndex++) {
            const symbolName = grid[rowIndex]?.[reelIndex] ?? "1";
            columnSymbols.push(symbolName as SymbolKey);
        }

        reel.setVisibleSymbols(columnSymbols);
        reel.setBufferSymbol(columnSymbols[0]);
    }

    private createDecorations() {
        if (!this.reels.length) return;

        const firstReel = this.reels[0];
        const lastReel = this.reels[this.reels.length - 1];
        const visibleSymbols = firstReel.getVisibleSymbols();

        if (!visibleSymbols.length) return;

        const firstTopSymbol = visibleSymbols[0];
        const firstBottomSymbol = visibleSymbols[visibleSymbols.length - 1];
        const lastTopSymbol = lastReel.getVisibleSymbols()[0];

        const leftEdge = firstReel.container.x + firstTopSymbol.x;
        const rightEdge = lastReel.container.x + lastTopSymbol.x + lastTopSymbol.width;
        const topEdge = firstTopSymbol.y;
        const bottomEdge = firstBottomSymbol.y + firstBottomSymbol.height;

        const paddingX = 32;
        const paddingY = 28;

        const background = new Graphics()
            .roundRect(
                leftEdge - paddingX,
                topEdge - paddingY,
                rightEdge - leftEdge + paddingX * 2,
                bottomEdge - topEdge + paddingY * 2,
                36
            )
            .fill({ color: 0x000000, alpha: 0.96 })
            .stroke({ color: 0xf6cf57, width: 8 });

        const innerFrame = new Graphics()
            .roundRect(
                leftEdge - paddingX + 10,
                topEdge - paddingY + 10,
                rightEdge - leftEdge + (paddingX - 10) * 2,
                bottomEdge - topEdge + (paddingY - 10) * 2,
                26
            )
            .stroke({ color: 0xf6cf57, width: 3, alpha: 1.0 });

        this.container.addChildAt(background, 0);
        this.container.addChildAt(innerFrame, 1);
        this.backgroundFrame = background;

        // this.createPaylines(leftEdge, rightEdge, visibleSymbols);
    }

    private createPaylines(leftEdge: number, rightEdge: number, symbols: Array<Sprite>) {
        // Paylines functionality removed - no longer using atlas textures
        // This method is kept for potential future implementation with individual assets
    }
}
