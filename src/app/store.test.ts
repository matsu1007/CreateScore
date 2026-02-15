import { describe, expect, it } from "vitest";
import {
  canAnalyze,
  canExport,
  canUndo,
  initialState,
  projectReducer
} from "./store";

describe("store", () => {
  it("handles main state transitions", () => {
    const recording = projectReducer(initialState, { type: "recordStart" });
    expect(recording.status).toBe("Recording");

    const recorded = projectReducer(recording, {
      type: "recorded",
      audio: {
        sampleRate: 16000,
        durationSec: 1,
        samples: new Float32Array([0, 0, 0])
      }
    });
    expect(recorded.status).toBe("Recorded");
    expect(canAnalyze(recorded)).toBe(true);

    const analyzing = projectReducer(recorded, { type: "analyzeStart" });
    expect(analyzing.status).toBe("Analyzing");

    const ready = projectReducer(analyzing, {
      type: "analyzeSuccess",
      payload: {
        frames: [],
        notesRaw: [],
        notesQ: [
          {
            id: "n",
            midi: 60,
            startTick: 0,
            durationTick: 2,
            velocity: 90
          }
        ]
      }
    });
    expect(ready.status).toBe("Ready");
    expect(canExport(ready)).toBe(true);

    const cleared = projectReducer(ready, { type: "clear" });
    expect(cleared.status).toBe("Empty");
  });

  it("moves and deletes selected notes", () => {
    const state = {
      ...initialState,
      status: "Ready" as const,
      notesQ: [{ id: "a", midi: 60, startTick: 1, durationTick: 2, velocity: 90 }],
      selection: { noteIds: ["a"] }
    };

    const moved = projectReducer(state, { type: "moveSelection", deltaTick: 2, deltaMidi: 1 });
    expect(moved.notesQ[0].startTick).toBe(3);
    expect(moved.notesQ[0].midi).toBe(61);

    const deleted = projectReducer(moved, { type: "deleteSelection" });
    expect(deleted.notesQ).toHaveLength(0);
  });

  it("undoes one editing step", () => {
    const state = {
      ...initialState,
      status: "Ready" as const,
      notesQ: [{ id: "a", midi: 60, startTick: 1, durationTick: 2, velocity: 90 }],
      selection: { noteIds: ["a"] }
    };

    const started = projectReducer(state, { type: "beginEdit" });
    expect(canUndo(started)).toBe(true);

    const moved = projectReducer(started, { type: "moveSelection", deltaTick: 2, deltaMidi: 1 });
    expect(moved.notesQ[0].startTick).toBe(3);
    expect(moved.notesQ[0].midi).toBe(61);

    const undone = projectReducer(moved, { type: "undoEdit" });
    expect(undone.notesQ[0].startTick).toBe(1);
    expect(undone.notesQ[0].midi).toBe(60);
    expect(canUndo(undone)).toBe(false);
  });

  it("keeps up to five undo steps", () => {
    let state = {
      ...initialState,
      status: "Ready" as const,
      notesQ: [{ id: "a", midi: 60, startTick: 0, durationTick: 2, velocity: 90 }],
      selection: { noteIds: ["a"] }
    };

    for (let i = 0; i < 6; i += 1) {
      state = projectReducer(state, { type: "beginEdit" });
      state = projectReducer(state, { type: "moveSelection", deltaTick: 1, deltaMidi: 0 });
    }

    expect(state.notesQ[0].startTick).toBe(6);
    expect(state.undoStack).toHaveLength(5);

    for (let i = 0; i < 5; i += 1) {
      state = projectReducer(state, { type: "undoEdit" });
    }

    expect(state.notesQ[0].startTick).toBe(1);
    expect(canUndo(state)).toBe(false);
  });

  it("transposes all notes by octave with clamp", () => {
    const state = {
      ...initialState,
      status: "Ready" as const,
      notesQ: [
        { id: "a", midi: 60, startTick: 0, durationTick: 2, velocity: 90 },
        { id: "b", midi: 5, startTick: 4, durationTick: 2, velocity: 90 },
        { id: "c", midi: 124, startTick: 8, durationTick: 2, velocity: 90 }
      ],
      selection: { noteIds: [] }
    };

    const up = projectReducer(state, { type: "transposeAllOctave", direction: "up" });
    expect(up.notesQ.map((note) => note.midi)).toEqual([72, 17, 127]);

    const down = projectReducer(up, { type: "transposeAllOctave", direction: "down" });
    expect(down.notesQ.map((note) => note.midi)).toEqual([60, 5, 115]);
  });

  it("transposes all notes by semitone with clamp", () => {
    const state = {
      ...initialState,
      status: "Ready" as const,
      notesQ: [
        { id: "a", midi: 60, startTick: 0, durationTick: 2, velocity: 90 },
        { id: "b", midi: 0, startTick: 4, durationTick: 2, velocity: 90 },
        { id: "c", midi: 127, startTick: 8, durationTick: 2, velocity: 90 }
      ],
      selection: { noteIds: [] }
    };

    const up = projectReducer(state, { type: "transposeAllSemitone", direction: "up" });
    expect(up.notesQ.map((note) => note.midi)).toEqual([61, 1, 127]);

    const down = projectReducer(up, { type: "transposeAllSemitone", direction: "down" });
    expect(down.notesQ.map((note) => note.midi)).toEqual([60, 0, 126]);
  });
});
