import { Application, Assets, Container, Sprite, Texture, Ticker } from "pixi.js";
import { SLOT_LAYOUT, SymbolKey } from "./config";
import { slotRngEngine } from "./SlotRngEngine";

export default class Reel {
    public readonly container: Container;
    public sprites: Array<Sprite> = [];
    private readonly appHeight: number;
    private readonly ticker: Ticker;
    private readonly visibleRows = SLOT_LAYOUT.reels.visibleRows;
    private readonly textureMap: Record<string, Texture>;
    private readonly defaultTexture: Texture;
    private rowGap = 0;
    private rowPadding = 0;

    constructor(app: Application, position: number) {
        this.appHeight = app.screen.height;
        this.ticker = app.ticker;
        this.container = new Container();
        this.textureMap = {
            "1": Assets.get("1.png"),
            "2": Assets.get("2.png"),
            "3": Assets.get("3.png"),
            "4": Assets.get("4.png"),
            "5": Assets.get("5.png"),
            "wild": Assets.get("wild.png"),
        };
        this.defaultTexture = this.textureMap["1"];
        this.generate(position);
    }

    private generate(position: number) {
        const { width: reelWidth, gap, symbolScale } = SLOT_LAYOUT.reels;
        const horizontalStep = reelWidth + gap;
        this.container.x = position * horizontalStep;

        const topSymbol = this.createSymbol(symbolScale);
        const gapBetweenRows = Math.max(
            (this.appHeight - topSymbol.height * this.visibleRows) / this.visibleRows,
            0
        );
        const cellHeight = topSymbol.height + gapBetweenRows;
        const paddingTop = gapBetweenRows / 2;

        this.rowGap = gapBetweenRows;
        this.rowPadding = paddingTop;

        topSymbol.x = (reelWidth - topSymbol.width) / 2;
        topSymbol.y = -cellHeight + paddingTop;
        this.sprites.push(topSymbol);
        this.container.addChild(topSymbol);

        for (let i = 1; i < this.visibleRows + 1; i++) {
            const symbol = this.createSymbol(symbolScale);
            symbol.x = (reelWidth - symbol.width) / 2;
            symbol.y = (i - 1) * cellHeight + paddingTop;
            this.sprites.push(symbol);
            this.container.addChild(symbol);
        }
    }

    spinOneTime() {
        let speed = SLOT_LAYOUT.spin.baseSpeed;
        let doneRunning = false;
        const yOffset = this.rowPadding;

        return new Promise<void>(resolve => {
            const tick = () => {
                for (let i = this.sprites.length - 1; i >= 0; i--) {
                    const symbol = this.sprites[i];

                    if (symbol.y + speed > this.appHeight + yOffset) {
                        doneRunning = true;
                        speed = this.appHeight - symbol.y + yOffset;
                        symbol.y = -(symbol.height + yOffset);
                    } else {
                        symbol.y += speed;
                    }

                    if (i === 0 && doneRunning) {
                        let t = this.sprites.pop();
                        if (t) this.sprites.unshift(t);
                        this.ticker.remove(tick);
                        resolve();
                    }
                }
            }

            this.ticker.add(tick);
        });
    }

    public getVisibleSymbol(rowIndex: number): Sprite {
        return this.getVisibleSymbols()[rowIndex];
    }

    public getVisibleSymbols(): Array<Sprite> {
        return this.sprites.slice(1, this.visibleRows + 1);
    }

    public refreshTopSymbol() {
        if (!this.sprites.length) return;
        const topSprite = this.sprites[0];
        this.applySymbol(topSprite, this.getRandomSymbolKey());
    }

    public setVisibleSymbols(symbols: SymbolKey[]) {
        const visible = this.getVisibleSymbols();
        for (let i = 0; i < visible.length; i++) {
            const sprite = visible[i];
            const symbolKey = symbols[i];
            if (!sprite || !symbolKey) continue;
            this.applySymbol(sprite, symbolKey);
        }
    }

    public setBufferSymbol(symbolKey: SymbolKey) {
        if (!this.sprites.length) return;
        this.applySymbol(this.sprites[0], symbolKey);
    }

    public setSymbolForRow(rowIndex: number, symbolKey: SymbolKey) {
        const visible = this.getVisibleSymbols();
        const sprite = visible[rowIndex];
        if (!sprite) return;
        this.applySymbol(sprite, symbolKey);
    }

    private createSymbol(scale: number): Sprite {
        const sprite = new Sprite(this.defaultTexture);
        sprite.scale.set(scale);
        this.applySymbol(sprite, this.getRandomSymbolKey());
        return sprite;
    }

    private getRandomSymbolKey(): SymbolKey {
        return slotRngEngine.getNextSymbol();
    }

    private applySymbol(sprite: Sprite, symbolKey: SymbolKey) {
        sprite.texture = this.getTexture(symbolKey);
        sprite.name = symbolKey;
    }

    private getTexture(symbolKey: SymbolKey): Texture {
        return this.textureMap[symbolKey] ?? this.defaultTexture;
    }
}
