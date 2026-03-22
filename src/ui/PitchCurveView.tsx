import { useEffect, useRef } from "react";
import type { PitchFrame } from "../app/types";

type Props = {
  frames: PitchFrame[];
};

const MIDI_MIN = 36; // C2
const MIDI_MAX = 96; // C7

const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

const confToColor = (conf: number): string => {
  // 低信頼度: 赤、高信頼度: 緑
  const r = Math.round(255 * Math.max(0, 1 - conf * 1.5));
  const g = Math.round(200 * Math.min(1, conf * 1.2));
  return `rgb(${r},${g},60)`;
};

const draw = (canvas: HTMLCanvasElement, frames: PitchFrame[]): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#16161e";
  ctx.fillRect(0, 0, W, H);

  if (frames.length === 0) return;

  const totalSec = (frames[frames.length - 1]?.tSec ?? 0) + 0.05;
  const toX = (t: number) => (t / totalSec) * W;
  const toY = (midi: number) => H - ((midi - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)) * H;

  // オクターブ境界のグリッド線
  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    if (midi % 12 !== 0) continue;
    const y = toY(midi);
    ctx.strokeStyle = "#2a2a3a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.font = "10px monospace";
    ctx.fillText(`C${Math.floor(midi / 12) - 1}`, 3, y - 2);
  }

  // ピッチフレームの描画
  for (const frame of frames) {
    if (frame.f0Hz === null) continue;
    const midi = hzToMidi(frame.f0Hz);
    if (midi < MIDI_MIN || midi > MIDI_MAX) continue;
    const x = toX(frame.tSec);
    const y = toY(midi);
    ctx.fillStyle = confToColor(frame.conf);
    ctx.fillRect(x, y - 1.5, Math.max(1.5, W / frames.length), 3);
  }
};

export const PitchCurveView = ({ frames }: Props): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = 120;
      draw(canvas, frames);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [frames]);

  // 統計表示
  const voiced = frames.filter((f) => f.f0Hz !== null);
  const avgConf =
    frames.length > 0
      ? frames.reduce((s, f) => s + f.conf, 0) / frames.length
      : 0;
  const voiceRatio = frames.length > 0 ? voiced.length / frames.length : 0;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#aaa", marginBottom: 4 }}>
        <span>フレーム数: {frames.length}</span>
        <span>有声: {voiced.length} ({Math.round(voiceRatio * 100)}%)</span>
        <span>平均conf: {avgConf.toFixed(3)}</span>
        <span style={{ color: "#f88" }}>■ 低conf</span>
        <span style={{ color: "#8c8" }}>■ 高conf</span>
      </div>
      <div ref={containerRef} style={{ width: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: 120, borderRadius: 4 }}
        />
      </div>
    </div>
  );
};
