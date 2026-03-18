import { db } from "./dexieClient";
import { createInitialItem, scheduleReview } from "../../domain/sm2";
import { importLetters } from "../import/importLetters";
import { importWords } from "../import/importWords";
import type { ReviewHistoryEntry, StudyItem } from "../../domain/models";
import { STORAGE_SCHEMA_VERSION } from "../../domain/models";

let letterOrderPromise: Promise<Map<string, number>> | null = null;

async function getLetterOrderMap() {
  if (!letterOrderPromise) {
    letterOrderPromise = importLetters().then((letters) => {
      const map = new Map<string, number>();
      letters.forEach((letter, index) => {
        map.set(String(letter.note_id), index);
      });
      return map;
    });
  }

  return letterOrderPromise;
}

export async function initializeData() {
  const [letters, words] = await Promise.all([importLetters(), importWords()]);

  const existingIds = new Set(await db.studyItems.toCollection().primaryKeys());
  const toAdd: StudyItem[] = [];

  for (const letter of letters) {
    if (!existingIds.has(letter.note_id)) {
      toAdd.push(
        createInitialItem({
          id: letter.note_id,
          front: letter.front,
          back: letter.back,
          category: "letter",
        })
      );
    }
  }

  for (const word of words) {
    const id = String(word.note_id);
    if (!existingIds.has(id)) {
      toAdd.push(
        createInitialItem({
          id,
          front: word.Front,
          back: word.Back,
          category: "word",
        })
      );
    }
  }

  if (toAdd.length) {
    await db.studyItems.bulkAdd(toAdd);
  }

  await db.appMeta.put({ key: "storageSchemaVersion", value: STORAGE_SCHEMA_VERSION });
}

export async function getLetters() {
  const [letters, orderMap] = await Promise.all([
    db.studyItems.where("category").equals("letter").toArray(),
    getLetterOrderMap(),
  ]);

  return letters.sort((a, b) => {
    const aOrder = orderMap.get(a.id);
    const bOrder = orderMap.get(b.id);

    if (aOrder === undefined && bOrder === undefined) {
      return a.front.localeCompare(b.front);
    }
    if (aOrder === undefined) {
      return 1;
    }
    if (bOrder === undefined) {
      return -1;
    }
    return aOrder - bOrder;
  });
}

export async function getWords() {
  return db.studyItems.where("category").equals("word").sortBy("front");
}

export async function getAllStudyItems() {
  return db.studyItems.toArray();
}

export async function upsertStudyItems(items: StudyItem[]) {
  if (!items.length) {
    return;
  }
  await db.studyItems.bulkPut(items);
}

export async function getAllReviewHistoryEntries() {
  return db.reviewHistory.toArray();
}

export async function mergeReviewHistoryEntries(entries: Array<Pick<ReviewHistoryEntry, "itemId" | "quality" | "timestamp">>) {
  if (!entries.length) {
    return;
  }

  const existing = await db.reviewHistory.toArray();
  const existingKeys = new Set(existing.map((entry) => `${entry.itemId}|${entry.quality}|${entry.timestamp}`));

  const toAdd = entries.filter((entry) => {
    const key = `${entry.itemId}|${entry.quality}|${entry.timestamp}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  if (toAdd.length) {
    await db.reviewHistory.bulkAdd(toAdd);
  }
}

export async function getDueItems(nowIso = new Date().toISOString(), limit = 200) {
  return db.studyItems
    .where("nextDate")
    .belowOrEqual(nowIso)
    .filter((item) => item.state !== "suspended")
    .limit(limit)
    .toArray();
}

export async function applyReview(item: StudyItem, quality: number) {
  const updated = scheduleReview(item, quality);
  const reviewEntry = { itemId: item.id, quality, timestamp: new Date().toISOString() };

  await db.transaction("rw", db.studyItems, db.reviewHistory, async () => {
    await db.studyItems.put(updated);
    await db.reviewHistory.add(reviewEntry);
  });

  return { updated, reviewEntry };
}

export async function getReviewDaysSet() {
  const entries = await db.reviewHistory.toArray();
  const set = new Set<string>();
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    set.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }
  return set;
}
