# Requirement.md — 鼻歌→楽譜（MVP）仕様書（3階層）【改訂版 v1.2】

作成日: 2026-02-15  
改訂日: 2026-02-15  
対象: Webアプリ（React / Browser-only / サーバ無し）および Desktopアプリ（Electron）  
前提: **一定テンポ前提（後で編集）**・単旋律（鼻歌/ハミング）・4/4固定（MVP）

---

## 0. 用語（追加定義あり）
- **f0**: 基本周波数（Hz）
- **VAD**: Voice Activity Detection（無声/有声判定）
- **ノート化**: フレーム列（f0）から音符区間（音高＋開始/終了）へ変換
- **量子化**: 一定テンポの拍グリッドへ開始/長さをスナップ
- **GridTick**: アプリ内部のグリッド単位の整数（division=1/8なら「8分音符1つ」、division=1/16なら「16分音符1つ」、division=1/32なら「32分音符1つ」）
- **MIDI Tick**: SMFの時間単位（PPQベース）
- **PPQ**: Pulses Per Quarter note（四分音符あたりのMIDI Tick数。MVPは480固定）
- **gridTicksPerQuarter**: 四分音符あたりのGridTick数  
  - division=1/8 → 2  
  - division=1/16 → 4
  - division=1/32 → 8
- **Electron Main**: ウィンドウ生成・OS連携を担当するメインプロセス
- **Electron Renderer**: 既存React UIを描画するプロセス
- **Preload**: Main/Renderer間の安全なブリッジ層（`contextBridge`）

---

# 1. 要求仕様（ユーザ視点）

## 1.1 目的
ユーザが鼻歌を録音し、メロディを自動で推定して編集可能な形（ピアノロール）で確認し、MIDIとして出力できること。

## 1.2 想定ユーザ
- 作曲の下書きを素早くMIDI化したいユーザ
- 「鼻歌→ざっくり採譜→後で修正」ワークフローを望むユーザ

## 1.3 ユースケース（基本フロー）
1. ユーザがブラウザで録音を開始し、鼻歌を歌う
2. 録音を停止する（録音済み状態）
3. 解析を実行する
4. ピッチカーブ/ピアノロールで推定結果を確認する
5. BPM・量子化分解能・音程/タイミングを編集する
6. MIDIをダウンロードし、DAW等で利用する

## 1.4 機能要件

### 1.4.1 録音
- マイク録音をブラウザで実行できる
- 録音を停止できる
- 録音した音声を再生できる
- 録音を破棄（Clear）できる
- 録音時間の上限を設ける（MVP推奨: 60秒）
- 録音メトロノームのON/OFFを切り替えできる
- 録音前にメトロノーム音を確認できる（8拍プレビュー）
- 録音中は設定BPMに追従したメトロノームを再生できる（4/4先頭拍アクセント）

### 1.4.2 解析
- 録音音声から、単旋律のピッチ（f0）を推定できる
- 推定したピッチから音符列（ノート）を生成できる
- 一定テンポ・固定拍子（4/4）の前提で量子化できる

### 1.4.3 表示
- ピッチカーブ（時間×Hz/音高）を表示できる
- ピアノロール（時間×音高）でノート列を表示できる
- ピアノロール左側に音名ラベル（例: C4, F#4）を表示できる
- Pitch/Piano Roll は横スクロールで長尺データを閲覧できる

### 1.4.4 編集
- BPMをユーザが変更できる（固定テンポ値を調整）
- 量子化分解能を切り替えできる（8分/16分/32分）
- ピアノロール上で以下ができる:
  - ノート選択
  - 音程変更（±半音）
  - タイミング移動（GridTick単位）
  - 全体半音移調（+1semi / -1semi）
  - 全体オクターブ移調（+1oct / -1oct）
  - 分割/結合
  - 削除
