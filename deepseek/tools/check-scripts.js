// Project check: extract every <script> block from the generated HTML files and
// syntax-check it with node --check. Exits non-zero on the first failure.
// Usage: node tools/check-scripts.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const dir = path.resolve(__dirname, "..");
const files = fs.readdirSync(dir).filter((f) => /^\d{3}-.+\.html$/.test(f));
// index.html is generated too — check it alongside the numbered files
if (fs.existsSync(path.join(dir, "index.html"))) files.push("index.html");
if (!files.length) {
  console.error("no generated html files found");
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "html-check-"));
let bad = 0;
let total = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const blocks = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  blocks.forEach((m, i) => {
    total++;
    const js = path.join(tmp, f.replace(/\.html$/, "") + (blocks.length > 1 ? "-" + i : "") + ".js");
    fs.writeFileSync(js, m[1]);
    const r = spawnSync(process.execPath, ["--check", js], { encoding: "utf8" });
    if (r.status !== 0) {
      bad++;
      console.error("SYNTAX ERROR in " + f + " (script " + i + "):\n" + (r.stderr || r.stdout).trim().split("\n").slice(0, 4).join("\n"));
    }
  });
  if (f === "index.html") {
    // sanity: the embedded ITEMS array must parse and hold exactly 100 entries
    const m = s.match(/ITEMS = (\[[\s\S]*?\]);/);
    if (!m) {
      bad++;
      console.error("index.html: ITEMS array not found");
    } else {
      let arr;
      try {
        arr = JSON.parse(m[1]);
      } catch (e) {
        bad++;
        console.error("index.html: ITEMS JSON parse failed: " + e.message);
      }
      if (arr && arr.length !== 100) {
        bad++;
        console.error("index.html: expected 100 items, got " + arr.length);
      }
      if (arr) for (const it of arr) {
        if (!it.file || !it.txt || !it.prompt) {
          bad++;
          console.error("index.html: item missing file/txt/prompt: " + JSON.stringify(it));
          break;
        }
      }
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log("checked " + total + " <script> blocks across " + files.length + " html files — " + (bad === 0 ? "ALL OK" : bad + " FAILED"));
process.exit(bad === 0 ? 0 : 1);