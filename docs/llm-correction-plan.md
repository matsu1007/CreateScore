# LLM補正機能 実装方針

Ollama + Gemma4 12B を使用して、解析済み MIDI ノートを音楽的文脈で補正する機能の設計ドキュメント。

## 目的と位置づけ

ピッチ検出（CREPE/YIN）が出力した `NoteQ[]` に対し、音楽的文脈（スケール・コード進行・メロディの自然さ）に基づく後補正を行う。

- **対象外**: ピッチ検出の精度問題（これは CREPE/YIN 側で対処）
- **対象**: スケールから外れた音・不自然な音価・前後から孤立した音
- **実行タイミング**: 解析後にユーザーが任意で実行（自動ではない）
- **副作用**: 既存の undo スタックに乗るため、いつでも元に戻せる

---

## データフロー

```
[解析済み NoteQ[]] + [ChordRoot[]]
  ↓
src/dsp/llmCorrect.ts
  NoteQ[] → JSON テキスト変換
  ChordRoot[] → コード文脈テキスト変換
  プロンプト構築
  ↓
src/api/ollama.ts
  POST localhost:11434/api/chat
  model: "gemma4:12b", temperature: 0.1, stream: false
  ↓
レスポンス JSON パース + 検証
  成功 → 補正済み NoteQ[]
  失敗 → 元の NoteQ[] にフォールバック
  ↓
store.dispatch({ type: "llmCorrect" }) → notesQ 更新
```

---

## 追加・変更ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/api/ollama.ts` | 新規 | Ollama HTTP クライアント |
| `src/dsp/llmCorrect.ts` | 新規 | 変換・プロンプト・補正ロジック |
| `src/ui/LlmCorrectionPanel.tsx` | 新規 | ボタン・ステータス表示 |
| `src/app/types.ts` | 変更 | `LlmStatus` 型追加 |
| `src/app/store.ts` | 変更 | `llmCorrect` アクション追加 |
| `src/app/App.tsx` | 変更 | パネル組み込み・ハンドラ追加 |

---

## LLM に渡すフォーマット

### プロンプト構造

```
Tempo: 120 BPM
Time signature: 4/4
Grid: 1 tick = 1/16 note
Detected chord roots by measure: [C, G, Am, F]

Notes (JSON):
[
  {"pitch":"A4","startTick":0,"durationTick":4},
  {"pitch":"B4","startTick":4,"durationTick":8},
  ...
]

Rules:
1. Fix notes that don't fit the scale or chord context.
2. Fix unnatural durations (snap to musical values: 1,2,4,8,16 ticks).
3. Fix isolated pitch outliers inconsistent with neighboring notes.
4. Do NOT add or remove notes.
5. Return ONLY a valid JSON array in the same format. No explanation.
```

### Ollama リクエスト設定

```json
{
  "model": "gemma4:12b",
  "messages": [{ "role": "user", "content": "<prompt>" }],
  "stream": false,
  "options": {
    "temperature": 0.1,
    "num_predict": 2000
  }
}
```

`temperature: 0.1` は JSON 出力の安定性優先のために低く設定する。

---

## 各モジュールの責務

### `src/api/ollama.ts`

```typescript
checkOllamaHealth(): Promise<boolean>
// GET localhost:11434/ でタイムアウト 2 秒

ollamaChat(model, messages, options, signal?): Promise<string>
// POST /api/chat, AbortController によるキャンセル対応
```

### `src/dsp/llmCorrect.ts`

```typescript
midiToName(midi: number): string          // 69 → "A4"
nameToMidi(name: string): number | null   // "A4" → 69、失敗で null

buildPrompt(notes: NoteQ[], chordRoots: ChordRoot[], grid: GridSetting): string

parseResponse(text: string, original: NoteQ[]): NoteQ[]
// JSON 抽出 → 検証 → 失敗時は original を返す

correctNotesWithLLM(
  notes: NoteQ[],
  chordRoots: ChordRoot[],
  grid: GridSetting,
  model: string,
  signal?: AbortSignal
): Promise<NoteQ[]>
```

---

## エラーハンドリング

| ケース | 対処 |
|---|---|
| Ollama 未起動 | "localhost:11434 に接続できません" と表示、ノート変更なし |
| JSON パース失敗 | 1 回だけ再試行、それでも失敗なら元のノートを維持 |
| ノート数が ±20% 以上変化 | 警告を出してユーザーに適用 or キャンセルを選択させる |
| MIDI 音域外（<21 or >108） | 最近傍の有効値にクランプ |
| タイムアウト（30 秒） | `AbortController` でキャンセル、元のノートを維持 |

---

## UI 仕様（`LlmCorrectionPanel`）

```
┌─────────────────────────────────────┐
│  LLM補正 (Gemma4 12B)               │
│  [Ollamaで補正を実行]               │
│  ○ 確認中...                        │
│  ◉ 補正中 12s...        [キャンセル]│
│  ✓ 完了（13 音符を修正）            │
│  ✗ エラー: 接続できません           │
└─────────────────────────────────────┘
```

ステータス遷移:

```
idle → checking → running → done
                           └→ error
```

- 完了後は変更された音符数を表示（透明性確保）
- 補正後は undo 可能（既存の undo スタックを使用）
- `App.tsx` 上の配置: `AnalysisPanel` と `ExportPanel` の間

---

## 長尺メロディへの対応

Gemma4 12B のコンテキスト長（128K〜）は十分大きく、通常の鼻歌・ヴォカリーズ（30〜100 音符）は一括処理で問題ない。100 音符超の場合のみ小節単位の分割処理を検討する。

---

## 制約・前提

- Ollama がローカルで起動していること（`ollama serve`）
- モデルが事前にダウンロードされていること（`ollama pull gemma4:12b`）
- ブラウザからの `localhost:11434` へのアクセスが許可されていること（CORS）
- Electron 版では同一マシンのため CORS 問題は発生しない
