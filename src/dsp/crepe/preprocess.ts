import type { NormalizeMode } from "../../app/types";

export const CREPE_SAMPLE_RATE = 16000;
export const CREPE_WINDOW_SIZE = 1024;
export const CREPE_HOP_SIZE = 160;
export const CREPE_PAD_SIZE = CREPE_WINDOW_SIZE / 2;
export const CREPE_NORMALIZE_EPS = 1e-8;

type BasePreprocessOptions = {
  sampleRate?: number;
  windowSize?: number;
  hopSize?: number;
};

export type CrepePreprocessOptions = BasePreprocessOptions & {
  normalizeMode?: NormalizeMode;
  eps?: number;
};

export type CrepeFrameGrid = {
  frames: Float32Array;
  frameCount: number;
  windowSize: number;
  hopSize: number;
  timestampsSec: Float32Array;
};

export type CrepePreprocessResult = CrepeFrameGrid & {
  normalizeMode: NormalizeMode;
  eps: number;
};

const assertSampleRate = (sampleRate: number): void => {
  if (sampleRate !== CREPE_SAMPLE_RATE) {
    throw new Error(
      `CREPE preprocessing expects ${CREPE_SAMPLE_RATE}Hz input, got ${sampleRate}Hz.`
    );
  }
};

const calcMeanStd = (
  values: Float32Array,
  start: number,
  length: number
): { mean: number; std: number } => {
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    sum += values[start + i];
  }
  const mean = sum / Math.max(1, length);

  let sq = 0;
  for (let i = 0; i < length; i += 1) {
    const centered = values[start + i] - mean;
    sq += centered * centered;
  }
  const std = Math.sqrt(sq / Math.max(1, length));
  return { mean, std };
};

const normalizeRangeInPlace = (
  values: Float32Array,
  start: number,
  length: number,
  mean: number,
  std: number,
  eps: number
): void => {
  const denom = std + eps;
  for (let i = 0; i < length; i += 1) {
    values[start + i] = (values[start + i] - mean) / denom;
  }
};

export const createCenteredFrameGrid = (
  samples: Float32Array,
  options: BasePreprocessOptions = {}
): CrepeFrameGrid => {
  const sampleRate = options.sampleRate ?? CREPE_SAMPLE_RATE;
  assertSampleRate(sampleRate);

  const windowSize = options.windowSize ?? CREPE_WINDOW_SIZE;
  const hopSize = options.hopSize ?? CREPE_HOP_SIZE;
  const padSize = Math.floor(windowSize / 2);

  const padded = new Float32Array(samples.length + padSize * 2);
  padded.set(samples, padSize);

  const frameCount = Math.max(1, Math.floor(samples.length / hopSize) + 1);
  const frames = new Float32Array(frameCount * windowSize);
  const timestampsSec = new Float32Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const srcStart = frameIndex * hopSize;
    const dstStart = frameIndex * windowSize;
    frames.set(padded.subarray(srcStart, srcStart + windowSize), dstStart);
    timestampsSec[frameIndex] = (frameIndex * hopSize) / sampleRate;
  }

  return {
    frames,
    frameCount,
    windowSize,
    hopSize,
    timestampsSec
  };
};

export const preprocessForCrepe = (
  samples: Float32Array,
  options: CrepePreprocessOptions = {}
): CrepePreprocessResult => {
  const normalizeMode = options.normalizeMode ?? "per_frame";
  const eps = options.eps ?? CREPE_NORMALIZE_EPS;
  const frameGrid = createCenteredFrameGrid(samples, options);
  const normalized = new Float32Array(frameGrid.frames);

  if (normalizeMode === "per_batch") {
    const { mean, std } = calcMeanStd(normalized, 0, normalized.length);
    normalizeRangeInPlace(normalized, 0, normalized.length, mean, std, eps);
  } else {
    for (let frameIndex = 0; frameIndex < frameGrid.frameCount; frameIndex += 1) {
      const start = frameIndex * frameGrid.windowSize;
      const { mean, std } = calcMeanStd(normalized, start, frameGrid.windowSize);
      normalizeRangeInPlace(normalized, start, frameGrid.windowSize, mean, std, eps);
    }
  }

  return {
    ...frameGrid,
    frames: normalized,
    normalizeMode,
    eps
  };
};
