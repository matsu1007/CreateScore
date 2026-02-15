import { useEffect, useRef } from "react";
import type { PitchFrame } from "../app/types";

const f0ToMidi = (f0: number): number => 69 + 12 * Math.log2(f0 / 440);

type PitchViewProps = {
  frames: PitchFrame[];
};

export const PitchView = ({ frames }: PitchViewProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas) {
      return;
    }
    const minScrollableWidth = (wrap?.clientWidth ?? 0) + 600;
    const width = Math.max(1400, minScrollableWidth, frames.length * 4);
    const height = 280;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f9fdff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#dde8ee";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const minMidi = 36;
    const maxMidi = 84;
    ctx.strokeStyle = "#1570a6";
    ctx.lineWidth = 2;

    let active = false;
    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      if (frame.f0Hz === null) {
        active = false;
        continue;
      }
      const midi = f0ToMidi(frame.f0Hz);
      const x = (i / Math.max(1, frames.length - 1)) * (width - 1);
      const y =
        ((Math.max(minMidi, Math.min(maxMidi, maxMidi - (midi - minMidi))) - minMidi) /
          (maxMidi - minMidi)) *
        height;

      if (!active) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        active = true;
      } else {
        ctx.lineTo(x, y);
      }
      if (i === frames.length - 1 || frames[i + 1].f0Hz === null) {
        ctx.stroke();
        active = false;
      }
    }
  }, [frames]);

  return (
    <div ref={wrapRef} className="canvas-wrap canvas-wrap-pitch">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
};
