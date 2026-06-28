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

export type ChordRoot = {
  measure: number;    // 0-indexed from first note-containing measure
  startTick: number;  // absolute tick of this measure's boundary (for x positioning)
  rootPc: number;     // pitch class 0-11 (0=C, 1=C#, ...)
  score: number;      // cosine similarity score [0, 1]
};

export type PitchBackend = "crepe-webgpu" | "crepe-wasm" | "yin";
export type LlmStatus = "idle" | "checking" | "running" | "done" | "error";
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
  grid: GridSetting;
  notesQ: NoteQ[];
  chordRoots: ChordRoot[];
  selection: { noteIds: string[] };
  undoStack: Array<{ notesQ: NoteQ[]; selection: { noteIds: string[] } }>;
  redoStack: Array<{ notesQ: NoteQ[]; selection: { noteIds: string[] } }>;
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
  notesQ: NoteQ[];
  pitchBackendUsed: PitchBackend;
  chordRoots: ChordRoot[];
};

export type AnalyzeError = {
  type: "error";
  code: string;
  message: string;
};

export type AnalyzeMessage = AnalyzeProgress | AnalyzeResult | AnalyzeError;
