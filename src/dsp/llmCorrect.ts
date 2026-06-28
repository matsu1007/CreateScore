import type { ChordRoot, GridSetting, NoteQ } from "../app/types";
import { ollamaChat } from "../api/ollama";
import { estimateChordRoots } from "./chordRoot";
import { gridTicksPerQuarter } from "./quantize";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B"
};

const midiToName = (midi: number): string => {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
};

const nameToMidi = (name: string): number | null => {
  const m = name.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!m) {
    return null;
  }
  const noteName = FLAT_TO_SHARP[m[1]] ?? m[1];
  const pc = NOTE_NAMES.indexOf(noteName as (typeof NOTE_NAMES)[number]);
  if (pc === -1) {
    return null;
  }
  return (parseInt(m[2], 10) + 1) * 12 + pc;
};

const rootNameToPc = (name: string): number | null => {
  const normalized = FLAT_TO_SHARP[name.trim()] ?? name.trim();
  const idx = NOTE_NAMES.indexOf(normalized as (typeof NOTE_NAMES)[number]);
  return idx === -1 ? null : idx;
};

const divisionLabel = (division: GridSetting["division"]): string =>
  ({ "1/8": "1/8", "1/16": "1/16", "1/32": "1/32" })[division];

const buildPrompt = (notes: NoteQ[], chordRoots: ChordRoot[], grid: GridSetting): string => {
  const chordHint =
    chordRoots.length > 0
      ? chordRoots.map((c) => `measure ${c.measure} = ${NOTE_NAMES[c.rootPc]}`).join(", ")
      : "unknown";

  const notesJson = JSON.stringify(
    notes.map((n) => ({ pitch: midiToName(n.midi), startTick: n.startTick }))
  );

  return `You are a music transcription assistant. A melody was captured from humming via automatic pitch detection. Pitch detectors frequently make errors: octave jumps, semitone slips, and notes that don't fit the key.

Context:
- Tempo: ${grid.bpm} BPM, 4/4 time
- Grid: 1 tick = ${divisionLabel(grid.division)} note
- Chord estimate by measure: ${chordHint}

Detected notes (JSON):
${notesJson}

Your job: identify and fix pitch detection errors. Look for:
- A note an octave too high or too low compared to neighbours
- A note that clashes with the key or chord context
- An isolated outlier note that breaks the melodic contour

Rules:
1. Output exactly ${notes.length} notes in the same order as input. Do NOT add, remove, or reorder notes.
2. Do NOT change startTick. Only "pitch" may differ.
3. Estimate the chord root for each measure that contains notes.

Return ONLY valid JSON, no explanation:
{"notes":[{"pitch":"C4","startTick":0},...], "chords":[{"measure":0,"root":"C"},...]}

"measure" is 0-indexed from the first note-containing measure. "root" is one of: C C# D D# E F F# G G# A A# B`;
};

type LlmNote = { pitch: string; startTick: number };

const extractJson = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    return fenced[1].trim();
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  const arrMatch = text.match(/\[[\s\S]*\]/);
  return arrMatch ? arrMatch[0] : text.trim();
};

const MIDI_MIN = 21;
const MIDI_MAX = 108;

// Only pitch is taken from LLM output.
// startTick, durationTick, id, velocity are always preserved from the original.
const parseNotes = (rawNotes: unknown, original: NoteQ[]): NoteQ[] | null => {
  if (!Array.isArray(rawNotes)) {
    return null;
  }

  const items = rawNotes as LlmNote[];
  const ratio = items.length / original.length;
  if (ratio < 0.8 || ratio > 1.2) {
    return null;
  }

  const len = Math.min(items.length, original.length);
  const result: NoteQ[] = [];

  for (let i = 0; i < len; i++) {
    const item = items[i];
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const midi = nameToMidi(String(item.pitch ?? ""));

    result.push({
      ...original[i],
      midi: midi !== null ? Math.max(MIDI_MIN, Math.min(MIDI_MAX, midi)) : original[i].midi
    });
  }

  for (let i = len; i < original.length; i++) {
    result.push(original[i]);
  }

  return result;
};

