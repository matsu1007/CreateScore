import * as ort from "onnxruntime-web";
import type { NormalizeMode, OutputKind, PitchFrame } from "../../app/types";
import { clamp } from "../../utils/math";
import { extractActivation, makeInputTensor, resolveModelIO } from "./adapter";
import { decodeActivationToPitchFrames } from "./decode";
import { CREPE_WINDOW_SIZE, preprocessForCrepe } from "./preprocess";

type TensorMetadataLike = {
  isTensor: boolean;
  shape?: ReadonlyArray<number | string>;
};

export type CrepeRuntimeBackend = "webgpu" | "wasm";

export type CreateCrepeRuntimeInput = {
  modelUrl: string;
  preferred: CrepeRuntimeBackend;
  normalizeMode: NormalizeMode;
  outputKind: OutputKind;
  confMin?: number;
  batchFrames?: number;
  interpolateRadius?: number;
};

export type CrepeAnalyzeInput = {
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  batchFrames?: number;
  onProgress?: (doneFrames: number, totalFrames: number) => void;
};

export type CrepeRuntime = {
  backend: CrepeRuntimeBackend;
  modelInfo: { inputShape?: number[]; outputShape?: number[] };
  analyze: (input: CrepeAnalyzeInput) => Promise<PitchFrame[]>;
  release: () => Promise<void>;
};

const DEFAULT_CONF_MIN = 0.3;
const DEFAULT_BATCH_FRAMES = 256;
const MAX_BATCH_FRAMES = 1024;
const CREPE_CLASS_COUNT = 360;

const toShapeNumbers = (meta?: TensorMetadataLike): number[] | undefined => {
  if (!meta?.isTensor || !meta.shape) {
    return undefined;
  }
  return meta.shape.map((dim) => (typeof dim === "number" ? dim : -1));
};

const fetchModelBuffer = async (modelUrl: string): Promise<ArrayBuffer> => {
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Model fetch failed: HTTP ${response.status} — ${modelUrl}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = await response.arrayBuffer();
  // HTML が返ってきた場合（404ページ等）を早期検出
  if (contentType.includes("text/html") || buffer.byteLength < 100) {
    throw new Error(
      `Model response looks invalid (content-type: ${contentType}, size: ${buffer.byteLength}B) — ${modelUrl}`
    );
  }
  return buffer;
};

const createSessionWithFallback = async (
  modelUrl: string,
  preferred: CrepeRuntimeBackend
): Promise<{ session: ort.InferenceSession; backend: CrepeRuntimeBackend }> => {
  ort.env.wasm.proxy = false;
  ort.env.wasm.numThreads = 1; // SharedArrayBuffer 不要（COOP/COEP なし環境でも動作）
  const baseUrl: string = import.meta.env.BASE_URL ?? "/";
  ort.env.wasm.wasmPaths = baseUrl.replace(/\/$/, "") + "/ort/";

  // URL 渡しではなく ArrayBuffer 渡しにすることで fetch エラーを明確に分離する
  const modelBuffer = await fetchModelBuffer(modelUrl);

  const order: CrepeRuntimeBackend[] = preferred === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
  let lastError: unknown = null;

  for (const backend of order) {
    try {
      const session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: [backend]
      });
      return { session, backend };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to initialize ONNX session (preferred=${preferred}). ${
      lastError instanceof Error ? lastError.message : "Unknown error."
    }`
  );
};

const runWarmup = async (
  session: ort.InferenceSession,
  inputName: string,
  outputName: string,
  inputShape?: readonly number[]
): Promise<void> => {
  const warmup = makeInputTensor(new Float32Array(CREPE_WINDOW_SIZE), 1, {
    inputShape,
    windowSize: CREPE_WINDOW_SIZE
  });
  const tensor = new ort.Tensor("float32", warmup.data, warmup.dims);
  await session.run({ [inputName]: tensor }, [outputName]);
};

const normalizeBatchFrames = (value?: number): number =>
  clamp(Math.floor(value ?? DEFAULT_BATCH_FRAMES), 1, MAX_BATCH_FRAMES);

export const createCrepeRuntime = async (
  input: CreateCrepeRuntimeInput
): Promise<CrepeRuntime> => {
  const { session, backend } = await createSessionWithFallback(input.modelUrl, input.preferred);
  const io = resolveModelIO(session);

  const inputMeta = session.inputMetadata.find((meta) => meta.name === io.inputName) as
    | TensorMetadataLike
    | undefined;
  const outputMeta = session.outputMetadata.find((meta) => meta.name === io.outputName) as
    | TensorMetadataLike
    | undefined;

  const inputShape = toShapeNumbers(inputMeta);
  const outputShape = toShapeNumbers(outputMeta);

  await runWarmup(session, io.inputName, io.outputName, inputShape);

  const confMin = input.confMin ?? DEFAULT_CONF_MIN;
  const defaultBatchFrames = normalizeBatchFrames(input.batchFrames);
  const interpolateRadius = Math.max(0, Math.floor(input.interpolateRadius ?? 0));

  return {
    backend,
    modelInfo: {
      inputShape,
      outputShape
    },
    analyze: async (analyzeInput: CrepeAnalyzeInput): Promise<PitchFrame[]> => {
      const batchFrames = normalizeBatchFrames(analyzeInput.batchFrames ?? defaultBatchFrames);
      const samples = new Float32Array(analyzeInput.audioBuffer);
      const preprocessed = preprocessForCrepe(samples, {
        sampleRate: analyzeInput.sampleRate,
        normalizeMode: input.normalizeMode
      });

      const totalFrames = preprocessed.frameCount;
      const activation = new Float32Array(totalFrames * CREPE_CLASS_COUNT);

      for (let offset = 0; offset < totalFrames; offset += batchFrames) {
        const currentBatch = Math.min(batchFrames, totalFrames - offset);
        const srcStart = offset * preprocessed.windowSize;
        const srcEnd = (offset + currentBatch) * preprocessed.windowSize;
        const frameSlice = preprocessed.frames.subarray(srcStart, srcEnd);

        const inputTensor = makeInputTensor(frameSlice, currentBatch, {
          inputShape,
          windowSize: preprocessed.windowSize
        });
        const feeds = {
          [io.inputName]: new ort.Tensor("float32", inputTensor.data, inputTensor.dims)
        };
        const outputs = await session.run(feeds, [io.outputName]);
        const outputTensor = outputs[io.outputName] as
          | { data: Float32Array | ArrayLike<number>; dims: readonly number[] }
          | undefined;
        if (!outputTensor) {
          throw new Error(`Model output "${io.outputName}" was not returned.`);
        }

        const batchActivation = extractActivation(outputTensor, outputShape);
        const expected = currentBatch * CREPE_CLASS_COUNT;
        if (batchActivation.length !== expected) {
          throw new Error(
            `Unexpected activation size: expected ${expected}, got ${batchActivation.length}.`
          );
        }

        activation.set(batchActivation, offset * CREPE_CLASS_COUNT);
        analyzeInput.onProgress?.(offset + currentBatch, totalFrames);
      }

      return decodeActivationToPitchFrames(activation, {
        outputKind: input.outputKind,
        confMin,
        timestampsSec: preprocessed.timestampsSec,
        interpolateRadius
      });
    },
    release: async (): Promise<void> => {
      await session.release();
    }
  };
};
