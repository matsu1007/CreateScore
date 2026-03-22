import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzeParams, GridSetting, NoteQ, NoteRaw, PitchFrame } from "../app/types";

vi.mock("./crepe/runtime", () => ({
  createCrepeRuntime: vi.fn()
}));

vi.mock("./pitch", () => ({
  estimatePitchFrames: vi.fn()
}));

vi.mock("./smooth", () => ({
  smoothPitchFrames: vi.fn()
}));

vi.mock("./segment", () => ({
  segmentNotes: vi.fn()
}));

vi.mock("./quantize", () => ({
  quantizeNotes: vi.fn()
}));

vi.mock("./vad", () => ({
  runVad: vi.fn()
}));

import { createCrepeRuntime } from "./crepe/runtime";
import { analyzePipeline } from "./analyzePipeline";
import { estimatePitchFrames } from "./pitch";
import { quantizeNotes } from "./quantize";
import { runVad } from "./vad";
import { segmentNotes } from "./segment";
import { smoothPitchFrames } from "./smooth";

const grid: GridSetting = {
  bpm: 120,
  timeSig: { num: 4, den: 4 },
  division: "1/16"
};

const baseParams: AnalyzeParams = {
  frameLenMs: 30,
  hopMs: 10,
  confMin: 0.3,
  fmin: 80,
  fmax: 1000,
  deadbandCent: 35,
  pitchBackend: "yin",
  modelVariant: "tiny",
  normalizeMode: "per_frame",
  outputKind: "prob",
  batchFrames: 256
};

const yinFrames: PitchFrame[] = [{ tSec: 0, f0Hz: 440, conf: 0.9, rms: 0.1 }];
const crepeFrames: PitchFrame[] = [{ tSec: 0, f0Hz: 445, conf: 0.8, rms: 0.1 }];
const notesRaw: NoteRaw[] = [{ id: "raw-1", midi: 69, startSec: 0, endSec: 0.2, conf: 0.8 }];
const notesQ: NoteQ[] = [{ id: "q-1", midi: 69, startTick: 0, durationTick: 2, velocity: 90 }];

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(runVad).mockReturnValue({
    frameLen: 480,
    hop: 160,
    threshold: 0.1,
    enterThreshold: 0.1,
    exitThreshold: 0.08,
    frames: []
  });
  vi.mocked(estimatePitchFrames).mockReturnValue(yinFrames);
  vi.mocked(smoothPitchFrames).mockImplementation((frames) => frames);
  vi.mocked(segmentNotes).mockReturnValue(notesRaw);
  vi.mocked(quantizeNotes).mockReturnValue(notesQ);
});

describe("analyzePipeline backend selection", () => {
  it("uses YIN path when pitchBackend is yin", async () => {
    const result = await analyzePipeline({
      samples: new Float32Array(1600),
      sampleRate: 16000,
      grid,
      params: {
        ...baseParams,
        pitchBackend: "yin"
      }
    });

    expect(createCrepeRuntime).not.toHaveBeenCalled();
    expect(result.frames).toEqual(yinFrames);
    expect(result.pitchBackendUsed).toBe("yin");
  });

  it("uses CREPE runtime when available", async () => {
    const analyzeMock = vi.fn().mockResolvedValue(crepeFrames);
    const releaseMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createCrepeRuntime).mockResolvedValue({
      backend: "webgpu",
      modelInfo: {},
      analyze: analyzeMock,
      release: releaseMock
    });

    const result = await analyzePipeline({
      samples: new Float32Array(1600),
      sampleRate: 16000,
      grid,
      params: {
        ...baseParams,
        pitchBackend: "crepe-webgpu"
      }
    });

    expect(createCrepeRuntime).toHaveBeenCalledTimes(1);
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(result.frames).toEqual(crepeFrames);
    expect(result.pitchBackendUsed).toBe("crepe-webgpu");
  });

  it("falls back to YIN when CREPE runtime initialization fails", async () => {
    vi.mocked(createCrepeRuntime).mockRejectedValue(new Error("runtime init failed"));

    const result = await analyzePipeline({
      samples: new Float32Array(1600),
      sampleRate: 16000,
      grid,
      params: {
        ...baseParams,
        pitchBackend: "crepe-wasm"
      }
    });

    expect(createCrepeRuntime).toHaveBeenCalledTimes(1);
    expect(result.frames).toEqual(yinFrames);
    expect(result.pitchBackendUsed).toBe("yin");
  });
});
