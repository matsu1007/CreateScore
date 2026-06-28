import type {
  AnalyzeParams,
  PitchBackend,
  GridSetting,
  NoteQ,
  PitchFrame,
  ChordRoot
} from "../app/types";
import { createCrepeRuntime } from "./crepe/runtime";
import { estimateChordRoots } from "./chordRoot";
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

const resolveModelUrl = (params: AnalyzeParams): string => {
  const file = params.modelVariant === "full" ? "crepe_full.onnx" : "crepe_tiny.onnx";
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const modelBase = new URL(baseUrl, globalThis.location?.href ?? "http://localhost/");
  return new URL(`model/${file}`, modelBase).toString();
};

const toPreferred = (backend: AnalyzeParams["pitchBackend"]): "webgpu" | "wasm" =>
  backend === "crepe-webgpu" ? "webgpu" : "wasm";

type PipelineResult = {
  frames: PitchFrame[];
  notesQ: NoteQ[];
  chordRoots: ChordRoot[];
  pitchBackendUsed: PitchBackend;
};

export const analyzePipeline = async ({
  samples,
  sampleRate,
  grid,
  params,
  onProgress
}: AnalyzePipelineInput): Promise<PipelineResult> => {
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

  const estimateWithYin = () =>
    estimatePitchFrames(samples, sampleRate, vad, {
      confMin: params.confMin,
      fmin: params.fmin,
      fmax: params.fmax
    });

  let pitchFrames = estimateWithYin();
  let pitchBackendUsed: PitchBackend = "yin";
  if (params.pitchBackend !== "yin") {
    const audioBuffer = new Float32Array(samples).buffer;
    const modelUrl = resolveModelUrl(params);
    let runtime = null;
    try {
      runtime = await createCrepeRuntime({
        modelUrl,
        preferred: toPreferred(params.pitchBackend),
        normalizeMode: params.normalizeMode,
        outputKind: params.outputKind,
        confMin: params.confMin,
        batchFrames: params.batchFrames
      });
      onProgress?.("pitch", 0.35);
      pitchFrames = await runtime.analyze({
        audioBuffer,
        sampleRate,
        batchFrames: params.batchFrames,
        onProgress: (doneFrames, totalFrames) => {
          const ratio = totalFrames > 0 ? doneFrames / totalFrames : 1;
          onProgress?.("pitch", 0.35 + Math.min(1, Math.max(0, ratio)) * 0.3);
        }
      });
      pitchBackendUsed = runtime.backend === "webgpu" ? "crepe-webgpu" : "crepe-wasm";
    } catch (crepeError) {
      // CREPE経路が使えない場合はYINへフォールバック
      console.error("[CREPE] 初期化/推論失敗 → YIN フォールバック:", crepeError);
      pitchFrames = estimateWithYin();
      pitchBackendUsed = "yin";
    } finally {
      await runtime?.release();
    }
  } else {
    onProgress?.("pitch", 0.45);
    pitchBackendUsed = "yin";
  }

  const frames = smoothPitchFrames(pitchFrames, 11);

  onProgress?.("segment", 0.7);
  const notesRaw = segmentNotes(frames, {
    stableFrames: 8,
    jitterToleranceFrames: 3,
    deadbandCent: params.deadbandCent,
    minNoteSec: 0.10,
    silenceEndMs: 50,
    hopMs: params.hopMs
  });

  // Trim leading silence: shift all notes so the first note starts at t=0
  const silenceOffset = notesRaw.length > 0 ? notesRaw[0].startSec : 0;
  const notesAligned =
    silenceOffset > 0
      ? notesRaw.map((n) => ({ ...n, startSec: n.startSec - silenceOffset, endSec: n.endSec - silenceOffset }))
      : notesRaw;

  onProgress?.("quantize", 0.9);
  const notesQ = quantizeNotes(notesAligned, grid);
  const chordRoots = estimateChordRoots(notesQ, grid);

  return {
    frames,
    notesQ,
    chordRoots,
    pitchBackendUsed
  };
};
