import { AudioRuntime } from "./audio";
import { Renderer } from "./renderer";
import { CaromGame } from "./simulation";
import { InputRuntime } from "./input";
import { CAROM_DEBUG_VERSION } from "./constants";
import type { CaromDebugApi } from "./types";

declare global {
  interface Window {
    __carom: CaromDebugApi;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
if (!canvas) {
  throw new Error("Missing #stage canvas");
}

const audio = new AudioRuntime();
const game = new CaromGame({
  muted: audio.muted,
  playCue: (cue) => audio.play(cue),
});
const renderer = new Renderer(canvas);
const input = new InputRuntime(
  canvas,
  () => renderer.fit(),
  () => audio.arm(),
);

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (game.autoStep) {
    audio.muted = game.state.muted;
    game.update(dt, input.frame());
    audio.muted = game.state.muted;
  }
  renderer.render(
    game.state,
    (index) => game.menuItemRect(index),
    game.autoStep,
  );
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Backquote") {
    renderer.debugVisible = !renderer.debugVisible;
  }
});

window.__carom = {
  version: CAROM_DEBUG_VERSION,
  setAutoStep(enabled) {
    game.autoStep = enabled;
  },
  advance(seconds, frames = 1) {
    const count = Math.max(1, Math.floor(frames));
    for (let i = 0; i < count; i += 1) {
      audio.muted = game.state.muted;
      game.update(seconds / count);
      renderer.render(
        game.state,
        (index) => game.menuItemRect(index),
        game.autoStep,
      );
    }
  },
  clearWorld: () => game.clearWorld(),
  spawnBall: () => game.spawnBall(),
  spawnObstacle: (index) => game.spawnObstacle(index),
  reset: () => game.reset(),
  reconcile: () => game.reconcile(),
  setScreen: (screen) => game.setScreen(screen),
  setMode: (mode) => game.setMode(mode),
  setMenuIndex: (index) => game.setMenuIndex(index),
  setTitleIndex: (index) => game.setTitleIndex(index),
  setResumeScreen: (screen) => game.setResumeScreen(screen),
  setScore: (p1, p2) => game.setScore(p1, p2),
  setWinner: (side) => game.setWinner(side),
  setReceiver: (side) => game.setReceiver(side),
  setPaddleCy: (side, cy) => game.setPaddleCy(side, cy),
  setPaddleVy: (side, vy) => game.setPaddleVy(side, vy),
  setPaddleDriven: (side, driven) => game.setPaddleDriven(side, driven),
  setBallPosition: (x, y) => game.setBallPosition(x, y),
  setBallVelocity: (vx, vy) => game.setBallVelocity(vx, vy),
  setBallSpin: (spin) => game.setBallSpin(spin),
  setBallHeld: (held) => game.setBallHeld(held),
  setBallHoldTimer: (seconds) => game.setBallHoldTimer(seconds),
  setBallServeSign: (sign) => game.setBallServeSign(sign),
  drawBallServeSign: () => game.drawBallServeSign(),
  setAiTracking: (enabled) => game.setAiTracking(enabled),
  setAiMovement: (enabled) => game.setAiMovement(enabled),
  setMuted(muted) {
    audio.muted = muted;
    game.setMuted(muted);
  },
  snapshot: () => game.snapshot(),
  menuItemRect: (index) => game.menuItemRect(index),
};

requestAnimationFrame(frame);
