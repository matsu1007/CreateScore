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
  enterThreshold: number;
  exitThreshold: number;
  frames: VadFrame[];
};

export type VadOptions = {
  frameLenMs?: number;
  hopMs?: number;
  silenceConfirmMs?: number;
  voiceConfirmMs?: number;
  thresholdScale?: number;
  enterThresholdScale?: number;
  exitThresholdScale?: number;
  preRollMs?: number;
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
  const hopMs = options.hopMs ?? 10;
  const frameLen = Math.max(1, Math.round(((options.frameLenMs ?? 30) / 1000) * sampleRate));
  const hop = Math.max(1, Math.round((hopMs / 1000) * sampleRate));
  const voiceConfirm = Math.max(
    1,
    Math.round((options.voiceConfirmMs ?? 50) / hopMs)
  );
  const silenceConfirm = Math.max(
    1,
    Math.round((options.silenceConfirmMs ?? 100) / hopMs)
  );
  const preRoll = Math.max(
    0,
    Math.round((options.preRollMs ?? 20) / hopMs)
  );

  const rmsValues: number[] = [];
  const starts: number[] = [];
  for (let start = 0; start + frameLen <= samples.length; start += hop) {
    starts.push(start);
    rmsValues.push(computeRms(samples, start, frameLen));
  }

  const baseThreshold = percentile(rmsValues, 20);
  const enterScale = options.enterThresholdScale ?? options.thresholdScale ?? 1.6;
  const exitScale = options.exitThresholdScale ?? Math.max(0, enterScale * 0.75);
  const enterThreshold = baseThreshold * enterScale;
  const exitThreshold = Math.min(enterThreshold, baseThreshold * exitScale);
  const threshold = enterThreshold;

  const voicedFlags = new Array<boolean>(rmsValues.length).fill(false);
  let voiced = false;
  let aboveCount = 0;
  let belowCount = 0;
  for (let i = 0; i < rmsValues.length; i += 1) {
    const rms = rmsValues[i];
    if (!voiced) {
      if (rms >= enterThreshold) {
        aboveCount += 1;
      } else {
        aboveCount = 0;
      }
      if (aboveCount >= voiceConfirm) {
        voiced = true;
        belowCount = 0;
        const preStart = Math.max(0, i - preRoll);
        for (let j = preStart; j <= i; j += 1) {
          voicedFlags[j] = true;
        }
      }
    } else {
      if (rms < exitThreshold) {
        belowCount += 1;
      } else {
        belowCount = 0;
      }
      if (belowCount >= silenceConfirm) {
        voiced = false;
        aboveCount = 0;
      }
    }

    voicedFlags[i] = voicedFlags[i] || voiced;
  }

  const frames: VadFrame[] = rmsValues.map((rms, i) => ({
    index: i,
    startSample: starts[i],
    tSec: starts[i] / sampleRate,
    rms,
    voiced: voicedFlags[i]
  }));

  return {
    frameLen,
    hop,
    threshold,
    enterThreshold,
    exitThreshold,
    frames
  };
};
