import {
  BALL_R,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  MATCHOVER_ITEMS,
  NET_X,
  OBSTACLE_H,
  OBSTACLE_W,
  P1_X0,
  P1_X1,
  P2_X0,
  PADDLE_H,
  TITLE_ITEMS,
  TITLE_TEXT,
} from "./constants";
import type { GameState, Rect } from "./types";

const FIELD = "#071014";
const INK = "#eef7f1";
const P1 = "#35e0c2";
const P2 = "#ff5876";
const BALL = "#ffe66d";
const OBSTACLE = "#8ea6ff";

export interface Fit {
  dpr: number;
  rect: Rect;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private fitValue: Fit = {
    dpr: 1,
    rect: { x: 0, y: 0, w: FIELD_W, h: FIELD_H },
  };
  debugVisible = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  fit(): Rect {
    return this.fitValue.rect;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    const scale = Math.min(w / FIELD_W, h / FIELD_H);
    const rect = {
      x: (w - FIELD_W * scale) / 2,
      y: (h - FIELD_H * scale) / 2,
      w: FIELD_W * scale,
      h: FIELD_H * scale,
    };
    this.fitValue = { dpr, rect };
  }

  render(
    state: GameState,
    menuRect: (index: number) => Rect | null,
    autoStep: boolean,
  ): void {
    const { ctx } = this;
    const width = this.canvas.width / this.fitValue.dpr;
    const height = this.canvas.height / this.fitValue.dpr;
    ctx.setTransform(this.fitValue.dpr, 0, 0, this.fitValue.dpr, 0, 0);
    ctx.fillStyle = FIELD;
    ctx.fillRect(0, 0, width, height);
    const scale = this.fitValue.rect.w / FIELD_W;
    ctx.translate(this.fitValue.rect.x, this.fitValue.rect.y);
    ctx.scale(scale, scale);
    this.drawField(state);
    if (state.screen === "title") {
      this.dim();
      this.drawTitle(state, menuRect);
    } else if (state.screen === "howto") {
      this.dim();
      this.drawHowTo(menuRect);
    } else if (state.screen === "paused") {
      this.dim();
      this.drawMenu(
        "PAUSED",
        ["RESUME", "RESTART", "QUIT TO MENU"],
        state.menuIndex,
        menuRect,
      );
    } else if (state.screen === "matchover") {
      this.dim();
      const winner =
        state.winner === "left" ? "PLAYER ONE WINS" : "PLAYER TWO WINS";
      this.drawMenu(
        `${winner}  ${state.score.p1}-${state.score.p2}`,
        MATCHOVER_ITEMS,
        state.menuIndex,
        menuRect,
      );
    } else if (state.screen === "countdown") {
      this.drawCountdown(state);
    }
    if (this.debugVisible) {
      this.drawDiagnostics(state, autoStep);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawField(state: GameState): void {
    const { ctx } = this;
    ctx.fillStyle = FIELD;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.strokeStyle = "rgba(238,247,241,0.13)";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 22]);
    ctx.beginPath();
    ctx.moveTo(NET_X, 24);
    ctx.lineTo(NET_X, FIELD_H - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const obstacle of state.obstacles) {
      roundRect(
        ctx,
        obstacle.cx - OBSTACLE_W / 2,
        obstacle.cy - OBSTACLE_H / 2,
        OBSTACLE_W,
        OBSTACLE_H,
        9,
      );
      ctx.fillStyle = OBSTACLE;
      ctx.shadowColor = OBSTACLE;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    this.drawPaddle(P1_X0, state.paddles.left.cy, P1);
    this.drawPaddle(P2_X0, state.paddles.right.cy, P2);
    this.drawTrail(state);
    if (state.ball) {
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = BALL;
      ctx.shadowColor = BALL;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (
      state.screen === "playing" ||
      state.screen === "countdown" ||
      state.screen === "paused"
    ) {
      this.drawHud(state);
    }
  }

  private drawPaddle(x: number, cy: number, color: string): void {
    roundRect(this.ctx, x, cy - PADDLE_H / 2, P1_X1 - P1_X0, PADDLE_H, 8);
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 15;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  private drawTrail(state: GameState): void {
    const ball = state.ball;
    if (!ball || ball.trail.length < 2) {
      return;
    }
    const { ctx } = this;
    for (let index = 1; index < ball.trail.length; index += 1) {
      const a = ball.trail[index - 1];
      const b = ball.trail[index];
      ctx.strokeStyle = `rgba(255,230,109,${index / ball.trail.length / 1.7})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  private drawHud(state: GameState): void {
    const { ctx } = this;
    ctx.fillStyle = INK;
    ctx.font = "700 58px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(state.score.p1), FIELD_CX - 170, 82);
    ctx.fillText(String(state.score.p2), FIELD_CX + 170, 82);
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillStyle = "rgba(238,247,241,0.72)";
    ctx.fillText(
      state.mode === "solo" ? "SOLO DUEL" : "VERSUS DUEL",
      FIELD_CX,
      42,
    );
  }

  private drawCountdown(state: GameState): void {
    const seconds = Math.ceil(state.ball?.holdTimer ?? 0);
    this.ctx.fillStyle = "rgba(238,247,241,0.9)";
    this.ctx.font = "900 70px system-ui, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText(String(Math.max(1, seconds)), FIELD_CX, FIELD_CY - 90);
  }

  private dim(): void {
    this.ctx.fillStyle = "rgba(7,16,20,0.72)";
    this.ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  private drawTitle(
    state: GameState,
    menuRect: (index: number) => Rect | null,
  ): void {
    const { ctx } = this;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "900 116px system-ui, sans-serif";
    ctx.fillText(TITLE_TEXT, FIELD_CX, 205);
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillStyle = "rgba(238,247,241,0.72)";
    ctx.fillText("curve the rally, bank the shot", FIELD_CX, 250);
    this.drawMenuItems(TITLE_ITEMS, state.menuIndex, menuRect);
  }

  private drawHowTo(menuRect: (index: number) => Rect | null): void {
    const { ctx } = this;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "800 48px system-ui, sans-serif";
    ctx.fillText("HOW TO PLAY", FIELD_CX, 120);
    ctx.font = "500 25px system-ui, sans-serif";
    const lines = [
      "W/S move player one. Arrow keys move player two in Versus.",
      "In Solo, either side of the keyboard steers the left paddle.",
      "Move as you strike to add spin. Spin bends the ball after contact.",
      "Use the center obstacles for bank shots. P pauses, M mutes.",
    ];
    lines.forEach((line, index) =>
      ctx.fillText(line, FIELD_CX, 210 + index * 48),
    );
    this.drawMenuItems(["BACK"], 0, menuRect);
  }

  private drawMenu(
    title: string,
    items: readonly string[],
    menuIndex: number,
    menuRect: (index: number) => Rect | null,
  ): void {
    const { ctx } = this;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "800 42px system-ui, sans-serif";
    ctx.fillText(title, FIELD_CX, 310);
    this.drawMenuItems(items, menuIndex, menuRect);
  }

  private drawMenuItems(
    items: readonly string[],
    menuIndex: number,
    menuRect: (index: number) => Rect | null,
  ): void {
    const { ctx } = this;
    items.forEach((item, index) => {
      const rect = menuRect(index);
      if (!rect) {
        return;
      }
      const selected = index === menuIndex;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fillStyle = selected ? "#eef7f1" : "rgba(238,247,241,0.08)";
      ctx.fill();
      ctx.strokeStyle = selected ? "#ffe66d" : "rgba(238,247,241,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = selected ? FIELD : INK;
      ctx.font = "800 25px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item, rect.x + rect.w / 2, rect.y + 38);
    });
  }

  private drawDiagnostics(state: GameState, autoStep: boolean): void {
    const ball = state.ball;
    const lines = [
      `screen ${state.screen}  mode ${state.mode}  auto ${autoStep}`,
      `time ${state.simTime.toFixed(2)}  muted ${state.muted}`,
      ball
        ? `ball ${ball.x.toFixed(1)},${ball.y.toFixed(1)}  v ${Math.hypot(ball.vx, ball.vy).toFixed(1)}  spin ${ball.spin.toFixed(1)}`
        : "ball absent",
    ];
    this.ctx.fillStyle = "rgba(0,0,0,0.58)";
    this.ctx.fillRect(16, FIELD_H - 104, 560, 86);
    this.ctx.fillStyle = "#9ff7e3";
    this.ctx.font = "16px ui-monospace, monospace";
    this.ctx.textAlign = "left";
    lines.forEach((line, index) =>
      this.ctx.fillText(line, 30, FIELD_H - 76 + index * 24),
    );
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
