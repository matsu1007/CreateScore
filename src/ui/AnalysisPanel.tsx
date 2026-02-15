import type { GridSetting, ProjectStatus } from "../app/types";

type AnalysisPanelProps = {
  status: ProjectStatus;
  grid: GridSetting;
  analyzeProgress: number;
  canAnalyze: boolean;
  onAnalyze: () => void;
  onBpmChange: (bpm: number) => void;
  onDivisionChange: (division: GridSetting["division"]) => void;
  onTapTempo: () => void;
};

export const AnalysisPanel = ({
  status,
  grid,
  analyzeProgress,
  canAnalyze,
  onAnalyze,
  onBpmChange,
  onDivisionChange,
  onTapTempo
}: AnalysisPanelProps): JSX.Element => {
  return (
    <section className="panel">
      <h2>解析・設定</h2>
      <div className="row">
        <label htmlFor="bpm">BPM</label>
        <input
          id="bpm"
          type="number"
          min={40}
          max={240}
          value={grid.bpm}
          onChange={(event) => onBpmChange(Number(event.target.value))}
          style={{ width: 88 }}
        />
        <label htmlFor="division">Division</label>
        <select
          id="division"
          value={grid.division}
          onChange={(event) => onDivisionChange(event.target.value as GridSetting["division"])}
        >
          <option value="1/8">1/8</option>
          <option value="1/16">1/16</option>
          <option value="1/32">1/32</option>
        </select>
        <button onClick={onTapTempo}>Tap Tempo</button>
        <button onClick={onAnalyze} disabled={!canAnalyze}>
          Analyze
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <span className="badge">状態: {status}</span>
        {status === "Analyzing" ? <span>進捗: {Math.round(analyzeProgress * 100)}%</span> : null}
      </div>
    </section>
  );
};
