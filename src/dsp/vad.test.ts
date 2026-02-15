import { describe, expect, it } from "vitest";
import { runVad } from "./vad";

const createSamples = (frameAmplitudes: number[], samplesPerFrame = 10): Float32Array => {
  const samples = new Float32Array(frameAmplitudes.length * samplesPerFrame);
  frameAmplitudes.forEach((amplitude, frameIndex) => {
    const offset = frameIndex * samplesPerFrame;
    for (let i = 0; i < samplesPerFrame; i += 1) {
      samples[offset + i] = amplitude;
    }
  });
  return samples;
};

describe("runVad", () => {
  it("keeps voiced state when RMS stays above exit threshold but below enter threshold", () => {
    const amplitudes = [
      ...new Array(8).fill(0.1),
      0.3,
      0.3,
      0.3,
      0.13,
      0.13,
      0.13,
      0.1,
      0.1
    ];
    const result = runVad(createSamples(amplitudes), 1000, {
      frameLenMs: 10,
      hopMs: 10,
      voiceConfirmMs: 20,
      silenceConfirmMs: 20,
      enterThresholdScale: 1.5,
      exitThresholdScale: 1.2,
      preRollMs: 0
    });

    expect(result.enterThreshold).toBeGreaterThan(result.exitThreshold);
    expect(result.frames[12]?.voiced).toBe(true);
    expect(result.frames[15]?.voiced).toBe(false);
  });

  it("applies pre-roll when switching to voiced", () => {
    const amplitudes = [...new Array(8).fill(0.1), 0.3, 0.3, ...new Array(3).fill(0.1)];
    const result = runVad(createSamples(amplitudes), 1000, {
      frameLenMs: 10,
      hopMs: 10,
      voiceConfirmMs: 20,
      silenceConfirmMs: 20,
      enterThresholdScale: 1.5,
      exitThresholdScale: 1.2,
      preRollMs: 20
    });

    expect(result.frames[7]?.voiced).toBe(true);
    expect(result.frames[8]?.voiced).toBe(true);
    expect(result.frames[9]?.voiced).toBe(true);
  });

  it("does not end voiced state on a single short dip", () => {
    const amplitudes = [
      ...new Array(8).fill(0.1),
      0.3,
      0.3,
      0.3,
      0.1,
      0.3,
      0.3,
      0.1,
      0.1
    ];
    const result = runVad(createSamples(amplitudes), 1000, {
      frameLenMs: 10,
      hopMs: 10,
      voiceConfirmMs: 20,
      silenceConfirmMs: 20,
      enterThresholdScale: 1.5,
      exitThresholdScale: 1.2,
      preRollMs: 0
    });

    expect(result.frames[11]?.voiced).toBe(true);
    expect(result.frames[15]?.voiced).toBe(false);
  });
});
