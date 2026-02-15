import { clamp } from "../utils/math";

export const estimateTapTempo = (tapTimesMs: number[]): number | null => {
  if (tapTimesMs.length < 2) {
    return null;
  }
  const intervals: number[] = [];
  for (let i = 1; i < tapTimesMs.length; i += 1) {
    const dt = tapTimesMs[i] - tapTimesMs[i - 1];
    if (dt > 0) {
      intervals.push(dt);
    }
  }
  if (intervals.length === 0) {
    return null;
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const trimmed = sorted.length > 2 ? sorted.slice(1, -1) : sorted;
  const avg = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  const bpm = 60000 / avg;
  return clamp(Math.round(bpm), 40, 240);
};
