import { Application, Assets, Text, TextStyle } from "pixi.js"

export default class Loader {
    private loadingScreen: Text;
    private app: Application;

    constructor(app: Application) {
        this.app = app;
        this.loadingScreen = this.createLoadingScreen(app.screen.width, app.screen.height);
    }

    public showLoadingScreen() {
        this.app.stage.addChild(this.loadingScreen);
    }

    public hideLoadingScreen() {
        this.app.stage.removeChild(this.loadingScreen);
    }

    public async loadAssets() {
        this.showLoadingScreen();
        // Load individual assets with correct paths
        Assets.add({ alias: "1.png", src: "/assets/1.png" });
        Assets.add({ alias: "2.png", src: "/assets/2.png" });
        Assets.add({ alias: "3.png", src: "/assets/3.png" });
        Assets.add({ alias: "4.png", src: "/assets/4.png" });
        Assets.add({ alias: "5.png", src: "/assets/5.png" });
        Assets.add({ alias: "wild.png", src: "/assets/wild.png" });
        
        await Assets.load(["1.png", "2.png", "3.png", "4.png", "5.png", "wild.png"]);
        this.hideLoadingScreen();
    }

    private createLoadingScreen(appWidth: number, appHeight: number): Text {
        const style = new TextStyle({
            fontFamily: "Arial",
            fontSize: 36,
            fontWeight: "bold",
            fill: "#ffffff",
        });
        const playText = new Text({ text: "Loading...", style });
        playText.x = (appWidth - playText.width) / 2;
        playText.y = (appHeight - playText.height) / 2;
        return playText;
    }
}