- Undo（ひとつ前に戻る）を実行できる
- Undo履歴は最大5ステップ保持する（6件目以降は古い履歴を破棄）
- （推奨）Tap Tempo: ユーザのタップ操作からBPMを推定し入力欄に反映（MVPで実装してもコスト小）

### 1.4.5 再生
- 推定/編集したノート列をブラウザで再生できる（簡易シンセで可）
- ノート再生を停止できる
- ノート再生の一時停止/再開ができる
- ノート再生時、ピアノロール上で現在再生位置（プレイヘッド）を表示できる

### 1.4.6 エクスポート
- 編集結果をMIDI（SMF）としてダウンロードできる

## 1.5 非機能要件（測定可能な形に補強）
- **コスト最小**: サーバ運用なし（静的ホスティングのみ）
- **プライバシー**: 音声は端末内で処理し、外部送信しない
- **性能（MVP目標）**:
  - 30秒録音（16kHz mono）を対象に、解析時間が **5秒以内**（Chrome/Edge、一般的ノートPCクラス）を目標
  - 解析中もUIが固まらない（Workerで実行）
- **互換性**: 主要ブラウザ（Chrome/Edge/Safari）で動作
- **操作性**: ピアノロール編集が実用的な反応速度である（Canvas推奨）

## 1.6 制約（MVP）
- 単旋律のみ（伴奏混じりは対象外）
- 拍子は4/4固定
- テンポは一定（BPM値のみユーザが変更）
- 自動テンポ推定・自動拍子推定はMVP対象外（Tap Tempoは例外としてUI補助）
- 楽譜（五線譜）出力・MusicXMLはMVP対象外（将来拡張）

## 1.7 受入基準（MVP / 測定可能）
- 基本動作:
  - 録音前メトロノーム確認→録音→解析→ピアノロール表示→編集→MIDI出力が一連で成立する
  - ノート再生中にプレイヘッドが進み、一時停止/再開/停止で整合した挙動を示す
  - ExportしたMIDIを一般的DAWで読み込める（SMFとして破損していない）
- 出力の最小品質:
  - 解析後、`notesQ.length > 0` となるケースが成立する（無声のみ等の入力を除く）
  - A4（440Hz）等のテスト入力で主要音高が **±1半音以内**に入る（合成サイン波/簡易テスト）
- 性能:
  - 30秒音声で解析が **5秒以内**（目標値、測定環境をREADMEで固定）

## 1.8 Desktop版要件（追加）
- 既存Web版と同等の主要機能（録音・解析・編集・再生・MIDI出力）をDesktopアプリで提供する
- サーバレス・ローカル完結処理の原則を維持する
- Desktop版でも解析はWorker利用を基本とし、失敗時はメインスレッドフォールバックを維持する
- RendererにNode権限を直接与えない（`contextIsolation=true`, `nodeIntegration=false`）
- Desktop版の初期対応OSはWindows（将来macOS対応を追加）

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
- 初期表示タブ: Piano Roll

## 2.3 Recorder Panel 仕様（詳細化）
### 入力
- Record: 録音開始
- Stop: 録音停止（録音済み状態へ）
- Play Original: 録音音声再生
- Clear: 録音データ破棄（状態初期化）
- 録音メトロノーム: ON/OFF切替
- メトロノーム確認: 録音前に8拍プレビュー再生

### 出力（表示）
- 状態表示（Empty / Recording / Recorded / Analyzing / Ready / Error）
- 録音時間（mm:ss）
- （任意）波形の簡易表示

### 録音データの取り扱い（外部仕様として固定）
- 入力チャンネル:
  - stereoの場合は `mono = (L + R) / 2` で合成
- サンプルレート:
  - 内部処理用に16kHzへ変換（UI上の表示/保存は任意）
- 録音上限:
  - 60秒到達時に自動Stop、もしくは警告して停止（実装でどちらかに統一）

## 2.4 Analysis Panel 仕様
### 入力（ユーザ操作）
- Analyze: 解析実行
- BPM: 数値入力（範囲: 40〜240。範囲外はクランプ or 入力エラー）
- Division: トグル（1/8, 1/16, 1/32）
- （推奨）Tap Tempo: ボタンを数回タップでBPM推定

