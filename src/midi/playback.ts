import type { GridSetting, NoteQ } from "../app/types";

const gridTickToSec = (tick: number, grid: GridSetting): number => {
  const beatSec = 60 / grid.bpm;
  const gridSec =
    grid.division === "1/8" ? beatSec / 2 : grid.division === "1/16" ? beatSec / 4 : beatSec / 8;
  return tick * gridSec;
};

export type PlaybackController = {
  stop: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  isPaused: () => boolean;
  isStopped: () => boolean;
  getElapsedSec: () => number;
  getDurationSec: () => number;
  getSecPerTick: () => number;
  getEndTick: () => number;
};

const createNoopController = (): PlaybackController => ({
  stop: () => undefined,
  pause: async () => undefined,
  resume: async () => undefined,
  isPaused: () => false,
  isStopped: () => true,
  getElapsedSec: () => 0,
  getDurationSec: () => 0,
  getSecPerTick: () => 0,
  getEndTick: () => 0
});

export const playNotes = (notes: NoteQ[], grid: GridSetting): PlaybackController => {
  if (notes.length === 0) {
    return createNoopController();
  }

  const audioContext = new AudioContext();
  const leadSec = 0.05;
  const startAtSec = audioContext.currentTime + leadSec;
  const secPerTick = gridTickToSec(1, grid);
  const endTick = Math.max(...notes.map((note) => note.startTick + note.durationTick));
  const durationSec = endTick * secPerTick;
  const gains: GainNode[] = [];
  const oscillators: OscillatorNode[] = [];
  let paused = false;
  let stopped = false;

  for (const note of notes) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = startAtSec + gridTickToSec(note.startTick, grid);
    const end = startAtSec + gridTickToSec(note.startTick + note.durationTick, grid);
    const freq = 440 * 2 ** ((note.midi - 69) / 12);

    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.setValueAtTime(0.18, Math.max(start + 0.02, end - 0.02));
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain).connect(audioContext.destination);
    osc.start(start);
    osc.stop(end + 0.02);

    gains.push(gain);
    oscillators.push(osc);
  }

  const stop = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    for (const gain of gains) {
      gain.gain.cancelScheduledValues(audioContext.currentTime);
      gain.gain.value = 0;
    }
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        // no-op: oscillator may already be stopped
      }
    }
    void audioContext.close();
  };

  const pause = async (): Promise<void> => {
    if (stopped || paused) {
      return;
    }
    await audioContext.suspend();
    paused = true;
  };

  const resume = async (): Promise<void> => {
    if (stopped || !paused) {
      return;
    }
    await audioContext.resume();
    paused = false;
  };

  return {
    stop,
    pause,
    resume,
    isPaused: () => paused,
    isStopped: () => stopped,
    getElapsedSec: () => Math.min(durationSec, Math.max(0, audioContext.currentTime - startAtSec)),
    getDurationSec: () => durationSec,
    getSecPerTick: () => secPerTick,
    getEndTick: () => endTick
  };
};
