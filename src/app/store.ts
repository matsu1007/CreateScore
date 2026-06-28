import type { ChordRoot, GridSetting, NoteQ, PitchFrame, ProjectState } from "./types";
import { clamp } from "../utils/math";
import { createId } from "../utils/id";

export const DEFAULT_GRID: GridSetting = {
  bpm: 120,
  timeSig: { num: 4, den: 4 },
  division: "1/32"
};

export const initialState: ProjectState = {
  status: "Empty",
  grid: DEFAULT_GRID,
  notesQ: [],
  chordRoots: [],
  undoStack: [],
  redoStack: [],
  selection: { noteIds: [] }
};

type Action =
  | { type: "recordStart" }
  | { type: "recorded"; audio: ProjectState["audio"] }
  | { type: "analyzeStart" }
  | {
      type: "analyzeSuccess";
      payload: {
        frames: PitchFrame[];
        notesQ: NoteQ[];
        chordRoots: ChordRoot[];
      };
    }
  | { type: "analyzeFail"; code: string; message: string }
  | { type: "clear" }
  | { type: "beginEdit" }
  | { type: "undoEdit" }
  | { type: "redoEdit" }
  | { type: "updateGrid"; grid: Partial<GridSetting> }
  | { type: "setSelection"; ids: string[] }
  | { type: "moveSelection"; deltaTick: number; deltaMidi: number }
  | { type: "transposeAllSemitone"; direction: "up" | "down" }
  | { type: "transposeAllOctave"; direction: "up" | "down" }
  | { type: "deleteSelection" }
  | { type: "splitSelection"; splitTick: number }
  | { type: "joinSelection" }
  | { type: "llmCorrect"; notesQ: NoteQ[]; chordRoots: ChordRoot[] };

const uniq = (ids: string[]): string[] => Array.from(new Set(ids));
const cloneNotes = (notes: NoteQ[]): NoteQ[] => notes.map((note) => ({ ...note }));
const MAX_UNDO_STEPS = 5;

const isSameNotes = (left: NoteQ[], right: NoteQ[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (
      left[i].id !== right[i].id ||
      left[i].midi !== right[i].midi ||
      left[i].startTick !== right[i].startTick ||
      left[i].durationTick !== right[i].durationTick ||
      left[i].velocity !== right[i].velocity
    ) {
      return false;
    }
  }
  return true;
};

const isSameSelection = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
};

export const canAnalyze = (state: ProjectState): boolean =>
  Boolean(state.audio) && state.status !== "Recording" && state.status !== "Analyzing";

export const canExport = (state: ProjectState): boolean =>
  state.status === "Ready" && state.notesQ.length > 0;

export const canUndo = (state: ProjectState): boolean =>
  state.status === "Ready" && state.undoStack.length > 0;

export const canRedo = (state: ProjectState): boolean =>
  state.status === "Ready" && state.redoStack.length > 0;

export const projectReducer = (state: ProjectState, action: Action): ProjectState => {
  switch (action.type) {
    case "recordStart":
      return {
        ...state,
        status: "Recording",
        error: undefined
      };
    case "recorded":
      if (!action.audio) {
        return state;
      }
      return {
        ...state,
        status: "Recorded",
        audio: action.audio,
        frames: undefined,
        notesQ: [],
        chordRoots: [],
        selection: { noteIds: [] },
        undoStack: [],
        redoStack: [],
        error: undefined
      };
    case "analyzeStart":
      if (!state.audio) {
        return state;
      }
      return {
        ...state,
        status: "Analyzing",
        error: undefined
      };
    case "analyzeSuccess":
      return {
        ...state,
        status: "Ready",
        frames: action.payload.frames,
        notesQ: action.payload.notesQ,
        chordRoots: action.payload.chordRoots,
        selection: { noteIds: [] },
        undoStack: [],
        redoStack: [],
        error: undefined
      };
    case "analyzeFail":
      return {
        ...state,
        status: "Error",
        undoStack: [],
        redoStack: [],
        error: { code: action.code, message: action.message }
      };
    case "clear":
      return {
        ...initialState,
        grid: state.grid
      };
    case "beginEdit":
      if (state.status !== "Ready") {
        return state;
      }
      const snapshot = {
        notesQ: cloneNotes(state.notesQ),
        selection: { noteIds: [...state.selection.noteIds] }
      };
      const last = state.undoStack[state.undoStack.length - 1];
      if (
        last &&
        isSameNotes(last.notesQ, snapshot.notesQ) &&
        isSameSelection(last.selection.noteIds, snapshot.selection.noteIds)
      ) {
        return state;
      }
      return {
        ...state,
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO_STEPS),
        redoStack: []
      };
    case "undoEdit":
      if (state.undoStack.length === 0) {
        return state;
      }
      const prev = state.undoStack[state.undoStack.length - 1];
      const currentSnapshot = {
        notesQ: cloneNotes(state.notesQ),
        selection: { noteIds: [...state.selection.noteIds] }
      };
      return {
        ...state,
        notesQ: cloneNotes(prev.notesQ),
        selection: { noteIds: [...prev.selection.noteIds] },
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot].slice(-MAX_UNDO_STEPS)
      };
    case "redoEdit":
      if (state.redoStack.length === 0) {
        return state;
      }
      const next = state.redoStack[state.redoStack.length - 1];
      const undoSnapshot = {
        notesQ: cloneNotes(state.notesQ),
        selection: { noteIds: [...state.selection.noteIds] }
      };
      return {
        ...state,
        notesQ: cloneNotes(next.notesQ),
        selection: { noteIds: [...next.selection.noteIds] },
        undoStack: [...state.undoStack, undoSnapshot].slice(-MAX_UNDO_STEPS),
        redoStack: state.redoStack.slice(0, -1)
      };
    case "updateGrid": {
      const nextBpm = action.grid.bpm ? clamp(action.grid.bpm, 40, 240) : state.grid.bpm;
      return {
        ...state,
        grid: {
          ...state.grid,
          ...action.grid,
          bpm: nextBpm
        }
      };
    }
    case "setSelection":
      return {
        ...state,
        selection: { noteIds: uniq(action.ids) }
      };
    case "moveSelection":
      return {
        ...state,
        notesQ: moveSelectedNotes(state.notesQ, state.selection.noteIds, action.deltaTick, action.deltaMidi)
      };
    case "transposeAllSemitone":
      return {
        ...state,
        notesQ: transposeAllBy(state.notesQ, action.direction === "up" ? 1 : -1)
      };
    case "transposeAllOctave":
      return {
        ...state,
        notesQ: transposeAllOctave(state.notesQ, action.direction)
      };
    case "deleteSelection":
      return {
        ...state,
        notesQ: deleteSelectedNotes(state.notesQ, state.selection.noteIds),
        selection: { noteIds: [] }
      };
    case "splitSelection": {
      const notesQ = splitSelectedNote(state.notesQ, state.selection.noteIds, action.splitTick);
      return {
        ...state,
        notesQ
      };
    }
    case "joinSelection": {
      const notesQ = joinSelectedNotes(state.notesQ, state.selection.noteIds);
      return {
        ...state,
        notesQ,
        selection: { noteIds: [] }
      };
    }
    case "llmCorrect":
      return {
        ...state,
        notesQ: action.notesQ,
        chordRoots: action.chordRoots,
        selection: { noteIds: [] }
      };
    default:
      return state;
  }
};

