import { describe, expect, it } from "vitest";
import {
  binToHz,
  CREPE_FMIN_HZ,
  decodeActivationToPitchFrames
} from "./decode";

describe("binToHz", () => {
  it("maps bin 0 to C1", () => {
    expect(binToHz(0)).toBeCloseTo(CREPE_FMIN_HZ, 10);
  });

  it("maps +60 bins to one octave above", () => {
    expect(binToHz(60)).toBeCloseTo(CREPE_FMIN_HZ * 2, 10);
  });
});

describe("decodeActivationToPitchFrames", () => {
  it("decodes probability activation and applies confMin", () => {
    const activation = new Float32Array(2 * 360);
    activation[120] = 0.8;
    activation[360 + 180] = 0.2;

    const frames = decodeActivationToPitchFrames(activation, {
      outputKind: "prob",
      confMin: 0.3,
      timestampsSec: new Float32Array([0, 0.01])
    });

    expect(frames).toHaveLength(2);
    expect(frames[0].tSec).toBeCloseTo(0, 8);
    expect(frames[0].conf).toBeCloseTo(0.8, 6);
    expect(frames[0].f0Hz).toBeCloseTo(binToHz(120), 8);
    expect(frames[1].conf).toBeCloseTo(0.2, 6);
    expect(frames[1].f0Hz).toBeNull();
  });

  it("decodes logit activation via softmax", () => {
    const activation = new Float32Array(360);
    activation[30] = 10;

    const frames = decodeActivationToPitchFrames(activation, {
      outputKind: "logit",
      confMin: 0
    });

    expect(frames).toHaveLength(1);
    expect(frames[0].conf).toBeGreaterThan(0.95);
    expect(frames[0].f0Hz).toBeCloseTo(binToHz(30), 8);
  });

  it("supports local weighted interpolation around argmax", () => {
    const activation = new Float32Array(360);
    activation[10] = 0.4;
    activation[11] = 0.6;

    const frames = decodeActivationToPitchFrames(activation, {
      outputKind: "prob",
      confMin: 0,
      interpolateRadius: 1
    });
    const expectedRefinedBin = (10 * 0.4 + 11 * 0.6) / (0.4 + 0.6);
    expect(frames[0].f0Hz).toBeCloseTo(binToHz(expectedRefinedBin), 8);
  });

  it("throws on invalid activation length", () => {
    expect(() =>
      decodeActivationToPitchFrames(new Float32Array(361), {
        outputKind: "prob"
      })
    ).toThrow("Activation length must be a multiple");
  });
});
