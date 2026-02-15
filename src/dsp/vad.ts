import { percentile } from "../utils/math";

export type VadFrame = {
  index: number;
  startSample: number;
  tSec: number;
  rms: number;
  voiced: boolean;
};

export type VadResult = {
  frameLen: number;
  hop: number;
  threshold: number;
  frames: VadFrame[];
};

export type VadOptions = {
  frameLenMs?: number;
  hopMs?: number;
  silenceConfirmMs?: number;
  voiceConfirmMs?: number;
  thresholdScale?: number;
};

const computeRms = (samples: Float32Array, start: number, len: number): number => {
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    const s = samples[start + i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / len);
};

export const runVad = (
  samples: Float32Array,
  sampleRate: number,
  options: VadOptions = {}
): VadResult => {
  const frameLen = Math.max(1, Math.round(((options.frameLenMs ?? 30) / 1000) * sampleRate));
  const hop = Math.max(1, Math.round(((options.hopMs ?? 10) / 1000) * sampleRate));
  const voiceConfirm = Math.max(
    1,
    Math.round((options.voiceConfirmMs ?? 50) / (options.hopMs ?? 10))
  );
  const silenceConfirm = Math.max(
    1,
    Math.round((options.silenceConfirmMs ?? 100) / (options.hopMs ?? 10))
  );

  const rmsValues: number[] = [];
  const starts: number[] = [];
  for (let start = 0; start + frameLen <= samples.length; start += hop) {
    starts.push(start);
    rmsValues.push(computeRms(samples, start, frameLen));
  }

  const threshold = percentile(rmsValues, 20) * (options.thresholdScale ?? 1.5);

  const frames: VadFrame[] = [];
  let voiced = false;
  let aboveCount = 0;
  let belowCount = 0;
  for (let i = 0; i < rmsValues.length; i += 1) {
    const rms = rmsValues[i];
    if (rms >= threshold) {
      aboveCount += 1;
      belowCount = 0;
    } else {
      belowCount += 1;
      aboveCount = 0;
    }

    if (!voiced && aboveCount >= voiceConfirm) {
      voiced = true;
    }
    if (voiced && belowCount >= silenceConfirm) {
      voiced = false;
    }

    frames.push({
      index: i,
      startSample: starts[i],
      tSec: starts[i] / sampleRate,
      rms,
      voiced
    });
  }

  return {
    frameLen,
    hop,
    threshold,
    frames
  };
};
