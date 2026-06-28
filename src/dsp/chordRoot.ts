import type { ChordRoot, GridSetting, NoteQ } from "../app/types";
import { gridTicksPerQuarter } from "./quantize";

// Krumhansl-Schmuckler key profiles (C-rooted, index 0 = C)
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Precompute all 12 rotations so template[r][i] = profile weight for pitch class i given root r
const buildTemplates = (profile: number[]): number[][] =>
  Array.from({ length: 12 }, (_, r) =>
    Array.from({ length: 12 }, (_, i) => profile[(i - r + 12) % 12])
  );

const MAJOR_TPL = buildTemplates(MAJOR);
const MINOR_TPL = buildTemplates(MINOR);

const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na * nb);
  return denom === 0 ? 0 : dot / denom;
};

export const estimateChordRoots = (notes: NoteQ[], grid: GridSetting): ChordRoot[] => {
  if (notes.length === 0) {
    return [];
  }

  const ticksPerMeasure = gridTicksPerQuarter(grid.division) * 4;

  // Measure numbering starts from the measure containing the first note
  const minTick = Math.min(...notes.map((n) => n.startTick));
  const firstAbsMeasure = Math.floor(minTick / ticksPerMeasure);

  // Build duration-weighted chroma vector per absolute measure
  const chromaByMeasure = new Map<number, number[]>();
  for (const note of notes) {
    const absMeasure = Math.floor(note.startTick / ticksPerMeasure);
    if (!chromaByMeasure.has(absMeasure)) {
      chromaByMeasure.set(absMeasure, new Array(12).fill(0));
    }
    const pc = ((note.midi % 12) + 12) % 12;
    chromaByMeasure.get(absMeasure)![pc] += note.durationTick;
  }

  const result: ChordRoot[] = [];
  for (const [absMeasure, chroma] of chromaByMeasure) {
    let bestRoot = 0;
    let bestScore = -1;
    for (let r = 0; r < 12; r++) {
      const score = Math.max(cosine(chroma, MAJOR_TPL[r]), cosine(chroma, MINOR_TPL[r]));
      if (score > bestScore) {
        bestScore = score;
        bestRoot = r;
      }
    }
    result.push({
      measure: absMeasure - firstAbsMeasure,
      startTick: absMeasure * ticksPerMeasure,
      rootPc: bestRoot,
      score: bestScore
    });
  }

  return result.sort((a, b) => a.measure - b.measure);
};
