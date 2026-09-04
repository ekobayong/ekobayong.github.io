#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = __dirname;
const SCRATCH =
  process.env.GROK_CHECK_SCRATCH ||
  path.join(
    process.env.LOCALAPPDATA || "/tmp",
    "Temp",
    "grok-goal-d6416f29e185",
    "implementer"
  );
const LOG = path.join(SCRATCH, "browser.log");

function log(line) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.appendFileSync(LOG, line + "\n", "utf8");
  console.log(line);
}

function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(LOG, "", "utf8");

  const ver = spawnSync("npx", ["--yes", "playwright", "--version"], {
    encoding: "utf8",
    timeout: 120000,
    shell: true,
  });
  if (ver.status !== 0) {
    log("PLAYWRIGHT_UNAVAILABLE: launcher failed");
    log((ver.stderr || ver.stdout || "").trim());
    process.exit(0);
  }
  log("playwright " + (ver.stdout || "").trim());

  let chromium;
  try {
    chromium = require("playwright").chromium;
  } catch (e) {
    const resolved = spawnSync(
      "npx",
      ["--yes", "-p", "playwright", "node", "-e", "process.stdout.write(require.resolve('playwright'))"],
      { encoding: "utf8", timeout: 120000, shell: true }
    );
    if (resolved.status !== 0 || !resolved.stdout) {
      log("PLAYWRIGHT_UNAVAILABLE: cannot resolve playwright module");
      log((resolved.stderr || resolved.stdout || "").trim());
      process.exit(0);
    }
    try {
      chromium = require(resolved.stdout.trim()).chromium;
    } catch (e2) {
      log("PLAYWRIGHT_UNAVAILABLE: cannot load chromium: " + e2.message);
      log("resolved=" + resolved.stdout.trim());
      process.exit(0);
    }
    const inst = spawnSync("npx", ["--yes", "playwright", "install", "chromium"], {
      encoding: "utf8",
      timeout: 180000,
      shell: true,
    });
    log("install chromium status=" + inst.status);
  }

  const files = fs
    .readdirSync(ROOT)
    .filter((f) => /^\d{3}-.+\.html$/.test(f))
    .sort();

  return (async () => {
    const browser = await chromium.launch({ headless: true });
    const errors = [];
    for (const file of files) {
      for (let run = 1; run <= 2; run++) {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", (err) => pageErrors.push(String(err)));
        const url = pathToFileURL(path.join(ROOT, file)).href;
        try {
          await page.goto(url, { waitUntil: "load", timeout: 15000 });
          await page.waitForTimeout(250);
        } catch (err) {
          pageErrors.push("NAV " + err.message);
        }
        if (pageErrors.length) {
          errors.push(file + " run" + run + " :: " + pageErrors[0]);
          log("FAIL " + file + " run" + run + " " + pageErrors.join(" | "));
        } else {
          log("OK " + file + " run" + run);
        }
        if (run === 1 && /^(001|050|100)-/.test(file)) {
          const shot = path.join(SCRATCH, "shot-" + file.slice(0, 3) + ".png");
          await page.screenshot({ path: shot, fullPage: false });
          log("SHOT " + shot);
        }
        await page.close();
      }
    }
    await browser.close();
    if (errors.length) {
      log("BROWSER_FAIL " + errors.length);
      process.exitCode = 1;
    } else {
      log("BROWSER_PASS " + files.length + " files x2");
    }
  })();
}

main().catch((err) => {
  log("PLAYWRIGHT_UNAVAILABLE: " + err.stack);
  process.exit(0);
});
