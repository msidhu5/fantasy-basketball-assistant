import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SOURCE_CSV = "/Users/manpreet/Downloads/projections.csv";
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../shared/projections-data.js");

const csvText = readFileSync(SOURCE_CSV, "utf-8");

const content = `/**
 * Projections bundled directly into the extension so no filesystem/file:// access
 * is needed at runtime. Regenerate this file (don't hand-edit) whenever
 * ${SOURCE_CSV} changes: npm run update-projections
 */
export const PROJECTIONS_CSV = ${JSON.stringify(csvText)};
`;

writeFileSync(outPath, content, "utf-8");
console.log(`Wrote ${outPath} (${csvText.length} chars embedded from ${SOURCE_CSV})`);
