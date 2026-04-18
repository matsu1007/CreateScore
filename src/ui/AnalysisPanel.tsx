import { useEffect, useState } from "react";
import type {
  GridSetting,
  ModelVariant,
  PitchBackend,
  ProjectStatus
} from "../app/types";

type AnalysisPanelProps = {
  status: ProjectStatus;
  grid: GridSetting;
  analyzeProgress: number;
  canAnalyze: boolean;
  deadbandCent: number;
  pitchBackend: PitchBackend;
  modelVariant: ModelVariant;
  confMin: number;
  batchFrames: number;
  effectivePitchBackend: PitchBackend | null;
  onAnalyze: () => void;
  onBpmChange: (bpm: number) => void;
  onDivisionChange: (division: GridSetting["division"]) => void;
  onDeadbandCentChange: (cent: number) => void;
  onPitchBackendChange: (backend: PitchBackend) => void;
  onModelVariantChange: (variant: ModelVariant) => void;
  onConfMinChange: (value: number) => void;
  onBatchFramesChange: (value: number) => void;
  onTapTempo: () => void;
};

export const AnalysisPanel = ({
  status,
  grid,
  analyzeProgress,
  canAnalyze,
  deadbandCent,
  pitchBackend,
  modelVariant,
  confMin,
  batchFrames,
  effectivePitchBackend,
  onAnalyze,
  onBpmChange,
  onDivisionChange,
  onDeadbandCentChange,
  onPitchBackendChange,
  onModelVariantChange,
  onConfMinChange,
  onBatchFramesChange,
  onTapTempo
}: AnalysisPanelProps): JSX.Element => {
  const [bpmInput, setBpmInput] = useState<string>(String(grid.bpm));
  const [deadbandInput, setDeadbandInput] = useState<string>(String(deadbandCent));
  const [confInput, setConfInput] = useState<string>(String(confMin));
  const [batchInput, setBatchInput] = useState<string>(String(batchFrames));

  useEffect(() => {
    setBpmInput(String(grid.bpm));
  }, [grid.bpm]);

  useEffect(() => {
    setDeadbandInput(String(deadbandCent));
  }, [deadbandCent]);

  useEffect(() => {
    setConfInput(String(confMin));
  }, [confMin]);

  useEffect(() => {
    setBatchInput(String(batchFrames));
  }, [batchFrames]);

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

  const commitConfInput = (): void => {
    const parsed = Number(confInput);
    if (!Number.isFinite(parsed)) {
      setConfInput(String(confMin));
      return;
    }
    onConfMinChange(parsed);
  };

  const commitBatchInput = (): void => {
    const parsed = Number(batchInput);
    if (!Number.isFinite(parsed)) {
      setBatchInput(String(batchFrames));
      return;
    }
    onBatchFramesChange(parsed);
  };

  const backendLabel = (value: PitchBackend): string => {
    if (value === "crepe-webgpu") {
      return "CREPE(WebGPU)";
    }
    if (value === "crepe-wasm") {
      return "CREPE(WASM)";
    }
    return "YIN";
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
        <label htmlFor="pitch-backend">Backend</label>
        <select
          id="pitch-backend"
          value={pitchBackend}
          onChange={(event) => onPitchBackendChange(event.target.value as PitchBackend)}
        >
          <option value="yin">YIN</option>
          <option value="crepe-webgpu">CREPE(WebGPU)</option>
          <option value="crepe-wasm">CREPE(WASM)</option>
        </select>
        <label htmlFor="model-variant">Model</label>
        <select
          id="model-variant"
          value={modelVariant}
          onChange={(event) => onModelVariantChange(event.target.value as ModelVariant)}
        >
          <option value="tiny">tiny</option>
          <option value="full">full</option>
        </select>
        <label htmlFor="conf-min">confMin</label>
        <input
          id="conf-min"
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={confInput}
          onChange={(event) => setConfInput(event.target.value)}
          onBlur={commitConfInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitConfInput();
            }
          }}
          style={{ width: 86 }}
        />
        <label htmlFor="batch-frames">batch</label>
        <input
          id="batch-frames"
          type="number"
          min={1}
          max={1024}
          step={1}
          inputMode="numeric"
          value={batchInput}
          onChange={(event) => setBatchInput(event.target.value)}
          onBlur={commitBatchInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitBatchInput();
            }
          }}
          style={{ width: 88 }}
        />
        <button onClick={onAnalyze} disabled={!canAnalyze}>
          Analyze
        </button>
      </div>
      <div className="row row-status">
        <span className="badge">状態: {status}</span>
        {status === "Analyzing" ? <span>進捗: {Math.round(analyzeProgress * 100)}%</span> : null}
        {effectivePitchBackend ? <span>実行Backend: {backendLabel(effectivePitchBackend)}</span> : null}
      </div>
    </section>
  );
};
