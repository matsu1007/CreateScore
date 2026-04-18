# Requirement.md — 鼻歌→楽譜（MVP）仕様書（3階層）

作成日: 2026-02-15  
対象: Webアプリ（React / Browser-only / サーバ無し）  
前提: **一定テンポ前提（後で編集）**・単旋律（鼻歌/ハミング）・4/4固定（MVP）

---

## 0. 用語
- **f0**: 基本周波数（Hz）
- **VAD**: Voice Activity Detection（無声/有声判定）
- **ノート化**: フレーム列（f0）から音符区間（音高＋開始/終了）へ変換
- **量子化**: 一定テンポの拍グリッドへ開始/長さをスナップ
- **Tick**: グリッド単位の整数（MVPでは「8分/16分」グリッドの1マス）

---

# 1. 要求仕様（ユーザ視点）

## 1.1 目的
ユーザが鼻歌を録音し、メロディを自動で推定して編集可能な形（ピアノロール）で確認し、MIDIとして出力できること。

## 1.2 想定ユーザ
- 作曲の下書きを素早くMIDI化したいユーザ
- 「鼻歌→ざっくり採譜→後で修正」ワークフローを望むユーザ

## 1.3 ユースケース（基本フロー）
1. ユーザがブラウザで録音を開始し、鼻歌を歌う
2. 録音を停止し、解析を実行する
3. ピッチカーブ/ピアノロールで推定結果を確認する
4. BPM・量子化分解能・音程/タイミングを編集する
5. MIDIをダウンロードし、DAW等で利用する

## 1.4 機能要件
### 1.4.1 録音
- マイク録音（mono）をブラウザで実行できる
- 録音した音声を再生できる
- 録音を破棄（Clear）できる

### 1.4.2 解析
- 録音音声から、単旋律のピッチ（f0）を推定できる
- 推定したピッチから音符列（ノート）を生成できる
- 一定テンポ・固定拍子（4/4）の前提で量子化できる

### 1.4.3 表示
- ピッチカーブ（時間×Hz/音高）を表示できる
- ピアノロール（時間×音高）でノート列を表示できる

### 1.4.4 編集
- BPMをユーザが変更できる（固定テンポ値を調整）
- 量子化分解能を切り替えできる（8分/16分）
- ピアノロール上で以下ができる:
  - ノート選択
  - 音程変更（±半音）
  - タイミング移動（tick単位）
  - 分割/結合
  - 削除

### 1.4.5 再生
- 推定/編集したノート列をブラウザで再生できる（簡易シンセで可）
- （任意）メトロノーム再生（MVPでは優先度低）

### 1.4.6 エクスポート
- 編集結果をMIDI（SMF）としてダウンロードできる

## 1.5 非機能要件
- **コスト最小**: サーバ運用なし（静的ホスティングのみ）
- **プライバシー**: 音声は端末内で処理し、外部送信しない
- **性能**: 30秒程度の録音に対し、解析が数秒以内を目標（端末依存）
- **互換性**: 主要ブラウザ（Chrome/Edge/Safari）で動作
- **操作性**: ピアノロール編集は引っかかりなく操作できる（Canvas推奨）

## 1.6 制約（MVP）
- 単旋律のみ（伴奏混じりは対象外）
- 拍子は4/4固定
- テンポは一定（BPM値のみユーザが変更）
- 自動テンポ推定・自動拍子推定はMVP対象外
- 楽譜（五線譜）出力・MusicXMLはMVP対象外（将来拡張）

## 1.7 受入基準（MVP）
- 録音→解析→ピアノロール表示→編集→MIDI出力が一連で成立する
- MIDIをDAWに読み込んで、メロディが再現される
- BPM/量子化変更により、ユーザが意図に近いタイミングへ調整できる

---

# 2. 外部仕様（画面・入出力）

## 2.1 画面一覧
- **Main（単一ページ）**
  - Recorder Panel（録音）
  - Analysis Panel（解析・設定）
  - View Panel（Pitch / Piano Roll タブ）
  - Export Panel（MIDI出力）

## 2.2 画面レイアウト（論理）
1) 上段: Recorder Panel  
2) 中段: Analysis Panel（BPM/Division/Analyze/状態）  
3) 下段: View Panel（タブ切替）  
4) 右下/下段: Export Panel  

## 2.3 Recorder Panel 仕様
### 入力
- Record: 録音開始
- Stop: 録音停止
- Play Original: 録音音声再生
- Clear: 録音データ破棄（状態初期化）

