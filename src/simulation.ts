import {
  AI_DEADZONE,
  AI_HOME_DEADZONE,
  AI_HOME_Y,
  AI_REACT,
  AI_SPEED,
  BALL_R,
  CAROM_DEBUG_VERSION,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  HOLD_TIME,
  MATCHOVER_ITEMS,
  MAX_BOUNCE_ANGLE,
  MAX_SUBSTEP,
  OBSTACLE_CENTERS,
  OBSTACLE_HH,
  OBSTACLE_HW,
  P1_X0,
  P1_X1,
  P2_X0,
  P2_X1,
  PADDLE_HALF,
  PADDLE_MAX_CY,
  PADDLE_MIN_CY,
  PADDLE_SPEED,
  SERVE_ANGLE,
  SERVE_SPEED,
  SPEED_CAP,
  SPEED_MULT,
  SPIN_CLAMP,
  SPIN_FROM_PADDLE,
  SPIN_HALFLIFE,
  TITLE_ITEMS,
  TRAIL_TIME,
  WIN_LEAD,
  WIN_SCORE,
} from "./constants";
import type {
  Action,
  BallState,
  Cue,
  GameState,
  InputFrame,
  Mode,
  ObstacleState,
  PaddleState,
  Rect,
  Screen,
  Side,
  Snapshot,
} from "./types";

const ACTIONS: Action[] = [
  "p1-up",
  "p1-down",
  "p2-up",
  "p2-down",
  "confirm",
  "back",
  "pause",
  "mute",
];

export function emptyInput(): InputFrame {
  const held = Object.fromEntries(
    ACTIONS.map((action) => [action, false]),
  ) as Record<Action, boolean>;
  return { held, pressed: { ...held }, pointer: null, touches: [] };
}

export class CaromGame {
  readonly state: GameState;
  autoStep = true;
  private readonly random: () => number;
  private readonly playCue: (cue: Cue) => void;
  private pointerPressItem: number | null = null;
  private touchPressItem: number | null = null;

  constructor(
    options: {
      random?: () => number;
      muted?: boolean;
      playCue?: (cue: Cue) => void;
    } = {},
  ) {
    this.random = options.random ?? Math.random;
    this.playCue = options.playCue ?? (() => undefined);
    this.state = this.makeTitleState(options.muted ?? false, 0);
  }

  update(dt: number, input: InputFrame = emptyInput()): Cue[] {
    const cues = new Set<Cue>();
    const state = this.state;
    state.simTime += Math.max(0, dt);
    if (input.pressed.mute) {
      state.muted = !state.muted;
    }
    this.applyScreenInput(input);

    const screen = state.screen;
    if (screen === "countdown") {
      this.updatePaddles(dt, input);
      this.updateCountdown(dt);
      this.writeTrail();
    } else if (screen === "playing") {
      this.updatePaddles(dt, input);
      this.updateBall(dt, cues);
      this.writeTrail();
      this.scoreIfGoal(cues);
    }

    for (const cue of cues) {
      this.playCue(cue);
    }
    return [...cues];
  }

  reset(): void {
    const muted = this.state.muted;
    const next = this.makeTitleState(muted, 0);
    Object.assign(this.state, next);
  }

  returnToTitle(): void {
    const { muted, simTime, titleIndex } = this.state;
    const next = this.makeTitleState(muted, simTime);
    next.titleIndex = titleIndex;
    next.menuIndex = titleIndex;
    Object.assign(this.state, next);
  }

  startMatch(mode = this.state.mode): void {
    this.state.mode = mode;
    this.state.screen = "countdown";
    this.state.resumeScreen = "playing";
    this.state.menuIndex = 0;
    this.state.score = { p1: 0, p2: 0 };
    this.state.winner = null;
    this.state.receiver = "left";
    this.state.paddles.left.cy = FIELD_CY;
    this.state.paddles.left.vy = 0;
    this.state.paddles.right.cy = FIELD_CY;
    this.state.paddles.right.vy = 0;
    this.spawnBall();
    this.spawnObstacle(0);
    this.spawnObstacle(1);
  }

  clearWorld(): void {
    this.state.ball = null;
    this.state.obstacles = [];
  }

  spawnBall(): void {
    this.state.ball = this.newBall();
  }

  spawnObstacle(index: number): void {
    this.assertObstacleIndex(index);
    const center = OBSTACLE_CENTERS[index];
    const obstacle = { index: index as 0 | 1, cx: center.cx, cy: center.cy };
    this.state.obstacles = this.state.obstacles.filter(
      (item) => item.index !== index,
    );
    this.state.obstacles.push(obstacle);
    this.state.obstacles.sort((a, b) => a.index - b.index);
  }

