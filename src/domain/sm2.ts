import type { StudyItem } from "./models";

export const LEARNING_STEPS_MINUTES = [1, 10];
export const RELEARNING_STEPS_MINUTES = [10];

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function gradeLabelToQuality(label: "again" | "hard" | "good" | "easy") {
  return { again: 1, hard: 3, good: 4, easy: 5 }[label];
}

export function scheduleReview(item: StudyItem, quality: number, now = new Date()): StudyItem {
  const updated: StudyItem = { ...item };
  updated.lastDate = now.toISOString();

  if (updated.state === "suspended") {
    return updated;
  }

  if (updated.state === "learning" || updated.state === "relearning") {
    const steps = updated.state === "learning" ? LEARNING_STEPS_MINUTES : RELEARNING_STEPS_MINUTES;

    if (quality <= 2) {
      updated.stepIndex = 0;
      updated.lapses += 1;
      updated.leechCount += 1;
      const next = new Date(now.getTime() + steps[0] * 60 * 1000);
      updated.nextDate = next.toISOString();
      if (updated.leechCount >= 8) {
        updated.state = "suspended";
      }
      return updated;
    }

    updated.stepIndex += 1;
    if (updated.stepIndex >= steps.length) {
      updated.state = "review";
      updated.stepIndex = 0;
      updated.reps = Math.max(1, updated.reps);
      updated.interval = quality >= 5 ? 4 : 1;
      updated.nextDate = new Date(now.getTime() + updated.interval * DAY_MS).toISOString();
      updated.leechCount = 0;
      return updated;
    }

    const next = new Date(now.getTime() + steps[updated.stepIndex] * 60 * 1000);
    updated.nextDate = next.toISOString();
    return updated;
  }

  if (quality <= 2) {
    updated.lapses += 1;
    updated.leechCount += 1;
    updated.reps = Math.max(0, updated.reps - 1);
    updated.state = "relearning";
    updated.stepIndex = 0;
    updated.interval = 1;
    updated.nextDate = new Date(now.getTime() + RELEARNING_STEPS_MINUTES[0] * 60 * 1000).toISOString();
    if (updated.leechCount >= 8) {
      updated.state = "suspended";
    }
  } else {
    updated.leechCount = 0;

    if (updated.reps === 0) {
      updated.interval = 1;
    } else if (updated.reps === 1) {
      updated.interval = 6;
    } else {
      const overdueDays = Math.max(0, Math.floor((now.getTime() - new Date(updated.nextDate).getTime()) / DAY_MS));
      const overdueBonus = Math.min(overdueDays * 0.25 * updated.interval, updated.interval * 0.5);
      const effectiveInterval = updated.interval + overdueBonus;
      const fuzz = effectiveInterval >= 7 ? 1 + (Math.random() * 0.1 - 0.05) : 1;
      updated.interval = Math.round(effectiveInterval * updated.ef * fuzz);
    }

    updated.reps += 1;

    updated.ef = updated.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    updated.ef = clamp(updated.ef, 1.3, 3.0);
    updated.state = "review";
    updated.nextDate = new Date(now.getTime() + updated.interval * DAY_MS).toISOString();
  }

  return updated;
}

export function createInitialItem(seed: {
  id: string;
  front: string;
  back: string;
  category: "letter" | "word";
}): StudyItem {
  return {
    id: seed.id,
    front: seed.front,
    back: seed.back,
    category: seed.category,
    reps: 0,
    lapses: 0,
    ef: 2.5,
    interval: 0,
    state: "learning",
    stepIndex: 0,
    leechCount: 0,
    lastDate: null,
    nextDate: new Date().toISOString(),
  };
}