### 出力（表示）
- 状態表示: Empty / Recording / Recorded / Analyzing / Ready / Error
- 解析進捗（スピナーで可）

## 2.5 Pitch View 仕様（タブ）
### 出力
- 時間軸に沿った f0 曲線（unvoicedはギャップ）
- （任意）confidenceの可視化
- 横スクロールで長尺データを閲覧可能

## 2.6 Piano Roll View 仕様（タブ）【分割/結合を明文化】
### 操作
- クリック: ノート選択（複数選択はShift/ドラッグ範囲選択は任意）
- ドラッグ上下: 音程変更（半音ステップ）
- ドラッグ左右: startTick変更（GridTick単位）
- 空白領域のドラッグ: 横スクロール（パン）
- 全体半音移調:
  - 全ノートを一括で +1 / -1 semitone する
  - 範囲外は `0..127` にクランプする
- 全体オクターブ移調:
  - 全ノートを一括で +12 / -12 semitone する
  - 範囲外は `0..127` にクランプする
- Undo:
  - 直近の編集操作を1ステップ取り消す
  - 履歴保持数は最大5
  - 操作単位は「分割/結合/削除/全体半音移調/全体オクターブ移調」各1回、および「ドラッグ移動1回（押下〜離し）」を1回とする
- 分割:
  - 選択ノート上のクリック位置を最寄りGridTickへ丸め、その位置で2分割  
  - 分割位置が端（開始/終了と同じ）になる場合は分割しない
- 結合:
  - 複数選択ノートを、時間順に並べて結合する
  - **同一midiの隣接ノートのみ結合可能**（MVPの簡易規則）
- 削除: 選択ノート削除

### 表示
- ノート矩形（横: tick、縦: midi）
- 音名ラベル列（左端）
- 選択状態のハイライト
- グリッド表示（divisionに応じた縦線/目盛）
- 再生中プレイヘッド（現在位置バー）表示
- 横スクロール対応（縦スクロールなし）
- 再生中、プレイヘッドが表示範囲外に出る場合は横方向へ自動追従スクロールする

## 2.7 Export Panel 仕様
### 入力
- Play Notes: ノート再生開始
- Pause/Resume: ノート再生の一時停止/再開
- Stop: ノート再生停止
- Export MIDI: MIDIファイル生成・ダウンロード

### 出力
- 既定ファイル名: `humming.mid`（任意で日時付与: `humming_YYYYMMDD_HHMM.mid`）

## 2.8 入出力データ仕様
### 入力
- マイク音声（ブラウザ取得）
- ユーザ設定: BPM, Division
- 編集操作: ノート編集イベント群

### 出力
- MIDI（SMF Type 0 / PPQ=480 / 1トラック / 1チャンネル）

## 2.9 エラー/例外（外部動作）
- マイク権限拒否: エラー表示し録音不可
- 録音データなしでAnalyze: 無効化または警告
- 解析失敗: Error状態に遷移し、再試行導線を提示
- 解析に時間がかかる: UIは応答し続ける（基本はWorkerで実行）
- Workerの起動/実行に失敗した場合はメインスレッド解析へフォールバックする

---

# 3. 内部仕様（アルゴ・型・状態遷移）

## 3.1 コンポーネント/モジュール構成（推奨）
- `audio/` : 録音・リサンプル・WAV（デバッグ）
- `dsp/` : VAD・YIN・平滑化・ノート化・量子化
- `midi/` : SMF生成・（任意）簡易シンセ
- `ui/` : Reactコンポーネント群
- `app/` : store（状態管理）・型定義

