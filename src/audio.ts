import type { Cue } from "./types";

export class AudioRuntime {
  muted = false;
  private context: AudioContext | null = null;
  private armed = false;

  arm(): void {
    this.armed = true;
    if (!this.context) {
      this.context = new AudioContext();
    }
    void this.context.resume();
  }

  play(cue: Cue): void {
    if (this.muted || !this.armed || !this.context) {
      return;
    }
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const shape = toneForCue(cue);
    oscillator.type = shape.type;
    oscillator.frequency.setValueAtTime(shape.frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(shape.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + shape.duration + 0.01);
  }
}

function toneForCue(cue: Cue): {
  frequency: number;
  duration: number;
  volume: number;
  type: OscillatorType;
} {
  if (cue === "paddle-hit") {
    return { frequency: 420, duration: 0.07, volume: 0.08, type: "square" };
  }
  if (cue === "wall-bounce") {
    return { frequency: 260, duration: 0.05, volume: 0.06, type: "triangle" };
  }
  if (cue === "obstacle-bounce") {
    return { frequency: 620, duration: 0.055, volume: 0.07, type: "sawtooth" };
  }
  return { frequency: 180, duration: 0.16, volume: 0.09, type: "sine" };
}
