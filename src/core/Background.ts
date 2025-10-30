import { Application, Container, Graphics } from "pixi.js";

export default class Background {
    public readonly sprite: Container;
    private readonly background: Graphics;

    constructor(app: Application) {
        this.sprite = new Container();
        
        // Background image removed - using solid color background only
        
        // Create black background as fallback
        this.background = new Graphics();
        this.background.rect(0, 0, app.screen.width, app.screen.height);
        this.background.fill(0x000000); // Black color
        
        this.sprite.addChild(this.background);
    }
}
