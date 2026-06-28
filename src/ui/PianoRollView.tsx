import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { ChordRoot, GridSetting, NoteQ } from "../app/types";
import { gridTicksPerQuarter } from "../dsp/quantize";

type PianoRollViewProps = {
  notes: NoteQ[];
  selection: string[];
  correctedNoteIds?: string[];
  playheadTick: number | null;
  multiSelectMode: boolean;
  grid: GridSetting;
  chordRoots: ChordRoot[];
  onSelect: (noteId: string | null, additive: boolean) => void;
  onSetSplitTick: (tick: number) => void;
  onEditStart: () => void;
  onMoveSelection: (deltaTick: number, deltaMidi: number) => void;
};

type DragState = {
  startX: number;
  startY: number;
  appliedTick: number;
  appliedMidi: number;
  editStarted: boolean;
};

type PanState = {
  startClientX: number;
  startScrollLeft: number;
};

const TICK_PX = 24;
const ROW_H = 16;
const LABEL_W = 56;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const HEADER_H = 22;

const midiToNoteName = (midi: number): string => {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
};

export const PianoRollView = ({
  notes,
  selection,
  correctedNoteIds,
  playheadTick,
  multiSelectMode,
  grid,
  chordRoots,
  onSelect,
  onSetSplitTick,
  onEditStart,
  onMoveSelection
}: PianoRollViewProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement>(null);
  const headerCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const headerWrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const touchHandlers = useRef<{
    start: (e: globalThis.TouchEvent) => void;
    move: (e: globalThis.TouchEvent) => void;
    end: () => void;
  }>({ start: () => {}, move: () => {}, end: () => {} });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const onWheel = (event: globalThis.WheelEvent): void => {
      const baseDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (baseDelta === 0) {
        return;
      }
      const factor = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? wrap.clientWidth : 1;
      const delta = baseDelta * factor;
      const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      if (maxScroll <= 0) {
        return;
      }
      const prev = wrap.scrollLeft;
      wrap.scrollLeft = Math.min(maxScroll, Math.max(0, prev + delta));
      if (wrap.scrollLeft !== prev) {
        event.preventDefault();
      }
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      wrap.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Sync header scroll to main canvas scroll
  useEffect(() => {
    const wrap = wrapRef.current;
    const headerWrap = headerWrapRef.current;
    if (!wrap || !headerWrap) {
      return;
    }
    const onScroll = (): void => {
      headerWrap.scrollLeft = wrap.scrollLeft;
    };
    wrap.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      wrap.removeEventListener("scroll", onScroll);
    };
  }, []);

  const bounds = useMemo(() => {
    if (notes.length === 0) {
      return {
        minMidi: 48,
        maxMidi: 72,
        maxTick: 64
      };
    }
    let minMidi = 127;
    let maxMidi = 0;
    let maxTick = 0;
    for (const note of notes) {
      minMidi = Math.min(minMidi, note.midi);
      maxMidi = Math.max(maxMidi, note.midi);
      maxTick = Math.max(maxTick, note.startTick + note.durationTick);
    }
    return {
      minMidi: Math.max(0, minMidi - 4),
      maxMidi: Math.min(127, maxMidi + 4),
      maxTick: maxTick + 8
    };
  }, [notes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !labelCanvas) {
      return;
    }
    const minScrollableWidth = (wrap?.clientWidth ?? 0) + 600;
    const width = Math.max(1400, minScrollableWidth, bounds.maxTick * TICK_PX);
    const height = (bounds.maxMidi - bounds.minMidi + 1) * ROW_H;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    labelCanvas.width = LABEL_W;
    labelCanvas.height = height;
    labelCanvas.style.width = `${LABEL_W}px`;
    labelCanvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    const labelCtx = labelCanvas.getContext("2d");
    if (!ctx || !labelCtx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(0, 0, width, height);

    for (let midi = bounds.minMidi; midi <= bounds.maxMidi; midi += 1) {
      const y = (bounds.maxMidi - midi) * ROW_H;
      ctx.strokeStyle = midi % 12 === 0 ? "#bcccd6" : "#edf3f7";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let tick = 0; tick <= bounds.maxTick + 1; tick += 1) {
      ctx.strokeStyle = tick % 4 === 0 ? "#b5c6d1" : "#e2ebf0";
      ctx.beginPath();
      const x = tick * TICK_PX;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let midi = bounds.minMidi; midi <= bounds.maxMidi; midi += 1) {
      const y = (bounds.maxMidi - midi) * ROW_H;
      const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
      labelCtx.fillStyle = isBlack ? "#e3ebf2" : "#f0f4f8";
      labelCtx.fillRect(0, y, LABEL_W, ROW_H);
      labelCtx.fillStyle = midi % 12 === 0 ? "#102332" : "#385265";
      labelCtx.font = "11px sans-serif";
      labelCtx.textBaseline = "middle";
      labelCtx.fillText(midiToNoteName(midi), 6, y + ROW_H / 2);
      labelCtx.strokeStyle = midi % 12 === 0 ? "#bcccd6" : "#edf3f7";
      labelCtx.beginPath();
      labelCtx.moveTo(0, y);
      labelCtx.lineTo(LABEL_W, y);
      labelCtx.stroke();
    }
    labelCtx.strokeStyle = "#b5c6d1";
    labelCtx.beginPath();
    labelCtx.moveTo(LABEL_W - 0.5, 0);
    labelCtx.lineTo(LABEL_W - 0.5, height);
    labelCtx.stroke();

    const selected = new Set(selection);
    const corrected = new Set(correctedNoteIds ?? []);
    for (const note of notes) {
      const x = note.startTick * TICK_PX;
      const y = (bounds.maxMidi - note.midi) * ROW_H + 1;
      const w = Math.max(4, note.durationTick * TICK_PX - 2);
      const h = ROW_H - 2;
      const isSelected = selected.has(note.id);
      const isCorrected = !isSelected && corrected.has(note.id);
      ctx.fillStyle = isSelected ? "#ffcb62" : isCorrected ? "#76d275" : "#62b2de";
      ctx.fillRect(x + 1, y, w, h);
      ctx.strokeStyle = isSelected ? "#8e5d00" : isCorrected ? "#2a7229" : "#1d5174";
      ctx.strokeRect(x + 1, y, w, h);
    }

    if (playheadTick !== null) {
      const x = playheadTick * TICK_PX;
      ctx.strokeStyle = "#e14b4b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = "#e14b4b";
      ctx.fillRect(Math.max(LABEL_W, x - 4), 0, 8, 8);
    }
  }, [bounds.maxMidi, bounds.maxTick, bounds.minMidi, correctedNoteIds, notes, playheadTick, selection]);

  // Draw chord root header
  useEffect(() => {
    const canvas = headerCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas) {
      return;
    }
    const minScrollableWidth = (wrap?.clientWidth ?? 0) + 600;
    const width = Math.max(1400, minScrollableWidth, bounds.maxTick * TICK_PX);
    canvas.width = width;
    canvas.height = HEADER_H;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEADER_H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, HEADER_H);
    ctx.fillStyle = "#f0f5f8";
    ctx.fillRect(0, 0, width, HEADER_H);

    if (chordRoots.length === 0) {
      return;
    }

    const ticksPerMeasure = gridTicksPerQuarter(grid.division) * 4;

    for (const { startTick, rootPc } of chordRoots) {
      const x = startTick * TICK_PX;
      const w = ticksPerMeasure * TICK_PX;

      ctx.fillStyle = "#ddeef7";
      ctx.fillRect(x + 1, 2, w - 2, HEADER_H - 4);

      ctx.strokeStyle = "#8bb8d0";
      ctx.strokeRect(x + 1, 2, w - 2, HEADER_H - 4);

      ctx.fillStyle = "#0f3d57";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(NOTE_NAMES[rootPc], x + w / 2, HEADER_H / 2);
    }
  }, [bounds.maxTick, chordRoots, grid]);

  useEffect(() => {
    if (playheadTick === null || drag || pan) {
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const x = playheadTick * TICK_PX;
    const left = wrap.scrollLeft;
    const right = left + wrap.clientWidth;
    const margin = 120;

    if (x > right - margin) {
      wrap.scrollLeft = Math.max(0, x - wrap.clientWidth + margin);
    } else if (x < left + margin) {
      wrap.scrollLeft = Math.max(0, x - margin);
    }
  }, [drag, pan, playheadTick]);

  const pickNote = (x: number, y: number): NoteQ | null => {
    for (const note of [...notes].reverse()) {
      const nx = note.startTick * TICK_PX;
      const ny = (bounds.maxMidi - note.midi) * ROW_H;
      const nw = note.durationTick * TICK_PX;
      const nh = ROW_H;
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
        return note;
      }
    }
    return null;
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>): void => {
    const x = event.nativeEvent.offsetX;
    const y = event.nativeEvent.offsetY;
    const note = pickNote(x, y);
    const tick = Math.max(0, Math.round(x / TICK_PX));
    onSetSplitTick(tick);

    if (!note) {
      onSelect(null, false);
      const wrap = wrapRef.current;
      if (wrap) {
        setPan({
          startClientX: event.clientX,
          startScrollLeft: wrap.scrollLeft
        });
      }
      return;
    }

    const additive = multiSelectMode || event.shiftKey;
    onSelect(note.id, additive);
    setDrag({
      startX: x,
      startY: y,
      appliedTick: 0,
      appliedMidi: 0,
      editStarted: false
    });
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>): void => {
    if (pan) {
      const wrap = wrapRef.current;
      if (wrap) {
        const dx = event.clientX - pan.startClientX;
        wrap.scrollLeft = pan.startScrollLeft - dx;
        event.preventDefault();
      }
      return;
    }
    if (!drag) {
      return;
    }
    const x = event.nativeEvent.offsetX;
    const y = event.nativeEvent.offsetY;

    const targetTick = Math.round((x - drag.startX) / TICK_PX);
    const targetMidi = Math.round((drag.startY - y) / ROW_H);

    const deltaTick = targetTick - drag.appliedTick;
    const deltaMidi = targetMidi - drag.appliedMidi;
    if (deltaTick !== 0 || deltaMidi !== 0) {
      if (!drag.editStarted) {
        onEditStart();
      }
      onMoveSelection(deltaTick, deltaMidi);
      setDrag({
        ...drag,
        appliedTick: targetTick,
        appliedMidi: targetMidi,
        editStarted: true
      });
    }
  };

  const handleMouseUp = (): void => {
    setDrag(null);
    setPan(null);
  };

  // Update touch handlers every render so they always close over current state/props
  touchHandlers.current.start = (e: globalThis.TouchEvent): void => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const note = pickNote(x, y);
    onSetSplitTick(Math.max(0, Math.round(x / TICK_PX)));
    if (!note) {
      onSelect(null, false);
      const wrap = wrapRef.current;
      if (wrap) {
        setPan({ startClientX: touch.clientX, startScrollLeft: wrap.scrollLeft });
      }
      return;
    }
    onSelect(note.id, multiSelectMode);
    setDrag({ startX: x, startY: y, appliedTick: 0, appliedMidi: 0, editStarted: false });
  };

  touchHandlers.current.move = (e: globalThis.TouchEvent): void => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (pan) {
      const wrap = wrapRef.current;
      if (wrap) {
        wrap.scrollLeft = pan.startScrollLeft - (touch.clientX - pan.startClientX);
      }
      return;
    }
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const targetTick = Math.round((x - drag.startX) / TICK_PX);
    const targetMidi = Math.round((drag.startY - y) / ROW_H);
    const deltaTick = targetTick - drag.appliedTick;
    const deltaMidi = targetMidi - drag.appliedMidi;
    if (deltaTick !== 0 || deltaMidi !== 0) {
      if (!drag.editStarted) onEditStart();
      onMoveSelection(deltaTick, deltaMidi);
      setDrag({ ...drag, appliedTick: targetTick, appliedMidi: targetMidi, editStarted: true });
    }
  };

  touchHandlers.current.end = (): void => {
    setDrag(null);
    setPan(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onStart = (e: globalThis.TouchEvent) => touchHandlers.current.start(e);
    const onMove = (e: globalThis.TouchEvent) => touchHandlers.current.move(e);
    const onEnd = () => touchHandlers.current.end();
    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div className="piano-roll-shell">
      <div className="piano-roll-header-corner" />
      <div ref={headerWrapRef} className="piano-roll-header-wrap">
        <canvas ref={headerCanvasRef} style={{ display: "block" }} />
      </div>
      <div className="piano-roll-label-lane">
        <canvas ref={labelCanvasRef} style={{ display: "block" }} />
      </div>
      <div ref={wrapRef} className="canvas-wrap canvas-wrap-piano">
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            touchAction: "none",
            cursor: pan ? "grabbing" : "default"
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
};
