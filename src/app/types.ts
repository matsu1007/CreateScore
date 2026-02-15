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
};

export type AnalyzeError = {
  type: "error";
  code: string;
  message: string;
};

export type AnalyzeMessage = AnalyzeProgress | AnalyzeResult | AnalyzeError;