### 出力（表示）
- 録音状態（Recording / Stopped）
- （任意）録音時間
- （任意）波形の簡易表示

## 2.4 Analysis Panel 仕様
### 入力（ユーザ操作）
- Analyze: 解析実行
- BPM: 数値入力（例: 40〜240、実装でバリデーション）
- Division: トグル（1/8, 1/16）

### 出力（表示）
- 状態表示: Idle / Recording / Analyzing / Ready / Error
- （任意）解析進捗（%またはスピナー）

## 2.5 Pitch View 仕様（タブ）
### 入力
- 表示範囲のスクロール/ズーム（MVPは任意）

### 出力
- 時間軸に沿った f0 曲線（unvoicedはギャップ）
- （任意）confidenceの可視化（色や透明度はMVP必須ではない）

## 2.6 Piano Roll View 仕様（タブ）
### 入力（編集操作）
- クリック: ノート選択
- ドラッグ上下: 音程変更（半音ステップ）
- ドラッグ左右: startTick変更（tick単位）
- 分割: 選択ノートを指定tickで分割（UI操作またはショートカット）
- 結合: 複数ノートを結合
- 削除: 選択ノート削除

### 出力（表示）
- ノート矩形（横: tick、縦: midi）
- 選択状態のハイライト
- （任意）グリッド表示（8分/16分）

## 2.7 Export Panel 仕様
### 入力
- Export MIDI: MIDIファイル生成・ダウンロード

### 出力
- ファイル名（例: `humming.mid`）でダウンロード開始
- （任意）エクスポート成功/失敗通知

## 2.8 入出力データ仕様
### 2.8.1 入力
- マイク音声（ブラウザ取得）
- ユーザ設定: BPM, Division
- 編集操作: ノート編集イベント群

### 2.8.2 出力
- MIDI（SMF Type 0）
- 画面表示:
  - ピッチフレーム列（f0曲線）
  - 量子化ノート列（ピアノロール）

## 2.9 エラー/例外（外部動作）
- マイク権限拒否: エラー表示し録音不可
- 録音データなしでAnalyze: 無効化または警告
- 解析失敗: Error状態に遷移し、再試行導線を提示
- 端末性能不足: 解析が長い場合でもUIが固まらない（Worker推奨）

---

# 3. 内部仕様（アルゴ・型・状態遷移）

## 3.1 コンポーネント/モジュール構成（推奨）
- `audio/` : 録音・リサンプル・WAV（デバッグ）
- `dsp/` : VAD・YIN・平滑化・ノート化・量子化
- `midi/` : SMF生成・（任意）簡易シンセ
- `ui/` : Reactコンポーネント群
- `app/` : store（状態管理）・型定義

## 3.2 内部データ型（TypeScript）
```ts
export type AudioBufferData = {
  sampleRate: number;      // 推奨 16000
  samples: Float32Array;   // mono PCM
  durationSec: number;
};

export type PitchFrame = {
  tSec: number;
  f0Hz: number | null;     // null = unvoiced
  conf: number;            // 0..1
  rms: number;             // 0..1
};

export type NoteRaw = {
  id: string;
  midi: number;            // 0..127
  startSec: number;
  endSec: number;
  conf: number;
};

export type GridSetting = {
  bpm: number;
  timeSig: { num: 4; den: 4 }; // MVP固定
  division: "1/8" | "1/16";
};

export type NoteQ = {
  id: string;
  midi: number;
  startTick: number;
  durationTick: number;    // >= 1
  velocity: number;        // 1..127
};

export type ProjectStatus = "Idle" | "Recording" | "Analyzing" | "Ready" | "Error";

export type ProjectState = {
  status: ProjectStatus;
  audio?: AudioBufferData;
  frames?: PitchFrame[];
  notesRaw?: NoteRaw[];
  grid: GridSetting;
  notesQ: NoteQ[];
  selection: { noteIds: string[] };
  error?: { code: string; message: string };
};
```

## 3.3 アルゴリズム仕様

### 3.3.1 リサンプル
- 目的: 推定器入力を統一（16kHz mono）
- 実装（MVP）: 線形補間で十分
- 入力: 任意sampleRate mono（またはstereo→mono合成）
- 出力: 16kHz mono

### 3.3.2 フレーム化
- 推奨:
  - `frameLen = 30ms`（480 samples @16k）
  - `hop = 10ms`（160 samples @16k）
- 各フレームで RMS を計算し `PitchFrame.rms` に格納

