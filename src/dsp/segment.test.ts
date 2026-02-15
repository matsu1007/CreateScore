import { describe, expect, it } from "vitest";
import type { PitchFrame } from "../app/types";
import { segmentNotes } from "./segment";

const midiToF0 = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

describe("segmentNotes", () => {
  it("creates notes and merges short note to neighbor", () => {
    const frames: PitchFrame[] = [];
    for (let i = 0; i < 10; i += 1) {
      frames.push({ tSec: i * 0.01, f0Hz: midiToF0(60), conf: 1, rms: 0.1 });
    }
    for (let i = 10; i < 12; i += 1) {
      frames.push({ tSec: i * 0.01, f0Hz: midiToF0(62), conf: 1, rms: 0.1 });
    }
    for (let i = 12; i < 24; i += 1) {
      frames.push({ tSec: i * 0.01, f0Hz: midiToF0(60), conf: 1, rms: 0.1 });
    }

    const notes = segmentNotes(frames, {
      stableFrames: 8,
      jitterToleranceFrames: 1,
      minNoteSec: 0.06,
      silenceEndMs: 50,
      hopMs: 10
    });

    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.endSec > n.startSec)).toBe(true);
  });
});
