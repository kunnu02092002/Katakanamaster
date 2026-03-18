import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const targetDir = path.resolve(root, "public", "data");
const targetLetters = path.resolve(targetDir, "katakana-letters.json");
const targetWords = path.resolve(targetDir, "words.json");

const sourceLettersCandidates = [
	path.resolve(root, "..", "katakana data", "katakana-letters.json"),
	path.resolve(root, "public", "data", "katakana-letters.json"),
];

const sourceWordsCandidates = [
	path.resolve(root, "..", " katakana data  raw", "data exported.json"),
	path.resolve(root, "public", "data", "words.json"),
];

async function firstExistingPath(paths) {
	for (const candidate of paths) {
		try {
			await access(candidate);
			return candidate;
		} catch {
			// Ignore missing candidate and try next source.
		}
	}
	return null;
}

await mkdir(targetDir, { recursive: true });

const sourceLetters = await firstExistingPath(sourceLettersCandidates);
const sourceWords = await firstExistingPath(sourceWordsCandidates);

if (!sourceLetters || !sourceWords) {
	throw new Error("Could not find source dataset files for sync-data.");
}

if (path.resolve(sourceLetters) !== path.resolve(targetLetters)) {
	await copyFile(sourceLetters, targetLetters);
}

if (path.resolve(sourceWords) !== path.resolve(targetWords)) {
	await copyFile(sourceWords, targetWords);
}

console.log("Synced data files to public/data");
