# CreateScore — 仕様書 / 設計書

> バージョン: 2026-06-06 時点のコードベースに基づく

---

## 1. アプリケーション概要

### 1.1 目的

マイクから鼻歌・ヴォカリーズを録音し、ピッチ検出→音符量子化→ピアノロール編集→SMF（Standard MIDI File）エクスポートまでをブラウザ完結で行うアプリケーション。

### 1.2 対象ユーザー

楽譜作成の補助ツールとして鼻歌・ヴォカリーズからメロディを書き起こしたい音楽ユーザー。

### 1.3 動作環境

| 環境 | 備考 |
|---|---|
| モダンブラウザ | Chrome / Edge 推奨（WebGPU 使用時） |
| Electron | デスクトップアプリとしてもビルド可能 |
| Node.js | 開発・ビルド用 |
| Ollama（任意） | LLM補正機能の使用時のみ必要 |

### 1.4 技術スタック

| カテゴリ | 採用技術 |
|---|---|
| フレームワーク | React 18 + TypeScript (strict mode) |
| ビルド | Vite |
| テスト | Vitest |
| デスクトップ | Electron |
| ピッチ推定 (YIN) | pitchy ライブラリ |
| ピッチ推定 (CREPE) | onnxruntime-web（WebGPU / WASM） |
| MIDI 生成 | midi-file ライブラリ |
| LLM 補正 | Ollama ローカル API |

---

## 2. 機能仕様

### 2.1 録音機能

- マイク入力を `MediaRecorder` で取得
- エコーキャンセル・ノイズ抑制・自動ゲイン制御をすべて無効化（生の音声波形を取得）
- 最長 **60 秒** でハードストップ
- 録音中にメトロノームクリック音を再生するオプション（BPM 連動）
- 録音完了後、AudioBuffer にデコードして **16 kHz モノラル** にリサンプリング

### 2.2 ピッチ解析機能

#### 解析パラメータ（UI で変更可能）

| パラメータ | デフォルト | 説明 |
|---|---|---|
| BPM | 120 | グリッド基準テンポ |
| 拍子 | 4/4 | 固定 |
| グリッド分割 | 1/16 | 1/8 / 1/16 / 1/32 |
| deadbandCent | 35 | セミトーン変化閾値（cent） |
| confMin | 0.3 | 信頼度下限（0–1） |
| pitchBackend | yin | YIN / CREPE-WebGPU / CREPE-WASM |
| modelVariant | tiny | CREPE モデルサイズ（tiny / full） |
| batchFrames | 256 | CREPE バッチサイズ |

#### 進捗表示

VAD → Pitch → Segment → Quantize の 4 ステージで進捗率（0–1）を UI に通知。

### 2.3 ピアノロール編集機能

#### 表示

- 水平軸: tick（グリッド単位）、垂直軸: MIDI ノート番号
- ピアノ鍵盤ラベル（56px 幅）と連動スクロール
- 上部ヘッダー（22px）にコードルート推定結果を表示
- 再生ヘッドをオーバーレイ表示

#### 操作（マウス / タッチ）

| 操作 | 動作 |
|---|---|
| ノートクリック | 単一選択 |
| モバイル複数選択モード ON 時クリック | 追加/除去選択 |
| 選択ノートをドラッグ | 時間軸・音高方向に移動 |

#### ツールバーボタン

| ボタン | 機能 |
|---|---|
| Undo | 最大 5 ステップ戻す |
| ±1semi | 全ノートを半音単位で転調 |
| ±1oct | 全ノートをオクターブ単位で転調 |
| Split | 選択中の 1 ノートをカーソル位置で分割 |
| Join | 選択中の隣接同音ノートを結合 |
| Delete | 選択ノートを削除 |

### 2.4 LLM 補正機能

- Ollama ローカル API（`http://localhost:11434`）経由で Gemma4 12B を呼び出す
- 全ノートを JSON 形式でプロンプトに含め、アルゴリズム推定のコードルートをヒントとして添付
- LLM が音符補正とコードルート推定を同時に実行し、`notes` + `chords` のオブジェクト形式で返す
- LLM の出力から採用するのは `pitch`（MIDI 変換後）と各小節の `root`（コードルート）のみ。`durationTick` / `startTick` / `id` / `velocity` はオリジナルを保持
- `startTick` / `id` / `velocity` はオリジナルを保持。コードパースに失敗した場合はアルゴリズム推定にフォールバック
- ストリーミング受信（`stream: true`）により、生成トークン数をリアルタイム表示
- 補正前に `beginEdit` を発行し Undo スタックに保存
- キャンセル（AbortController）対応
- タイムアウト: 10 分

