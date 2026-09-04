// tools/build-index.js — reads prompt.md and writes index.html
// Navigation gallery: search, count, viewport-gated iframe previews, prompt panels.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "prompt.md");
const OUT_HTML = path.join(ROOT, "index.html");

const md = fs.readFileSync(SRC, "utf8");

function parseSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const h = /^##\s+(\d+)\.\s*(.+)$/.exec(line);
    if (h) {
      if (cur) sections.push(cur);
      cur = { num: +h[1], title: h[2].trim(), body: [], file: null, txt: null };
      continue;
    }
    if (!cur) continue;
    if (!cur.file) {
      const fm = /^- File:\s*`([^`]+)`/.exec(line);
      if (fm) {
        cur.file = fm[1];
        continue;
      }
    }
    if (!cur.txt) {
      const tm = /^- Prompt file:\s*`([^`]+)`/.exec(line);
      if (tm) {
        cur.txt = tm[1];
        continue;
      }
    }
    cur.body.push(line);
  }
  if (cur) sections.push(cur);
  return sections;
}

const items = parseSections(md);
if (items.length !== 100) {
  console.error("expected 100 sections, found " + items.length);
  process.exit(1);
}
for (const it of items) {
  const raw = it.body.join("\n");
  const cleaned = raw.replace(/^\n+/, "").replace(/\n+---\n?$/, "").replace(/\s+$/, "");
  it.promptText = cleaned;
  if (!it.file) {
    console.error("missing file for #" + it.num);
    process.exit(1);
  }
}

