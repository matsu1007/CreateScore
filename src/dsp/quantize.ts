import type { GridSetting, NoteQ, NoteRaw } from "../app/types";
import { createId } from "../utils/id";

const gridSecFromSetting = (grid: GridSetting): number => {
  const beatSec = 60 / grid.bpm;
  const ticksPerQuarter = gridTicksPerQuarter(grid.division);
  return beatSec / ticksPerQuarter;
};

export const quantizeNotes = (notesRaw: NoteRaw[], grid: GridSetting): NoteQ[] => {
  const gridSec = gridSecFromSetting(grid);
  const notes = notesRaw.map<NoteQ>((note) => {
    const startTick = Math.round(note.startSec / gridSec);
    const endTick = Math.round(note.endSec / gridSec);
    return {
      id: note.id || createId("q"),
      midi: note.midi,
      startTick,
      durationTick: Math.max(1, endTick - startTick),
      velocity: 90
    };
  });

  notes.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);

  const merged: NoteQ[] = [];
  for (const note of notes) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(note);
      continue;
    }
    const sameStart = prev.startTick === note.startTick;
    const sameMidi = prev.midi === note.midi;
    if (sameStart && sameMidi) {
      const prevEnd = prev.startTick + prev.durationTick;
      const nextEnd = note.startTick + note.durationTick;
      prev.durationTick = Math.max(1, Math.max(prevEnd, nextEnd) - prev.startTick);
      continue;
    }
    merged.push(note);
  }

  return merged;
};

export const gridTicksPerQuarter = (division: GridSetting["division"]): number =>
  division === "1/8" ? 2 : division === "1/16" ? 4 : 8;