## 3.2 内部データ型（TypeScript）【状態追加】
```ts
export type AudioBufferData = {
  sampleRate: number;      // 推奨 16000
  samples: Float32Array;   // mono PCM
  durationSec: number;
};

export type PitchFrame = {
  tSec: number;
  f0Hz: number | null;     // null = unvoiced
  conf: number;            // 0..1（定義は3.3.4参照）
  rms: number;             // 0..1（正規化後のRMS）
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
  division: "1/8" | "1/16" | "1/32";
};

export type NoteQ = {
  id: string;
  midi: number;
  startTick: number;       // GridTick
  durationTick: number;    // >= 1
  velocity: number;        // 1..127
};

export type ProjectStatus =
  | "Empty"      // 音声なし
  | "Recording"  // 録音中
  | "Recorded"   // 録音済み（未解析/再解析可能）
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
  undoStack: Array<{ notesQ: NoteQ[]; selection: { noteIds: string[] } }>; // 編集履歴（最大5）
  error?: { code: string; message: string };
};

// UIローカル状態（実装依存）
export type PlaybackUiState = {
  playheadTick: number | null;
  isPlaybackActive: boolean;
  isPlaybackPaused: boolean;
};
```

## 3.3 アルゴリズム仕様

### 3.3.1 リサンプル
- 目的: 推定器入力を統一（16kHz mono）
- 実装（MVP）: 線形補間で十分
- stereo→mono: `mono = (L + R) / 2`

### 3.3.2 フレーム化
- 推奨:
  - `frameLen = 30ms`（480 samples @16k）
  - `hop = 10ms`（160 samples @16k）
- RMSは**正規化後**のフレームで計算し `PitchFrame.rms` に格納

### 3.3.3 VAD（無声判定）【閾値の安定化を追加】
- 固定閾値は入力ゲインに弱いので、MVPでは以下のいずれかに統一する:
  - A) **自動閾値**: `rmsTh = percentile(rmsAll, 20) * k`（推奨: k=1.5）
  - B) 固定閾値: `rmsTh = 0.01`（録音正規化を必須化）
- 連続条件（初期値）:
  - 無声確定: `silenceConfirm = 100ms`（=10 hops）
  - 有声確定: `voiceConfirm = 50ms`（=5 hops）
- 出力: unvoicedフレームは `f0Hz=null` とする（推定前マスク/推定後マスクどちらでも可）

### 3.3.4 ピッチ推定（YIN系）【conf定義を固定】
- 探索範囲:
  - `fmin = 80Hz`, `fmax = 1000Hz`
- YIN内部で得られる `cmndMin`（0が理想、1に近いほど悪い）を用い、confidenceを次で定義する:
  - `conf = clamp(1 - cmndMin, 0, 1)`
- 低信頼の扱い（初期値）:
  - `conf < 0.3` は `f0Hz=null` として扱う（ノート化の誤爆を減らす）

### 3.3.5 平滑化・外れ値抑制
- メディアンフィルタ（初期値）: 窓=7（±3フレーム）
- オクターブジャンプ抑制（ルール例）:
  - `abs(midi[i]-midi[i-1]) >= 10` の単発ジャンプは補正候補
  - 近傍中央値へ寄せる、または前値保持

### 3.3.6 ノート区間化（安定区間ベース）【例外処理を追加】
- `midiFloat = 69 + 12*log2(f0/440)`
- `midi = round(midiFloat)`
- 同一ピッチ判定: ±0.5半音以内
- 初期値:
  - 安定開始条件: `K = 8 frames`（80ms）
  - 揺れ許容: `M = 3 frames`（30ms）
- 最小ノート長（推奨）:
  - `minNoteSec = 0.06`（60ms）未満のノート候補は隣接ノートへマージ（優先: 同一midi）
- ノート終端:
  - 無声が50ms以上継続、または別ピッチがKフレーム継続
- ノート代表音高:
  - 区間内 `midiFloat` の中央値→四捨五入（外れに強い）