### 3.3.3 VAD（無声判定）
- RMS閾値（初期値）: `rmsTh = 0.01`
- 連続条件（初期値）:
  - 無声確定: `silenceConfirm = 100ms`（=10 hops）
  - 有声確定: `voiceConfirm = 50ms`（=5 hops）
- 判定結果は、f0推定前に「推定対象/非対象」を決めるか、推定後に `f0Hz=null` へ反映

### 3.3.4 ピッチ推定（YIN系）
- 探索範囲:
  - `fmin = 80Hz`, `fmax = 1000Hz`
- 出力:
  - `f0Hz`（推定不可/無声なら null）
  - `conf`（0..1; CMNDの最小値などから正規化）

### 3.3.5 平滑化・外れ値抑制
- メディアンフィルタ（初期値）: 窓=7（±3フレーム）
- オクターブジャンプ抑制（ルール例）:
  - `abs(midi[i]-midi[i-1]) >= 10` の単発ジャンプは補正候補
  - 周辺中央値に近い値へ寄せる、または前値保持
- `conf` が低いフレームは `f0Hz=null` 寄りに倒す（閾値は実験で調整）

### 3.3.6 ノート区間化（安定区間ベース）
- `midiFloat = 69 + 12*log2(f0/440)`
- `midi = round(midiFloat)`
- 同一ピッチ判定: ±0.5半音以内
- 初期値:
  - 安定開始条件: `K = 8 frames`（80ms）
  - 揺れ許容: `M = 3 frames`（30ms）
- ノート終端:
  - 無声が50ms以上継続、または別ピッチがKフレーム継続
- ノート代表音高:
  - 区間内 `midiFloat` の中央値→四捨五入（外れに強い）

### 3.3.7 量子化（固定テンポ）
- `beatSec = 60 / bpm`
- `gridSec = beatSec / 2`（division=1/8）, `gridSec = beatSec / 4`（division=1/16）
- `startTick = round(startSec / gridSec)`
- `endTick = round(endSec / gridSec)`
- `durationTick = max(1, endTick - startTick)`
- 破綻防止:
  - 同じstartTickに潰れたノートはマージ（同一midiなら優先マージ）
  - durationTick=0が出ないことを保証

### 3.3.8 MIDI生成（SMF）
- SMF Type 0（単一トラック）
- PPQ: 480（固定推奨）
- テンポメタイベント: BPMから設定
- NoteOn/NoteOff:
  - `tickToMidiTime`: `startTick` をPPQ換算（実装で「gridTick→PPQ」変換テーブルを作る）
  - velocity: 固定（例 90）で可

### 3.3.9 ピッチ推定バックエンド（CREPE → ONNX → onnxruntime-web(WebGPU)）【追加・改訂】

本MVPはピッチ推定を「YIN系（軽量）」で開始できるが、精度優先の構成として **CREPEをONNX化し、onnxruntime-webのWebGPU Execution Providerで推論**するバックエンドを選択可能とする。

#### 目的
- 鼻歌のような倍音が弱く揺れの大きい入力で、古典手法より堅牢なf0推定を得る
- サーバ無し（ブラウザ完結）で推論を成立させる

#### バックエンド優先順位（仕様固定）
- `pitchBackend = "crepe-webgpu" | "crepe-wasm" | "yin"`
- 優先順位は以下に固定する：
  1) `crepe-webgpu`（WebGPU利用可能な場合）
  2) `crepe-wasm`（WebGPU不可・WASM可能な場合）
  3) `yin`（上記いずれも不可、またはユーザが軽量を明示選択した場合）
- UIには実際に選択された backend を表示する（デバッグ・再現性確保）

---

#### 資産（ビルド/配布）
- モデル配置（例）
  - `public/models/crepe_tiny.onnx`（MVP既定）
  - `public/models/crepe_full.onnx`（将来/高精度）
- 依存
  - `onnxruntime-web`
- 事前最適化（任意）
  - ONNX graph optimization / FP16化（互換性検証が前提）

---

#### 実行配置（スレッド/Worker）【制約明文化】
- CREPE推論は **Dedicated Web Worker内**で実行する（UIスレッドのフリーズ防止）
- WebGPU EP 使用時は **WASM proxy worker を利用しない**（`ort.env.wasm.proxy = true` 等の設定をWebGPUで前提にしない）
- Worker内で onnxruntime-web をロードする方式を採用する
  - 例：Classic Workerで `importScripts()`、または ESM Worker での静的import（どちらかに統一）
- CSPによりBlob Workerが禁止される環境があるため、デプロイ時はWorkerの読み込み方式（同一オリジン配信等）を満たすこと

