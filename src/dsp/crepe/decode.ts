import type { OutputKind, PitchFrame } from "../../app/types";
import { clamp } from "../../utils/math";

export const CREPE_BIN_COUNT = 360;
export const CREPE_FMIN_HZ = 32.70319566257483;
export const CREPE_CENT_STEP = 20;

export type DecodeCrepeOptions = {
  outputKind?: OutputKind;
  confMin?: number;
  timestampsSec?: Float32Array;
  hopSec?: number;
  interpolateRadius?: number;
};

const rowOffset = (frameIndex: number): number => frameIndex * CREPE_BIN_COUNT;

export const binToHz = (bin: number): number =>
  CREPE_FMIN_HZ * 2 ** ((bin * CREPE_CENT_STEP) / 1200);

const softmaxRow = (values: Float32Array, start: number): Float32Array => {
  let maxValue = -Infinity;
  for (let i = 0; i < CREPE_BIN_COUNT; i += 1) {
    maxValue = Math.max(maxValue, values[start + i]);
  }
  const probs = new Float32Array(CREPE_BIN_COUNT);
  let sum = 0;
  for (let i = 0; i < CREPE_BIN_COUNT; i += 1) {
    const v = Math.exp(values[start + i] - maxValue);
    probs[i] = v;
    sum += v;
  }
  const denom = sum > 0 ? sum : 1;
  for (let i = 0; i < CREPE_BIN_COUNT; i += 1) {
    probs[i] /= denom;
  }
  return probs;
};

const argMax = (values: Float32Array): number => {
  let bestIndex = 0;
  let bestValue = values[0] ?? -Infinity;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > bestValue) {
      bestValue = values[i];
      bestIndex = i;
    }
  }
  return bestIndex;
};

const refineBin = (
  probs: Float32Array,
  argmaxBin: number,
  interpolateRadius: number
): number => {
  if (interpolateRadius <= 0) {
    return argmaxBin;
  }
  const start = Math.max(0, argmaxBin - interpolateRadius);
  const end = Math.min(CREPE_BIN_COUNT - 1, argmaxBin + interpolateRadius);
  let weightedSum = 0;
  let weight = 0;
  for (let k = start; k <= end; k += 1) {
    const p = Math.max(0, probs[k]);
    weightedSum += k * p;
    weight += p;
  }
  if (weight <= 0) {
    return argmaxBin;
  }
  return weightedSum / weight;
};

export const decodeActivationToPitchFrames = (
  activation: Float32Array,
  options: DecodeCrepeOptions = {}
): PitchFrame[] => {
  if (activation.length % CREPE_BIN_COUNT !== 0) {
    throw new Error(
      `Activation length must be a multiple of ${CREPE_BIN_COUNT}, got ${activation.length}.`
    );
  }

  const frameCount = activation.length / CREPE_BIN_COUNT;
  const outputKind = options.outputKind ?? "prob";
  const confMin = options.confMin ?? 0.3;
  const hopSec = options.hopSec ?? 0.01;
  const interpolateRadius = Math.max(0, Math.floor(options.interpolateRadius ?? 0));
  const timestamps = options.timestampsSec;
  if (timestamps && timestamps.length !== frameCount) {
    throw new Error(
      `timestampsSec length must equal frame count (${frameCount}), got ${timestamps.length}.`
    );
  }

  const frames: PitchFrame[] = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = rowOffset(frameIndex);
    const probs =
      outputKind === "logit"
        ? softmaxRow(activation, start)
        : activation.subarray(start, start + CREPE_BIN_COUNT);
    const argmaxBin = argMax(probs);
    const confidence = clamp(probs[argmaxBin] ?? 0, 0, 1);
    const refinedBin = refineBin(probs, argmaxBin, interpolateRadius);
    const f0Hz = confidence < confMin ? null : binToHz(refinedBin);
    frames.push({
      tSec: timestamps ? timestamps[frameIndex] : frameIndex * hopSec,
      f0Hz,
      conf: confidence,
      rms: 0
    });
  }
  return frames;
};
