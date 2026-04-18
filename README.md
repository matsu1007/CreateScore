# CreateScore
鼻歌を録音してMIDIに変換し、ブラウザ上で編集・再生・エクスポートできる Web アプリです。  
サーバを使わず、音声処理は端末内で完結します。

## 概要
- フロントエンド: `Vite + React + TypeScript`
- 実行形態: シングルページアプリ（Browser-only）
- 解析: Web Worker 実行（失敗時はメインスレッドへフォールバック）
- 対象: 単旋律メロディ（鼻歌/ハミング）

## 主な機能
### 録音
- `Record / Stop / Play Original / Clear`
- 録音メトロノーム ON/OFF
- 録音前 8 拍プレビュー
- 録音中クリック（4/4先頭拍アクセント）

### 解析
- 16kHz mono 変換
- VAD
- ピッチ推定（YIN / CREPE）
- 平滑化
- ノート区間化
- 量子化
- Worker 実行 + フォールバック

### 設定
- BPM (`40-240`)
- Division (`1/8` / `1/16` / `1/32`, デフォルト `1/16`)
- Deadband(cents) (`0-100`, デフォルト `35`)
- Backend (`YIN` / `CREPE(WebGPU)` / `CREPE(WASM)`)
- Model (`tiny` / `full`)
- confMin (`0.0-1.0`)
- batch (`1-1024`)
- Tap Tempo（直近6タップ）

### 表示
- Piano Roll View（音名ラベル付き）
- 横スクロール対応

### 編集
- ノート選択（Shift+Click 複数選択、モバイル複数選択モード）
- ドラッグ移動（時間/音高）
- `Split / Join / Delete`
- 全体移調（`±1semi` / `±1oct`）
- Undo（最大5ステップ）

### 再生/出力
- ノート再生
- 一時停止 / 再開 / 停止
- プレイヘッド表示
- MIDIエクスポート（SMF Type 0, PPQ=480, `humming.mid`）

## セットアップ
前提:
- Node.js `18+`
- npm

```bash
npm install
npm run dev
```

ブラウザで表示されるローカルURLを開いて使用します。

## CREPEバックエンド

### 概要
CREPE（Convolutional REpresentation for Pitch Estimation）はDNNによるピッチ推定モデルです。  
YINより高精度で、特に声楽・ハミングに強い特性を持ちます。

| Backend | 説明 |
|---|---|
| `CREPE(WebGPU)` | GPUで推論。WebGPUに対応したブラウザ/GPUが必要。最速。 |
| `CREPE(WASM)` | CPU（WASM）で推論。環境を問わず動作。WebGPU非対応時は自動でこちらに落ちる。 |
| `YIN` | モデル不要の従来手法。CREPEセッション初期化失敗時のフォールバック先。 |

### モデルの用意
CREPEバックエンドを使う場合、ONNXモデルを `public/model/` に配置してください。

| ファイル | サイズ目安 | 精度 | 推奨用途 |
|---|---|---|---|
| `public/model/crepe_tiny.onnx` | 約 2 MB | 標準 | 通常使用 |
| `public/model/crepe_full.onnx` | 約 130 MB | 高精度 | 精度優先 |

**モデルのエクスポート手順:**

Python環境（3.10+）で以下を実行します。

```bash
pip install torch torchcrepe onnx onnxruntime onnxscript
```

```bash
# tiny モデル（約 2MB）
python export_crepe_torch.py tiny

# full モデル（約 130MB）
python export_crepe_torch.py full
```

出力された `crepe_tiny.onnx` / `crepe_full.onnx` を `public/model/` に配置してください。

### ランタイムファイルの配置
`public/ort/` に onnxruntime-web の WASM ファイルを配置してください。

```bash
node -e "
const src = 'node_modules/onnxruntime-web/dist';
const dst = 'public/ort';
const fs = require('fs');
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => /\.(wasm|mjs)$/.test(f)))
  fs.copyFileSync(src+'/'+f, dst+'/'+f);
console.log('done');
"
```

