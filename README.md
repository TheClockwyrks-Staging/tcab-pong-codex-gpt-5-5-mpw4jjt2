# Carom

Carom is a top-down paddle duel for the browser. Two paddles trade ricochets across a dark 1280 x 720 field, banking the ball around fixed center obstacles. Moving a paddle at the moment of contact adds spin, so clean returns can bend into awkward curves and late match points can turn on a bank shot.

The game is written in TypeScript with its own canvas runtime, physics loop, input handling, synthesized audio cues, AI opponent, local two-player mode, and `window.__carom` debug surface. It ships as static files and needs no backend or runtime assets.

## Install

```sh
npm ci
```

## Development

```sh
npm run dev
```

Vite serves the game locally with hot reload.

## Production Build

```sh
npm run build
```

The complete static site is emitted to `dist/` with `dist/index.html` as its entry point.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

## Controls

- Player one: `W` and `S`
- Player two in Versus: `ArrowUp` and `ArrowDown`
- Solo: either `W`/`S` or arrow keys move the left paddle
- Confirm menu item: `Enter` or `Space`
- Back or pause: `Escape`
- Pause: `P`
- Mute: `M`
- Debug overlay: backquote
