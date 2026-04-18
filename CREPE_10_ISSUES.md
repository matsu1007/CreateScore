# CREPE精度優先構成 実装Issue（10チケット）

## [x] 1. [INFRA] onnxruntime-web導入とCREPE基盤ディレクトリ作成
- 目的: CREPE実装の土台を作る
- 作業:
  - `onnxruntime-web` 追加
  - `src/dsp/crepe/` と `src/workers/` 配下の骨組み作成
- 変更ファイル:
  - `package.json`
  - `src/dsp/crepe/`（新規）
- 完了条件:
  - `npm install` 後に `npx tsc -b` が通る

## [x] 2. [TYPE] AnalyzeParams拡張（backend/model/normalize/outputKind/batch）
- 目的: 精度優先構成の設定を型で固定
- 作業:
  - `AnalyzeParams` に `pitchBackend`, `modelVariant`, `normalizeMode`, `outputKind`, `batchFrames` を追加
  - 関連メッセージ型の追加
- 変更ファイル:
  - `src/app/types.ts`
- 完了条件:
  - 型エラーなしでビルド可能

## [x] 3. [WORKER] pitch.worker の Message Protocol 実装（INIT/ANALYZE）
- 目的: CREPE推論用Workerの通信契約を実装
- 作業:
  - `INIT/ANALYZE` 受信
  - `READY/PROGRESS/RESULT/ERROR` 送信
  - まずはダミー応答で可
- 変更ファイル:
  - `src/workers/pitch.worker.ts`（新規）
  - `src/app/types.ts`
- 完了条件:
  - Worker起動し、ダミーで `READY -> RESULT` が返る

## [x] 4. [DSP] CREPE前処理実装（16k/1024/160/center-pad/normalize）
- 目的: モデル入力を仕様通りに整形
- 作業:
  - mono16k前提のフレーム化
  - center/padding
  - `per_frame/per_batch` 正規化
- 変更ファイル:
  - `src/dsp/crepe/preprocess.ts`（新規）
  - `src/dsp/crepe/preprocess.test.ts`（新規）
- 完了条件:
  - frame数・timestamp・正規化テスト通過

## [x] 5. [DSP] ONNX入出力アダプタ実装（shape/name差異吸収）
- 目的: モデル差異に依存しない推論I/O
- 作業:
  - `inputNames/outputNames` 自動取得
  - 複数shapeパターン対応
- 変更ファイル:
  - `src/dsp/crepe/adapter.ts`（新規）
  - `src/dsp/crepe/adapter.test.ts`（新規）
- 完了条件:
  - shape差異ケースのテスト通過

## [x] 6. [DSP] CREPE後処理実装（activation/logit→f0Hz/conf）
- 目的: 360bin出力を `PitchFrame` へ変換
- 作業:
  - `binToHz` 実装
  - `outputKind=logit` 時の softmax
  - `confMin` による unvoiced 化
- 変更ファイル:
  - `src/dsp/crepe/decode.ts`（新規）
  - `src/dsp/crepe/decode.test.ts`（新規）
- 完了条件:
  - 主要変換テストが通る

## [x] 7. [RUNTIME] ORTランタイム実装（webgpu優先・wasmフォールバック・warmup・batch）
- 目的: 実運用できる推論実行器を作る
- 作業:
  - `webgpu -> wasm` 優先順実装
  - warmup実行
  - batch推論と進捗通知
- 変更ファイル:
  - `src/dsp/crepe/runtime.ts`（新規）
  - `src/workers/pitch.worker.ts`
- 完了条件:
  - backend選択が仕様順に動作し、推論が完走

## [x] 8. [PIPELINE] analyzePipeline統合（CREPE/YIN切替）
- 目的: 既存パイプラインに精度優先backendを統合
- 作業:
  - ピッチ推定器をbackend選択式に変更
  - VAD/Smooth/Segment/Quantizeは既存流用
- 変更ファイル:
  - `src/dsp/analyzePipeline.ts`
  - `src/workers/analyze.worker.ts`（必要なら）
- 完了条件:
  - backend変更してもノート生成まで完走

## [x] 9. [UI] 解析設定UI追加（Backend/Model/confMin/batch）+ 実backend表示
- 目的: ユーザが精度優先構成を選べるようにする
- 作業:
  - Analysis Panelに設定項目追加
  - 実際に採用されたbackend表示
- 変更ファイル:
  - `src/ui/AnalysisPanel.tsx`
  - `src/app/App.tsx`
- 完了条件:
  - UI操作が `AnalyzeParams` に反映される

## [x] 10. [QA/DOC] テスト強化とREADME更新（精度優先構成）
- 目的: 回帰防止と運用手順の明文化
- 作業:
  - fallback順序、変換ロジック、Worker通信テスト追加
  - READMEにモデル配置と制約を追記
- 変更ファイル:
  - `src/**/*.test.ts`
  - `README.md`
- 完了条件:
  - テスト通過、READMEに新構成手順が明記済み
