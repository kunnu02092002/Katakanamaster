import { describe, expect, it } from "vitest";
import { createInitialItem, scheduleReview } from "../../src/domain/sm2";

describe("scheduleReview", () => {
  it("keeps ef above floor", () => {
    let item = createInitialItem({ id: "1", front: "ア", back: "a", category: "word" });
    item.state = "review";
    item.reps = 3;
    item.interval = 10;

    for (let i = 0; i < 20; i += 1) {
      item = scheduleReview(item, 1);
      item.state = "review";
    }

    expect(item.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("moves failed review into relearning", () => {
    const item = createInitialItem({ id: "2", front: "イ", back: "i", category: "word" });
    item.state = "review";
    item.reps = 2;
    item.interval = 6;

    const updated = scheduleReview(item, 1);
    expect(updated.state).toBe("relearning");
    expect(updated.lapses).toBe(1);
  });
});
