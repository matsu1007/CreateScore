import { describe, expect, it } from "vitest";
import { estimateTapTempo } from "./tapTempo";

describe("estimateTapTempo", () => {
  it("estimates bpm from tap intervals and trims outlier", () => {
    const taps = [0, 500, 1000, 1500, 2000, 3500];
    expect(estimateTapTempo(taps)).toBe(120);
  });

  it("returns null when not enough taps", () => {
    expect(estimateTapTempo([0])).toBeNull();
  });
});
