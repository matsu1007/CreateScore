# CreateScore — インターフェース仕様書

> バージョン: 2026-06-06 時点のコードベースに基づく

---

## 目次

1. [React コンポーネント Props](#1-react-コンポーネント-props)
2. [モジュール公開 API](#2-モジュール公開-api)
3. [状態管理 API（store）](#3-状態管理-apistore)
4. [Web Worker メッセージプロトコル](#4-web-worker-メッセージプロトコル)
5. [外部 API（Ollama）](#5-外部-apiollamarest)
6. [共有型定義](#6-共有型定義)

---

## 1. React コンポーネント Props

### 1.1 `<App>`

エントリポイント。内部で全状態を `useReducer` で管理し、子コンポーネントへ分配する。Props なし。

---

### 1.2 `<RecorderPanel>`

ファイル: [src/ui/RecorderPanel.tsx](../src/ui/RecorderPanel.tsx)

```typescript
type RecorderPanelProps = {
  status: ProjectStatus;           // 現在のアプリ状態
  durationSec: number;             // 録音経過秒数
  hasRecording: boolean;           // 録音データが存在するか
  metronomeEnabled: boolean;       // 録音メトロノームの ON/OFF
  onRecord: () => void;            // 録音開始ボタン押下
  onStop: () => void;              // 停止ボタン押下
  onPlayOriginal: () => void;      // 録音音声を再生
  onClear: () => void;             // 全クリア
  onPreviewMetronome: () => void;  // メトロノームを 8 拍プレビュー
  onToggleMetronome: (enabled: boolean) => void;  // メトロノーム ON/OFF 切り替え
};
```

**ボタン有効/無効ロジック**

| ボタン | 無効条件 |
|---|---|
| Record | `status === "Recording" \|\| status === "Analyzing"` |
| Stop | `status !== "Recording"` |
| Play Original | `!hasRecording \|\| status === "Recording"` |
| Clear | `status === "Recording" && !hasRecording` |
| メトロノーム確認 | `status === "Recording"` |

---

### 1.3 `<AnalysisPanel>`

ファイル: [src/ui/AnalysisPanel.tsx](../src/ui/AnalysisPanel.tsx)

```typescript
type AnalysisPanelProps = {
  status: ProjectStatus;
  grid: GridSetting;                             // 現在のグリッド設定
  analyzeProgress: number;                       // 解析進捗 [0, 1]
  canAnalyze: boolean;                           // 解析ボタンの活性判定
  deadbandCent: number;                          // セミトーン変化閾値（cent）
  pitchBackend: PitchBackend;                    // ピッチ推定バックエンド
  modelVariant: ModelVariant;                    // CREPE モデルサイズ
  confMin: number;                               // 信頼度下限 [0, 1]
  batchFrames: number;                           // CREPE バッチサイズ [1, 1024]
  effectivePitchBackend: PitchBackend | null;    // 実際に使用されたバックエンド
  onAnalyze: () => void;
  onBpmChange: (bpm: number) => void;            // 解析後の BPM 変更も受け付ける
  onDivisionChange: (division: GridSetting["division"]) => void;
  onDeadbandCentChange: (cent: number) => void;
  onPitchBackendChange: (backend: PitchBackend) => void;
  onModelVariantChange: (variant: ModelVariant) => void;
  onConfMinChange: (value: number) => void;
  onBatchFramesChange: (value: number) => void;
  onTapTempo: () => void;                        // タップでテンポ推定
};
```

**入力値のコミットタイミング**

テキスト入力（BPM / deadbandCent / confMin / batchFrames）は `onBlur` または `Enter` キーでコミット。数値として解析できない入力は前回値に戻す。

---

### 1.4 `<PitchCurveView>`

ファイル: [src/ui/PitchCurveView.tsx](../src/ui/PitchCurveView.tsx)

```typescript
type PitchCurveViewProps = {
  frames: PitchFrame[];   // スムージング後のピッチフレーム列
};
```

**表示内容**

- Canvas 横幅: コンテナ幅に追従（ResizeObserver）
- Canvas 高さ: 固定 120px
- 音高範囲: C2（MIDI 36）〜 C7（MIDI 96）
- 各フレームを点でプロット。`conf` に応じて赤（低）〜緑（高）で色付け
- オクターブ境界（C音）に水平グリッド線を描画

**統計表示（Canvas 上部のテキスト）**

- フレーム総数、有声フレーム数と割合、平均 `conf`

---

### 1.5 `<PianoRollView>`

ファイル: [src/ui/PianoRollView.tsx](../src/ui/PianoRollView.tsx)

```typescript
type PianoRollViewProps = {
  notes: NoteQ[];              // 表示するノート列
  selection: string[];         // 選択中のノート ID 列
  correctedNoteIds?: string[]; // LLM補正で変更されたノート ID 列（緑表示）
  playheadTick: number | null; // 再生ヘッド位置（tick）、null = 非表示
  multiSelectMode: boolean;    // true: クリックで追加選択
  grid: GridSetting;           // コードヘッダー描画に使用
  chordRoots: ChordRoot[];     // 小節ごとのコードルート
  onSelect: (noteId: string | null, additive: boolean) => void;
    // noteId: null = 選択解除、additive: true = 追加/除去
  onSetSplitTick: (tick: number) => void;  // クリック位置の tick を通知
  onEditStart: () => void;     // ドラッグ開始時に Undo スナップショットをトリガー
  onMoveSelection: (deltaTick: number, deltaMidi: number) => void;
    // ドラッグ中の差分移動量（累積でなく差分）
};
```

**レイアウト構造（CSS Grid）**

```
┌──────────────┬──────────────────────────────────┐
│  corner 56px │  header (ChordRoot) 22px          │  ← 上段
├──────────────┼──────────────────────────────────┤
│  label lane  │  piano roll canvas（スクロール） │  ← 下段
│  56px wide   │                                  │
└──────────────┴──────────────────────────────────┘
```

**Canvas 描画定数**

| 定数 | 値 | 説明 |
|---|---|---|
| `TICK_PX` | 24 | 1 tick あたりのピクセル幅 |
| `ROW_H` | 16 | 1 MIDI ノートあたりの行高 |
| `LABEL_W` | 56 | 左側鍵盤ラベルの幅 |
| `HEADER_H` | 22 | コードルートヘッダーの高さ |

**インタラクション**

| 操作 | 動作 |
|---|---|
| Canvas クリック（ノート上） | `onSelect(noteId, additive)` を呼び出し |
| Canvas クリック（空白） | `onSelect(null, false)` → パン操作開始 |
| ノートをドラッグ | `onEditStart()` → `onMoveSelection(dt, dm)` を繰り返し呼び出し |
| 空白をドラッグ | 水平パン（スクロール） |
| ホイール | 水平スクロール |
| Shift + クリック | 追加選択（`additive = true`） |

**自動スクロール**

再生ヘッドがビューの端から 120px 以内に近づくと自動スクロール。ドラッグ中・パン中は無効。

---

### 1.6 `<LlmCorrectionPanel>`

ファイル: [src/ui/LlmCorrectionPanel.tsx](../src/ui/LlmCorrectionPanel.tsx)

```typescript
type LlmCorrectionPanelProps = {
  canCorrect: boolean;         // 補正ボタンの活性判定
  status: LlmStatus;           // "idle" | "checking" | "running" | "done" | "error"
  elapsedSec: number;          // 補正開始からの経過秒数
  tokenCount?: number;         // 受信済みトークン数（ストリーミング中）
  resultMessage?: string;      // 完了時のメッセージ
  errorMessage?: string;       // エラー時のメッセージ
  helpCommand?: string;        // エラー時に表示するコマンド例
  onCorrect: () => void;       // 補正実行ボタン押下
  onCancel: () => void;        // キャンセルボタン押下
};
```

**ステータスと表示の対応**

| `status` | 表示内容 |
|---|---|
| `idle` | 補正ボタンのみ |
| `checking` | 「○ Ollama に接続中...」 |
| `running` | 「◉ 補正中... {elapsedSec}s ({tokenCount} tokens)」+ キャンセルボタン |
| `done` | 「✓ {resultMessage}」（緑） |
| `error` | 「✗ {errorMessage}」（赤）+ `helpCommand` のコードブロック |

---

### 1.7 `<ExportPanel>`

ファイル: [src/ui/ExportPanel.tsx](../src/ui/ExportPanel.tsx)

```typescript
type ExportPanelProps = {
  canPlay: boolean;         // ノート再生ボタンの活性判定
  canPauseResume: boolean;  // 一時停止/再開・停止ボタンの活性判定
  isPaused: boolean;        // true: 「再開」、false: 「一時停止」
  canExport: boolean;       // Export MIDI ボタンの活性判定
  onPlay: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onExport: () => void;     // SMF ファイルを生成してダウンロード
};
```

---

## 2. モジュール公開 API

### 2.1 音声録音（`src/audio/recorder.ts`）

```typescript
class RecorderController {
  async start(events: RecorderEvents, maxSec?: number): Promise<void>
  // maxSec デフォルト: 60
  // events.onDuration: 100ms 間隔で経過秒を通知
  // events.onStop: 録音完了時に Blob を通知
  // events.onError: エラー時に Error を通知

  stop(): void     // 録音停止（onstop が非同期で呼ばれる）
  clear(): void    // 録音停止 + ストリーム解放 + チャンク削除
}
```

### 2.2 音声デコード（`src/audio/decode.ts`）

```typescript
decodeBlobToAudioBuffer(blob: Blob): Promise<AudioBuffer>
// ブラウザの AudioContext を使用してデコード
```

### 2.3 リサンプリング（`src/audio/resample.ts`）

```typescript
toMono16k(audioBuffer: AudioBuffer): AudioBufferData
// 多チャンネル → モノラル、任意サンプルレート → 16000 Hz
// 返値: { sampleRate: 16000, samples: Float32Array, durationSec }
```

### 2.4 VAD（`src/dsp/vad.ts`）

```typescript
runVad(
  samples: Float32Array,
  sampleRate: number,
  options?: VadOptions
): VadResult

type VadOptions = {
  frameLenMs?: number;         // デフォルト: 30
  hopMs?: number;              // デフォルト: 10
  silenceConfirmMs?: number;   // デフォルト: 100
  voiceConfirmMs?: number;     // デフォルト: 50
  thresholdScale?: number;
  enterThresholdScale?: number; // デフォルト: 1.6
  exitThresholdScale?: number;  // デフォルト: enterScale × 0.75
  preRollMs?: number;           // デフォルト: 20
}

type VadResult = {
  frameLen: number;
  hop: number;
  threshold: number;
  enterThreshold: number;
  exitThreshold: number;
  frames: VadFrame[];
}
```

### 2.5 ピッチ推定 YIN（`src/dsp/pitch.ts`）

```typescript
estimatePitchFrames(
  samples: Float32Array,
  sampleRate: number,
  vad: VadResult,
  options?: PitchOptions
): PitchFrame[]

type PitchOptions = {
  fmin?: number;    // デフォルト: 80 Hz
  fmax?: number;    // デフォルト: 1000 Hz
  confMin?: number; // デフォルト: 0.3
}
```

### 2.6 スムージング（`src/dsp/smooth.ts`）

```typescript
smoothPitchFrames(
  frames: PitchFrame[],
  medianWindow?: number  // デフォルト: 11
): PitchFrame[]
// 処理順: メディアンフィルタ → スパイク除去 → ゼロ位相 EMA (α=0.2)
```

### 2.7 セグメンテーション（`src/dsp/segment.ts`）

```typescript
segmentNotes(
  frames: PitchFrame[],
  options?: SegmentOptions
): NoteRaw[]

type SegmentOptions = {
  stableFrames?: number;          // デフォルト: 8
  jitterToleranceFrames?: number; // デフォルト: 3
  minNoteSec?: number;            // デフォルト: 0.06
  silenceEndMs?: number;          // デフォルト: 50
  hopMs?: number;                 // デフォルト: 10
  deadbandCent?: number;          // デフォルト: 35
}
```

### 2.8 量子化（`src/dsp/quantize.ts`）

```typescript
quantizeNotes(notesRaw: NoteRaw[], grid: GridSetting): NoteQ[]
// startTick = round(startSec / gridSec)
// durationTick = max(1, round(endSec / gridSec) - startTick)
// 同一 startTick & midi のノートはマージ

gridTicksPerQuarter(division: GridSetting["division"]): number
// "1/8" → 2, "1/16" → 4, "1/32" → 8
```

### 2.9 コードルート推定（`src/dsp/chordRoot.ts`）

```typescript
estimateChordRoots(notes: NoteQ[], grid: GridSetting): ChordRoot[]
// Krumhansl-Schmuckler テンプレートマッチング
// 各小節の duration-weighted クロマ vs 長調/短調 24 テンプレートのコサイン類似度
// 最初の音符を含む小節を measure=0 として正規化
```

### 2.10 解析パイプライン（`src/dsp/analyzePipeline.ts`）

```typescript
analyzePipeline(input: AnalyzePipelineInput): Promise<Omit<AnalyzeResult, "type">>

type AnalyzePipelineInput = {
  samples: Float32Array;
  sampleRate: number;
  grid: GridSetting;
  params: AnalyzeParams;
  onProgress?: (stage: AnalyzeProgressStage, progress: number) => void;
  // stage: "vad" | "pitch" | "segment" | "quantize"
  // progress: 各ステージ内の進捗 [0, 1]
}
```

**進捗値の目安**

| ステージ | 通知タイミング | progress 値 |
|---|---|---|
| vad | 完了後 | 0.2 |
| pitch | 開始時 | 0.35 |
| pitch | フレーム処理中 | 0.35 + ratio × 0.3 |
| segment | 開始時 | 0.7 |
| quantize | 開始時 | 0.9 |

### 2.11 LLM 補正（`src/dsp/llmCorrect.ts`）

```typescript
correctNotesWithLLM(
  notes: NoteQ[],
  chordRoots: ChordRoot[],
  grid: GridSetting,
  model: string,
  signal?: AbortSignal,
  onToken?: (count: number) => void  // ストリーミング受信トークン数（累積）
): Promise<LlmCorrectionResult>

type LlmCorrectionResult = {
  notesQ: NoteQ[];
  chordRoots: ChordRoot[];  // 補正後に再推定したコードルート
  changedCount: number;     // 変更されたノート数
}
// パース失敗時は元のノートをそのまま返す（例外は投げない）
// AbortError は再スロー（キャンセルとタイムアウトを区別）
```

### 2.12 Ollama HTTP クライアント（`src/api/ollama.ts`）

```typescript
checkOllamaHealth(): Promise<boolean>
// GET http://localhost:11434/ を 2 秒タイムアウトで試行

ollamaChat(
  model: string,
  messages: OllamaMessage[],
  options?: OllamaChatOptions,
  signal?: AbortSignal,
  onToken?: (count: number) => void  // 受信トークン数（累積）
): Promise<string>
// stream: true でトークンを逐次受信
// タイムアウト: 10 分
// 返値: 完成した全テキスト

type OllamaMessage = {
  role: "user" | "assistant" | "system";
  content: string;
}

type OllamaChatOptions = {
  temperature?: number;   // デフォルト: 0.1
  num_predict?: number;  // デフォルト: 2000
}
```

### 2.13 MIDI エクスポート（`src/midi/smf.ts`）

```typescript
encodeSmfType0(notes: NoteQ[], grid: GridSetting): Uint8Array
// SMF Type 0、PPQ = 480
// 先頭に setTempo イベントを埋め込む
// velocity = note.velocity（固定 90）

gridTickToMidiTick(gridTick: number, division: GridSetting["division"]): number
// midiTick = gridTick × (PPQ / ticksPerQuarter)

PPQ: 480  // 定数エクスポート
```

### 2.14 再生（`src/midi/playback.ts`）

```typescript
playNotes(notes: NoteQ[], grid: GridSetting): PlaybackController

type PlaybackController = {
  stop: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  isPaused: () => boolean;
  isStopped: () => boolean;
  getElapsedSec: () => number;
  getDurationSec: () => number;
  getSecPerTick: () => number;
  getEndTick: () => number;
}
// Web Audio API の OscillatorNode（sine）を使用
// 10ms アタック / 20ms リリース
```

---

## 3. 状態管理 API（store）

ファイル: [src/app/store.ts](../src/app/store.ts)

### 3.1 アクション型

```typescript
type Action =
  | { type: "recordStart" }
  | { type: "recorded"; audio: ProjectState["audio"] }
  | { type: "analyzeStart" }
  | { type: "analyzeSuccess"; payload: {
      frames: PitchFrame[];
      notesRaw: ProjectState["notesRaw"];
      notesQ: NoteQ[];
      chordRoots: ChordRoot[];
    }}
  | { type: "analyzeFail"; code: string; message: string }
  | { type: "clear" }
  | { type: "beginEdit" }         // Undo スナップショット保存・Redo スタッククリア
  | { type: "undoEdit" }          // 1 ステップ戻す（現在状態を Redo スタックへ）
  | { type: "redoEdit" }          // 1 ステップ進む（現在状態を Undo スタックへ）
  | { type: "updateGrid"; grid: Partial<GridSetting> }
  | { type: "setSelection"; ids: string[] }
  | { type: "moveSelection"; deltaTick: number; deltaMidi: number }
  | { type: "transposeAllSemitone"; direction: "up" | "down" }
  | { type: "transposeAllOctave"; direction: "up" | "down" }
  | { type: "deleteSelection" }
  | { type: "splitSelection"; splitTick: number }
  | { type: "joinSelection" }
  | { type: "llmCorrect"; notesQ: NoteQ[]; chordRoots: ChordRoot[] }
```

### 3.2 セレクタ関数

```typescript
canAnalyze(state: ProjectState): boolean
// Boolean(state.audio) && status !== "Recording" && status !== "Analyzing"

canExport(state: ProjectState): boolean
// status === "Ready" && notesQ.length > 0

canUndo(state: ProjectState): boolean
// status === "Ready" && undoStack.length > 0

canRedo(state: ProjectState): boolean
// status === "Ready" && redoStack.length > 0
```

### 3.3 ノート操作ユーティリティ（純粋関数）

```typescript
moveSelectedNotes(notes, ids, deltaTick, deltaMidi): NoteQ[]
deleteSelectedNotes(notes, ids): NoteQ[]
transposeAllBy(notes, delta): NoteQ[]       // MIDI 0–127 にクランプ
transposeAllOctave(notes, direction): NoteQ[]
splitSelectedNote(notes, ids, splitTick): NoteQ[]
// ids.length !== 1 の場合は変更なしで返す
joinSelectedNotes(notes, ids): NoteQ[]
// 同一 MIDI でかつ endTick === 次の startTick の場合のみ結合
```

---

## 4. Web Worker メッセージプロトコル

### 4.1 `analyze.worker.ts`（メイン Worker）

**メインスレッド → Worker（リクエスト）**

```typescript
type AnalyzeRequest = {
  audioBuffer: ArrayBuffer;   // transferable
  sampleRate: number;
  grid: GridSetting;
  params: AnalyzeParams;
}
```

**Worker → メインスレッド（レスポンス）**

```typescript
type AnalyzeMessage =
  | { type: "progress"; stage: AnalyzeProgressStage; progress: number }
  | { type: "result";
      frames: PitchFrame[];
      notesRaw: NoteRaw[];
      notesQ: NoteQ[];
      chordRoots: ChordRoot[];
      pitchBackendUsed: PitchBackend;
    }
  | { type: "error"; code: string; message: string }
```

### 4.2 `pitch.worker.ts`（CREPE 専用 Worker）

**初期化リクエスト**

```typescript
type PitchWorkerInitRequest = {
  type: "INIT";
  modelUrl: string;
  preferred: "webgpu" | "wasm";
  normalizeMode: NormalizeMode;  // "per_frame" | "per_batch"
  outputKind: OutputKind;        // "prob" | "logit"
}
```

**解析リクエスト**

```typescript
type PitchWorkerAnalyzeRequest = {
  type: "ANALYZE";
  audioBuffer: ArrayBuffer;  // transferable
  sampleRate: number;
  batchFrames?: number;
}
```

**レスポンスメッセージ**

```typescript
type PitchWorkerMessage =
  | { type: "READY"; backend: "webgpu" | "wasm";
      modelInfo?: { inputShape?: number[]; outputShape?: number[] } }
  | { type: "PROGRESS"; doneFrames: number; totalFrames: number }
  | { type: "RESULT"; frames: PitchFrame[] }
  | { type: "ERROR"; code: string; message: string }
```

---

## 5. 外部 API（Ollama REST）

**ベース URL**: `http://localhost:11434`

### 5.1 ヘルスチェック

```
GET /
```

レスポンス: `200 OK` で Ollama が起動していることを確認。タイムアウト: 2 秒。

### 5.2 チャット補完（ストリーミング）

```
POST /api/chat
Content-Type: application/json
```

**リクエストボディ**

```json
{
  "model": "gemma4:12b",
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "stream": true,
  "options": {
    "temperature": 0.1,
    "num_predict": 2000
  }
}
```

**レスポンス（NDJSON ストリーム）**

各行が JSON オブジェクト:

```json
{ "model": "gemma4:12b", "message": { "role": "assistant", "content": "token" }, "done": false }
{ "model": "gemma4:12b", "message": { "role": "assistant", "content": "" }, "done": true }
```

`done: true` で終端。`message.content` を連結して完成テキストを取得。

**エラーレスポンス**

| HTTP Status | 意味 |
|---|---|
| 404 | 指定モデルが存在しない |
| 500 | Ollama 内部エラー |
| タイムアウト | 10 分経過で AbortController が発火 |

---

## 6. 共有型定義

ファイル: [src/app/types.ts](../src/app/types.ts)

### 6.1 プリミティブ型

```typescript
type PitchBackend = "crepe-webgpu" | "crepe-wasm" | "yin";
type LlmStatus = "idle" | "checking" | "running" | "done" | "error";
type ModelVariant = "tiny" | "full";
type NormalizeMode = "per_frame" | "per_batch";
type OutputKind = "prob" | "logit";

type ProjectStatus =
  | "Empty"      // 初期状態
  | "Recording"  // 録音中
  | "Recorded"   // 録音完了（未解析）
  | "Analyzing"  // 解析中
  | "Ready"      // 解析完了（編集可能）
  | "Error";     // エラー
```

### 6.2 データ型

```typescript
type AudioBufferData = {
  sampleRate: number;     // 常に 16000
  samples: Float32Array;  // モノラル PCM
  durationSec: number;
};

type PitchFrame = {
  tSec: number;        // フレーム開始時刻（秒）
  f0Hz: number | null; // 基本周波数（null = 無音または低信頼度）
  conf: number;        // 信頼度 [0, 1]
  rms: number;         // フレーム RMS
};

type NoteRaw = {
  id: string;
  midi: number;      // MIDI ノート番号
  startSec: number;
  endSec: number;
  conf: number;      // 平均信頼度
};

type GridSetting = {
  bpm: number;                         // [40, 240]
  timeSig: { num: 4; den: 4 };        // 固定
  division: "1/8" | "1/16" | "1/32";
};

type NoteQ = {
  id: string;
  midi: number;
  startTick: number;     // グリッド tick 単位
  durationTick: number;  // 最小 1
  velocity: number;      // 固定: 90
};

type ChordRoot = {
  measure: number;   // 0-indexed（最初の音符小節が 0）
  startTick: number; // 絶対 tick（描画用）
  rootPc: number;    // ピッチクラス 0–11（0=C, 1=C#, ...）
  score: number;     // コサイン類似度 [0, 1]
};
```

### 6.3 解析パラメータ型

```typescript
type AnalyzeParams = {
  frameLenMs: number;         // VAD フレーム長（ms）
  hopMs: number;              // VAD ホップ幅（ms）
  confMin: number;            // 信頼度下限 [0, 1]
  fmin: number;               // ピッチ下限（Hz）
  fmax: number;               // ピッチ上限（Hz）
  deadbandCent: number;       // セミトーン変化閾値（cent）
  pitchBackend: PitchBackend;
  modelVariant: ModelVariant;
  normalizeMode: NormalizeMode;
  outputKind: OutputKind;
  batchFrames: number;        // CREPE バッチサイズ
};
```

### 6.4 プロジェクト状態型

```typescript
type ProjectState = {
  status: ProjectStatus;
  audio?: AudioBufferData;
  frames?: PitchFrame[];
  notesRaw?: NoteRaw[];
  grid: GridSetting;
  notesQ: NoteQ[];
  chordRoots: ChordRoot[];
  selection: { noteIds: string[] };
  undoStack: Array<{
    notesQ: NoteQ[];
    selection: { noteIds: string[] };
  }>;
  error?: { code: string; message: string };
};
```
