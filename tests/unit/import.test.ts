import { describe, expect, it } from "vitest";
import { z } from "zod";

const wordSchema = z.object({
  note_id: z.number(),
  Front: z.string().min(1),
  Back: z.string().min(1),
});

describe("import schemas", () => {
  it("accepts valid word rows", () => {
    const parsed = wordSchema.safeParse({ note_id: 1, Front: "テスト", Back: "test" });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed rows", () => {
    const parsed = wordSchema.safeParse({ note_id: "bad", Front: "", Back: 1 });
    expect(parsed.success).toBe(false);
  });
});