補足:
- モデルが無い、またはWebGPU/WASMが使えない場合は `YIN` へフォールバックします。
- 実際に使用されたBackendは解析パネルの「実行Backend」に表示されます。
- `public/ort/` と `public/model/` は `.gitignore` で除外済みです（容量が大きいため）。

## Desktop版（Electron）
開発起動:
```bash
npm run desktop:dev
```

Desktop向けビルド:
```bash
npm run build:desktop
```

配布用パッケージ作成:
```bash
npm run desktop:dist
```

備考:
- `desktop:start` は既存ビルド済み `dist-desktop` を読み込んで起動します。
- `desktop:dist` は `electron-builder` を実行して `release/` に成果物を出力します。

## 使い方
1. `メトロノーム確認` でテンポを確認（必要なら `BPM` と `Division` を調整）。
2. `Record` で録音開始、`Stop` で終了。
3. `Analyze` でノート抽出。
4. Piano Roll で編集（移動、Split、Join、Delete、移調、Undo）。
5. `ノート再生` で確認後、`Export MIDI` で `humming.mid` を保存。

## テスト
```bash
npm test
```

テスト対象:
- `src/dsp/quantize.ts`
- `src/midi/smf.ts`
- `src/app/store.ts`
- `src/dsp/tapTempo.ts`
- `src/dsp/segment.ts`
- `src/dsp/analyzePipeline.ts`（backend切替/フォールバック）
- `src/dsp/crepe/preprocess.ts`
- `src/dsp/crepe/adapter.ts`
- `src/dsp/crepe/decode.ts`

## 仕様メモ
- Project status: `Empty / Recording / Recorded / Analyzing / Ready / Error`
- 録音上限: 60秒
- 拍子: 4/4 固定
- テンポ: 固定（自動推定なし、Tap Tempo補助のみ）
- 永続化: なし（セッションのみ）

## 受入観点
1. 録音前メトロノーム確認→録音→解析→編集→再生→MIDI出力が成立する。
2. 録音なしで `Analyze` 不可。
3. ノートが空のとき `Export MIDI` 不可。
4. マイク権限拒否時に `Error` 表示。
5. A4（440Hz）入力で主要音高が概ね ±1 半音以内。

## 解析性能の測定条件
- OS: Windows 11
- Browser: Chrome Stable
- CPU: ノートPCクラス（4コア以上）
- 入力: 30秒 / 16kHz mono
- 目標: 解析5秒以内

## トラブルシュート
- `@rollup/rollup-...` が見つからず `npm test` / `vite` が失敗する場合:
```bash
npm install --include=optional
```
`npm` の optional dependency 解決不整合で発生することがあります。

- 上記で解決しない場合:
  `node_modules` と `package-lock.json` を削除してから `npm install` を再実行してください。

- `desktop:dist` で `Cannot create symbolic link` が出る場合:
  Windows の権限不足で `winCodeSign` 展開に失敗しています。  
  このリポジトリは `signAndEditExecutable: false` を設定済みなので、最新コードを pull した上で再実行してください。  
  それでも失敗する場合は以下のいずれかで回避できます。
  1. Windows の「開発者モード」を有効化する
  2. ターミナルを管理者権限で起動して `npm run desktop:dist` を実行する

- CREPEを選択してもYINになる場合:
  1. `public/model/crepe_tiny.onnx` が配置されているか確認
  2. `public/ort/` に `.wasm` / `.mjs` ファイルが配置されているか確認
  3. ブラウザのWebGPU対応状況を確認（未対応ならWASM経由で動作）
  4. それでも失敗する場合は実行環境制約によりYINへフォールバックします

## ディレクトリ構成
- `src/app`: 状態管理・型・アプリ本体
- `src/audio`: 録音/デコード/リサンプル
- `src/dsp`: 解析ロジック
- `src/workers`: 解析 Worker
- `src/midi`: MIDI 出力 / ノート再生
- `src/ui`: UI コンポーネント

## 仕様書
詳細仕様は `Requirement.md` を参照してください。
