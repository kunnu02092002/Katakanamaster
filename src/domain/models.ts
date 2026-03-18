export type StudyCategory = "letter" | "word";
export type CardState = "learning" | "review" | "relearning" | "suspended";

export interface StudyItem {
  id: string;
  front: string;
  back: string;
  category: StudyCategory;
  reps: number;
  lapses: number;
  ef: number;
  interval: number;
  state: CardState;
  stepIndex: number;
  leechCount: number;
  lastDate: string | null;
  nextDate: string;
}

export interface ReviewHistoryEntry {
  id?: number;
  itemId: string;
  quality: number;
  timestamp: string;
}

export interface AppMeta {
  key: string;
  value: string;
}

export interface LetterSeed {
  note_id: string;
  front: string;
  back: string;
  category: "letter";
}

export interface WordSeed {
  note_id: number;
  Front: string;
  Back: string;
}

export const STORAGE_SCHEMA_VERSION = "1";