const itemsJson = JSON.stringify(
  items.map((it) => ({
    n: it.num,
    title: it.title,
    file: it.file,
    src: "prompt.md · ## " + String(it.num).padStart(3, "0"),
    prompt: it.promptText,
  })),
  null,
  1
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grok 4.6 — 100 HTML Files</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23111111'/%3E%3Ctext x='8' y='12' text-anchor='middle' font-size='11' fill='%23f4e7d0'%3E100%3C/text%3E%3C/svg%3E">
<style>
  :root {
    --bg:#f6f3ee; --card:#ffffff; --line:#e4ddd2; --line-strong:#cfc4b3;
    --tx:#1c1915; --muted:#625a4e; --dim:#978e80;
    --acc:#c45c26; --acc2:#1a1a1a; --acc3:#2f6b5a;
    --shadow:0 1px 2px rgba(28,20,10,.05), 0 8px 24px -12px rgba(28,20,10,.14);
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { font-family:"Segoe UI", system-ui, -apple-system, sans-serif; background:var(--bg);
         color:var(--tx); min-height:100vh; line-height:1.5; }
  body::before { content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
    background:
      radial-gradient(ellipse 80% 50% at 10% -10%, rgba(196,92,38,.12), transparent 50%),
      radial-gradient(ellipse 60% 40% at 90% 0%, rgba(26,26,26,.06), transparent 45%),
      radial-gradient(ellipse 50% 30% at 50% 100%, rgba(47,107,90,.08), transparent 40%); }
  .wrap { position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:48px 22px 80px; }
  header { margin-bottom:32px; }
  .eyebrow { font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--acc);
             margin-bottom:12px; font-weight:600; }
  h1 { font-size:clamp(28px,5vw,44px); font-weight:800; letter-spacing:-.03em; line-height:1.12; margin-bottom:12px; }
  h1 span { background:linear-gradient(120deg,#c45c26,#1a1a1a,#2f6b5a);
            -webkit-background-clip:text; background-clip:text; color:transparent; }
  .lede { color:var(--muted); font-size:16px; max-width:62ch; }
  .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:26px 0 8px;
             position:sticky; top:0; z-index:10; padding:14px 0;
             background:linear-gradient(180deg, rgba(246,243,238,.96) 65%, rgba(246,243,238,0));
             backdrop-filter:blur(8px); }
  .search { flex:1; min-width:220px; position:relative; }
  .search input { width:100%; background:var(--card); border:1px solid var(--line-strong);
    color:var(--tx); border-radius:10px; padding:12px 14px 12px 40px; font-size:14px;
    outline:none; transition:border-color .2s, box-shadow .2s; }
  .search input::placeholder { color:var(--dim); }
  .search input:focus { border-color:rgba(196,92,38,.5); box-shadow:0 0 0 3px rgba(196,92,38,.12); }
  .search svg { position:absolute; left:13px; top:50%; transform:translateY(-50%);
                width:16px; height:16px; color:var(--dim); pointer-events:none; }
  .count { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--dim);
           white-space:nowrap; font-variant-numeric:tabular-nums; }
  .count b { color:var(--acc); font-weight:600; }
  .list { display:flex; flex-direction:column; gap:16px; margin-top:8px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px;
          overflow:hidden; box-shadow:var(--shadow);
          transition:border-color .2s, box-shadow .2s, transform .15s, background .2s;
          display:flex; flex-direction:column; }
  .card:hover { border-color:#c9c0ae; transform:translateY(-1px);
    box-shadow:0 2px 6px rgba(28,20,10,.06), 0 16px 34px -16px rgba(28,20,10,.20); }
  .thumb { display:block; position:relative; background:#101016; height:clamp(220px,44vw,460px);
           overflow:hidden; cursor:pointer; }
  .thumb .preview-iframe { position:absolute; top:0; left:0;
                  border:0; transform-origin:0 0; transform:scale(var(--zf,0.5));
                  width:calc(100% / var(--zf,0.5)); height:calc(clamp(220px,44vw,460px) / var(--zf,0.5));
                  pointer-events:none; }
  .thumb .open-btn { position:absolute; inset:0; display:grid; place-items:center; z-index:2;
                     opacity:0; transition:opacity .25s; text-decoration:none; }
  .thumb:hover .open-btn { opacity:1; }
  .thumb .open-btn span { background:rgba(20,16,12,.88); color:#fff; font-size:12px; letter-spacing:.14em;
    text-transform:uppercase; font-weight:600; padding:10px 18px; border-radius:999px;
    box-shadow:0 10px 26px rgba(0,0,0,.4); }
  .card-top { display:flex; gap:14px; align-items:flex-start; padding:16px 16px 12px; flex:1; }
  .num { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:12px; color:var(--dim);
         padding-top:2px; font-variant-numeric:tabular-nums; min-width:34px; }
  .title { font-size:15.5px; font-weight:650; letter-spacing:-.01em; line-height:1.28; flex:1; }
  .file-line { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:11px; color:var(--dim);
               margin-top:5px; word-break:break-all; }
  .actions { display:flex; gap:8px; padding:0 16px 14px; flex-wrap:wrap; }
  .btn { border:1px solid var(--line-strong); background:var(--card); color:var(--tx);
         font:inherit; font-size:12px; font-weight:600; letter-spacing:.06em; padding:9px 14px;
         border-radius:9px; cursor:pointer; text-decoration:none; display:inline-flex;
         align-items:center; gap:6px; transition:background .15s, border-color .15s, color .15s; }
  .btn:hover { background:#f1efe9; border-color:#b7ad99; }
  .btn-open { background:#1a1a1a; border-color:#1a1a1a; color:#fff; }
  .btn-open:hover { background:#3a2a22; border-color:#3a2a22; color:#fff; }
  details.prompt-panel[open] > summary span::after { content:" ▾"; }
  .prompt-panel { border-top:1px solid var(--line); padding:12px 16px 14px;
                  background:#f4f1ea; }
  details.prompt-panel > summary { list-style:none; }
  details.prompt-panel > summary::-webkit-details-marker { display:none; }
  details.prompt-panel > summary span::after { content:" ▸"; }
  details.prompt-panel[open] > summary { background:#f3e4d6; border-color:var(--acc); color:var(--acc); }
  details.prompt-panel[open] > summary span::after { content:" ▾"; }
  .prompt-body { margin-top:12px; }
  .prompt-label { font-size:10px; letter-spacing:.22em; text-transform:uppercase;
                  color:var(--acc3); font-weight:600; }
  .prompt-text { font-size:13px; color:#47402f; line-height:1.62; white-space:pre-wrap;
                 margin-top:8px; }
  .file-name { margin-top:10px; font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--dim); }
  .empty { text-align:center; padding:60px 20px; color:var(--muted);
           border:1px dashed var(--line-strong); border-radius:14px;
           background:rgba(255,255,255,.6); display:none; grid-column:1 / -1; }
  footer { margin-top:42px; padding-top:18px; border-top:1px solid var(--line-strong);
           color:var(--dim); font-size:12.5px; display:flex; justify-content:space-between;
           gap:12px; flex-wrap:wrap; }
  footer code{ color:var(--muted); }
  @media (prefers-reduced-motion: reduce){ .card, .btn { transition:none; } }
  .card { content-visibility:auto; contain-intrinsic-size:auto 660px; }
  .preview-ph { position:absolute; inset:0; display:grid; place-items:center;
    background:linear-gradient(135deg,#1a1510,#c45c26 48%,#2f6b5a); }
  .preview-ph span { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:64px;
    font-weight:700; color:rgba(255,255,255,.28); letter-spacing:.05em; }
  .thumb.live .preview-ph { display:none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">Collection · 100 studies</div>
    <h1>Grok 4.6. <span>100 HTML Files</span></h1>
    <p class="lede">One hundred self-contained visual studies — generative art, physics, typography,
      interfaces and scenes — generated with Grok 4.6. Open any piece in a new tab, or expand a
      card to read the original generation prompt.</p>
  </header>

  <div class="toolbar">
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
      <input id="q" type="search" placeholder="Search by title or file name…" autocomplete="off">
    </div>
    <div class="count"><b id="shownCount">0</b> / <span id="totalCount">0</span> files</div>
  </div>

  <div class="list" id="list"></div>
  <div class="empty" id="empty">No matches — try another keyword.</div>

  <footer>
    <span>Built from <code>prompt.md</code> · Grok 4.6</span>
    <span>Prompts are embedded in this page from <code>prompt.md</code></span>
  </footer>
</div>

<script>
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var ITEMS = ${itemsJson};

  var q = document.getElementById("q");
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  var shownEl = document.getElementById("shownCount");
  var totalEl = document.getElementById("totalCount");
  if (!q || !list || !empty || !shownEl || !totalEl) return;
  totalEl.textContent = ITEMS.length;

  var frag = document.createDocumentFragment();
  ITEMS.forEach(function (it) {
    var card = document.createElement("article");
    card.className = "card";
    card.setAttribute("data-title", it.title.toLowerCase());
    card.setAttribute("data-file", it.file.toLowerCase());

    var num = String(it.n).padStart(3, "0");
    var zf = window.innerWidth < 640 ? 0.4 : 0.5;
    var thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.style.setProperty("--zf", zf);
    thumb.setAttribute("data-src", it.file);
    thumb.setAttribute("data-title", "Preview of " + it.file);
    var ph = document.createElement("div");
    ph.className = "preview-ph";
    ph.innerHTML = "<span>" + num + "</span>";
    var ob = document.createElement("a");
    ob.className = "open-btn";
    ob.href = it.file;
    ob.target = "_blank";
    ob.rel = "noopener";
    ob.innerHTML = "<span>Open demo ↗</span>";
    thumb.appendChild(ph); thumb.appendChild(ob);
    var top = document.createElement("div");
    top.className = "card-top";
    top.innerHTML = '<div class="num">' + num + '</div>' +
      '<div class="title">' + it.title.replace(/</g,"&lt;") + '<div class="file-line">' + it.file + '</div></div>';

    var actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = '<a class="btn btn-open" href="' + it.file + '" target="_blank" rel="noopener">Open demo</a>';

    var panel = document.createElement("details");
    panel.className = "prompt-panel";
    panel.id = "prompt-" + num;
    panel.innerHTML = '<summary class="btn btn-prompt"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><span>Prompt</span></summary>' +
      '<div class="prompt-body"><div class="prompt-label">Original prompt</div></div>';
    var pre = document.createElement("div");
    pre.className = "prompt-text";
    pre.textContent = it.prompt;
    var pbody = panel.querySelector(".prompt-body");
    pbody.appendChild(pre);
    pbody.appendChild(Object.assign(document.createElement("div"), { className: "file-name", textContent: it.src }));

    card.appendChild(thumb); card.appendChild(top); card.appendChild(actions); card.appendChild(panel);
    frag.appendChild(card);
  });
  list.appendChild(frag);

  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function mountFrame(thumb) {
    if (RM || thumb.querySelector("iframe")) return;
    var frame = document.createElement("iframe");
    frame.className = "preview-iframe";
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("title", thumb.getAttribute("data-title") || "Preview");
    frame.setAttribute("src", thumb.getAttribute("data-src"));
    frame.addEventListener("error", function () { unmountFrame(thumb); });
    thumb.insertBefore(frame, thumb.firstChild);
    thumb.classList.add("live");
  }
  function unmountFrame(thumb) {
    var f = thumb.querySelector("iframe");
    if (f) f.remove();
    thumb.classList.remove("live");
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) mountFrame(en.target);
        else unmountFrame(en.target);
      });
    }, { rootMargin: "700px 0px" });
    list.querySelectorAll(".thumb").forEach(function (t) { io.observe(t); });
  } else {
    list.querySelectorAll(".thumb").forEach(mountFrame);
  }

  function apply() {
    var term = q.value.trim().toLowerCase(), shown = 0;
    var cards = list.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var hit = !term ||
        c.getAttribute("data-title").indexOf(term) !== -1 ||
        c.getAttribute("data-file").indexOf(term) !== -1 ||
        String(i + 1).padStart(3, "0") === term.replace(/\\D/g, "").padStart(3, "0");
      c.style.display = hit ? "" : "none";
      if (hit) shown++;
    }
    shownEl.textContent = shown;
    empty.style.display = shown ? "none" : "block";
  }
  q.addEventListener("input", apply);
  apply();
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html, "utf8");
console.log("wrote " + OUT_HTML + " (" + (html.length / 1024).toFixed(1) + " kB)");
console.log("items=" + items.length);
