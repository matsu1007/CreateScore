import type { ProjectStatus } from "../app/types";

type RecorderPanelProps = {
  status: ProjectStatus;
  durationSec: number;
  hasRecording: boolean;
  metronomeEnabled: boolean;
  onRecord: () => void;
  onStop: () => void;
  onPlayOriginal: () => void;
  onClear: () => void;
  onPreviewMetronome: () => void;
  onToggleMetronome: (enabled: boolean) => void;
};

const formatSec = (sec: number): string => {
  const clamped = Math.max(0, Math.floor(sec));
  const m = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const s = (clamped % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export const RecorderPanel = ({
  status,
  durationSec,
  hasRecording,
  metronomeEnabled,
  onRecord,
  onStop,
  onPlayOriginal,
  onClear,
  onPreviewMetronome,
  onToggleMetronome
}: RecorderPanelProps): JSX.Element => {
  return (
    <section className="panel">
      <h2>録音</h2>
      <div className="row">
        <button onClick={onRecord} disabled={status === "Recording" || status === "Analyzing"}>
          Record
        </button>
        <button onClick={onStop} disabled={status !== "Recording"}>
          Stop
        </button>
        <button onClick={onPlayOriginal} disabled={!hasRecording || status === "Recording"}>
          Play Original
        </button>
        <button onClick={onClear} disabled={status === "Recording" && !hasRecording}>
          Clear
        </button>
        <button onClick={onPreviewMetronome} disabled={status === "Recording"}>
          メトロノーム確認
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={metronomeEnabled}
            onChange={(event) => onToggleMetronome(event.target.checked)}
          />{" "}
          録音メトロノーム
        </label>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <span className="badge">状態: {status}</span>
        <span>録音時間: {formatSec(durationSec)}</span>
      </div>
    </section>
  );
};
