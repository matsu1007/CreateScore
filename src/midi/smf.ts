import { writeMidi } from "midi-file";
import type { GridSetting, NoteQ } from "../app/types";
import { gridTicksPerQuarter } from "../dsp/quantize";

export const PPQ = 480;

export const gridTickToMidiTick = (gridTick: number, division: GridSetting["division"]): number => {
  const ticksPerQuarter = gridTicksPerQuarter(division);
  if (PPQ % ticksPerQuarter !== 0) {
    throw new Error("PPQとdivisionの組み合わせが不正です");
  }
  return Math.round(gridTick * (PPQ / ticksPerQuarter));
};

export const encodeSmfType0 = (notes: NoteQ[], grid: GridSetting): Uint8Array => {
  const microsecondsPerBeat = Math.round(60_000_000 / grid.bpm);

  const events: Array<Record<string, number | string | boolean>> = [
    { deltaTime: 0, meta: true, type: "setTempo", microsecondsPerBeat }
  ];

  const noteEvents: Array<{ tick: number; type: "noteOn" | "noteOff"; note: NoteQ }> = [];
  for (const note of notes) {
    const onTick = gridTickToMidiTick(note.startTick, grid.division);
    const offTick = gridTickToMidiTick(note.startTick + note.durationTick, grid.division);
    noteEvents.push({ tick: onTick, type: "noteOn", note });
    noteEvents.push({ tick: offTick, type: "noteOff", note });
  }

  noteEvents.sort((a, b) => {
    if (a.tick !== b.tick) {
      return a.tick - b.tick;
    }
    if (a.type === b.type) {
      return 0;
    }
    return a.type === "noteOff" ? -1 : 1;
  });

  let cursor = 0;
  for (const event of noteEvents) {
    const deltaTime = Math.max(0, event.tick - cursor);
    cursor = event.tick;
    if (event.type === "noteOn") {
      events.push({
        deltaTime,
        channel: 0,
        type: "noteOn",
        noteNumber: event.note.midi,
        velocity: event.note.velocity
      });
    } else {
      events.push({
        deltaTime,
        channel: 0,
        type: "noteOff",
        noteNumber: event.note.midi,
        velocity: 0
      });
    }
  }

  events.push({ deltaTime: 0, meta: true, type: "endOfTrack" });

  return new Uint8Array(
    writeMidi({
      header: {
        format: 0,
        numTracks: 1,
        ticksPerBeat: PPQ
      },
      tracks: [events as never[]]
    })
  );
};
