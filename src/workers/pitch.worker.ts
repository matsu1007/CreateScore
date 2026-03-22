/// <reference lib="webworker" />

import type {
  PitchWorkerAnalyzeRequest,
  PitchWorkerError,
  PitchWorkerInitRequest,
  PitchWorkerReady,
  PitchWorkerRequest,
  PitchWorkerResult
} from "../app/types";
import { createCrepeRuntime, type CrepeRuntime } from "../dsp/crepe/runtime";

const ctx: DedicatedWorkerGlobalScope = self as never;

let runtime: CrepeRuntime | null = null;
let isAnalyzing = false;

const postError = (code: string, message: string): void => {
  const payload: PitchWorkerError = {
    type: "ERROR",
    code,
    message
  };
  ctx.postMessage(payload);
};

const handleInit = async (message: PitchWorkerInitRequest): Promise<void> => {
  if (runtime) {
    await runtime.release();
    runtime = null;
  }

  runtime = await createCrepeRuntime({
    modelUrl: message.modelUrl,
    preferred: message.preferred,
    normalizeMode: message.normalizeMode,
    outputKind: message.outputKind
  });

  const ready: PitchWorkerReady = {
    type: "READY",
    backend: runtime.backend,
    modelInfo: runtime.modelInfo
  };
  ctx.postMessage(ready);
};

const handleAnalyze = async (message: PitchWorkerAnalyzeRequest): Promise<void> => {
  if (!runtime) {
    postError("NOT_INITIALIZED", "Pitch worker is not initialized. Send INIT first.");
    return;
  }
  if (isAnalyzing) {
    postError("BUSY", "Pitch worker is already analyzing.");
    return;
  }
  if (!(message.audioBuffer instanceof ArrayBuffer)) {
    postError("INVALID_AUDIO_BUFFER", "audioBuffer must be an ArrayBuffer.");
    return;
  }
  if (!Number.isFinite(message.sampleRate) || message.sampleRate <= 0) {
    postError("INVALID_SAMPLE_RATE", "sampleRate must be a positive number.");
    return;
  }

  isAnalyzing = true;
  try {
    const frames = await runtime.analyze({
      audioBuffer: message.audioBuffer,
      sampleRate: message.sampleRate,
      batchFrames: message.batchFrames,
      onProgress: (doneFrames, totalFrames) => {
        ctx.postMessage({
          type: "PROGRESS",
          doneFrames,
          totalFrames
        });
      }
    });

    const result: PitchWorkerResult = {
      type: "RESULT",
      frames
    };
    ctx.postMessage(result);
  } finally {
    isAnalyzing = false;
  }
};

const handleMessage = async (message: PitchWorkerRequest): Promise<void> => {
  if (!message || typeof message !== "object") {
    postError("INVALID_REQUEST", "Worker request is invalid.");
    return;
  }

  if (message.type === "INIT") {
    await handleInit(message);
    return;
  }
  if (message.type === "ANALYZE") {
    await handleAnalyze(message);
    return;
  }

  postError("UNSUPPORTED_REQUEST", "Unsupported worker request type.");
};

ctx.onmessage = (event: MessageEvent<PitchWorkerRequest>) => {
  void handleMessage(event.data).catch((error) => {
    postError(
      "WORKER_RUNTIME_ERROR",
      error instanceof Error ? error.message : "Unknown worker error."
    );
  });
};

export {};