export const moveSelectedNotes = (
  notes: NoteQ[],
  ids: string[],
  deltaTick: number,
  deltaMidi: number
): NoteQ[] => {
  if (deltaTick === 0 && deltaMidi === 0) {
    return notes;
  }
  const idSet = new Set(ids);
  return notes.map((note) => {
    if (!idSet.has(note.id)) {
      return note;
    }
    return {
      ...note,
      startTick: Math.max(0, note.startTick + deltaTick),
      midi: clamp(note.midi + deltaMidi, 0, 127)
    };
  });
};

export const deleteSelectedNotes = (notes: NoteQ[], ids: string[]): NoteQ[] => {
  if (ids.length === 0) {
    return notes;
  }
  const idSet = new Set(ids);
  return notes.filter((note) => !idSet.has(note.id));
};

export const transposeAllBy = (notes: NoteQ[], delta: number): NoteQ[] => {
  if (notes.length === 0 || delta === 0) {
    return notes;
  }
  return notes.map((note) => ({
    ...note,
    midi: clamp(note.midi + delta, 0, 127)
  }));
};

export const transposeAllOctave = (notes: NoteQ[], direction: "up" | "down"): NoteQ[] => {
  return transposeAllBy(notes, direction === "up" ? 12 : -12);
};

export const splitSelectedNote = (notes: NoteQ[], ids: string[], splitTick: number): NoteQ[] => {
  if (ids.length !== 1) {
    return notes;
  }
  const selectedId = ids[0];
  const result: NoteQ[] = [];
  for (const note of notes) {
    if (note.id !== selectedId) {
      result.push(note);
      continue;
    }
    const endTick = note.startTick + note.durationTick;
    if (splitTick <= note.startTick || splitTick >= endTick) {
      result.push(note);
      continue;
    }
    const leftDur = splitTick - note.startTick;
    const rightDur = endTick - splitTick;
    if (leftDur <= 0 || rightDur <= 0) {
      result.push(note);
      continue;
    }
    result.push({ ...note, durationTick: leftDur });
    result.push({
      ...note,
      id: createId("note"),
      startTick: splitTick,
      durationTick: rightDur
    });
  }
  return result.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
};

export const joinSelectedNotes = (notes: NoteQ[], ids: string[]): NoteQ[] => {
  if (ids.length < 2) {
    return notes;
  }
  const idSet = new Set(ids);
  const selected = notes
    .filter((note) => idSet.has(note.id))
    .sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
  if (selected.length < 2) {
    return notes;
  }

  const keep = notes.filter((note) => !idSet.has(note.id));
  const merged: NoteQ[] = [];

  let cursor = selected[0];
  for (let i = 1; i < selected.length; i += 1) {
    const next = selected[i];
    const cursorEnd = cursor.startTick + cursor.durationTick;
    const isJoinable = cursor.midi === next.midi && cursorEnd === next.startTick;
    if (isJoinable) {
      cursor = {
        ...cursor,
        durationTick: cursor.durationTick + next.durationTick
      };
      continue;
    }
    merged.push(cursor);
    cursor = next;
  }
  merged.push(cursor);

  return [...keep, ...merged].sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
};

export type ProjectAction = Action;
