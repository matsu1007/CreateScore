import { useEffect, useState } from "react";
import type { GridSetting, ProjectStatus } from "../app/types";

type AnalysisPanelProps = {
  status: ProjectStatus;
  grid: GridSetting;
  analyzeProgress: number;
  canAnalyze: boolean;
  deadbandCent: number;
  onAnalyze: () => void;
  onBpmChange: (bpm: number) => void;
  onDivisionChange: (division: GridSetting["division"]) => void;
  onDeadbandCentChange: (cent: number) => void;
  onTapTempo: () => void;
};

export const AnalysisPanel = ({
  status,
  grid,
  analyzeProgress,
  canAnalyze,
  deadbandCent,
  onAnalyze,
  onBpmChange,
  onDivisionChange,
  onDeadbandCentChange,
  onTapTempo
}: AnalysisPanelProps): JSX.Element => {
  const [bpmInput, setBpmInput] = useState<string>(String(grid.bpm));
  const [deadbandInput, setDeadbandInput] = useState<string>(String(deadbandCent));

  useEffect(() => {
    setBpmInput(String(grid.bpm));
  }, [grid.bpm]);

  useEffect(() => {
    setDeadbandInput(String(deadbandCent));
  }, [deadbandCent]);

  const commitBpmInput = (): void => {
    const parsed = Number(bpmInput);
    if (!Number.isFinite(parsed)) {
      setBpmInput(String(grid.bpm));
      return;
    }
    onBpmChange(parsed);
  };

  const commitDeadbandInput = (): void => {
    const parsed = Number(deadbandInput);
    if (!Number.isFinite(parsed)) {
      setDeadbandInput(String(deadbandCent));
      return;
    }
    onDeadbandCentChange(parsed);
  };

  return (
    <section className="panel">
      <h2>解析・設定</h2>
      <div className="row row-controls analysis-controls">
        <label htmlFor="bpm">BPM</label>
        <input
          id="bpm"
          type="number"
          min={40}
          max={240}
          step={1}
          inputMode="numeric"
          value={bpmInput}
          onChange={(event) => setBpmInput(event.target.value)}
          onBlur={commitBpmInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitBpmInput();
            }
          }}
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
        <label htmlFor="deadband-cent">Deadband(cents)</label>
        <input
          id="deadband-cent"
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={deadbandInput}
          onChange={(event) => setDeadbandInput(event.target.value)}
          onBlur={commitDeadbandInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDeadbandInput();
            }
          }}
          style={{ width: 96 }}
        />
        <button onClick={onAnalyze} disabled={!canAnalyze}>
          Analyze
        </button>
      </div>
      <div className="row row-status">
        <span className="badge">状態: {status}</span>
        {status === "Analyzing" ? <span>進捗: {Math.round(analyzeProgress * 100)}%</span> : null}
      </div>
    </section>
  );
};