  setScreen(screen: Screen): void {
    this.state.screen = screen;
  }

  setMode(mode: Mode): void {
    this.state.mode = mode;
  }

  setMenuIndex(index: number): void {
    this.state.menuIndex = index;
  }

  setTitleIndex(index: number): void {
    this.state.titleIndex = index;
  }

  setResumeScreen(screen: "countdown" | "playing"): void {
    this.state.resumeScreen = screen;
  }

  setScore(p1: number, p2: number): void {
    this.state.score = { p1, p2 };
  }

  setWinner(side: Side | null): void {
    this.state.winner = side;
  }

  setReceiver(side: Side): void {
    this.state.receiver = side;
  }

  setPaddleCy(side: Side, cy: number): void {
    this.state.paddles[side].cy = cy;
  }

  setPaddleVy(side: Side, vy: number): void {
    this.state.paddles[side].drivenVy = vy;
  }

  setPaddleDriven(side: Side, driven: boolean): void {
    this.state.paddles[side].driven = driven;
  }

  setBallPosition(x: number, y: number): void {
    const ball = this.requireBall();
    ball.x = x;
    ball.y = y;
  }

  setBallVelocity(vx: number, vy: number): void {
    const ball = this.requireBall();
    ball.vx = vx;
    ball.vy = vy;
  }

  setBallSpin(spin: number): void {
    this.requireBall().spin = spin;
  }

  setBallHeld(held: boolean): void {
    this.requireBall().held = held;
  }

  setBallHoldTimer(seconds: number): void {
    this.requireBall().holdTimer = seconds;
  }

  setBallServeSign(sign: 1 | -1): void {
    this.requireBall().serveSign = sign;
  }

  drawBallServeSign(): void {
    this.requireBall().serveSign = this.drawServeSign();
  }

  setAiTracking(enabled: boolean): void {
    this.state.ai.tracking = enabled;
  }

  setAiMovement(enabled: boolean): void {
    this.state.ai.movement = enabled;
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
  }

  reconcile(): void {
    return undefined;
  }

  snapshot(): Snapshot {
    const ball = this.state.ball;
    return {
      version: CAROM_DEBUG_VERSION,
      screen: this.state.screen,
      mode: this.state.mode,
      menuIndex: this.state.menuIndex,
      titleIndex: this.state.titleIndex,
      resumeScreen: this.state.resumeScreen,
      score: { ...this.state.score },
      winner: this.state.winner,
      muted: this.state.muted,
      paddles: {
        left: { ...this.state.paddles.left },
        right: { ...this.state.paddles.right },
      },
      ai: { ...this.state.ai },
      receiver: this.state.receiver,
      ball: ball
        ? {
            ...ball,
            speed: Math.hypot(ball.vx, ball.vy),
            trail: ball.trail.map((sample) => ({ ...sample })),
          }
        : null,
      obstacles: this.state.obstacles.map((obstacle) => ({ ...obstacle })),
      autoStep: this.autoStep,
      simTime: this.state.simTime,
    };
  }

  menuItemRect(index: number): Rect | null {
    const count = this.menuItems().length;
    if (count === 0 || index < 0 || index >= count) {
      return null;
    }
    const w = this.state.screen === "howto" ? 260 : 340;
    const h = 58;
    const gap = 18;
    const total = count * h + (count - 1) * gap;
    const y0 =
      this.state.screen === "title"
        ? 358
        : this.state.screen === "howto"
          ? 590
          : 430;
    return {
      x: (FIELD_W - w) / 2,
      y: y0 - total / 2 + index * (h + gap),
      w,
      h,
    };
  }

  private makeTitleState(muted: boolean, simTime: number): GameState {
    return {
      screen: "title",
      mode: "solo",
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      paddles: {
        left: this.newPaddle(),
        right: this.newPaddle(),
      },
      ai: { tracking: true, movement: true },
      ball: this.newBall(),
      obstacles: OBSTACLE_CENTERS.map((center, index) => ({
        index: index as 0 | 1,
        cx: center.cx,
        cy: center.cy,
      })),
      simTime,
      muted,
    };
  }

