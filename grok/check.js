#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const PROMPT = path.join(ROOT, "prompt.md");
const SCRATCH =
  process.env.GROK_CHECK_SCRATCH ||
  path.join(
    process.env.LOCALAPPDATA || "/tmp",
    "Temp",
    "grok-goal-d6416f29e185",
    "implementer"
  );

function parsePrompt() {
  const text = fs.readFileSync(PROMPT, "utf8");
  const sections = text.split(/^## /m).slice(1);
  const entries = [];
  for (const s of sections) {
    const titleLine = s.split("\n")[0].trim();
    const fm = s.match(/- File: `([^`]+)`/);
    if (!fm) throw new Error("Missing File: line in section: " + titleLine);
    entries.push({
      title: titleLine,
      file: fm[1],
      body: s,
    });
  }
  if (entries.length !== 100) {
    throw new Error("Expected 100 prompt sections, got " + entries.length);
  }
  return entries;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizeText(s) {
  return decodeEntities(s)
    .replace(/[\u3000\u00a0\u2000-\u200b]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function identityTokens(entry) {
  const tokens = [];
  const afterNum = entry.title.replace(/^\d+\.\s*/, "").trim();
  const parts = afterNum.split(/\s+[—–|]\s+/);
  for (const p of parts) {
    const t = p.trim();
    if (t.length >= 4) tokens.push(t);
  }
  const seen = new Set(tokens);
  const quoteRe = /"([^"]{8,90})"/g;
  let m;
  while ((m = quoteRe.exec(entry.body))) {
    const q = m[1].trim();
    if (
      q.endsWith(".html") ||
      q.endsWith(".txt") ||
      q.startsWith("http") ||
      seen.has(q)
    ) {
      continue;
    }
    seen.add(q);
    tokens.push(q);
  }
  return tokens;
}

function containsToken(html, token) {
  const hay = normalizeText(html);
  const needle = normalizeText(token);
  if (needle.length < 4) return false;
  if (hay.includes(needle)) return true;
  const words = needle.split(" ").filter((w) => w.length >= 4);
  if (words.length >= 2 && words.every((w) => hay.includes(w))) return true;
  return false;
}

function extractScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    scripts.push({ attrs: m[1] || "", body: m[2] || "" });
  }
  return scripts;
}

function findExternalAssets(html) {
  const hits = [];
  const attrRe =
    /\s(?:src|href)\s*=\s*["']\s*(https?:)?\/\/[^"']+/gi;
  let m;
  while ((m = attrRe.exec(html))) {
    const val = m[0];
    if (/xmlns/i.test(html.slice(Math.max(0, m.index - 80), m.index))) continue;
    hits.push(val.trim());
  }
  const cssUrl = /url\(\s*["']?(https?:)?\/\/[^)]+\)/gi;
  while ((m = cssUrl.exec(html))) hits.push(m[0]);
  const imp = /@import\s+["']?(https?:)?\/\//gi;
  while ((m = imp.exec(html))) hits.push(m[0]);
  if (/\bfetch\s*\(/i.test(html)) hits.push("fetch(");
  if (/\bXMLHttpRequest\b/.test(html)) hits.push("XMLHttpRequest");
  return hits;
}

function fakeStyle() {
  const store = Object.create(null);
  return new Proxy(store, {
    get(t, p) {
      if (p === "setProperty") return (k, v) => { t[k] = v; };
      if (p === "getPropertyValue") return (k) => t[k] || "";
      if (p === "removeProperty") return (k) => { delete t[k]; return ""; };
      if (p === "cssText") return Object.keys(t).map((k) => k + ":" + t[k]).join(";");
      return t[p];
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  });
}

function ancestorStub() {
  const node = {
    tagName: "DIV",
    style: fakeStyle(),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    children: [],
    getAttribute() { return "1a"; },
    setAttribute() {},
    setAttributeNS() {},
    appendChild(c) { this.children.push(c); return c; },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  node.parentNode = node;
  node.parentElement = node;
  return node;
}

function fakeEl(tag) {
  const parent = ancestorStub();
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    style: fakeStyle(),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    children: [],
    childNodes: [],
    parentNode: parent,
    parentElement: parent,
    offsetWidth: 800,
    offsetHeight: 600,
    clientWidth: 800,
    clientHeight: 600,
    scrollWidth: 800,
    scrollHeight: 600,
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    textContent: "",
    innerHTML: "",
    innerText: "",
    id: "",
    className: "",
    href: "",
    src: "",
    width: 800,
    height: 600,
    selectedIndex: 0,
    options: [{ text: "Tide Room", value: "tide" }],
    firstChild: null,
    lastChild: null,
    setAttribute() {},
    getAttribute(name) {
      if (name === "data-hx") return "1a";
      if (name === "data-rows") return "4";
      if (name === "data-panel") return "1";
      if (name === "id") return "id";
      return "1a";
    },
    setAttributeNS() {},
    removeAttribute() {},
    hasAttribute() { return false; },
    getTotalLength() { return 100; },
    getPointAtLength() { return { x: 40, y: 40 }; },
    appendChild(c) {
      if (c && typeof c === "object") {
        c.parentNode = this;
        c.parentElement = this;
      }
      this.children.push(c);
      this.firstChild = this.children[0] || null;
      this.lastChild = c;
      return c;
    },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      this.firstChild = this.children[0] || null;
      this.lastChild = this.children[this.children.length - 1] || null;
      return c;
    },
    insertBefore(c) { return c; },
    replaceChild(c) { return c; },
    cloneNode() { return fakeEl(tag); },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    focus() {},
    blur() {},
    click() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 };
    },
    querySelector() {
      const n = fakeEl("div");
      n.parentNode = el;
      n.parentElement = el;
      return n;
    },
    querySelectorAll() {
      if (this.children && this.children.length) return this.children;
      const n = fakeEl("div");
      n.parentNode = el;
      n.parentElement = el;
      return [n];
    },
    closest() { return el; },
    matches() { return false; },
    contains() { return false; },
    getContext() {
      return {
        canvas: el,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        globalAlpha: 1,
        font: "12px sans-serif",
        textAlign: "left",
        textBaseline: "alphabetic",
        shadowColor: "",
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        globalCompositeOperation: "source-over",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
        save() {},
        restore() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        rect() {},
        fillRect() {},
        strokeRect() {},
        clearRect() {},
        fill() {},
        stroke() {},
        clip() {},
        fillText() {},
        strokeText() {},
        measureText() { return { width: 10 }; },
        drawImage() {},
        createLinearGradient() {
          return { addColorStop() {} };
        },
        createRadialGradient() {
          return { addColorStop() {} };
        },
        createPattern() { return {}; },
        createConicGradient() { return { addColorStop() {} }; },
        createImageData(w, h) {
          const width = w || 1;
          const height = h || 1;
          return { width, height, data: new Uint8ClampedArray(width * height * 4) };
        },
        getImageData(x, y, w, h) {
          return this.createImageData(w, h);
        },
        putImageData() {},
        translate() {},
        rotate() {},
        scale() {},
        setTransform() {},
        transform() {},
        quadraticCurveTo() {},
        bezierCurveTo() {},
        ellipse() {},
        setLineDash() {},
        getLineDash() { return []; },
      };
    },
    getContextAttributes() { return {}; },
    toDataURL() { return "data:image/png;base64,"; },
  };
  return el;
}

function makeSandbox() {
  const sandboxState = {
    id: 1,
    queue: [],
    schedule(cb) {
      const id = this.id++;
      this.queue.push({ id, cb });
      return id;
    },
    flush(n) {
      let i = 0;
      while (this.queue.length && i++ < n) {
        const job = this.queue.shift();
        try {
          job.cb();
        } catch (e) { /* animation tick */ }
      }
      this.queue.length = 0;
    },
  };
  const body = fakeEl("body");
  const head = fakeEl("head");
  const docEl = fakeEl("html");
  const canvasProto = { getContext: fakeEl("canvas").getContext };
  const document = {
    readyState: "complete",
    documentElement: docEl,
    body,
    head,
    title: "",
    hidden: false,
    visibilityState: "visible",
    currentScript: null,
    activeElement: body,
    location: { href: "file:///page.html", protocol: "file:", pathname: "/page.html", search: "", hash: "" },
    cookie: "",
    createElement(tag) { return fakeEl(tag); },
    createElementNS() { return fakeEl("svg"); },
    createTextNode(t) { return { nodeType: 3, textContent: t, data: t }; },
    createDocumentFragment() { return fakeEl("fragment"); },
    getElementById() { return fakeEl("div"); },
    getElementsByClassName() { return [fakeEl("div")]; },
    getElementsByTagName() { return [fakeEl("div")]; },
    getElementsByName() { return [fakeEl("input")]; },
    querySelector() { return fakeEl("div"); },
    querySelectorAll() { return [fakeEl("div")]; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    hasFocus() { return true; },
    fonts: { ready: Promise.resolve(), load() { return Promise.resolve(); } },
  };
  const storage = {
    _d: Object.create(null),
    getItem(k) { return k in this._d ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
    clear() { this._d = Object.create(null); },
  };
  const window = {
    window: null,
    document,
    navigator: { userAgent: "check", maxTouchPoints: 0, hardwareConcurrency: 4 },
    location: document.location,
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    console,
    localStorage: storage,
    sessionStorage: storage,
    matchMedia() {
      return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
    },
    requestAnimationFrame(cb) { return sandboxState.schedule(() => cb(Date.now())); },
    cancelAnimationFrame() {},
    setTimeout(cb) { return sandboxState.schedule(() => { if (typeof cb === "function") cb(); }); },
    clearTimeout() {},
    setInterval(cb) { return sandboxState.schedule(() => { if (typeof cb === "function") cb(); }); },
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    getComputedStyle() {
      return { getPropertyValue() { return ""; } };
    },
    ResizeObserver: function ResizeObserver() { this.observe = function () {}; this.unobserve = function () {}; this.disconnect = function () {}; },
    IntersectionObserver: function IntersectionObserver(cb) {
      this.observe = function (target) {
        try {
          if (typeof cb === "function") {
            cb([{ isIntersecting: false, target: target || fakeEl("div"), intersectionRatio: 0 }], this);
          }
        } catch (e) { /* observer */ }
      };
      this.unobserve = function () {};
      this.disconnect = function () {};
    },
    MutationObserver: function MutationObserver() { this.observe = function () {}; this.disconnect = function () {}; },
    performance: { now() { return Date.now(); } },
    URL,
    Image: function Image() { this.onload = null; this.src = ""; this.width = 1; this.height = 1; },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    HTMLCanvasElement: function HTMLCanvasElement() { return fakeEl("canvas"); },
    Path2D: function Path2D() { this.addPath = function () {}; },
    PointerEvent: function PointerEvent() {},
    CustomEvent: function CustomEvent() {},
    Event: function Event() {},
    alert() {},
    confirm() { return false; },
    prompt() { return null; },
    scrollTo() {},
    scroll() {},
    getSelection() { return { removeAllRanges() {}, addRange() {} }; },
    history: { pushState() {}, replaceState() {} },
    crypto: {
      getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() * 256) | 0;
        return arr;
      },
    },
  };
  window.window = window;
  window.self = window;
  window.top = window;
  window.parent = window;
  window.globalThis = window;
  document.defaultView = window;
  const sandbox = {
    window,
    document,
    navigator: window.navigator,
    location: window.location,
    console,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    setInterval: window.setInterval,
    clearInterval: window.clearInterval,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    IntersectionObserver: window.IntersectionObserver,
    ResizeObserver: window.ResizeObserver,
    MutationObserver: window.MutationObserver,
    localStorage: storage,
    sessionStorage: storage,
    matchMedia: window.matchMedia,
    performance: window.performance,
    Image: window.Image,
    Path2D: window.Path2D,
    URL,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Uint8Array,
    Uint8ClampedArray,
    Uint32Array,
    Float32Array,
    Int32Array,
    ArrayBuffer,
    DataView,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    NaN,
    Infinity,
    undefined,
    atob(s) { return Buffer.from(s, "base64").toString("binary"); },
    btoa(s) { return Buffer.from(s, "binary").toString("base64"); },
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  Object.defineProperty(sandbox, "module", { value: undefined, writable: false });
  Object.defineProperty(sandbox, "require", { value: undefined, writable: false });
  Object.defineProperty(sandbox, "exports", { value: undefined, writable: false });
  Object.defineProperty(sandbox, "process", { value: undefined, writable: false });
  Object.defineProperty(sandbox, "__dirname", { value: undefined, writable: false });
  Object.defineProperty(sandbox, "__filename", { value: undefined, writable: false });
  sandbox.__flushTimers = function (n) { sandboxState.flush(n); };
  return sandbox;
}

function syntaxCheck(body, label) {
  const tmp = path.join(SCRATCH, "tmp-script-check.js");
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(tmp, body, "utf8");
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  if (r.status !== 0) {
    return (r.stderr || r.stdout || "syntax error").trim() + " [" + label + "]";
  }
  return null;
}

function loadScript(body, label) {
  const sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox, { name: label });
  try {
    const script = new vm.Script(body, { filename: label });
    script.runInContext(ctx, { timeout: 2500 });
    return null;
  } catch (err) {
    return (err && err.stack) || String(err);
  }
}

function checkIndex(entries, failures, loadLog) {
  const fp = path.join(ROOT, "index.html");
  if (!fs.existsSync(fp)) {
    failures.push("MISSING index.html");
    return;
  }
  const html = fs.readFileSync(fp, "utf8");
  if (!/<!DOCTYPE\s+html/i.test(html)) failures.push("INDEX NOT_HTML");
  if (!/<style[\s>]/i.test(html)) failures.push("INDEX NO_STYLE");
  if (!/id="q"/i.test(html) || !/type="search"/i.test(html)) failures.push("INDEX NO_SEARCH");
  if (!/id="list"/i.test(html)) failures.push("INDEX NO_LIST");
  if (!/id="shownCount"/i.test(html) || !/id="totalCount"/i.test(html)) failures.push("INDEX NO_COUNT");
  if (!/Open demo/i.test(html)) failures.push("INDEX NO_OPEN");
  if (!/Prompt/i.test(html)) failures.push("INDEX NO_PROMPT_UI");
  if (/<script[^>]*type\s*=\s*["']module["']/i.test(html)) failures.push("INDEX MODULE_SCRIPT");
  const ext = findExternalAssets(html);
  if (ext.length) failures.push("INDEX EXTERNAL :: " + ext.slice(0, 3).join(" | "));
  const im = html.match(/var ITEMS = (\[[\s\S]*?\n\]);/);
  if (!im) {
    failures.push("INDEX NO_ITEMS");
    return;
  }
  let catalog;
  try {
    catalog = JSON.parse(im[1]);
  } catch (e) {
    failures.push("INDEX ITEMS_JSON " + e.message);
    return;
  }
  if (!Array.isArray(catalog) || catalog.length !== 100) {
    failures.push("INDEX ITEMS_COUNT " + (catalog && catalog.length));
  } else {
    for (let i = 0; i < entries.length; i++) {
      const want = entries[i];
      const got = catalog[i];
      if (!got || got.file !== want.file) {
        failures.push("INDEX FILE_MISMATCH #" + (i + 1) + " want " + want.file + " got " + (got && got.file));
        break;
      }
      if (!got.title || !want.title.includes(got.title) && !got.title.includes(want.title.replace(/^\d+\.\s*/, ""))) {
        // title from prompt heading should appear
        const heading = want.title.replace(/^\d+\.\s*/, "");
        if (got.title !== heading) {
          failures.push("INDEX TITLE_MISMATCH #" + (i + 1) + " " + got.title);
          break;
        }
      }
      if (!got.prompt || got.prompt.length < 80) {
        failures.push("INDEX SHORT_PROMPT #" + (i + 1));
        break;
      }
    }
  }
  const scripts = extractScripts(html);
  scripts.forEach((sc, i) => {
    const label = "index.html#script" + i;
    const body = sc.body.trim();
    if (!body) return;
    const syn = syntaxCheck(body, label);
    if (syn) failures.push("SYNTAX " + label + " :: " + syn.split("\n")[0]);
    const loadErr = loadScript(body, label);
    if (loadErr) {
      failures.push("LOAD " + label + " :: " + loadErr.split("\n")[0]);
      loadLog.push("FAIL " + label + "\n" + loadErr + "\n");
    } else {
      loadLog.push("OK " + label);
    }
  });
}

function main() {
  const entries = parsePrompt();
  const failures = [];
  const listing = [];
  const loadLog = [];
  let passCount = 0;

  const numbered = fs
    .readdirSync(ROOT)
    .filter((f) => /^\d{3}-.+\.html$/.test(f))
    .sort();

  if (numbered.length !== 100) {
    failures.push("Expected 100 numbered HTML files, found " + numbered.length);
  }

  for (const entry of entries) {
    const fp = path.join(ROOT, entry.file);
    listing.push(entry.file);
    if (!fs.existsSync(fp)) {
      failures.push("MISSING " + entry.file);
      continue;
    }
    const html = fs.readFileSync(fp, "utf8");
    if (!html.trim()) {
      failures.push("EMPTY " + entry.file);
      continue;
    }
    if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
      failures.push("NOT_HTML " + entry.file);
    }
    if (!/<style[\s>]/i.test(html)) {
      failures.push("NO_STYLE " + entry.file);
    }
    if (/<script[^>]*type\s*=\s*["']module["']/i.test(html)) {
      failures.push("MODULE_SCRIPT " + entry.file);
    }
    if (/<script[^>]*type\s*=\s*["']importmap["']/i.test(html)) {
      failures.push("IMPORTMAP " + entry.file);
    }
    const ext = findExternalAssets(html);
    if (ext.length) {
      failures.push("EXTERNAL " + entry.file + " :: " + ext.slice(0, 3).join(" | "));
    }
    const tokens = identityTokens(entry);
    const found = tokens.filter((t) => containsToken(html, t));
    const headingTokens = identityTokens({
      title: entry.title,
      body: "",
    });
    const headingHit = headingTokens.some((t) => containsToken(html, t));
    if (!headingHit) {
      failures.push(
        "IDENTITY_TITLE " +
          entry.file +
          " missing heading token from [" +
          headingTokens.join(" | ") +
          "]"
      );
    }
    const need = Math.min(2, tokens.length);
    if (found.length < need) {
      failures.push(
        "IDENTITY " +
          entry.file +
          " matched " +
          found.length +
          "/" +
          tokens.length +
          " tokens; need " +
          need
      );
    }
    const scripts = extractScripts(html);
    scripts.forEach((sc, i) => {
      const label = entry.file + "#script" + i;
      if (/type\s*=\s*["']module["']/i.test(sc.attrs)) {
        failures.push("MODULE_SCRIPT " + label);
        return;
      }
      const body = sc.body.trim();
      if (!body) return;
      if (/\bimport\s+[\w*{]|^\s*import\s*\(|import\.meta|\bexport\s+/.test(body)) {
        failures.push("ESM_IMPORT " + label);
      }
      const syn = syntaxCheck(body, label);
      if (syn) failures.push("SYNTAX " + label + " :: " + syn.split("\n")[0]);
      const loadErr = loadScript(body, label);
      if (loadErr) {
        failures.push("LOAD " + label + " :: " + loadErr.split("\n")[0]);
        loadLog.push("FAIL " + label + "\n" + loadErr + "\n");
      } else {
        loadLog.push("OK " + label);
      }
    });
    if (!failures.some((f) => f.includes(entry.file))) passCount++;
  }

  checkIndex(entries, failures, loadLog);

  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, "html-files.txt"), listing.join("\n") + "\n", "utf8");

  const summary =
    "PASS " +
    passCount +
    "/100 files clean; failures=" +
    failures.length +
    (failures.length ? "\n" + failures.join("\n") : "");
  const okLine = failures.length === 0 ? "PASS 100/100 files clean; failures=0" : summary;

  console.log(okLine);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
  return { okLine, failures, loadLog };
}

if (require.main === module) {
  const result = main();
  if (process.env.GROK_CHECK_LOG) {
    fs.writeFileSync(process.env.GROK_CHECK_LOG, result.okLine + "\n", "utf8");
  }
  if (process.env.GROK_LOAD_LOG) {
    fs.writeFileSync(
      process.env.GROK_LOAD_LOG,
      result.loadLog.join("\n") + "\n" + result.okLine + "\n",
      "utf8"
    );
  }
  process.exit(result.failures.length ? 1 : 0);
}

module.exports = { parsePrompt, identityTokens, main, loadScript, extractScripts, makeSandbox };