##### Worker Message Protocol（仕様固定）
- Main → Worker
  - `INIT { modelUrl: string, preferred: "webgpu" | "wasm", normalizeMode: "per_frame" | "per_batch", outputKind: "prob" | "logit" }`
  - `ANALYZE { audioBuffer: ArrayBuffer, sampleRate: number, batchFrames?: number }`
- Worker → Main
  - `READY { backend: "webgpu" | "wasm", modelInfo?: { inputShape?: number[], outputShape?: number[] } }`
  - `PROGRESS { doneFrames: number, totalFrames: number }`
  - `RESULT { frames: PitchFrame[] }`
  - `ERROR { code: string, message: string }`

##### 転送（性能要件）
- Main→Worker：`audioBuffer` は **Transferable** で所有権移譲（コピー回避）
- Worker→Main：activationは返さず、`f0Hz` と `confidence` を縮約して返す

---

#### 前処理（CREPE互換）【center/padding・正規化単位を固定可能に】
CREPE互換のため、入力は以下の規則に固定する。

- サンプルレート：**16kHz**
- mono化：stereoの場合 `mono = (L + R) / 2`
- フレーム化（仕様固定）：
  - `window = 1024 samples`（64ms @16k）
  - `hop = 160 samples`（10ms @16k）
- センタリング（仕様固定）：
  - centered frames を採用する
  - 先頭に `pad = window/2 = 512 samples` のゼロパディングを入れる
  - `tSec` は **フレーム中心時刻**として定義し、`tSec = frameIndex * hop / 16000` とする
  - 末尾も必要量ゼロパディングして最後のフレームまで処理する
- 正規化（仕様化）：
  - `normalizeMode` を `INIT` で指定する（モデルにより前提が異なる可能性があるため）
    - `per_frame`: 各フレーム `x = (x - mean(x)) / (std(x) + eps)`
    - `per_batch`: バッチ全体でmean/stdを取り、同式で正規化
  - eps=1e-8（固定）
  - MVP既定は `per_frame` とするが、採用ONNXモデルの前処理に合わせて変更できること

---

#### ONNX入出力アダプタ（モデル差異吸収）【出力意味も吸収】
ONNXモデルにより入出力名・shape・出力の意味（prob/logit）が異なる可能性があるため、**アダプタ層**で吸収する。

- `inputName = session.inputNames[0]`
- `outputName = session.outputNames[0]`
- 入力shape例（モデル依存）
  - `[1, 1024]` / `[1, 1024, 1]` / `[B, 1024]`
- 出力shape例（モデル依存）
  - `[1, 360]`（1フレーム）/ `[B, 360]`（バッチ）
- `outputKind = "prob" | "logit"`
  - `"logit"` の場合は、confidence計算前に softmax を適用し `"prob"` として扱う（仕様固定）
- アダプタが提供すべき関数：
  - `makeInputTensor(frames: Float32Array, batch: number): ort.Tensor`
  - `extractActivation(output: ort.Tensor): Float32Array /* (batch*360) */`

---

#### 推論（WebGPU優先）【warmupとバッチ戦略を固定】
- `session = await ort.InferenceSession.create(modelUrl, { executionProviders: ["webgpu"] })`
- WebGPU不可の場合：
  - `executionProviders: ["wasm"]` にフォールバック（= `crepe-wasm`）
- INIT完了後に **warmup推論**を1回実行する（shader compile等を吸収）
- バッチング（仕様固定）：
  - 推論はフレーム単位ではなく **バッチ単位**で行う
  - 既定 `batchFrames = 256`（=約2.56秒分、10ms hop）
  - 最大 `batchFrames = 1024` を上限とし、端末メモリ/性能に合わせて調整可能とする
  - バッチ毎に `PROGRESS` を通知する

---

#### 後処理（activation → f0Hz/conf）【bin→Hzの式とレンジを固定】
CREPE出力 `activation[t, k] (k=0..359)` から f0Hz と confidence を得る。

- bin→Hzの定義（仕様固定）：
  - 最低周波数 `fMinHz = 32.70319566257483`（C1）
  - 1binあたり `centStep = 20`
  - `binToHz(k) = fMinHz * 2 ** ((k * centStep) / 1200)`
  - これによりレンジは概ね C1〜B7 をカバー（360bin）
- `k* = argmax_k activation[t,k]`
- `confidence`（仕様固定）：
  - `outputKind="prob"` の場合：`confidence = activation[t,k*]`
  - `outputKind="logit"` の場合：softmax後の確率に対し同様に定義
