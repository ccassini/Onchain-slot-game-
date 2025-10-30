import { Application, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { SLOT_LAYOUT } from "./config";

export default class PlayButton {
    public readonly sprite: Sprite;
    private readonly onClick: () => void;
    private readonly activeGraphics: Graphics;
    private readonly disabledGraphics: Graphics;

    constructor(app: Application, onClick: () => void) {
        this.onClick = onClick;
        this.activeGraphics = this.createButtonGraphics(0x4CAF50); // Green
        this.disabledGraphics = this.createButtonGraphics(0x666666); // Gray
        this.sprite = new Sprite();
        this.sprite.addChild(this.activeGraphics);
        this.init(app.screen.width, app.screen.height);
    }

    setEnabled() {
        this.sprite.removeChildren();
        this.sprite.addChild(this.activeGraphics);
        this.sprite.interactive = true;
    }

    setDisabled() {
        this.sprite.removeChildren();
        this.sprite.addChild(this.disabledGraphics);
        this.sprite.interactive = false;
    }

    private createButtonGraphics(color: number): Graphics {
        const graphics = new Graphics();
        graphics.roundRect(0, 0, 120, 50, 8);
        graphics.fill(color);
        graphics.stroke({ width: 2, color: 0xFFFFFF });
        
        // Add text
        const textStyle = new TextStyle({
            fontSize: 18,
            fill: 0xFFFFFF,
            fontWeight: "bold"
        });
        const text = new Text({ text: "SPIN", style: textStyle });
        text.x = 60 - text.width / 2;
        text.y = 25 - text.height / 2;
        graphics.addChild(text);
        
        return graphics;
    }

    private init(appWidth: number, appHeight: number) {
        const marginRight = Math.max(SLOT_LAYOUT.reels.gap * 2, 40);
        const marginBottom = 60;
        this.sprite.x = appWidth - this.sprite.width - marginRight;
        this.sprite.y = appHeight - this.sprite.height - marginBottom;
        this.sprite.interactive = true;
        this.sprite.eventMode = "static";
        this.sprite.addListener("pointerdown", this.onClick);
    }
}
