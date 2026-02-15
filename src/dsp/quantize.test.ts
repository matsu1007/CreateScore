import { describe, expect, it } from "vitest";
import type { GridSetting, NoteRaw } from "../app/types";
import { quantizeNotes } from "./quantize";

const grid: GridSetting = {
  bpm: 120,
  timeSig: { num: 4, den: 4 },
  division: "1/16"
};

describe("quantizeNotes", () => {
  it("rounds start/end and enforces duration >= 1", () => {
    const raw: NoteRaw[] = [
      {
        id: "n1",
        midi: 60,
        startSec: 0,
        endSec: 0.01,
        conf: 1
      }
    ];

    const result = quantizeNotes(raw, grid);
    expect(result).toHaveLength(1);
    expect(result[0].startTick).toBe(0);
    expect(result[0].durationTick).toBe(1);
  });

  it("merges same midi notes collapsed to same startTick", () => {
    const raw: NoteRaw[] = [
      {
        id: "n1",
        midi: 64,
        startSec: 0,
        endSec: 0.2,
        conf: 1
      },
      {
        id: "n2",
        midi: 64,
        startSec: 0.01,
        endSec: 0.3,
        conf: 1
      }
    ];

    const result = quantizeNotes(raw, {
      ...grid,
      division: "1/8"
    });

    expect(result).toHaveLength(1);
    expect(result[0].durationTick).toBeGreaterThanOrEqual(1);
  });

  it("supports 1/32 division", () => {
    const raw: NoteRaw[] = [
      {
        id: "n1",
        midi: 67,
        startSec: 0,
        endSec: 0.125,
        conf: 1
      }
    ];

    const result = quantizeNotes(raw, {
      ...grid,
      division: "1/32"
    });

    expect(result).toHaveLength(1);
    expect(result[0].startTick).toBe(0);
    expect(result[0].durationTick).toBe(2);
  });
});