- 精度改善（任意）：
  - `k*` の近傍（±1〜±2bin）で weighted average を取り、実数binへ補間してからHz変換してよい
- 無声判定（仕様固定）：
  - `confidence < confMin` のフレームは `f0Hz=null` とする
  - 初期値：`confMin = 0.3`（prob前提。logitモデルはsoftmax適用後に評価）

出力は既存の `PitchFrame` に格納し、以降は **3.3.5〜3.3.7**（平滑化/ノート化/量子化）を同一に適用する。

---

#### パフォーマンス/メモリ方針（仕様固定）
- activation（N×360）は原則保持せず、`f0Hz` と `confidence` の系列に縮約して返す
- 60秒上限時のフレーム数は概ね 6000（10ms hop）であり、UI描画・保存は縮約データのみを対象とする
- 解析処理はWorkerで実行し、UIスレッドをブロックしない

## 3.4 状態遷移仕様（ProjectState.status）
### 3.4.1 状態定義
- `Idle`: 初期状態／録音データなし or 破棄後
- `Recording`: 録音中
- `Analyzing`: 解析実行中
- `Ready`: 解析結果があり編集可能
- `Error`: エラー発生（message保持）

### 3.4.2 遷移（イベント駆動）
- `Idle` --(Record)--> `Recording`
- `Recording` --(Stop)--> `Idle`（audio確定。解析は未実行）
- `Idle`（audioあり） --(Analyze)--> `Analyzing`
- `Analyzing` --(Success)--> `Ready`（frames/notesRaw/notesQ更新）
- `Analyzing` --(Fail)--> `Error`
- `Ready` --(Clear)--> `Idle`（全データ破棄）
- `Error` --(Clear)--> `Idle`
- `Ready` --(Edit: BPM/Division/NoteEdit)--> `Ready`（notesQ再計算 or 差分更新）

### 3.4.3 操作可否（ガード）
- `Analyze`は `audio` が存在する場合のみ有効
- `Export MIDI`は `notesQ.length > 0` の場合のみ有効
- `Record`は `Analyzing` 中は不可（またはキャンセル実装が必要）

## 3.5 並列実行/スレッド設計（推奨）
- 解析（VAD/YIN/ノート化/量子化）は **Web Worker** で実行し、UIスレッドをブロックしない
- メッセージ:
  - `AnalyzeRequest { audio, grid, params }`
  - `AnalyzeProgress { ... }`（任意）
  - `AnalyzeResult { frames, notesRaw, notesQ }`
  - `AnalyzeError { code, message }`

## 3.6 初期パラメータ（MVP推奨）
- sampleRate: 16000
- frameLen: 30ms、hop: 10ms
- VAD: rmsTh=0.01、silenceConfirm=100ms、voiceConfirm=50ms
- Smooth: median window=7
- Segment: K=8 frames（80ms）、M=3 frames（30ms）
- Grid: BPM=120、division=1/8、4/4固定

## 3.7 精度優先構成（CREPE）実装進捗チェック
- [x] 1. [INFRA] onnxruntime-web導入とCREPE基盤ディレクトリ作成
- [x] 2. [TYPE] AnalyzeParams拡張（backend/model/normalize/outputKind/batch）
- [x] 3. [WORKER] pitch.worker の Message Protocol 実装（INIT/ANALYZE）
- [x] 4. [DSP] CREPE前処理実装（16k/1024/160/center-pad/normalize）
- [x] 5. [DSP] ONNX入出力アダプタ実装（shape/name差異吸収）
- [x] 6. [DSP] CREPE後処理実装（activation/logit→f0Hz/conf）
- [x] 7. [RUNTIME] ORTランタイム実装（webgpu優先・wasmフォールバック・warmup・batch）
- [x] 8. [PIPELINE] analyzePipeline統合（CREPE/YIN切替）
- [x] 9. [UI] 解析設定UI追加（Backend/Model/confMin/batch）+ 実backend表示
- [x] 10. [QA/DOC] テスト強化とREADME更新（精度優先構成）

---

## 付録A. フォルダ構成（参考）
```
src/
  app/
    App.tsx
    store.ts
    types.ts
  audio/
    recorder.ts
    resample.ts
    wav.ts
  dsp/
    vad.ts
    yin.ts
    smooth.ts
    segment.ts
    quantize.ts
  midi/
    smf.ts
    synth.ts
  ui/
    RecorderPanel.tsx
    AnalysisPanel.tsx
    PitchView.tsx
    PianoRollView.tsx
    ExportPanel.tsx
  utils/
    math.ts
    id.ts
```