### 3.3.7 量子化（固定テンポ）
- `beatSec = 60 / bpm`
- `gridSec = beatSec / 2`（division=1/8）, `gridSec = beatSec / 4`（division=1/16）, `gridSec = beatSec / 8`（division=1/32）
- `startTick = round(startSec / gridSec)`
- `endTick = round(endSec / gridSec)`
- `durationTick = max(1, endTick - startTick)`
- 破綻防止:
  - 同じstartTickに潰れたノートはマージ（同一midi優先）
  - durationTick=0が出ないことを保証

### 3.3.8 MIDI生成（SMF）【Tick変換を明文化】
- SMF Type 0（単一トラック）
- PPQ: 480（固定）
- テンポメタイベント: BPMから設定（1曲1テンポ）
- GridTick→MIDI Tick変換:
  - `gridTicksPerQuarter = (division == "1/8") ? 2 : (division == "1/16") ? 4 : 8`
  - `midiTick = gridTick * (PPQ / gridTicksPerQuarter)`
  - 制約: `PPQ % gridTicksPerQuarter == 0` を満たすこと（PPQ=480なら常にOK）
- NoteOn/NoteOff:
  - `on = midiTick(startTick)`
  - `off = midiTick(startTick + durationTick)`
  - velocity: 固定（例: 90）で可
- チャンネル: 0固定
- Program Change: MVPでは出さない（任意で1回だけ指定しても良い）

## 3.4 状態遷移仕様（ProjectState.status）【Recorded追加】
### 3.4.1 状態定義
- `Empty`: 初期状態／録音データなし or 破棄後
- `Recording`: 録音中
- `Recorded`: 録音済み（解析未実行/再解析可能）
- `Analyzing`: 解析実行中
- `Ready`: 解析結果があり編集可能
- `Error`: エラー発生（message保持）

### 3.4.2 遷移（イベント駆動）
- `Empty` --(Record)--> `Recording`
- `Recording` --(Stop)--> `Recorded`（audio確定）
- `Recorded` --(Analyze)--> `Analyzing`
- `Ready` --(Analyze)--> `Analyzing`（再解析）
- `Error` --(Analyze)--> `Analyzing`（audioが保持されている場合の再試行）
- `Analyzing` --(Success)--> `Ready`
- `Analyzing` --(Fail)--> `Error`
- `Ready` --(Clear)--> `Empty`
- `Error` --(Clear)--> `Empty`
- `Recorded` --(Clear)--> `Empty`

### 3.4.3 操作可否（ガード）
- `Analyze`は `audio` が存在する場合のみ有効
- `Export MIDI`は `notesQ.length > 0` の場合のみ有効
- `Undo`は `undoStack.length > 0` の場合のみ有効
- `Play Notes`は `notesQ.length > 0` の場合のみ有効
- `Pause/Resume` と `Stop` は再生中（`isPlaybackActive=true`）の場合のみ有効
- `Record`は `Analyzing` 中は不可（キャンセル実装する場合は別途仕様化）

### 3.4.4 Undo履歴規則
- 履歴は `undoStack` にスナップショットとして保持する
- `undoStack` の最大長は5（push時に古い履歴から破棄）
- Undo実行時は末尾スナップショットを復元し、復元した履歴は `undoStack` からpopする
- 以下のイベントで `undoStack` をクリアする:
  - `Recorded`（新規録音確定）
  - `Analyze Success`（再解析結果反映）
  - `Clear`
  - `Error`

### 3.4.5 再生UI規則
- 再生状態は `ProjectStatus` とは独立して `PlaybackUiState` で管理する
- 再生中は `playheadTick` を定期更新し、Piano Roll に可視化する
- 一時停止中は `playheadTick` を保持し、再開時はその位置から進行を再開する
- 停止時は `playheadTick=null` に戻す

