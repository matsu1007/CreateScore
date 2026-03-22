import { describe, expect, it } from "vitest";
import {
  createCenteredFrameGrid,
  preprocessForCrepe
} from "./preprocess";

const meanStd = (values: Float32Array): { mean: number; std: number } => {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
  }
  const mean = sum / Math.max(1, values.length);

  let sq = 0;
  for (let i = 0; i < values.length; i += 1) {
    const d = values[i] - mean;
    sq += d * d;
  }
  const std = Math.sqrt(sq / Math.max(1, values.length));
  return { mean, std };
};

describe("createCenteredFrameGrid", () => {
  it("creates centered frames with head/tail zero padding", () => {
    const samples = new Float32Array([1, 2, 3, 4]);
    const result = createCenteredFrameGrid(samples, {
      sampleRate: 16000,
      windowSize: 4,
      hopSize: 2
    });

    expect(result.frameCount).toBe(3);
    expect(Array.from(result.frames)).toEqual([
      0, 0, 1, 2,
      1, 2, 3, 4,
      3, 4, 0, 0
    ]);
    expect(result.timestampsSec[0]).toBeCloseTo(0, 8);
    expect(result.timestampsSec[1]).toBeCloseTo(2 / 16000, 8);
    expect(result.timestampsSec[2]).toBeCloseTo(4 / 16000, 8);
  });

  it("throws for non-16kHz input", () => {
    expect(() =>
      createCenteredFrameGrid(new Float32Array([0, 1, 2]), {
        sampleRate: 44100
      })
    ).toThrow("16000Hz");
  });
});

describe("preprocessForCrepe", () => {
  it("normalizes each frame independently in per_frame mode", () => {
    const samples = new Float32Array([1, 2, 3, 4]);
    const result = preprocessForCrepe(samples, {
      sampleRate: 16000,
      windowSize: 4,
      hopSize: 2,
      normalizeMode: "per_frame"
    });

    for (let i = 0; i < result.frameCount; i += 1) {
      const frame = result.frames.subarray(i * result.windowSize, (i + 1) * result.windowSize);
      const { mean, std } = meanStd(frame);
      expect(mean).toBeCloseTo(0, 5);
      expect(std).toBeCloseTo(1, 5);
    }
  });

  it("normalizes over all samples in per_batch mode", () => {
    const samples = new Float32Array([1, 2, 3, 4]);
    const result = preprocessForCrepe(samples, {
      sampleRate: 16000,
      windowSize: 4,
      hopSize: 2,
      normalizeMode: "per_batch"
    });

    const { mean, std } = meanStd(result.frames);
    expect(mean).toBeCloseTo(0, 5);
    expect(std).toBeCloseTo(1, 5);
  });
});
