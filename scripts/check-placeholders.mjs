// Finds unfinished "[PLACEHOLDER ...]" markers in site content (the same check as the portfolio's).
// Normal mode: lists them and exits OK (warning only).
// Strict mode (--strict): lists them and exits with an error.
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const MARKER = "[PLACEHOLDER";
const ROOTS = ["src", "public"];
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md", ".mdx", ".css", ".svg", ".html", ".txt"]);
const strict = process.argv.includes("--strict");

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // folder does not exist yet
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

const found = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.includes(MARKER)) found.push({ file, line: i + 1, text: line.trim() });
      });
  }
}

if (found.length === 0) {
  console.log("No placeholders found.");
  process.exit(0);
}

console.log(`${found.length} placeholder(s) still in the site content:\n`);
for (const { file, line, text } of found) console.log(`  ${file.replaceAll("\\", "/")}:${line}  ${text}`);

if (strict) {
  console.error("\nStrict mode: unfinished placeholders must be replaced before this goes live.");
  process.exit(1);
}
console.log("\nWarning only. Use --strict before going live.");
