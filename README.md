# CreateScore (鼻歌→MIDI MVP)

`Requirement.md v1.1` に基づくブラウザ完結の採譜MVPです。

## 機能

- ブラウザ録音 (`Record / Stop / Play Original / Clear`)
- 録音メトロノーム（ON/OFF、録音前8拍プレビュー）
- 16kHz mono へ変換して Worker で解析
- VAD + ピッチ推定 + 平滑化 + ノート区間化 + 量子化
- Division切替（`1/8` / `1/16` / `1/32`）
- Pitch表示 / Piano Roll表示
- Piano Roll編集（選択、移動、Split、Join、Delete）
- 全ノートの半音一括移調（`-1semi` / `+1semi`）
- 全ノートのオクターブ一括移調（`-1oct` / `+1oct`）
- Tap Tempo（直近最大6タップ）
- ノート再生（Web Audio簡易シンセ）
- ノート再生の一時停止/再開
- ノート再生中のプレイヘッド表示（Piano Roll上）
- MIDI出力（SMF Type 0, PPQ=480）

## セットアップ

```bash
npm install
npm run dev
```

## テスト

```bash
npm test
```

対象:

- `quantize.ts`
- `smf.ts`
- `store.ts`
- `tapTempo.ts`
- `segment.ts`

## 受入確認の観点

1. 録音→解析→表示→編集→再生→MIDI出力が成立する。
2. 録音なしでAnalyzeできない。
3. `notesQ.length === 0` の時はExport不可。
4. マイク権限拒否でエラー表示が出る。
5. A4(440Hz)入力で主要音高が±1半音に収まる。

## 解析性能の測定条件（README固定）

- OS: Windows 11
- Browser: Chrome Stable
- CPU: ノートPCクラス（4コア以上）
- 入力: 30秒 / 16kHz mono
- 目標: 解析5秒以内

## フォルダ

- `src/app`: 状態・型・App
- `src/audio`: 録音/デコード/リサンプル
- `src/dsp`: VAD/ピッチ/平滑化/区間化/量子化/TapTempo
- `src/workers`: 解析Worker
- `src/midi`: MIDI出力/再生
- `src/ui`: パネルUI
