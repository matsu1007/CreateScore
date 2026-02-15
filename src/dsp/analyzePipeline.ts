import type {
  AnalyzeParams,
  AnalyzeResult,
  GridSetting
} from "../app/types";
import { estimatePitchFrames } from "./pitch";
import { quantizeNotes } from "./quantize";
import { segmentNotes } from "./segment";
import { smoothPitchFrames } from "./smooth";
import { runVad } from "./vad";

export type AnalyzeProgressStage = "vad" | "pitch" | "segment" | "quantize";

type AnalyzePipelineInput = {
  samples: Float32Array;
  sampleRate: number;
  grid: GridSetting;
  params: AnalyzeParams;
  onProgress?: (stage: AnalyzeProgressStage, progress: number) => void;
};

export const analyzePipeline = ({
  samples,
  sampleRate,
  grid,
  params,
  onProgress
}: AnalyzePipelineInput): Omit<AnalyzeResult, "type"> => {
  onProgress?.("vad", 0.2);
  const vad = runVad(samples, sampleRate, {
    frameLenMs: params.frameLenMs,
    hopMs: params.hopMs,
    silenceConfirmMs: 140,
    voiceConfirmMs: 50,
    enterThresholdScale: 1.5,
    exitThresholdScale: 1.2,
    preRollMs: 30
  });

  onProgress?.("pitch", 0.45);
  const frames = smoothPitchFrames(
    estimatePitchFrames(samples, sampleRate, vad, {
      confMin: params.confMin,
      fmin: params.fmin,
      fmax: params.fmax
    }),
    7
  );

  onProgress?.("segment", 0.7);
  const notesRaw = segmentNotes(frames, {
    stableFrames: 8,
    jitterToleranceFrames: 3,
    minNoteSec: 0.06,
    silenceEndMs: 50,
    hopMs: params.hopMs
  });

  onProgress?.("quantize", 0.9);
  const notesQ = quantizeNotes(notesRaw, grid);

  return {
    frames,
    notesRaw,
    notesQ
  };
};