  private newPaddle(): PaddleState {
    return { cy: FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
  }

  private newBall(): BallState {
    return {
      x: FIELD_W / 2,
      y: FIELD_H / 2,
      vx: 0,
      vy: 0,
      spin: 0,
      held: true,
      holdTimer: HOLD_TIME,
      serveSign: this.drawServeSign(),
      trail: [],
    };
  }

  private drawServeSign(): 1 | -1 {
    return this.random() < 0.5 ? -1 : 1;
  }

  private applyScreenInput(input: InputFrame): void {
    const screen = this.state.screen;
    if (screen === "countdown" || screen === "playing") {
      if (input.pressed.pause) {
        this.state.resumeScreen = screen;
        this.state.screen = "paused";
        this.state.menuIndex = 0;
      }
      return;
    }
    if (screen === "paused" && (input.pressed.pause || input.pressed.back)) {
      this.state.screen = this.state.resumeScreen;
      return;
    }
    const moved = this.applyKeyboardMenuMovement(input);
    const keyboardConfirm = input.pressed.confirm;
    if (!moved && keyboardConfirm) {
      this.confirmMenuItem();
      return;
    }
    if (!keyboardConfirm) {
      this.applyPointerMenus(input);
    }
  }

  private applyKeyboardMenuMovement(input: InputFrame): boolean {
    const count = this.menuItems().length;
    if (count === 0) {
      return false;
    }
    if (this.state.screen === "howto") {
      if (input.pressed.back) {
        this.returnToTitle();
        return true;
      }
      return false;
    }
    if (this.state.screen === "title" && input.pressed.back) {
      return false;
    }
    if (this.state.screen === "matchover" && input.pressed.back) {
      this.returnToTitle();
      return true;
    }
    const up = input.pressed["p1-up"] || input.pressed["p2-up"];
    const down = input.pressed["p1-down"] || input.pressed["p2-down"];
    if (up) {
      this.state.menuIndex = (this.state.menuIndex + count - 1) % count;
      return true;
    }
    if (down) {
      this.state.menuIndex = (this.state.menuIndex + 1) % count;
      return true;
    }
    return false;
  }

  private applyPointerMenus(input: InputFrame): void {
    const events = [input.pointer, ...input.touches].filter(
      (event) => event !== null,
    );
    for (const event of events) {
      const hit = this.hitMenu(event.x, event.y);
      if (hit !== null) {
        this.state.menuIndex = hit;
      }
      if (event.pressed) {
        if (event === input.pointer) {
          this.pointerPressItem = hit;
        } else {
          this.touchPressItem = hit;
        }
      }
      if (event.released && hit !== null) {
        const started =
          event === input.pointer ? this.pointerPressItem : this.touchPressItem;
        if (started === hit) {
          this.confirmMenuItem();
        }
        if (event === input.pointer) {
          this.pointerPressItem = null;
        } else {
          this.touchPressItem = null;
        }
        return;
      }
    }
  }

  private hitMenu(x: number, y: number): number | null {
    for (let index = 0; index < this.menuItems().length; index += 1) {
      const rect = this.menuItemRect(index);
      if (
        rect &&
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
      ) {
        return index;
      }
    }
    return null;
  }

  private confirmMenuItem(): void {
    if (this.state.screen === "title") {
      this.state.titleIndex = this.state.menuIndex;
      if (this.state.menuIndex === 0) {
        this.startMatch("solo");
      } else if (this.state.menuIndex === 1) {
        this.startMatch("versus");
      } else {
        this.state.screen = "howto";
        this.state.menuIndex = 0;
      }
      return;
    }
    if (this.state.screen === "howto") {
      this.returnToTitle();
      return;
    }
    if (this.state.screen === "paused") {
      if (this.state.menuIndex === 0) {
        this.state.screen = this.state.resumeScreen;
      } else if (this.state.menuIndex === 1) {
        this.startMatch(this.state.mode);
      } else {
        this.returnToTitle();
      }
      return;
    }
    if (this.state.screen === "matchover") {
      if (this.state.menuIndex === 0) {
        this.startMatch(this.state.mode);
      } else {
        this.returnToTitle();
      }
    }
  }

  private menuItems(): readonly string[] {
    if (this.state.screen === "title") {
      return TITLE_ITEMS;
    }
    if (this.state.screen === "howto") {
      return ["BACK"];
    }
    if (this.state.screen === "paused") {
      return ["RESUME", "RESTART", "QUIT TO MENU"];
    }
    if (this.state.screen === "matchover") {
      return MATCHOVER_ITEMS;
    }
    return [];
  }

  private updatePaddles(dt: number, input: InputFrame): void {
    const left = this.state.paddles.left;
    const right = this.state.paddles.right;
    if (left.driven) {
      this.integratePaddle(left, left.drivenVy, dt);
    } else {
      const up =
        this.state.mode === "solo"
          ? input.held["p1-up"] || input.held["p2-up"]
          : input.held["p1-up"];
      const down =
        this.state.mode === "solo"
          ? input.held["p1-down"] || input.held["p2-down"]
          : input.held["p1-down"];
      this.integratePaddle(
        left,
        (Number(down) - Number(up)) * PADDLE_SPEED,
        dt,
      );
    }

    if (right.driven) {
      this.integratePaddle(right, right.drivenVy, dt);
    } else if (this.state.mode === "versus") {
      this.integratePaddle(
        right,
        (Number(input.held["p2-down"]) - Number(input.held["p2-up"])) *
          PADDLE_SPEED,
        dt,
      );
    } else {
      this.updateAi(dt);
    }
  }

  private updateAi(dt: number): void {
    const paddle = this.state.paddles.right;
    if (!this.state.ai.movement) {
      this.integratePaddle(paddle, 0, dt);
      return;
    }
    let target = AI_HOME_Y;
    let deadzone = AI_HOME_DEADZONE;
    const ball = this.state.ball;
    if (
      this.state.ai.tracking &&
      this.state.screen === "playing" &&
      ball &&
      ball.vx > 0
    ) {
      target = ball.y - ball.vy * AI_REACT;
      deadzone = AI_DEADZONE;
    }
    const diff = target - paddle.cy;
    const vy =
      Math.abs(diff) <= deadzone || dt <= 0
        ? 0
        : Math.sign(diff) * Math.min(AI_SPEED, Math.abs(diff) / dt);
    this.integratePaddle(paddle, vy, dt);
  }

  private integratePaddle(
    paddle: PaddleState,
    wantedVy: number,
    dt: number,
  ): void {
    if (dt <= 0) {
      paddle.vy = wantedVy;
      return;
    }
    const previous = paddle.cy;
    const next = clamp(previous + wantedVy * dt, PADDLE_MIN_CY, PADDLE_MAX_CY);
    paddle.vy =
      next !== previous + wantedVy * dt ? (next - previous) / dt : wantedVy;
    paddle.cy = next;
  }

  private updateCountdown(dt: number): void {
    const ball = this.state.ball;
    if (!ball) {
      return;
    }
    ball.x = FIELD_W / 2;
    ball.y = FIELD_H / 2;
    if (ball.held) {
      ball.holdTimer -= dt;
      if (ball.holdTimer <= 0) {
        ball.holdTimer = 0;
        ball.held = false;
        ball.trail = [];
        const dir = this.state.receiver === "left" ? -1 : 1;
        ball.vx = dir * SERVE_SPEED * Math.cos(SERVE_ANGLE);
        ball.vy = ball.serveSign * SERVE_SPEED * Math.sin(SERVE_ANGLE);
        this.state.screen = "playing";
      }
    }
  }

  private updateBall(dt: number, cues: Set<Cue>): void {
    const ball = this.state.ball;
    if (!ball || ball.held) {
      return;
    }
    const speed = Math.hypot(ball.vx, ball.vy);
    const n = Math.max(1, Math.ceil((speed * dt) / MAX_SUBSTEP));
    const h = n > 0 ? dt / n : dt;
    for (let i = 0; i < n; i += 1) {
      this.stepBall(h, cues);
    }
  }

  private stepBall(h: number, cues: Set<Cue>): void {
    const ball = this.requireBall();
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const angle = (ball.spin / speed) * h;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const vx = ball.vx * cos - ball.vy * sin;
      const vy = ball.vx * sin + ball.vy * cos;
      ball.vx = vx;
      ball.vy = vy;
    }
    ball.spin *= Math.pow(0.5, h / SPIN_HALFLIFE);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    this.resolveWalls(ball, cues);
    this.resolvePaddle(ball, "left", cues);
    this.resolvePaddle(ball, "right", cues);
    for (const obstacle of this.state.obstacles) {
      this.resolveObstacle(ball, obstacle, cues);
    }
  }

