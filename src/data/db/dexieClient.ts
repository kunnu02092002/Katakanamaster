import Dexie, { type EntityTable } from "dexie";
import type { AppMeta, ReviewHistoryEntry, StudyItem } from "../../domain/models";

export class KatakanaDb extends Dexie {
  studyItems!: EntityTable<StudyItem, "id">;
  reviewHistory!: EntityTable<ReviewHistoryEntry, "id">;
  appMeta!: EntityTable<AppMeta, "key">;

  constructor() {
    super("katakana-master-db");
    this.version(1).stores({
      studyItems: "&id, category, nextDate, front, state",
      reviewHistory: "++id, itemId, timestamp",
      appMeta: "&key",
    });
  }
}

export const db = new KatakanaDb();
