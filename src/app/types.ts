export type AudioBufferData = {
  sampleRate: number;
  samples: Float32Array;
  durationSec: number;
};

export type PitchFrame = {
  tSec: number;
  f0Hz: number | null;
  conf: number;
  rms: number;
};

export type NoteRaw = {
  id: string;
  midi: number;
  startSec: number;
  endSec: number;
  conf: number;
};

export type GridSetting = {
  bpm: number;
  timeSig: { num: 4; den: 4 };
  division: "1/8" | "1/16" | "1/32";
};

export type NoteQ = {
  id: string;
  midi: number;
  startTick: number;
  durationTick: number;
  velocity: number;
};

export type PitchBackend = "crepe-webgpu" | "crepe-wasm" | "yin";
export type ModelVariant = "tiny" | "full";
export type NormalizeMode = "per_frame" | "per_batch";
export type OutputKind = "prob" | "logit";

export type ProjectStatus =
  | "Empty"
  | "Recording"
  | "Recorded"
  | "Analyzing"
  | "Ready"
  | "Error";

export type ProjectState = {
  status: ProjectStatus;
  audio?: AudioBufferData;
  frames?: PitchFrame[];
  notesRaw?: NoteRaw[];
  grid: GridSetting;
  notesQ: NoteQ[];
  selection: { noteIds: string[] };
  undoStack: Array<{ notesQ: NoteQ[]; selection: { noteIds: string[] } }>;
  error?: { code: string; message: string };
};

export type AnalyzeParams = {
  frameLenMs: number;
  hopMs: number;
  confMin: number;
  fmin: number;
  fmax: number;
  deadbandCent: number;
  pitchBackend: PitchBackend;
  modelVariant: ModelVariant;
  normalizeMode: NormalizeMode;
  outputKind: OutputKind;
  batchFrames: number;
};

export type AnalyzeRequest = {
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  grid: GridSetting;
  params: AnalyzeParams;
};

export type AnalyzeProgress = {
  type: "progress";
  stage: "vad" | "pitch" | "segment" | "quantize";
  progress: number;
};

export type AnalyzeResult = {
  type: "result";
  frames: PitchFrame[];
  notesRaw: NoteRaw[];
  notesQ: NoteQ[];
  pitchBackendUsed: PitchBackend;
};

export type AnalyzeError = {
  type: "error";
  code: string;
  message: string;
};

export type AnalyzeMessage = AnalyzeProgress | AnalyzeResult | AnalyzeError;

export type PitchWorkerInitRequest = {
  type: "INIT";
  modelUrl: string;
  preferred: "webgpu" | "wasm";
  normalizeMode: NormalizeMode;
  outputKind: OutputKind;
};

export type PitchWorkerAnalyzeRequest = {
  type: "ANALYZE";
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  batchFrames?: number;
};

export type PitchWorkerRequest = PitchWorkerInitRequest | PitchWorkerAnalyzeRequest;

export type PitchWorkerReady = {
  type: "READY";
  backend: "webgpu" | "wasm";
  modelInfo?: { inputShape?: number[]; outputShape?: number[] };
};

export type PitchWorkerProgress = {
  type: "PROGRESS";
  doneFrames: number;
  totalFrames: number;
};

export type PitchWorkerResult = {
  type: "RESULT";
  frames: PitchFrame[];
};

export type PitchWorkerError = {
  type: "ERROR";
  code: string;
  message: string;
};

export type PitchWorkerMessage =
  | PitchWorkerReady
  | PitchWorkerProgress
  | PitchWorkerResult
  | PitchWorkerError;