  private resolveWalls(ball: BallState, cues: Set<Cue>): void {
    if (ball.y - BALL_R < 0 && ball.vy < 0) {
      ball.y = BALL_R;
      ball.vy = -ball.vy;
      cues.add("wall-bounce");
    } else if (ball.y + BALL_R > FIELD_H && ball.vy > 0) {
      ball.y = FIELD_H - BALL_R;
      ball.vy = -ball.vy;
      cues.add("wall-bounce");
    }
  }

  private resolvePaddle(ball: BallState, side: Side, cues: Set<Cue>): void {
    const paddle = this.state.paddles[side];
    const x0 = side === "left" ? P1_X0 : P2_X0;
    const x1 = side === "left" ? P1_X1 : P2_X1;
    const result = resolveCircleRect(
      ball,
      x0,
      x1,
      paddle.cy - PADDLE_HALF,
      paddle.cy + PADDLE_HALF,
    );
    if (!result) {
      return;
    }
    if (result.face === "left" || result.face === "right") {
      const speed = Math.min(
        Math.hypot(ball.vx, ball.vy) * SPEED_MULT,
        SPEED_CAP,
      );
      const offset = clamp((ball.y - paddle.cy) / PADDLE_HALF, -1, 1);
      const theta = offset * MAX_BOUNCE_ANGLE;
      const dir = side === "left" ? 1 : -1;
      ball.vx = dir * speed * Math.cos(theta);
      ball.vy = speed * Math.sin(theta);
      ball.spin = clamp(
        ball.spin + paddle.vy * SPIN_FROM_PADDLE,
        -SPIN_CLAMP,
        SPIN_CLAMP,
      );
      ball.x = side === "left" ? P1_X1 + BALL_R : P2_X0 - BALL_R;
      cues.add("paddle-hit");
    } else {
      cues.add("wall-bounce");
    }
  }

