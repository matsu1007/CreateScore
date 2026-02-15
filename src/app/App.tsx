import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { decodeBlobToAudioBuffer } from "../audio/decode";
import { RecorderController } from "../audio/recorder";
import { toMono16k } from "../audio/resample";
import { analyzePipeline } from "../dsp/analyzePipeline";
import { estimateTapTempo } from "../dsp/tapTempo";
import { encodeSmfType0 } from "../midi/smf";
import { playNotes } from "../midi/playback";
import type { PlaybackController } from "../midi/playback";
import { AnalysisPanel } from "../ui/AnalysisPanel";
import { ExportPanel } from "../ui/ExportPanel";
import { PianoRollView } from "../ui/PianoRollView";
import { PitchView } from "../ui/PitchView";
import { RecorderPanel } from "../ui/RecorderPanel";
import {
  canAnalyze,
  canExport,
  canUndo,
  initialState,
  projectReducer
} from "./store";
import type { AnalyzeMessage, AnalyzeRequest } from "./types";

const ANALYZE_PARAMS = {
  frameLenMs: 30,
  hopMs: 10,
  confMin: 0.3,
  fmin: 80,
  fmax: 1000
};

export const App = (): JSX.Element => {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const [durationSec, setDurationSec] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"pitch" | "piano">("piano");
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [splitTick, setSplitTick] = useState(0);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [playheadTick, setPlayheadTick] = useState<number | null>(null);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const [recordMetronomeEnabled, setRecordMetronomeEnabled] = useState(true);

  const recorderRef = useRef<RecorderController | null>(null);
  const playbackRef = useRef<PlaybackController | null>(null);
  const playheadIntervalRef = useRef<number | null>(null);
  const recordMetronomeRef = useRef<{
    ctx: AudioContext;
    timerId: number;
    bpm: number;
  } | null>(null);
  const previewMetronomeCtxRef = useRef<AudioContext | null>(null);
  const previewMetronomeTimersRef = useRef<number[]>([]);

  if (!recorderRef.current) {
    recorderRef.current = new RecorderController();
  }

  const triggerMetronomeClick = (ctx: AudioContext, accent: boolean): void => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1400 : 1000;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  };

  const stopRecordMetronome = (): void => {
    const ref = recordMetronomeRef.current;
    if (!ref) {
      return;
    }
    window.clearInterval(ref.timerId);
    void ref.ctx.close();
    recordMetronomeRef.current = null;
  };

  const clearPreviewMetronomeTimers = (): void => {
    for (const timerId of previewMetronomeTimersRef.current) {
      window.clearTimeout(timerId);
    }
    previewMetronomeTimersRef.current = [];
  };

  const stopPreviewMetronome = (): void => {
    clearPreviewMetronomeTimers();
    const ctx = previewMetronomeCtxRef.current;
    if (!ctx) {
      return;
    }
    void ctx.close();
    previewMetronomeCtxRef.current = null;
  };

  const startRecordMetronome = (bpm: number): void => {
    const normalizedBpm = Math.max(40, Math.min(240, bpm));
    const current = recordMetronomeRef.current;
    if (current && current.bpm === normalizedBpm) {
      return;
    }
    stopRecordMetronome();

    const ctx = new AudioContext();
    void ctx.resume();
    let beat = 0;
    triggerMetronomeClick(ctx, true);
    const intervalMs = 60_000 / normalizedBpm;
    const timerId = window.setInterval(() => {
      beat = (beat + 1) % 4;
      triggerMetronomeClick(ctx, beat === 0);
    }, intervalMs);
    recordMetronomeRef.current = {
      ctx,
      timerId,
      bpm: normalizedBpm
    };
  };

  useEffect(() => {
    return () => {
      if (playheadIntervalRef.current !== null) {
        window.clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
      playbackRef.current?.stop();
      playbackRef.current = null;
      stopRecordMetronome();
      stopPreviewMetronome();
    };
  }, []);

  useEffect(() => {
    if (state.status === "Recording" && recordMetronomeEnabled) {
      startRecordMetronome(state.grid.bpm);
      return;
    }
    stopRecordMetronome();
  }, [recordMetronomeEnabled, state.grid.bpm, state.status]);

  const clearPlaybackTimers = (): void => {
    if (playheadIntervalRef.current !== null) {
      window.clearInterval(playheadIntervalRef.current);
      playheadIntervalRef.current = null;
    }
  };

  const stopPlayback = (): void => {
    clearPlaybackTimers();
    playbackRef.current?.stop();
    playbackRef.current = null;
    setPlayheadTick(null);
    setIsPlaybackActive(false);
    setIsPlaybackPaused(false);
  };

  const handleRecord = async (): Promise<void> => {
    dispatch({ type: "recordStart" });
    setDurationSec(0);
    stopPreviewMetronome();
    if (recordMetronomeEnabled) {
      startRecordMetronome(state.grid.bpm);
    }
    await recorderRef.current?.start(
      {
        onDuration: (sec) => {
          setDurationSec(sec);
        },
        onStop: async (blob) => {
          try {
            const audioBuffer = await decodeBlobToAudioBuffer(blob);
            const audio = toMono16k(audioBuffer);
            if (recordingUrl) {
              URL.revokeObjectURL(recordingUrl);
            }
            setRecordingUrl(URL.createObjectURL(blob));
            dispatch({ type: "recorded", audio });
            setDurationSec(audio.durationSec);
          } catch (error) {
            dispatch({
              type: "analyzeFail",
              code: "DECODE_FAILED",
              message: error instanceof Error ? error.message : "録音データの処理に失敗しました"
            });
          }
        },
        onError: (error) => {
          dispatch({
            type: "analyzeFail",
            code: "RECORDER_ERROR",
            message: error.message || "録音に失敗しました"
          });
        }
      },
      60
    );
  };

  const handleStopRecord = (): void => {
    recorderRef.current?.stop();
    stopRecordMetronome();
  };

  const handlePlayOriginal = (): void => {
    if (!recordingUrl) {
      return;
    }
    const audio = new Audio(recordingUrl);
    void audio.play();
  };

  const handleClear = (): void => {
    recorderRef.current?.clear();
    stopRecordMetronome();
    stopPreviewMetronome();
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    stopPlayback();
    setDurationSec(0);
    setAnalyzeProgress(0);
    setTapTimes([]);
    dispatch({ type: "clear" });
  };

  const handlePreviewMetronome = (): void => {
    if (state.status === "Recording") {
      return;
    }
    stopRecordMetronome();
    clearPreviewMetronomeTimers();

    let ctx = previewMetronomeCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext();
      previewMetronomeCtxRef.current = ctx;
    }
    void ctx.resume();

    const bpm = Math.max(40, Math.min(240, state.grid.bpm));
    const intervalMs = 60_000 / bpm;
    for (let beat = 0; beat < 4; beat += 1) {
      const timerId = window.setTimeout(() => {
        triggerMetronomeClick(ctx as AudioContext, beat === 0);
      }, beat * intervalMs);
      previewMetronomeTimersRef.current.push(timerId);
    }
    const closeTimerId = window.setTimeout(() => {
      if (previewMetronomeCtxRef.current === ctx) {
        void ctx?.close();
        previewMetronomeCtxRef.current = null;
      }
      previewMetronomeTimersRef.current = [];
    }, intervalMs * 4 + 120);
    previewMetronomeTimersRef.current.push(closeTimerId);
  };

  const runAnalyze = (): void => {
    if (!state.audio) {
      return;
    }
    dispatch({ type: "analyzeStart" });
    setAnalyzeProgress(0);
    const runAnalyzeFallback = (): void => {
      window.setTimeout(() => {
        try {
          const { frames, notesRaw, notesQ } = analyzePipeline({
            samples: samplesCopy,
            sampleRate: state.audio?.sampleRate ?? 16000,
            grid: state.grid,
            params: ANALYZE_PARAMS,
            onProgress: (_stage, progress) => {
              setAnalyzeProgress(progress);
            }
          });
          dispatch({
            type: "analyzeSuccess",
            payload: {
              frames,
              notesRaw,
              notesQ
            }
          });
          setAnalyzeProgress(1);
        } catch (error) {
          dispatch({
            type: "analyzeFail",
            code: "ANALYZE_FAILED",
            message: error instanceof Error ? error.message : "解析中にエラーが発生しました"
          });
        }
      }, 0);
    };

    const samplesCopy = new Float32Array(state.audio.samples);
    let worker: Worker | null = null;
    let fallbackTriggered = false;
    const triggerFallback = (): void => {
      if (fallbackTriggered) {
        return;
      }
      fallbackTriggered = true;
      worker?.terminate();
      runAnalyzeFallback();
    };

    try {
      worker = new Worker(new URL("../workers/analyze.worker.ts", import.meta.url), {
        type: "module"
      });
    } catch {
      triggerFallback();
      return;
    }

    worker.onmessage = (event: MessageEvent<AnalyzeMessage>) => {
      const message = event.data;
      if (message.type === "progress") {
        setAnalyzeProgress(message.progress);
        return;
      }
      if (message.type === "result") {
        dispatch({
          type: "analyzeSuccess",
          payload: {
            frames: message.frames,
            notesRaw: message.notesRaw,
            notesQ: message.notesQ
          }
        });
        setAnalyzeProgress(1);
        worker?.terminate();
        return;
      }
      dispatch({
        type: "analyzeFail",
        code: message.code,
        message: message.message
      });
      worker?.terminate();
    };

    worker.onerror = () => {
      triggerFallback();
    };

    const request: AnalyzeRequest = {
      audioBuffer: samplesCopy.buffer.slice(0),
      sampleRate: state.audio.sampleRate,
      grid: state.grid,
      params: ANALYZE_PARAMS
    };
    try {
      worker.postMessage(request);
    } catch {
      triggerFallback();
    }
  };

  const handleTapTempo = (): void => {
    const now = Date.now();
    const next = [...tapTimes, now].slice(-6);
    setTapTimes(next);
    const bpm = estimateTapTempo(next);
    if (bpm) {
      dispatch({ type: "updateGrid", grid: { bpm } });
    }
  };

  const handleSelect = (noteId: string | null, additive: boolean): void => {
    if (!noteId) {
      dispatch({ type: "setSelection", ids: [] });
      return;
    }
    if (!additive) {
      dispatch({ type: "setSelection", ids: [noteId] });
      return;
    }
    const exists = state.selection.noteIds.includes(noteId);
    const ids = exists
      ? state.selection.noteIds.filter((id) => id !== noteId)
      : [...state.selection.noteIds, noteId];
    dispatch({ type: "setSelection", ids });
  };

  const handlePlayNotes = (): void => {
    if (state.notesQ.length === 0) {
      return;
    }

    stopPlayback();
    const controller = playNotes(state.notesQ, state.grid);
    playbackRef.current = controller;
    setPlayheadTick(0);
    setIsPlaybackActive(true);
    setIsPlaybackPaused(false);

    playheadIntervalRef.current = window.setInterval(() => {
      const ref = playbackRef.current;
      if (!ref || ref.isStopped()) {
        stopPlayback();
        return;
      }
      const elapsedSec = ref.getElapsedSec();
      const currentTick = elapsedSec / Math.max(1e-6, ref.getSecPerTick());
      setPlayheadTick(Math.min(ref.getEndTick(), currentTick));
      if (!ref.isPaused() && elapsedSec >= ref.getDurationSec()) {
        stopPlayback();
      }
    }, 33);
  };

  const handleStopNotes = (): void => {
    stopPlayback();
  };

  const handleTogglePauseNotes = async (): Promise<void> => {
    const controller = playbackRef.current;
    if (!controller || controller.isStopped()) {
      return;
    }
    try {
      if (controller.isPaused()) {
        await controller.resume();
        setIsPlaybackPaused(false);
        return;
      }
      await controller.pause();
      setIsPlaybackPaused(true);
    } catch {
      // no-op: keep previous pause state if the browser rejects the operation
    }
  };

  const handleExportMidi = (): void => {
    if (state.notesQ.length === 0) {
      return;
    }
    const bytes = encodeSmfType0(state.notesQ, state.grid);
    const blob = new Blob([bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "humming.mid";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleUndoEdit = (): void => {
    dispatch({ type: "undoEdit" });
  };

  const handleTransposeAllOctave = (direction: "up" | "down"): void => {
    if (state.notesQ.length === 0) {
      return;
    }
    dispatch({ type: "beginEdit" });
    dispatch({ type: "transposeAllOctave", direction });
  };

  const handleTransposeAllSemitone = (direction: "up" | "down"): void => {
    if (state.notesQ.length === 0) {
      return;
    }
    dispatch({ type: "beginEdit" });
    dispatch({ type: "transposeAllSemitone", direction });
  };

  const infoText = useMemo(() => {
    if (state.status === "Error" && state.error) {
      return `${state.error.code}: ${state.error.message}`;
    }
    if (state.status === "Ready") {
      return `ノート数: ${state.notesQ.length}`;
    }
    return "";
  }, [state.error, state.notesQ.length, state.status]);

  return (
    <main className="app">
      <h1>鼻歌→MIDI（MVP）</h1>

      <RecorderPanel
        status={state.status}
        durationSec={durationSec}
        hasRecording={Boolean(recordingUrl)}
        metronomeEnabled={recordMetronomeEnabled}
        onRecord={handleRecord}
        onStop={handleStopRecord}
        onPlayOriginal={handlePlayOriginal}
        onClear={handleClear}
        onPreviewMetronome={handlePreviewMetronome}
        onToggleMetronome={setRecordMetronomeEnabled}
      />

      <AnalysisPanel
        status={state.status}
        grid={state.grid}
        analyzeProgress={analyzeProgress}
        canAnalyze={canAnalyze(state)}
        onAnalyze={runAnalyze}
        onBpmChange={(bpm) => dispatch({ type: "updateGrid", grid: { bpm } })}
        onDivisionChange={(division) => dispatch({ type: "updateGrid", grid: { division } })}
        onTapTempo={handleTapTempo}
      />

      <section className="panel">
        <h2>表示・編集</h2>
        <div className="tabs">
          <button
            className={tab === "pitch" ? "tab-active" : ""}
            onClick={() => setTab("pitch")}
          >
            Pitch
          </button>
          <button
            className={tab === "piano" ? "tab-active" : ""}
            onClick={() => setTab("piano")}
          >
            Piano Roll
          </button>
        </div>

        {tab === "pitch" ? (
          <PitchView frames={state.frames ?? []} />
        ) : (
          <>
            <div className="note-toolbar">
              <button onClick={() => setMultiSelectMode((v) => !v)}>
                モバイル複数選択: {multiSelectMode ? "ON" : "OFF"}
              </button>
              <button onClick={handleUndoEdit} disabled={!canUndo(state)}>
                Undo
              </button>
              <button
                onClick={() => handleTransposeAllSemitone("down")}
                disabled={state.notesQ.length === 0}
              >
                -1semi
              </button>
              <button
                onClick={() => handleTransposeAllSemitone("up")}
                disabled={state.notesQ.length === 0}
              >
                +1semi
              </button>
              <button
                onClick={() => handleTransposeAllOctave("down")}
                disabled={state.notesQ.length === 0}
              >
                -1oct
              </button>
              <button
                onClick={() => handleTransposeAllOctave("up")}
                disabled={state.notesQ.length === 0}
              >
                +1oct
              </button>
              <button
                onClick={() => {
                  dispatch({ type: "beginEdit" });
                  dispatch({ type: "splitSelection", splitTick });
                }}
                disabled={state.selection.noteIds.length !== 1}
              >
                Split
              </button>
              <button
                onClick={() => {
                  dispatch({ type: "beginEdit" });
                  dispatch({ type: "joinSelection" });
                }}
                disabled={state.selection.noteIds.length < 2}
              >
                Join
              </button>
              <button
                onClick={() => {
                  dispatch({ type: "beginEdit" });
                  dispatch({ type: "deleteSelection" });
                }}
                disabled={state.selection.noteIds.length === 0}
              >
                Delete
              </button>
            </div>
            <PianoRollView
              notes={state.notesQ}
              selection={state.selection.noteIds}
              playheadTick={playheadTick}
              multiSelectMode={multiSelectMode}
              onSelect={handleSelect}
              onSetSplitTick={setSplitTick}
              onEditStart={() => dispatch({ type: "beginEdit" })}
              onMoveSelection={(deltaTick, deltaMidi) =>
                dispatch({ type: "moveSelection", deltaTick, deltaMidi })
              }
            />
          </>
        )}
      </section>

      <ExportPanel
        canPlay={state.notesQ.length > 0}
        canPauseResume={isPlaybackActive}
        isPaused={isPlaybackPaused}
        canExport={canExport(state)}
        onPlay={handlePlayNotes}
        onPauseResume={() => {
          void handleTogglePauseNotes();
        }}
        onStop={handleStopNotes}
        onExport={handleExportMidi}
      />

      {infoText ? (
        <section className="panel">
          <h2>ステータス</h2>
          <p className={state.status === "Error" ? "error" : undefined}>{infoText}</p>
        </section>
      ) : null}
    </main>
  );
};
