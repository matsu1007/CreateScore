import type { PitchFrame } from "../app/types";
import { median } from "../utils/math";

const f0ToMidi = (f0: number): number => 69 + 12 * Math.log2(f0 / 440);
const midiToF0 = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export const smoothPitchFrames = (frames: PitchFrame[], medianWindow = 7): PitchFrame[] => {
  const half = Math.floor(medianWindow / 2);
  const midiSeq = frames.map((frame) => (frame.f0Hz ? f0ToMidi(frame.f0Hz) : null));
  const medianFiltered = midiSeq.map((value, index) => {
    if (value === null) {
      return null;
    }
    const values: number[] = [];
    for (let i = Math.max(0, index - half); i <= Math.min(midiSeq.length - 1, index + half); i += 1) {
      if (midiSeq[i] !== null) {
        values.push(midiSeq[i] as number);
      }
    }
    return values.length === 0 ? value : median(values);
  });

  const corrected = [...medianFiltered];
  for (let i = 1; i < corrected.length - 1; i += 1) {
    const prev = corrected[i - 1];
    const curr = corrected[i];
    const next = corrected[i + 1];
    if (prev === null || curr === null || next === null) {
      continue;
    }
    if (Math.abs(curr - prev) >= 10 && Math.abs(next - prev) <= 2) {
      corrected[i] = prev;
    }
  }

  return frames.map((frame, index) => {
    const midi = corrected[index];
    return {
      ...frame,
      f0Hz: midi === null ? null : midiToF0(midi)
    };
  });
};