### 2.5 再生機能

- Web Audio API の `OscillatorNode`（sine 波）でノートを発音
- 各ノートに 10ms のアタック・20ms のリリースエンベロープを付与
- 一時停止 / 再開 / 停止をサポート
- 再生ヘッド位置を 33ms 間隔でポーリングして表示

### 2.6 MIDI エクスポート機能

- SMF Type 0 形式（1 トラック）
- PPQ = 480
- テンポイベント（`setTempo`）を先頭に埋め込み
- グリッド tick → MIDI tick 変換: `midiTick = gridTick × (PPQ / ticksPerQuarter)`
- velocity: 90（固定）
- ブラウザのダウンロード機能で `humming.mid` として保存

---

## 3. システム設計

### 3.1 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│  ブラウザ / Electron                                  │
│                                                       │
│  App.tsx (useReducer)                                 │
│  ├── RecorderPanel                                    │
│  ├── AnalysisPanel                                    │
│  ├── PitchCurveView                                   │
│  ├── PianoRollView (Canvas)                           │
│  ├── LlmCorrectionPanel                              │
│  └── ExportPanel                                      │
│                                                       │
│  Web Worker: analyze.worker.ts                        │
│  └── analyzePipeline (VAD→Pitch→Smooth→Seg→Quant)    │
│                                                       │
│  Web Worker: pitch.worker.ts (CREPE 専用)             │
│  └── onnxruntime-web (WebGPU / WASM)                  │
└─────────────────────────────────────────────────────┘
         ↕ HTTP
┌──────────────────┐
│  Ollama           │  (localhost:11434, 任意)
│  gemma4:12b       │
└──────────────────┘
```

### 3.2 データフロー

```
Mic
 → MediaRecorder (audio/webm)
 → decodeAudioData
 → resample to 16kHz mono (Float32Array)
 → [Web Worker] analyzePipeline
     ├── VAD          → VadResult (voiced/unvoiced per frame)
     ├── Pitch        → PitchFrame[] (tSec, f0Hz, conf, rms)
     ├── Smooth       → PitchFrame[] (median 11f + zero-phase EMA α=0.2)
     ├── Segment      → NoteRaw[] (startSec, endSec, midi)
     ├── Trim silence → 先頭無音を除去（最初のノートの startSec を全ノートから減算）
     ├── Quantize     → NoteQ[] (startTick, durationTick, velocity)
     └── ChordRoot    → ChordRoot[] (measure, rootPc, score)
 → React state (projectReducer)
 → PianoRollView (Canvas rendering)
 → [任意] LLM Correction → corrected NoteQ[]
 → encodeSmfType0 → .mid ダウンロード