## 3.5 並列実行/スレッド設計（実装準拠）
- 解析（VAD/YIN/ノート化/量子化）は基本的に **Web Worker** で実行し、UIスレッドをブロックしない
- Workerの生成・実行・メッセージ送信で失敗した場合は、同一パイプラインをメインスレッドで実行してフォールバックする
- メッセージI/F（判別用 `type` を含む）:
  - `AnalyzeRequest { audioBuffer: ArrayBuffer, sampleRate, grid, params }`
  - `AnalyzeProgress { type: "progress", stage: "vad"|"pitch"|"segment"|"quantize", progress }`
  - `AnalyzeResult { type: "result", frames, notesRaw, notesQ }`
  - `AnalyzeError { type: "error", code, message }`
- `audioBuffer` は `Float32Array` のバッファをコピーして送信する（送信失敗時はフォールバック）

## 3.6 初期パラメータ（MVP推奨）
- sampleRate: 16000
- frameLen: 30ms、hop: 10ms
- VAD: 自動閾値（推奨）または rmsTh=0.01（正規化必須）、silenceConfirm=100ms、voiceConfirm=50ms
- Pitch: confMin=0.3
- Smooth: median window=7
- Segment: K=8 frames（80ms）、M=3 frames（30ms）、minNoteSec=60ms
- Grid: BPM=120、division=1/16、4/4固定
- Record metronome: BPM連動、4/4先頭拍アクセント、プレビューは8拍
- MIDI: PPQ=480、channel=0、velocity=90

---

# 4. Desktopアプリ版仕様（Electron）

## 4.1 目的と提供形態
- Web版と同一のUI/解析ロジックをDesktopアプリとして配布し、ブラウザ依存を減らす
- 配布形式はインストーラ付き実行ファイル（Windows向け）を初期ターゲットとする

## 4.2 スコープ
- 対象:
  - 既存Web機能のDesktop移植
  - マイク録音、解析、Piano Roll編集、再生、MIDI出力
  - 自動更新なしの単体配布（MVP）
- 非対象:
  - クラウド同期
  - ログイン/アカウント機能
  - DAWプラグイン化

## 4.3 アーキテクチャ
- `Main Process`:
  - `BrowserWindow` の作成
  - 権限ハンドリング（マイク）
  - 将来のネイティブ保存ダイアログ/ファイルI/O窓口
- `Renderer Process`:
  - 既存 `Vite + React` アプリをそのまま利用
  - 録音/解析/編集/再生のUI処理
- `Preload`:
  - 必要最小限のAPIのみ `contextBridge` で公開
  - 初版は最小（将来 `saveFile` API 等を拡張）

## 4.4 セキュリティ要件
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` を基本方針とし、必要時のみ例外を明記する
- リモートコンテンツ読込禁止（ローカル生成物のみ読み込む）
- `preload` 経由で公開するAPIはホワイトリスト方式で制御する

## 4.5 権限・デバイス要件
- 録音機能利用時にマイク権限が必要
- 権限拒否時はWeb版同様に `Error` 状態へ遷移し、再試行導線を表示する
- OS設定でマイク無効の場合のエラー文言をDesktop向けに明示する

## 4.6 画面・機能整合
- UI/状態遷移はWeb版仕様（章1〜3）と同一
- 解析パラメータ・MIDI出力仕様（Type0, PPQ=480）も同一
- ファイル名既定値 `humming.mid` を維持

## 4.7 ビルド・配布仕様
- ビルド構成:
  - Web公開向けビルドとDesktop向けビルドを分離する
  - Desktop向け `base` は相対パス（`./`）を使用する
- 配布:
  - `electron-builder` 等でWindows実行ファイルを生成
  - GitHub Releases等で成果物を配布する

## 4.8 Desktop版受入基準
- 起動後、録音→解析→編集→再生→MIDI出力が一連で成立する
- マイク権限拒否時にエラー表示され、再試行可能である
- 30秒音声の解析時間がWeb版目標（5秒以内）から大きく悪化しない
- 生成MIDIが主要DAWで読込可能である

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

## 付録B. Desktop拡張時の想定追加構成（参考）
```
electron/
  main.ts
  preload.ts
  builder.config.(yml|json)
```