const parseChords = (rawChords: unknown, notes: NoteQ[], grid: GridSetting): ChordRoot[] | null => {
  if (!Array.isArray(rawChords) || rawChords.length === 0) {
    return null;
  }

  const ticksPerMeasure = gridTicksPerQuarter(grid.division) * 4;
  const minTick = Math.min(...notes.map((n) => n.startTick));
  const firstAbsMeasure = Math.floor(minTick / ticksPerMeasure);

  const result: ChordRoot[] = [];
  for (const item of rawChords) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const measure = Number((item as Record<string, unknown>).measure);
    const rootStr = String((item as Record<string, unknown>).root ?? "");
    const rootPc = rootNameToPc(rootStr);
    if (!Number.isFinite(measure) || !Number.isInteger(measure) || rootPc === null) {
      return null;
    }
    result.push({
      measure,
      startTick: (firstAbsMeasure + measure) * ticksPerMeasure,
      rootPc,
      score: 1.0
    });
  }

  return result.sort((a, b) => a.measure - b.measure);
};

type ParsedResponse = {
  notes: NoteQ[] | null;
  chords: ChordRoot[] | null;
};

const parseResponse = (text: string, original: NoteQ[], grid: GridSetting): ParsedResponse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    return { notes: null, chords: null };
  }

  let rawNotes: unknown;
  let rawChords: unknown;

  if (Array.isArray(parsed)) {
    // Fallback: LLM returned a bare array (old format)
    rawNotes = parsed;
    rawChords = null;
  } else if (typeof parsed === "object" && parsed !== null) {
    rawNotes = (parsed as Record<string, unknown>).notes;
    rawChords = (parsed as Record<string, unknown>).chords;
  } else {
    return { notes: null, chords: null };
  }

  const notes = parseNotes(rawNotes, original);
  const chords = notes ? parseChords(rawChords, notes, grid) : null;
  return { notes, chords };
};

// Trim each note's durationTick so it ends no later than the next note's startTick.
const clipOverlaps = (notes: NoteQ[]): NoteQ[] => {
  const result = notes.map((n) => ({ ...n }));
  for (let i = 0; i + 1 < result.length; i++) {
    const end = result[i].startTick + result[i].durationTick;
    if (end > result[i + 1].startTick) {
      result[i].durationTick = Math.max(1, result[i + 1].startTick - result[i].startTick);
    }
  }
  return result;
};

export type LlmCorrectionResult = {
  notesQ: NoteQ[];
  chordRoots: ChordRoot[];
  changedCount: number;
};

export const correctNotesWithLLM = async (
  notes: NoteQ[],
  chordRoots: ChordRoot[],
  grid: GridSetting,
  model: string,
  signal?: AbortSignal,
  onToken?: (count: number) => void
): Promise<LlmCorrectionResult> => {
  if (notes.length === 0) {
    return { notesQ: notes, chordRoots, changedCount: 0 };
  }

  const prompt = buildPrompt(notes, chordRoots, grid);

  let tokenOffset = 0;
  let lastLocalCount = 0;
  const trackToken = onToken
    ? (n: number) => {
        lastLocalCount = n;
        onToken(tokenOffset + n);
      }
    : undefined;

  // ~15 tokens per note (pitch+startTick+durationTick) + ~5 per chord + fixed overhead
  const numPredict = Math.min(2000, notes.length * 20 + 300);
  const chatOptions = { temperature: 0.1, num_predict: numPredict, num_thread: navigator.hardwareConcurrency || 4 };

  let responseText: string;
  try {
    responseText = await ollamaChat(
      model,
      [{ role: "user", content: prompt }],
      chatOptions,
      signal,
      trackToken
    );
    tokenOffset += lastLocalCount;
    lastLocalCount = 0;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    tokenOffset += lastLocalCount;
    lastLocalCount = 0;
    responseText = await ollamaChat(
      model,
      [
        { role: "user", content: prompt },
        { role: "assistant", content: responseText! },
        {
          role: "user",
          content: 'The response must be ONLY a JSON object with "notes" and "chords" keys. No explanation. Try again.'
        }
      ],
      chatOptions,
      signal,
      trackToken
    );
  }

  const { notes: corrected, chords: llmChords } = parseResponse(responseText, notes, grid);
  const finalNotes = corrected !== null ? clipOverlaps(corrected) : notes;
  const finalChords = llmChords ?? estimateChordRoots(finalNotes, grid);

  const changedCount = finalNotes.filter(
    (n, i) => n.midi !== notes[i]?.midi
  ).length;

  return { notesQ: finalNotes, chordRoots: finalChords, changedCount };
};
