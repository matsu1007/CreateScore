import { describe, expect, it } from "vitest";
import { parseMidi } from "midi-file";
import type { GridSetting, NoteQ } from "../app/types";
import { PPQ, encodeSmfType0, gridTickToMidiTick } from "./smf";

const grid: GridSetting = {
  bpm: 120,
  timeSig: { num: 4, den: 4 },
  division: "1/16"
};

describe("smf", () => {
  it("converts grid tick to midi tick", () => {
    expect(gridTickToMidiTick(4, "1/16")).toBe(480);
    expect(gridTickToMidiTick(2, "1/8")).toBe(480);
    expect(gridTickToMidiTick(8, "1/32")).toBe(480);
  });

  it("emits valid type0 midi with tempo event", () => {
    const notes: NoteQ[] = [
      {
        id: "q1",
        midi: 60,
        startTick: 0,
        durationTick: 4,
        velocity: 90
      }
    ];

    const bytes = encodeSmfType0(notes, grid);
    const parsed = parseMidi(bytes);

    expect(parsed.header.format).toBe(0);
    expect(parsed.header.ticksPerBeat).toBe(PPQ);
    expect(parsed.tracks[0].some((e) => e.type === "setTempo")).toBe(true);
    expect(parsed.tracks[0].some((e) => e.type === "noteOn")).toBe(true);
    expect(parsed.tracks[0].some((e) => e.type === "noteOff")).toBe(true);
  });
});
