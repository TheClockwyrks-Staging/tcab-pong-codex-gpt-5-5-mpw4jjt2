import { describe, expect, it } from "vitest";
import {
  FIELD_CY,
  FIELD_W,
  HOLD_TIME,
  P1_X1,
  P2_X0,
  PADDLE_MIN_CY,
  SPEED_CAP,
} from "./constants";
import { CaromGame, emptyInput } from "./simulation";

describe("CaromGame", () => {
  it("opens on the title state and exposes a complete snapshot", () => {
    const game = new CaromGame({ random: () => 0.75 });
    const snapshot = game.snapshot();

    expect(snapshot.version).toBe(1);
    expect(snapshot.screen).toBe("title");
    expect(snapshot.mode).toBe("solo");
    expect(snapshot.ball?.x).toBe(FIELD_W / 2);
    expect(snapshot.ball?.held).toBe(true);
    expect(snapshot.ball?.serveSign).toBe(1);
    expect(snapshot.obstacles).toHaveLength(2);
  });

  it("serves toward the receiver after the countdown without advancing the ball that frame", () => {
    const game = new CaromGame({ random: () => 0.75 });

    game.startMatch("solo");
    game.setBallServeSign(-1);
    game.update(HOLD_TIME, emptyInput());
    const ball = game.snapshot().ball;

    expect(game.snapshot().screen).toBe("playing");
    expect(ball?.held).toBe(false);
    expect(ball?.x).toBe(FIELD_W / 2);
    expect(ball?.y).toBe(FIELD_CY);
    expect(ball?.vx).toBeLessThan(0);
    expect(ball?.vy).toBeLessThan(0);
  });

  it("uses integrated paddle velocity for spin and clamps the paddle at bounds", () => {
    const game = new CaromGame({ random: () => 0.75 });
    game.startMatch("versus");
    game.setScreen("playing");
    game.setPaddleCy("left", PADDLE_MIN_CY + 1);
    game.setPaddleDriven("left", true);
    game.setPaddleVy("left", -720);
    game.setBallHeld(false);
    game.setBallPosition(P1_X1 + 10, PADDLE_MIN_CY);
    game.setBallVelocity(-520, 0);

    game.update(1 / 60, emptyInput());
    const snapshot = game.snapshot();

    expect(snapshot.paddles.left.cy).toBe(PADDLE_MIN_CY);
    expect(snapshot.paddles.left.vy).toBeCloseTo(-60);
    expect(snapshot.ball?.spin).toBeLessThan(0);
    expect(snapshot.ball?.vx).toBeGreaterThan(0);
  });

  it("scores points, preserves deuce, and ends only with a two-point lead", () => {
    const game = new CaromGame({ random: () => 0.75 });
    game.startMatch("solo");
    game.setScreen("playing");
    game.setScore(10, 10);
    game.setBallHeld(false);
    game.setBallPosition(FIELD_W + 12, FIELD_CY);
    game.setBallVelocity(80, 0);

    game.update(1 / 60, emptyInput());
    expect(game.snapshot().score).toEqual({ p1: 11, p2: 10 });
    expect(game.snapshot().screen).toBe("countdown");

    game.setScreen("playing");
    game.setBallHeld(false);
    game.setBallPosition(FIELD_W + 12, FIELD_CY);
    game.setBallVelocity(80, 0);
    game.update(1 / 60, emptyInput());

    expect(game.snapshot().score).toEqual({ p1: 12, p2: 10 });
    expect(game.snapshot().winner).toBe("left");
    expect(game.snapshot().screen).toBe("matchover");
  });

  it("keeps scripted drives close across different frame sizes", () => {
    const coarse = scriptedRally(1 / 64);
    const fine = scriptedRally(1 / 250);
    const coarseBall = coarse.ball;
    const fineBall = fine.ball;

    expect(coarseBall).not.toBeNull();
    expect(fineBall).not.toBeNull();
    if (!coarseBall || !fineBall) {
      return;
    }
    expect(Math.abs(coarseBall.speed - fineBall.speed)).toBeLessThan(10);
    expect(Math.sign(coarseBall.vx)).toBe(Math.sign(fineBall.vx));
    expect(Math.abs(coarse.simTime - fine.simTime) / fine.simTime).toBeLessThan(
      0.08,
    );
    expect(coarseBall.speed).toBeLessThanOrEqual(SPEED_CAP);
  });

  it("reports menu rectangles and handles pointer confirm only from matching press and release", () => {
    const game = new CaromGame();
    const solo = game.menuItemRect(0);
    const versus = game.menuItemRect(1);
    expect(solo).not.toBeNull();
    expect(versus).not.toBeNull();
    if (!solo || !versus) {
      return;
    }

    game.update(0, pointerFrame(solo.x + 5, solo.y + 5, true, false));
    game.update(0, pointerFrame(versus.x + 5, versus.y + 5, false, true));
    expect(game.snapshot().screen).toBe("title");
    expect(game.snapshot().menuIndex).toBe(1);

    game.update(0, pointerFrame(versus.x + 5, versus.y + 5, true, true));
    expect(game.snapshot().screen).toBe("countdown");
    expect(game.snapshot().mode).toBe("versus");
  });
});

function scriptedRally(dt: number) {
  const game = new CaromGame({ random: () => 0.75 });
  game.startMatch("versus");
  game.setScreen("playing");
  game.setPaddleDriven("left", true);
  game.setPaddleDriven("right", true);
  game.setPaddleCy("left", FIELD_CY);
  game.setPaddleCy("right", FIELD_CY);
  game.setPaddleVy("left", 220);
  game.setPaddleVy("right", -140);
  game.setBallHeld(false);
  game.setBallPosition(P2_X0 - 40, FIELD_CY);
  game.setBallVelocity(700, 45);
  game.setBallSpin(250);
  for (let t = 0; t < 1.1; t += dt) {
    game.update(dt, emptyInput());
  }
  return game.snapshot();
}

function pointerFrame(
  x: number,
  y: number,
  pressed: boolean,
  released: boolean,
) {
  const input = emptyInput();
  input.pointer = { x, y, pressed, released };
  return input;
}
