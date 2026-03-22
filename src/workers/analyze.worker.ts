/// <reference lib="webworker" />

import type { AnalyzeError, AnalyzeRequest, AnalyzeResult } from "../app/types";
import { analyzePipeline } from "../dsp/analyzePipeline";

const ctx: DedicatedWorkerGlobalScope = self as never;

ctx.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  try {
    const { audioBuffer, sampleRate, grid, params } = event.data;
    const samples = new Float32Array(audioBuffer);
    const { frames, notesRaw, notesQ, pitchBackendUsed } = await analyzePipeline({
      samples,
      sampleRate,
      grid,
      params,
      onProgress: (stage, progress) => {
        ctx.postMessage({
          type: "progress",
          stage,
          progress
        });
      }
    });

    const result: AnalyzeResult = {
      type: "result",
      frames,
      notesRaw,
      notesQ,
      pitchBackendUsed
    };
    ctx.postMessage(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析中にエラーが発生しました";
    const payload: AnalyzeError = {
      type: "error",
      code: "ANALYZE_FAILED",
      message
    };
    ctx.postMessage(payload);
  }
};

export {};
