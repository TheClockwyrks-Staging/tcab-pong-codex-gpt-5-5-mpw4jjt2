import { FIELD_H, FIELD_W } from "./constants";
import { emptyInput } from "./simulation";
import type { Action, InputFrame, PointerFrame, Rect } from "./types";

const KEY_ACTIONS = new Map<string, Action[]>([
  ["KeyW", ["p1-up"]],
  ["KeyS", ["p1-down"]],
  ["ArrowUp", ["p2-up"]],
  ["ArrowDown", ["p2-down"]],
  ["Enter", ["confirm"]],
  ["Space", ["confirm"]],
  ["Escape", ["back", "pause"]],
  ["KeyP", ["pause"]],
  ["KeyM", ["mute"]],
]);

export class InputRuntime {
  private readonly heldKeys = new Set<string>();
  private readonly previousHeld: Record<Action, boolean> = emptyInput().held;
  private pointerPosition: { x: number; y: number } | null = null;
  private pointerPressed = false;
  private pointerReleased = false;
  private readonly touchFrames: PointerFrame[] = [];
  private readonly canvas: HTMLCanvasElement;
  private readonly logicalRect: () => Rect;
  private readonly onGesture: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    logicalRect: () => Rect,
    onGesture: () => void,
  ) {
    this.canvas = canvas;
    this.logicalRect = logicalRect;
    this.onGesture = onGesture;
    window.addEventListener("keydown", (event) => this.key(event, true));
    window.addEventListener("keyup", (event) => this.key(event, false));
    canvas.addEventListener("pointermove", (event) => {
      this.pointerPosition = this.toLogical(event.clientX, event.clientY);
    });
    canvas.addEventListener("pointerdown", (event) => {
      this.onGesture();
      this.pointerPosition = this.toLogical(event.clientX, event.clientY);
      this.pointerPressed = true;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointerup", (event) => {
      this.onGesture();
      this.pointerPosition = this.toLogical(event.clientX, event.clientY);
      this.pointerReleased = true;
    });
    canvas.addEventListener(
      "touchstart",
      (event) => {
        this.onGesture();
        this.captureTouch(event, true, false);
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchmove",
      (event) => {
        this.captureTouch(event, false, false);
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchend",
      (event) => {
        this.onGesture();
        this.captureTouch(event, false, true);
      },
      { passive: false },
    );
  }

  frame(): InputFrame {
    const input = emptyInput();
    for (const code of this.heldKeys) {
      for (const action of KEY_ACTIONS.get(code) ?? []) {
        input.held[action] = true;
      }
    }
    for (const action of Object.keys(input.held) as Action[]) {
      input.pressed[action] = input.held[action] && !this.previousHeld[action];
      this.previousHeld[action] = input.held[action];
    }
    if (this.pointerPosition) {
      input.pointer = {
        x: this.pointerPosition.x,
        y: this.pointerPosition.y,
        pressed: this.pointerPressed,
        released: this.pointerReleased,
      };
    }
    input.touches = this.touchFrames.splice(0);
    this.pointerPressed = false;
    this.pointerReleased = false;
    return input;
  }

  private key(event: KeyboardEvent, isDown: boolean): void {
    if (!KEY_ACTIONS.has(event.code)) {
      return;
    }
    this.onGesture();
    event.preventDefault();
    if (isDown) {
      this.heldKeys.add(event.code);
    } else {
      this.heldKeys.delete(event.code);
    }
  }

  private captureTouch(
    event: TouchEvent,
    pressed: boolean,
    released: boolean,
  ): void {
    event.preventDefault();
    const touches = released ? event.changedTouches : event.touches;
    for (const touch of touches) {
      const point = this.toLogical(touch.clientX, touch.clientY);
      this.touchFrames.push({ ...point, pressed, released });
    }
  }

  private toLogical(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const canvasRect = this.canvas.getBoundingClientRect();
    const fit = this.logicalRect();
    const x = ((clientX - canvasRect.left - fit.x) / fit.w) * FIELD_W;
    const y = ((clientY - canvasRect.top - fit.y) / fit.h) * FIELD_H;
    return { x, y };
  }
}