```

### 3.3 Worker パターン

`analyze.worker.ts` が `analyzePipeline` をラップ。Worker 生成に失敗した場合（Electron など）はメインスレッドにフォールバック。

CREPE 使用時は `pitch.worker.ts` が ONNX セッションを管理し、`analyze.worker.ts` から `postMessage` で通信。

---

## 4. DSP パイプライン詳細

### 4.1 VAD（音声区間検出）

| パラメータ | 値 |
|---|---|
| フレーム長 | 30 ms |
| ホップ幅 | 10 ms |
| 閾値計算 | RMS の 20 パーセンタイルを基底として Enter ×1.5 / Exit ×1.2 |
| Enter 確認フレーム | 50 ms 分（5 フレーム） |
| Exit 確認フレーム | 140 ms 分（14 フレーム） |
| プリロール | 30 ms |

ヒステリシス付きで誤検出・途切れを抑制。

### 4.2 ピッチ推定

#### YIN（デフォルト）

- `pitchy` ライブラリの `PitchDetector`
- VAD で voiced と判定されたフレームのみ処理
- 信頼度（clarity）< confMin のフレームは `f0Hz = null`
- fmin: 80 Hz / fmax: 1000 Hz

#### CREPE（オプション）

- 360-bin softmax、入力: 1024 サンプル @ 16 kHz、出力: 32.7–1975 Hz
- `onnxruntime-web` で ONNX モデルを実行
- 実行優先順位: WebGPU → WASM（自動フォールバック）
- `ort.env.wasm.numThreads = 1`（SharedArrayBuffer 不要）
- モデルファイル（`public/model/*.onnx`）は Git 管理外、手動配置が必要

### 4.3 スムージング（`smooth.ts`）

1. **メディアンフィルタ** — ウィンドウ 11 フレーム（±55 ms）
2. **スパイク除去** — 前後比較で孤立した 10 半音超の外れ値を修正
3. **ゼロ位相 EMA** — α = 0.2、前方向 + 後方向の 2 パス（位相遅延なし）

> α = 0.2 は 100 fps（10 ms ホップ）で約 4 Hz のカットオフ。ヴィブラート（4–8 Hz）を減衰させつつ半音識別を維持。

### 4.4 セグメンテーション（`segment.ts`）

| パラメータ | 値 |
|---|---|
| deadbandCent | 35（UI で変更可） |
| stableFrames | 8 |
| jitterToleranceFrames | 3 |
| minNoteSec | 0.10 秒 |
| silenceEndMs | 50 ms |

デッドバンド内の音高変動はノート境界とみなさない。短すぎるノートは隣接ノートにマージ。

### 4.5 量子化（`quantize.ts`）

```
gridSec = (60 / bpm) / ticksPerQuarter
startTick = round(startSec / gridSec)
durationTick = max(1, round(endSec / gridSec) - startTick)
```

グリッド分割と ticksPerQuarter の対応:

| division | ticksPerQuarter |
|---|---|
| 1/8 | 2 |
| 1/16 | 4 |
| 1/32 | 8 |

同一 startTick・同一 MIDI 番号のノートは自動マージ。

### 4.6 コードルート推定（`chordRoot.ts`）

- Krumhansl-Schmuckler テンプレートマッチング
- 長調・短調の 24 テンプレートを各ピッチクラスへの回転で生成
- 各小節の duration-weighted クロマベクトルとコサイン類似度を計算
- 最高スコアのルート音を採択
- 小節番号は最初の音符を含む小節を measure=0 として正規化

---

## 5. 状態管理

### 5.1 ProjectState

```typescript
type ProjectState = {
  status: "Empty" | "Recording" | "Recorded" | "Analyzing" | "Ready" | "Error";
  audio?: AudioBufferData;      // 16kHz mono PCM
  frames?: PitchFrame[];        // スムージング後のピッチ曲線
  notesRaw?: NoteRaw[];         // 秒単位の生ノート
  grid: GridSetting;            // BPM / 拍子 / division
  notesQ: NoteQ[];              // 量子化済みノート（tick単位）
  chordRoots: ChordRoot[];      // 小節ごとのコードルート
  selection: { noteIds: string[] };
  undoStack: Array<{ notesQ: NoteQ[]; selection: ... }>;  // 最大5件
  redoStack: Array<{ notesQ: NoteQ[]; selection: ... }>;  // 最大5件
  error?: { code: string; message: string };
};
```

### 5.2 アクション一覧

| アクション | 説明 |
|---|---|
| `recordStart` | 録音開始 |
| `recorded` | 録音完了・AudioBuffer を格納 |
| `analyzeStart` | 解析開始 |
| `analyzeSuccess` | 解析完了・全データを格納 |
| `analyzeFail` | 解析エラー |
| `clear` | 全リセット（grid 設定は保持） |
| `beginEdit` | Undo スナップショット保存・Redo スタッククリア |
| `undoEdit` | 1 ステップ戻す（現在状態を Redo スタックへ） |
| `redoEdit` | 1 ステップ進む（現在状態を Undo スタックへ） |
| `updateGrid` | BPM / division 更新（BPM は 40–240 にクランプ） |
| `setSelection` | 選択ノート ID を上書き |
| `moveSelection` | 選択ノートを deltaTick / deltaMidi 移動 |
| `transposeAllSemitone` | 全ノート ±1 半音 |
| `transposeAllOctave` | 全ノート ±1 オクターブ |
| `deleteSelection` | 選択ノートを削除 |
| `splitSelection` | 選択中の 1 ノートを splitTick で分割 |
| `joinSelection` | 選択中の隣接同音ノートを結合 |
| `llmCorrect` | LLM 補正結果で notesQ / chordRoots を更新 |

### 5.3 Undo / Redo

- `beginEdit` でスナップショット（`notesQ` + `selection`）を保存し、Redo スタックをクリア
- `undoEdit` で現在状態を Redo スタックへ退避し、Undo スタックから復元
- `redoEdit` で現在状態を Undo スタックへ退避し、Redo スタックから復元
- Undo / Redo それぞれ最大 5 ステップ保持
- 保存対象: `notesQ` と `selection` のみ（`frames` / `chordRoots` は対象外）

---

## 6. 主要データ型

```typescript
type PitchFrame = {
  tSec: number;         // フレーム時刻（秒）
  f0Hz: number | null;  // 基本周波数（null = 無音）
  conf: number;         // 信頼度 [0, 1]
  rms: number;          // フレーム RMS
};

type NoteRaw = {
  id: string;
  midi: number;         // MIDI ノート番号
  startSec: number;
  endSec: number;
  conf: number;         // 平均信頼度
};

type NoteQ = {
  id: string;
  midi: number;
  startTick: number;    // グリッド tick 単位
  durationTick: number;
  velocity: number;     // 固定: 90
};

type ChordRoot = {
  measure: number;      // 0-indexed（最初の音符小節が0）
  startTick: number;    // 絶対 tick（描画位置計算用）
  rootPc: number;       // ピッチクラス 0–11（0=C）
  score: number;        // コサイン類似度 [0, 1]
};

type GridSetting = {
  bpm: number;                           // 40–240
  timeSig: { num: 4; den: 4 };          // 固定
  division: "1/8" | "1/16" | "1/32";
};
```

---

## 7. LLM 補正設計

### 7.1 プロンプト構造

```
[System context]
You are a music correction assistant...

Context:
- Tempo: {bpm} BPM
- Time signature: 4/4
- Grid: 1 tick = {division}
- Chord estimate by measure (for reference): measure 0 = C, measure 1 = G, ...

Notes (JSON):
[{"pitch":"C4","startTick":0}, ...]

Rules:
1. 文脈・コードに合わない音符を修正
2. 不自然な音価を標準値にスナップ
3. 音符数を変更しない
4. 各小節のコードルートを推定する

Return ONLY a valid JSON object:
{"notes": [...], "chords": [{"measure":0,"root":"C"}, ...]}
```

### 7.2 レスポンス処理

1. マークダウンコードフェンスを除去して JSON を抽出（`{...}` を優先、`[...]` にもフォールバック）
2. `notes` 配列検証（±20% のノート数差まで許容）
3. `notes` から採用するのは `pitch`（MIDI 変換後）のみ。`startTick` / `durationTick` / `id` / `velocity` はすべてオリジナルを保持
4. MIDI 範囲を 21–108 にクランプ
5. `chords` から `measure` と `root`（ピッチクラス文字列）を読み取り `ChordRoot` に変換。`score` は 1.0 固定
6. notes / chords いずれかのパースに失敗した場合は独立してフォールバック（notes → オリジナル保持、chords → アルゴリズム推定）

### 7.3 Ollama API

| 設定 | 値 |
|---|---|
| エンドポイント | `http://localhost:11434/api/chat` |
| モデル | `gemma4:12b` |
| temperature | 0.1 |
| num_predict | 2000 |
| stream | true（トークン逐次受信） |
| タイムアウト | 10 分 |

---

## 8. 制約・既知の制限

| 制約 | 詳細 |
|---|---|
| 単声のみ | 和音は扱わない。同時複音のある録音は誤検出が増加する |
| 固定拍子 | 4/4 のみ。拍子の自動検出なし |
| 固定テンポ | BPM はユーザー手動設定。タップテンポはUI補助のみ |
| 最長 60 秒 | 録音のハードリミット |
| 永続化なし | セッション終了でデータ消失。ローカルストレージ非対応 |
| CREPE モデル手動配置 | `public/model/*.onnx` は Git 管理外。手動ダウンロードが必要 |
| LLM はオプション | Ollama 未起動時はエラー表示し通常操作は継続 |
| Undo / Redo は各 5 ステップ | `frames` / `chordRoots` は対象外 |
| MIDI velocity 固定 | 全ノート velocity = 90 |
| MIDI チャンネル固定 | チャンネル 0 のみ使用 |
