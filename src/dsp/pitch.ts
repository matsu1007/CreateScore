import { PitchDetector } from "pitchy";
import type { PitchFrame } from "../app/types";
import type { VadResult } from "./vad";
import { clamp } from "../utils/math";

export type PitchOptions = {
  fmin?: number;
  fmax?: number;
  confMin?: number;
};

export const estimatePitchFrames = (
  samples: Float32Array,
  sampleRate: number,
  vad: VadResult,
  options: PitchOptions = {}
): PitchFrame[] => {
  const fmin = options.fmin ?? 80;
  const fmax = options.fmax ?? 1000;
  const confMin = options.confMin ?? 0.3;
  const detector = PitchDetector.forFloat32Array(vad.frameLen);

  return vad.frames.map((frame) => {
    if (!frame.voiced) {
      return {
        tSec: frame.tSec,
        f0Hz: null,
        conf: 0,
        rms: frame.rms
      };
    }

    const segment = samples.subarray(frame.startSample, frame.startSample + vad.frameLen);
    const [frequency, clarity] = detector.findPitch(segment, sampleRate);
    const conf = clamp(clarity, 0, 1);

    if (!Number.isFinite(frequency) || frequency < fmin || frequency > fmax || conf < confMin) {
      return {
        tSec: frame.tSec,
        f0Hz: null,
        conf,
        rms: frame.rms
      };
    }

    return {
      tSec: frame.tSec,
      f0Hz: frequency,
      conf,
      rms: frame.rms
    };
  });
};
