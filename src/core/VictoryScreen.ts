import { Application, Container, Graphics, TextStyle, Text } from "pixi.js";
import { SLOT_LAYOUT } from "./config";

export default class VictoryScreen {
    public container: Container;
    private overlay: Graphics;

    constructor(app: Application) {
        this.container = new Container();
        this.generate(app.screen.width, app.screen.height);
    }

    show() {
        this.container.visible = true;
        const id = window.setTimeout(this.hide.bind(this), 3000);
        const handler = () => {
            window.clearTimeout(id);
            this.hide();
        };
        this.overlay.addListener("pointerdown", handler.bind(this));
    }

    hide() {
        this.container.visible = false;
    }

    private generate(appWidth: number, appHeight: number) {
        this.container.visible = false;

        this.overlay = new Graphics()
            .rect(0, 0, appWidth, appHeight)
            .fill({ color: 0xffffff, alpha: 0.001 });

        this.overlay.interactive = true;
        this.overlay.eventMode = "static";
        this.overlay.cursor = "default";

        const { leftOffset, width, gap, count } = SLOT_LAYOUT.reels;
        const reelsWidth = count * width + (count - 1) * gap;
        const rectWidth = Math.min(reelsWidth, appWidth - leftOffset * 2);
        const rectHeight = appHeight * 0.6;
        const rect = new Graphics()
            .rect(0, 0, rectWidth, rectHeight)
            .fill({ color: 0x02474E, alpha: 0.8 });
        rect.x = leftOffset;
        rect.y = (appHeight - rectHeight) / 2;

        const style = new TextStyle({
            fontFamily: "Arial",
            fontSize: 96,
            fill: "yellow",
        });

        const text = new Text({ text: "YOU WON!", style });
        text.x = rect.x + (rectWidth - text.width) / 2;
        text.y = rect.y + (rectHeight - text.height) / 2;

        this.container.addChild(rect, text, this.overlay);
    }
}
