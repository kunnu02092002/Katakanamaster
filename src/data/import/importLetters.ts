import { z } from "zod";
import type { LetterSeed } from "../../domain/models";

const letterSchema = z.object({
  note_id: z.union([z.string(), z.number()]),
  front: z.string().min(1),
  back: z.string().min(1),
  category: z.string().optional(),
});

const lettersFileSchema = z.object({
  version: z.string().optional(),
  description: z.string().optional(),
  data: z.array(letterSchema),
});

export async function importLetters(): Promise<LetterSeed[]> {
  const response = await fetch("/data/katakana-letters.json");
  if (!response.ok) {
    throw new Error("Could not fetch letters dataset");
  }

  const json = await response.json();
  const parsed = lettersFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid letters dataset: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  return parsed.data.data.map((item) => ({
    note_id: String(item.note_id),
    front: item.front,
    back: item.back,
    category: "letter",
  }));
}
