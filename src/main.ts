import "./style.css";
import { Game } from "./game/game";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("找不到 #game-canvas");
}

const game = new Game(canvas);
game.start();
