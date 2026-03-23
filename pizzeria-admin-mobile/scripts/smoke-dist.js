/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distIndexPath = path.join(__dirname, "..", "dist", "index.html");

if (!fs.existsSync(distIndexPath)) {
  console.error("Smoke check failed: dist/index.html is missing. Run `npm run build` first.");
  process.exit(1);
}

const content = fs.readFileSync(distIndexPath, "utf8");
if (!/<html/i.test(content) || !/<body/i.test(content)) {
  console.error("Smoke check failed: dist/index.html does not look like a valid HTML page.");
  process.exit(1);
}

console.log("Smoke check passed: dist/index.html is present.");