  private resolveObstacle(
    ball: BallState,
    obstacle: ObstacleState,
    cues: Set<Cue>,
  ): void {
    const result = resolveCircleRect(
      ball,
      obstacle.cx - OBSTACLE_HW,
      obstacle.cx + OBSTACLE_HW,
      obstacle.cy - OBSTACLE_HH,
      obstacle.cy + OBSTACLE_HH,
    );
    if (result) {
      cues.add("obstacle-bounce");
    }
  }

  private scoreIfGoal(cues: Set<Cue>): void {
    const ball = this.state.ball;
    if (!ball) {
      return;
    }
    let scorer: Side | null = null;
    if (ball.x - BALL_R > FIELD_W) {
      scorer = "left";
      this.state.score.p1 += 1;
    } else if (ball.x + BALL_R < 0) {
      scorer = "right";
      this.state.score.p2 += 1;
    }
    if (!scorer) {
      return;
    }
    cues.add("score");
    const { p1, p2 } = this.state.score;
    const leftWins = p1 >= WIN_SCORE && p1 - p2 >= WIN_LEAD;
    const rightWins = p2 >= WIN_SCORE && p2 - p1 >= WIN_LEAD;
    if (leftWins || rightWins) {
      this.state.winner = scorer;
      this.state.screen = "matchover";
      this.state.menuIndex = 0;
    } else {
      this.spawnBall();
      this.state.receiver = scorer === "left" ? "right" : "left";
      this.state.screen = "countdown";
    }
  }

  private writeTrail(): void {
    const ball = this.state.ball;
    if (!ball) {
      return;
    }
    ball.trail.push({ x: ball.x, y: ball.y, t: this.state.simTime });
    const oldest = this.state.simTime - TRAIL_TIME;
    ball.trail = ball.trail.filter((sample) => sample.t >= oldest);
  }

  private requireBall(): BallState {
    if (!this.state.ball) {
      throw new Error("No ball is present");
    }
    return this.state.ball;
  }

  private assertObstacleIndex(index: number): asserts index is 0 | 1 {
    if (index !== 0 && index !== 1) {
      throw new Error(`Obstacle index ${index} does not exist`);
    }
  }
}

type Face = "left" | "right" | "top" | "bottom";

function resolveCircleRect(
  ball: BallState,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): { face: Face } | null {
  if (!(
    ball.x > x0 - BALL_R &&
    ball.x < x1 + BALL_R &&
    ball.y > y0 - BALL_R &&
    ball.y < y1 + BALL_R
  )) {
    return null;
  }
  const depths = [
    { face: "left" as const, value: ball.x - (x0 - BALL_R) },
    { face: "right" as const, value: x1 + BALL_R - ball.x },
    { face: "top" as const, value: ball.y - (y0 - BALL_R) },
    { face: "bottom" as const, value: y1 + BALL_R - ball.y },
  ];
  const struck = depths.reduce((best, item) =>
    item.value < best.value ? item : best,
  );
  if (struck.face === "left") {
    ball.x = x0 - BALL_R;
    if (ball.vx > 0) {
      ball.vx = -ball.vx;
    }
  } else if (struck.face === "right") {
    ball.x = x1 + BALL_R;
    if (ball.vx < 0) {
      ball.vx = -ball.vx;
    }
  } else if (struck.face === "top") {
    ball.y = y0 - BALL_R;
    if (ball.vy > 0) {
      ball.vy = -ball.vy;
    }
  } else {
    ball.y = y1 + BALL_R;
    if (ball.vy < 0) {
      ball.vy = -ball.vy;
    }
  }
  return { face: struck.face };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
