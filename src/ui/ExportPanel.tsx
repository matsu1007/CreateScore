type ExportPanelProps = {
  canPlay: boolean;
  canPauseResume: boolean;
  isPaused: boolean;
  canExport: boolean;
  onPlay: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onExport: () => void;
};

export const ExportPanel = ({
  canPlay,
  canPauseResume,
  isPaused,
  canExport,
  onPlay,
  onPauseResume,
  onStop,
  onExport
}: ExportPanelProps): JSX.Element => {
  return (
    <section className="panel">
      <h2>出力</h2>
      <div className="row row-controls">
        <button onClick={onPlay} disabled={!canPlay}>
          ノート再生
        </button>
        <button onClick={onPauseResume} disabled={!canPauseResume}>
          {isPaused ? "再開" : "一時停止"}
        </button>
        <button onClick={onStop} disabled={!canPauseResume}>
          停止
        </button>
        <button onClick={onExport} disabled={!canExport}>
          Export MIDI
        </button>
      </div>
    </section>
  );
};
