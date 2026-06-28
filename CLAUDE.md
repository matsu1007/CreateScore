# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite build → dist/
npm test             # Run all tests (Vitest)
npm test -- src/dsp/segment.test.ts          # Run a single test file
npm test -- -t "merges short notes"          # Run tests matching a name pattern
npm run desktop:dev  # Launch Electron dev environment
npm run desktop:dist # Build distributable installer (Windows NSIS)
```

No lint script exists; TypeScript strict mode (`tsconfig.json`) serves as the primary static check. Run `npx tsc --noEmit` to type-check without emitting.

## Architecture

### What this app does

Browser/Electron app that converts humming or vocalise recordings into MIDI. The user records audio → the app detects pitch → snaps notes to a grid → user edits in a piano roll → exports SMF Type 0 MIDI.

### Data flow

```
Mic → MediaRecorder → decodeAudioData → resample to 16 kHz mono
  → Web Worker: analyzePipeline
      VAD → pitch (YIN or CREPE) → smooth → segment → quantize → NoteQ[]
  → React state (projectReducer) → Piano roll UI → MIDI export
```

### Analysis pipeline (`src/dsp/`)

`analyzePipeline.ts` orchestrates these stages in order:

| Stage | File | Key output |
|---|---|---|
| Voice activity detection | `vad.ts` | Per-frame `voiced` boolean (RMS + hysteresis) |
| Pitch estimation | `pitch.ts` or `crepe/` | `PitchFrame[]` with `f0Hz`, `conf`, `tSec`, `rms` |
| Smoothing | `smooth.ts` | 11-frame median → zero-phase EMA (α=0.2, ~4 Hz cutoff) |
| Segmentation | `segment.ts` | `NoteRaw[]` with `startSec`, `endSec`, `midi` |
| Quantization | `quantize.ts` | `NoteQ[]` with `startTick`, `durationTick` (PPQ=480) |

All note timings in `NoteQ` are integer ticks. Converting to seconds requires BPM + grid division from `GridSetting`.

### CREPE backend (`src/dsp/crepe/`)

CREPE is a DNN pitch detector (360-bin softmax over 32.7–1975 Hz). Backend selection:

1. `crepe-webgpu` → WebGPU ONNX session
2. `crepe-wasm` → WASM ONNX session  
3. Automatic fallback to YIN on any error

ONNX runtime config: `ort.env.wasm.numThreads = 1` (avoids SharedArrayBuffer requirement), WASM files served from `public/ort/`. Model files (`public/model/*.onnx`) are gitignored — must be placed manually.

### State management (`src/app/store.ts`)

`projectReducer` handles all mutations. Undo/Redo each store up to 5 snapshots of `{ notesQ, selection }` only — not full state. `beginEdit` saves a snapshot and clears the redo stack. `undoEdit` moves current state to the redo stack and restores the previous snapshot. `redoEdit` is the reverse.

### Web Worker pattern (`src/workers/`)

`analyze.worker.ts` wraps `analyzePipeline`. If `new Worker(...)` fails (e.g., Electron context), `App.tsx` falls back to running the pipeline on the main thread.

### Key constraints

- **Monophonic only** — one note at a time; no chord detection in the current pipeline.
- **Fixed 4/4 meter** — no auto meter detection.
- **Fixed tempo** — BPM set by user (Tap Tempo is a UI helper only; not fed into analysis).
- **60-second recording cap** — hard stop in `RecorderController`.
- **No persistence** — session-only; nothing written to disk or localStorage.

## Documentation sync rule

**After every code change, explicitly check whether documentation needs updating and report the result to the user.** Either update the relevant docs in the same response, or state clearly that no doc update is needed and why.

| Changed file | Docs to update |
|---|---|
| `src/app/types.ts` | `docs/interface-specification.md` §6, `docs/specification.md` §6 |
| `src/app/store.ts` | `docs/interface-specification.md` §3, `docs/specification.md` §5 |
| `src/ui/*.tsx` (Props) | `docs/interface-specification.md` §1 |
| `src/dsp/*.ts` (signatures/params) | `docs/interface-specification.md` §2, `docs/specification.md` §4 |
| `src/api/ollama.ts` | `docs/interface-specification.md` §5 |
| `src/workers/*.ts` (message types) | `docs/interface-specification.md` §4 |
| Architecture / data flow | `docs/specification.md` §3, this file |
| Constraints / limits | `docs/specification.md` §8 |

### Types (`src/app/types.ts`)

All shared types live here. The key ones:

- `PitchFrame` — raw detector output: `{ tSec, f0Hz, conf, rms }`
- `NoteRaw` — segmented note in seconds: `{ id, midi, startSec, endSec, conf }`
- `NoteQ` — quantized note in ticks: `{ id, midi, startTick, durationTick, velocity }`
- `AnalyzeParams` — all tunable pipeline parameters (deadbandCent, confMin, pitchBackend, etc.)
- `GridSetting` — `{ bpm, division }` used for tick↔second conversion
