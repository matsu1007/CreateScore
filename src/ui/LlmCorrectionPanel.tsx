import type { LlmStatus } from "../app/types";

const MODEL_PRESETS = [
  "gemma4:12b",
  "gemma3:4b",
  "qwen2.5:7b",
  "qwen2.5:3b",
  "phi4-mini",
];
const CUSTOM_VALUE = "__custom__";

type LlmCorrectionPanelProps = {
  canCorrect: boolean;
  model: string;
  onModelChange: (model: string) => void;
  status: LlmStatus;
  elapsedSec: number;
  tokenCount?: number;
  resultMessage?: string;
  errorMessage?: string;
  helpCommand?: string;
  onCorrect: () => void;
  onCancel: () => void;
};

const STATUS_ICON: Record<LlmStatus, string> = {
  idle: "",
  checking: "○",
  running: "◉",
  done: "✓",
  error: "✗"
};

export const LlmCorrectionPanel = ({
  canCorrect,
  model,
  onModelChange,
  status,
  elapsedSec,
  tokenCount,
  resultMessage,
  errorMessage,
  helpCommand,
  onCorrect,
  onCancel
}: LlmCorrectionPanelProps): JSX.Element => {
  const isActive = status === "checking" || status === "running";
  const isCustom = !MODEL_PRESETS.includes(model);

  return (
    <section className="panel">
      <h2>LLM補正</h2>
      <div className="row row-controls">
        <label>
          モデル
          <select
            value={isCustom ? CUSTOM_VALUE : model}
            onChange={(e) => {
              if (e.target.value === CUSTOM_VALUE) {
                onModelChange("");
              } else {
                onModelChange(e.target.value);
              }
            }}
            disabled={isActive}
            style={{ marginLeft: "0.5em" }}
          >
            {MODEL_PRESETS.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value={CUSTOM_VALUE}>カスタム...</option>
          </select>
        </label>
        {isCustom && (
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={isActive}
            placeholder="モデル名を入力"
            style={{ marginLeft: "0.5em", width: "13em" }}
          />
        )}
      </div>
      <div className="row row-controls">
        <button onClick={onCorrect} disabled={!canCorrect || isActive || !model.trim()}>
          {model.trim() || "（モデル未入力）"} で補正を実行
        </button>
        {isActive && (
          <button onClick={onCancel} className="btn-cancel">
            キャンセル
          </button>
        )}
      </div>

      {status === "checking" && (
        <p className="llm-status">
          {STATUS_ICON.checking} Ollama に接続中...
        </p>
      )}

      {status === "running" && (
        <p className="llm-status">
          {STATUS_ICON.running} 補正中... {elapsedSec}s
          {tokenCount !== undefined && tokenCount > 0 && ` (${tokenCount} tokens)`}
        </p>
      )}

      {status === "done" && resultMessage && (
        <p className="llm-status llm-status--done">
          {STATUS_ICON.done} {resultMessage}
        </p>
      )}

      {status === "error" && errorMessage && (
        <div className="llm-error-block">
          <p className="llm-status llm-status--error">
            {STATUS_ICON.error} {errorMessage}
          </p>
          {helpCommand && (
            <div className="llm-help">
              <p>Ollama が未起動の場合は、ターミナルで以下を実行してください：</p>
              <code className="llm-help-command">{helpCommand}</code>
              <p className="llm-help-note">
                「port is already in use」や「Only one usage of each socket address」というエラーが出た場合は、Ollama はすでに起動しています。そのまま補正を再試行してください。
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
