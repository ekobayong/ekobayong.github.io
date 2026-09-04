// tools/build-index.js — reads prompt.md and generates:
//   * index.html  (navigation gallery; prompts embedded inline; previews via lazy iframes)
//   * 100 prompt .txt files next to the html files
// Usage: node tools/build-index.js
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "prompt.md");
const OUT_HTML = path.join(ROOT, "index.html");

const md = fs.readFileSync(SRC, "utf8");

// ---------- parse ----------
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
      if (fm) { cur.file = fm[1]; continue; }
    }
    if (!cur.txt) {
      const tm = /^- Prompt file:\s*`([^`]+)`/.exec(line);
      if (tm) { cur.txt = tm[1]; continue; }
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
  it.bodyText = it.body.join("\n").replace(/^\n/, "").replace(/\s+$/, "") + "\n";
  if (!it.file) { console.error("missing file for #" + it.num); process.exit(1); }
  if (!it.txt) { console.error("missing txt for #" + it.num); process.exit(1); }
}

// ---------- write .txt files ----------
let txtWritten = 0;
for (const it of items) {
  const p = path.join(ROOT, it.txt);
  fs.writeFileSync(p, it.bodyText, "utf8");
  txtWritten++;
}
console.log("wrote " + txtWritten + " prompt .txt files");

// ---------- build index.html ----------
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// items JSON (safe via JSON.stringify; embedded as a JS literal)
const itemsJson = JSON.stringify(
  items.map((it) => ({
    n: it.num,
    title: it.title,
    file: it.file,
    txt: it.txt,
    prompt: it.bodyText
  }))
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fable-5.1 — 100 HTML Files (DeepSeek)</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%236d28d9'/%3E%3Ctext x='8' y='12' text-anchor='middle' font-size='11' fill='%23fff'%3E100%3C/text%3E%3C/svg%3E">
<style>
  :root {
    --bg:#f7f6f2; --card:#ffffff; --line:#e6e1d6; --line-strong:#cfc6b4;
    --tx:#211d17; --muted:#665e50; --dim:#9a917f;
    --acc:#6d28d9; --acc2:#4338ca; --acc3:#0e7a5f;
    --shadow:0 1px 2px rgba(30,20,50,.05), 0 8px 24px -12px rgba(30,20,50,.12);
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { font-family:"Segoe UI", system-ui, -apple-system, sans-serif; background:var(--bg);
         color:var(--tx); min-height:100vh; line-height:1.5; }
  body::before { content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
    background:
      radial-gradient(ellipse 80% 50% at 10% -10%, rgba(109,40,217,.10), transparent 50%),
      radial-gradient(ellipse 60% 40% at 90% 0%, rgba(67,56,202,.08), transparent 45%),
      radial-gradient(ellipse 50% 30% at 50% 100%, rgba(14,122,95,.08), transparent 40%); }
  .wrap { position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:48px 22px 80px; }
  header { margin-bottom:32px; }
  .eyebrow { font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--acc);
             margin-bottom:12px; font-weight:600; }
  h1 { font-size:clamp(28px,5vw,44px); font-weight:800; letter-spacing:-.03em; line-height:1.12; margin-bottom:12px; }
  h1 span { background:linear-gradient(120deg,#7c3aed,#4f46e5,#0d9488);
            -webkit-background-clip:text; background-clip:text; color:transparent; }
  .lede { color:var(--muted); font-size:16px; max-width:62ch; }
  .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin:26px 0 8px;
             position:sticky; top:0; z-index:10; padding:14px 0;
             background:linear-gradient(180deg, rgba(247,246,242,.96) 65%, rgba(247,246,242,0));
             backdrop-filter:blur(8px); }
  .search { flex:1; min-width:220px; position:relative; }
  .search input { width:100%; background:var(--card); border:1px solid var(--line-strong);
    color:var(--tx); border-radius:10px; padding:12px 14px 12px 40px; font-size:14px;
    outline:none; transition:border-color .2s, box-shadow .2s; }
  .search input::placeholder { color:var(--dim); }
  .search input:focus { border-color:rgba(109,40,217,.5); box-shadow:0 0 0 3px rgba(109,40,217,.12); }
  .search svg { position:absolute; left:13px; top:50%; transform:translateY(-50%);
                width:16px; height:16px; color:var(--dim); pointer-events:none; }
  .count { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--dim);
           white-space:nowrap; font-variant-numeric:tabular-nums; }
  .count b { color:var(--acc); font-weight:600; }
  .list { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; margin-top:8px; }
  @media (max-width:640px){ .list{ grid-template-columns:1fr; } }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px;
          overflow:hidden; box-shadow:var(--shadow);
          transition:border-color .2s, box-shadow .2s, transform .15s, background .2s;
          display:flex; flex-direction:column; }
  .card:hover { border-color:#c9c0ae; transform:translateY(-1px);
    box-shadow:0 2px 6px rgba(30,20,50,.06), 0 16px 34px -16px rgba(30,20,50,.20); }
  .thumb { display:block; position:relative; background:#101016; height:212px; overflow:hidden; }
  .thumb iframe { position:absolute; top:0; left:0; width:100%; height:100%;
                  border:0; transform-origin:0 0; transform:scale(var(--zf,0.44));
                  width:calc(100% / var(--zf,0.44)); height:calc(212px / var(--zf,0.44));
                  pointer-events:none; }
  .thumb .open-btn { position:absolute; inset:0; display:grid; place-items:center; z-index:2;
                     opacity:0; transition:opacity .25s; text-decoration:none; }
  .thumb:hover .open-btn { opacity:1; }
  .thumb .open-btn span { background:rgba(20,16,32,.85); color:#fff; font-size:12px; letter-spacing:.14em;
    text-transform:uppercase; font-weight:600; padding:10px 18px; border-radius:999px;
    box-shadow:0 10px 26px rgba(0,0,0,.4); }
  .card-top { display:flex; gap:14px; align-items:flex-start; padding:16px 16px 12px; flex:1; }
  .num { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:12px; color:var(--dim);
         padding-top:2px; font-variant-numeric:tabular-nums; min-width:34px; }
  .title { font-size:15.5px; font-weight:650; letter-spacing:-.01em; line-height:1.28; flex:1; }
  .file-line { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:11px; color:var(--dim);
               margin-top:5px; word-break:break-all; }
  .actions { display:flex; gap:8px; padding:0 16px 14px; }
  .btn { border:1px solid var(--line-strong); background:var(--card); color:var(--tx);
         font:inherit; font-size:12px; font-weight:600; letter-spacing:.06em; padding:9px 14px;
         border-radius:9px; cursor:pointer; text-decoration:none; display:inline-flex;
         align-items:center; gap:6px; transition:background .15s, border-color .15s, color .15s; }
  .btn:hover { background:#f1efe9; border-color:#b7ad99; }
  .btn-open { background:#191524; border-color:#191524; color:#fff; }
  .btn-open:hover { background:#2b2140; border-color:#2b2140; color:#fff; }
  .btn-prompt[aria-expanded="true"] { background:#e9e0ff; border-color:var(--acc); color:var(--acc); }
  .prompt-panel { display:none; border-top:1px solid var(--line); padding:14px 16px 16px;
                  background:#f4f1ea; }
  .card.open .prompt-panel { display:block; }
  .prompt-label { font-size:10px; letter-spacing:.22em; text-transform:uppercase;
                  color:var(--acc3); font-weight:600; }
  .prompt-text { font-size:13px; color:#47402f; line-height:1.62; white-space:pre-wrap;
                 margin-top:8px; max-height:210px; overflow:hidden; position:relative; }
  .prompt-text.cut::after { content:""; position:absolute; left:0; right:0; bottom:0; height:46px;
    background:linear-gradient(180deg, transparent, #f4f1ea); pointer-events:none; }
  .card.open .prompt-text { max-height:none; }
  .card.open .prompt-text.cut::after { display:none; }
  .file-name { margin-top:10px; font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--dim); }
  .empty { text-align:center; padding:60px 20px; color:var(--muted);
           border:1px dashed var(--line-strong); border-radius:14px;
           background:rgba(255,255,255,.6); display:none; grid-column:1 / -1; }
  footer { margin-top:42px; padding-top:18px; border-top:1px solid var(--line-strong);
           color:var(--dim); font-size:12.5px; display:flex; justify-content:space-between;
           gap:12px; flex-wrap:wrap; }
  footer code{ color:var(--muted); }
  @media (prefers-reduced-motion: reduce){ .card, .btn { transition:none; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">DeepSeek V4 · Flash</div>
    <h1>Fable 5.1 — <span>100 HTML Files</span></h1>
    <p class="lede">Seratus halaman mandiri: satu proyek per prompt, tanpa library eksternal —
      semua di-generate di browser. Klik <b>Open</b> untuk membuka demo di tab baru, atau gunakan
      tombol <b>Prompt</b> untuk menampilkan/menyembunyikan prompt asli.</p>
  </header>

  <div class="toolbar">
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
      <input id="q" type="search" placeholder="Cari berdasarkan judul atau nama file…" autocomplete="off">
    </div>
    <div class="count"><b id="shownCount">0</b> / <span id="totalCount">0</span> files</div>
  </div>

  <div class="list" id="list"></div>
  <div class="empty" id="empty">Tidak ada yang cocok — coba kata kunci lain.</div>

  <footer>
    <span>Generated dari <code>prompt.md</code> oleh <code>tools/build-index.js</code></span>
    <span>Prompt lengkap juga tersedia sebagai file <code>NNN-….txt</code> terpisah</span>
  </footer>
</div>

<script>
(function () {
  "use strict";
  var ITEMS = ${itemsJson};

  var q = document.getElementById("q");
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  var shownEl = document.getElementById("shownCount");
  var totalEl = document.getElementById("totalCount");
  totalEl.textContent = ITEMS.length;

  // lazy: build DOM for all cards, but let iframes load on scroll via loading=lazy
  var frag = document.createDocumentFragment();
  ITEMS.forEach(function (it) {
    var card = document.createElement("article");
    card.className = "card";
    card.setAttribute("data-title", it.title.toLowerCase());
    card.setAttribute("data-file", it.file.toLowerCase());

    var zf = window.innerWidth < 560 ? 0.36 : 0.5;
    var thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.style.setProperty("--zf", zf);
    var frame = document.createElement("iframe");
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("title", it.file);
    frame.setAttribute("src", it.file);
    var ob = document.createElement("a");
    ob.className = "open-btn";
    ob.href = it.file;
    ob.target = "_blank";
    ob.rel = "noopener";
    ob.innerHTML = "<span>Open demo ↗</span>";
    thumb.appendChild(frame); thumb.appendChild(ob);

    var top = document.createElement("div");
    top.className = "card-top";
    top.innerHTML = '<div class="num">' + String(it.n).padStart(3,"0") + '</div>' +
      '<div class="title">' + it.title.replace(/</g,"&lt;") + '<div class="file-line">' + it.file + '</div></div>';

    var actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = '<a class="btn btn-open" href="' + it.file + '" target="_blank" rel="noopener">Open</a>' +
      '<button class="btn btn-prompt" type="button" aria-expanded="false">Prompt</button>';

    var panel = document.createElement("div");
    panel.className = "prompt-panel";
    var pre = document.createElement("div");
    pre.className = "prompt-text cut";
    pre.textContent = it.prompt;
    panel.innerHTML = '<div class="prompt-label">Original prompt</div>';
    panel.appendChild(pre);
    panel.appendChild(Object.assign(document.createElement("div"), { className: "file-name", textContent: it.txt }));

    card.appendChild(thumb); card.appendChild(top); card.appendChild(actions); card.appendChild(panel);
    frag.appendChild(card);
  });
  list.appendChild(frag);

  list.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".btn-prompt");
    if (!btn) return;
    var open = btn.closest(".card").classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      var t = btn.closest(".card").querySelector(".prompt-text");
      if (t) t.classList.remove("cut");
    }
  });

  function apply() {
    var term = q.value.trim().toLowerCase(), shown = 0;
    var cards = list.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var hit = !term ||
        c.getAttribute("data-title").indexOf(term) !== -1 ||
        c.getAttribute("data-file").indexOf(term) !== -1 ||
        String(i + 1).padStart(3, "0") === term.replace(/\D/g, "").padStart(3, "0");
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
</html>`;

fs.writeFileSync(OUT_HTML, html, "utf8");
console.log("wrote " + OUT_HTML + " (" + (html.length / 1024).toFixed(1) + " kB)");