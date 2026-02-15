import type { NoteRaw, PitchFrame } from "../app/types";
import { createId } from "../utils/id";
import { median } from "../utils/math";

const f0ToMidi = (f0: number): number => 69 + 12 * Math.log2(f0 / 440);

type SegmentOptions = {
  stableFrames?: number;
  jitterToleranceFrames?: number;
  minNoteSec?: number;
  silenceEndMs?: number;
  hopMs?: number;
};

type NoteBuilder = {
  startIndex: number;
  endIndex: number;
  midiValues: number[];
  confValues: number[];
};

const finalizeBuilder = (
  builder: NoteBuilder,
  frames: PitchFrame[],
  hopSec: number,
  frameLenSec: number
): NoteRaw => {
  const midi = Math.round(median(builder.midiValues));
  const conf =
    builder.confValues.reduce((sum, value) => sum + value, 0) / Math.max(1, builder.confValues.length);
  return {
    id: createId("raw"),
    midi,
    startSec: frames[builder.startIndex].tSec,
    endSec: frames[builder.endIndex].tSec + frameLenSec,
    conf
  };
};

const mergeShortNotes = (notes: NoteRaw[], minNoteSec: number): NoteRaw[] => {
  if (notes.length <= 1) {
    return notes;
  }

  const result: NoteRaw[] = [];
  for (const note of notes) {
    const duration = note.endSec - note.startSec;
    if (duration >= minNoteSec) {
      result.push(note);
      continue;
    }

    const prev = result[result.length - 1];
    if (prev && prev.midi === note.midi) {
      prev.endSec = note.endSec;
      prev.conf = (prev.conf + note.conf) * 0.5;
      continue;
    }

    const next = notes[notes.indexOf(note) + 1];
    if (next && next.midi === note.midi) {
      next.startSec = note.startSec;
      next.conf = (next.conf + note.conf) * 0.5;
      continue;
    }

    if (prev) {
      prev.endSec = note.endSec;
      prev.conf = (prev.conf + note.conf) * 0.5;
      continue;
    }

    result.push(note);
  }

  return result;
};

export const segmentNotes = (frames: PitchFrame[], options: SegmentOptions = {}): NoteRaw[] => {
  if (frames.length === 0) {
    return [];
  }

  const stableFrames = options.stableFrames ?? 8;
  const jitterToleranceFrames = options.jitterToleranceFrames ?? 3;
  const minNoteSec = options.minNoteSec ?? 0.06;
  const silenceFrames = Math.max(1, Math.round((options.silenceEndMs ?? 50) / (options.hopMs ?? 10)));
  const hopSec = frames.length > 1 ? Math.max(1e-6, frames[1].tSec - frames[0].tSec) : 0.01;
  const frameLenSec = 0.03;

  const notes: NoteRaw[] = [];

  let builder: NoteBuilder | null = null;
  let mismatchStart = -1;
  let mismatchCount = 0;
  let silenceCount = 0;

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (frame.f0Hz === null) {
      silenceCount += 1;
      if (builder && silenceCount >= silenceFrames) {
        notes.push(finalizeBuilder(builder, frames, hopSec, frameLenSec));
        builder = null;
      }
      continue;
    }

    silenceCount = 0;
    const midiFloat = f0ToMidi(frame.f0Hz);

    if (!builder) {
      builder = {
        startIndex: i,
        endIndex: i,
        midiValues: [midiFloat],
        confValues: [frame.conf]
      };
      mismatchStart = -1;
      mismatchCount = 0;
      continue;
    }

    const currentMidi = Math.round(median(builder.midiValues));
    const incomingMidi = Math.round(midiFloat);

    if (Math.abs(incomingMidi - currentMidi) <= 0.5) {
      builder.endIndex = i;
      builder.midiValues.push(midiFloat);
      builder.confValues.push(frame.conf);
      mismatchStart = -1;
      mismatchCount = 0;
      continue;
    }

    if (mismatchStart < 0) {
      mismatchStart = i;
    }
    mismatchCount += 1;

    if (mismatchCount <= jitterToleranceFrames) {
      builder.endIndex = i;
      builder.midiValues.push(midiFloat);
      builder.confValues.push(frame.conf);
      continue;
    }

    const stableLen = mismatchStart - builder.startIndex;
    if (stableLen >= stableFrames) {
      builder.endIndex = mismatchStart - 1;
      notes.push(finalizeBuilder(builder, frames, hopSec, frameLenSec));
      builder = {
        startIndex: mismatchStart,
        endIndex: i,
        midiValues: [f0ToMidi(frames[mismatchStart].f0Hz as number), midiFloat],
        confValues: [frames[mismatchStart].conf, frame.conf]
      };
    } else {
      builder.endIndex = i;
      builder.midiValues.push(midiFloat);
      builder.confValues.push(frame.conf);
    }

    mismatchStart = -1;
    mismatchCount = 0;
  }

  if (builder) {
    notes.push(finalizeBuilder(builder, frames, hopSec, frameLenSec));
  }

  const filtered = notes.filter((note) => note.endSec > note.startSec);
  return mergeShortNotes(filtered, minNoteSec);
};
