import { z } from "zod";
import type { WordSeed } from "../../domain/models";

const wordSchema = z.object({
  note_id: z.number(),
  Front: z.string().min(1),
  Back: z.string().min(1),
});

const wordsSchema = z.array(wordSchema);

export async function importWords(): Promise<WordSeed[]> {
  const response = await fetch("/data/words.json");
  if (!response.ok) {
    throw new Error("Could not fetch words dataset");
  }

  const json = await response.json();
  const parsed = wordsSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid words dataset: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  return parsed.data;
}
