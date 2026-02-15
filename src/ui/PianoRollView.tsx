import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { NoteQ } from "../app/types";

type PianoRollViewProps = {
  notes: NoteQ[];
  selection: string[];
  playheadTick: number | null;
  multiSelectMode: boolean;
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

const midiToNoteName = (midi: number): string => {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
};

export const PianoRollView = ({
  notes,
  selection,
  playheadTick,
  multiSelectMode,
  onSelect,
  onSetSplitTick,
  onEditStart,
  onMoveSelection
}: PianoRollViewProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);

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
    const wrap = wrapRef.current;
    if (!canvas) {
      return;
    }
    const minScrollableWidth = (wrap?.clientWidth ?? 0) + 600;
    const width = Math.max(1400, minScrollableWidth, bounds.maxTick * TICK_PX + LABEL_W);
    const height = (bounds.maxMidi - bounds.minMidi + 1) * ROW_H;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(0, 0, width, height);

    // Left label lane for note names.
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(0, 0, LABEL_W, height);

    for (let midi = bounds.minMidi; midi <= bounds.maxMidi; midi += 1) {
      const y = (bounds.maxMidi - midi) * ROW_H;
      const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
      if (isBlack) {
        ctx.fillStyle = "#e3ebf2";
        ctx.fillRect(0, y, LABEL_W, ROW_H);
      }
      ctx.fillStyle = midi % 12 === 0 ? "#102332" : "#385265";
      ctx.font = "11px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(midiToNoteName(midi), 6, y + ROW_H / 2);
    }

    ctx.strokeStyle = "#b5c6d1";
    ctx.beginPath();
    ctx.moveTo(LABEL_W, 0);
    ctx.lineTo(LABEL_W, height);
    ctx.stroke();

    for (let tick = 0; tick <= bounds.maxTick; tick += 1) {
      ctx.strokeStyle = tick % 4 === 0 ? "#b5c6d1" : "#e2ebf0";
      ctx.beginPath();
      const x = LABEL_W + tick * TICK_PX;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let midi = bounds.minMidi; midi <= bounds.maxMidi; midi += 1) {
      const y = (bounds.maxMidi - midi) * ROW_H;
      ctx.strokeStyle = midi % 12 === 0 ? "#bcccd6" : "#edf3f7";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const selected = new Set(selection);
    for (const note of notes) {
      const x = LABEL_W + note.startTick * TICK_PX;
      const y = (bounds.maxMidi - note.midi) * ROW_H + 1;
      const w = Math.max(4, note.durationTick * TICK_PX - 2);
      const h = ROW_H - 2;
      ctx.fillStyle = selected.has(note.id) ? "#ffcb62" : "#62b2de";
      ctx.fillRect(x + 1, y, w, h);
      ctx.strokeStyle = selected.has(note.id) ? "#8e5d00" : "#1d5174";
      ctx.strokeRect(x + 1, y, w, h);
    }

    if (playheadTick !== null) {
      const x = LABEL_W + playheadTick * TICK_PX;
      ctx.strokeStyle = "#e14b4b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = "#e14b4b";
      ctx.fillRect(Math.max(LABEL_W, x - 4), 0, 8, 8);
    }
  }, [bounds.maxMidi, bounds.maxTick, bounds.minMidi, notes, playheadTick, selection]);

  useEffect(() => {
    if (playheadTick === null || drag || pan) {
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const x = LABEL_W + playheadTick * TICK_PX;
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
      const nx = LABEL_W + note.startTick * TICK_PX;
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
    const tick = Math.max(0, Math.round((x - LABEL_W) / TICK_PX));
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

  return (
    <div ref={wrapRef} className="canvas-wrap canvas-wrap-piano">
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          touchAction: "pan-x",
          cursor: pan ? "grabbing" : "default"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};
