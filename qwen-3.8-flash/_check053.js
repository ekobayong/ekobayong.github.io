
'use strict';
/* ============================================================
   Shared compute kernel — runs inside Workers AND, via
   new Function, on the main thread as an automatic fallback.
   ============================================================ */
var KERNEL = String.raw`
var PAL_DEF = {
  Ultra: [[0x00,0x07,0x64],[0x20,0x6b,0xcb],[0xed,0xff,0xff],[0xff,0xaa,0x00],[0x00,0x02,0x00]],
  Ember: [[0x0a,0x04,0x02],[0x5a,0x0c,0x06],[0xc8,0x3c,0x0a],[0xff,0xaa,0x28],[0xff,0xf0,0xc8],[0x3c,0x0a,0x14]],
  Ice:   [[0x02,0x06,0x14],[0x0a,0x28,0x6e],[0x3c,0x8c,0xdc],[0xc8,0xf0,0xff],[0xff,0xff,0xff],[0x1e,0x14,0x46]],
  Mono:  [[0x08,0x08,0x0a],[0xf0,0xee,0xe8],[0x08,0x08,0x0a]]
};
var PAL_CACHE = {};
function smoothstep(t){ return t * t * (3 - 2 * t); }
function getPalette(name){
  var cached = PAL_CACHE[name];
  if (cached) return cached;
  var cp = PAL_DEF[name] || PAL_DEF.Ultra, m = cp.length, n = 2048;
  var pal = new Uint8Array(n * 4);
  for (var i = 0; i < n; i++){
    var t = i / (n - 1) * (m - 1);
    var a = Math.floor(t); if (a > m - 2) a = m - 2; if (a < 0) a = 0;
    var b = a + 1, f = smoothstep(t - a);
    pal[i*4]     = cp[a][0] + (cp[b][0] - cp[a][0]) * f;
    pal[i*4 + 1] = cp[a][1] + (cp[b][1] - cp[a][1]) * f;
    pal[i*4 + 2] = cp[a][2] + (cp[b][2] - cp[a][2]) * f;
    pal[i*4 + 3] = 255;
  }
  PAL_CACHE[name] = pal;
  return pal;
}
function computeBand(m){
  var w = m.w, h = m.h, step = m.step,
      y0 = m.y0, y1 = m.y1,
      cx = m.cx, cy = m.cy, span = m.span,
      maxIter = m.maxIter,
      pal = getPalette(m.palette),
      gw = Math.ceil(w / step),
      gh = y1 - y0,
      buf = new Uint8ClampedArray(gw * gh * 4),
      scale = span / w,
      LOG2 = 1.4426950408889634,
      o = 0;
  for (var gy = y0; gy < y1; gy++){
    var ci = cy - ((gy + 0.5) * step - h / 2) * scale;
    var cardQ = ci * ci * 0.25;
    for (var gx = 0; gx < gw; gx++){
      var cr = cx + ((gx + 0.5) * step - w / 2) * scale;
      o = ((gy - y0) * gw + gx) * 4;
      buf[o + 3] = 255;
      /* interior fast-outs: main cardioid, then period-2 bulb */
      var x = cr - 0.25, q = x * x + ci * ci;
      if (q * (q + x) <= cardQ) continue;                 /* inside cardioid */
      var u = cr + 1;
      if (u * u + ci * ci <= 0.00390625) continue;        /* (cr+1)^2+ci^2 <= (1/16)^2 */
      /* iterate: bailout radius 256 -> |z|^2 > 65536 */
      var zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
      while (zr2 + zi2 <= 65536 && n < maxIter){
        zi = 2 * zr * zi + ci;
        zr = zr2 - zi2 + cr;
        zr2 = zr * zr;
        zi2 = zi * zi;
        n++;
      }
      if (n >= maxIter) continue;                          /* interior points are black */
      var lm = 0.5 * Math.log(zr2 + zi2);                  /* ln|z|, always > 0 past bailout */
      var nu = n + 1 - Math.log(lm) * LOG2;                /* smoothed escape time */
      if (nu < 0) nu = 0;
      var idx = ((Math.sqrt(nu) * 96 + 240) % 2048) | 0;
      idx *= 4;
      buf[o]     = pal[idx];
      buf[o + 1] = pal[idx + 1];
      buf[o + 2] = pal[idx + 2];
    }
  }
  return { buf: buf, gw: gw, gh: gh, gy0: y0 };
}
`;

var WORKER_TAIL = String.raw`
self.onmessage = function (e) {
  var m = e.data;
  var r = computeBand(m);
  self.postMessage({ id: m.id, tag: m.tag, step: m.step, gy0: r.gy0, gw: r.gw, gh: r.gh, buf: r.buf }, [r.buf.buffer]);
};
`;

/* ============================================================ */
(function () {
  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  var prog = document.getElementById('prog');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BOOKMARKS = [
    { name: 'Overview',        cx: -0.75,       cy: 0,        span: 3.4 },
    { name: 'Seahorse Valley', cx: -0.7435669,  cy: 0.1314023, span: 0.0022 },
    { name: 'Elephant Valley', cx: 0.2749,      cy: 0.00655,   span: 0.012 },
    { name: 'Triple Spiral',   cx: -0.088,      cy: 0.654,     span: 0.012 },
    { name: 'Spiral',          cx: -0.16070135, cy: 1.0375665, span: 0.0012 },
    { name: 'Mini-brot',       cx: -1.7548776,  cy: 0,         span: 0.028 }
  ];
  var PALETTE_NAMES = ['Ultra', 'Ember', 'Ice', 'Mono'];
  var PALETTE_CSS = {
    Ultra: 'linear-gradient(90deg,#000764,#206bcb,#edffff,#ffaa00,#000200)',
    Ember: 'linear-gradient(90deg,#0a0402,#5a0c06,#c83c0a,#ffaa28,#fff0c8,#3c0a14)',
    Ice:   'linear-gradient(90deg,#020614,#0a286e,#3c8cdc,#c8f0ff,#fff,#1e1446)',
    Mono:  'linear-gradient(90deg,#08080a,#f0eee8,#08080a)'
  };
  var FACTORS = [0.5, 1, 2, 4, 8];

  var view = { cx: -0.75, cy: 0, span: 3.4 };
  var palette = 'Ultra';
  var factorIdx = 1;
  var W = 0, H = 0, dpr = 1;

  function itersFor(span, factor) {
    var depth = Math.max(0, Math.log2(3.4 / span));
    return Math.min(12000, Math.round((120 + 90 * Math.pow(depth, 1.15)) * factor));
  }

  /* ---------- thread pool: inline Blob workers, new-Function fallback ---------- */
  var N = Math.max(2, Math.min(8, navigator.hardwareConcurrency || 4));
  var workers = [], busy = [], useWorkers = false, fallbackFn = null, fbRunning = false;
  try {
    if (typeof Worker !== 'undefined') {
      var url = URL.createObjectURL(new Blob([KERNEL + WORKER_TAIL], { type: 'text/javascript' }));
      for (var i = 0; i < N; i++) {
        var wk = new Worker(url);
        (function (idx) {
          wk.onmessage = function (e) { busy[idx] = false; onBand(e.data); pump(); };
          wk.onerror = function () { degrade(); };
        })(i);
        workers.push(wk);
        busy.push(false);
      }
      useWorkers = true;
    }
  } catch (e) { useWorkers = false; }
  if (!useWorkers) fallbackFn = new Function('m', KERNEL + '\nreturn computeBand(m);');

  function degrade() {
    if (!useWorkers) return;
    useWorkers = false;
    for (var i = 0; i < workers.length; i++) { try { workers[i].terminate(); } catch (e) {} }
    workers = []; busy = [];
    fallbackFn = new Function('m', KERNEL + '\nreturn computeBand(m);');
    N = 1;
    document.getElementById('h-threads').textContent = '1 (main)';
    if (pending.length) runFallback();
  }

  /* ---------- render queue ---------- */
  var PASSES = [8, 4, 2, 1];
  var pending = [];          // FIFO of main-frame {msg, tag}
  var thumbQ = [];           // lower-priority thumbnail bands, survives render cancellation
  var renderId = 0;
  var mainTotal = 0, mainDone = 0, t0 = 0;
  var tmpCanvas = document.createElement('canvas');
  var tmpCtx = tmpCanvas.getContext('2d');

  function bandsOf(spanRows, parts) {
    var out = [], per = spanRows / parts;
    for (var k = 0; k < parts; k++) {
      var a = Math.round(per * k), b = Math.round(per * (k + 1));
      if (b > a) out.push([a, b]);
    }
    return out;
  }

  function startRender() {
    renderId++;
    pending = [];
    mainTotal = 0; mainDone = 0; t0 = performance.now();
    prog.style.opacity = '1';
    prog.style.width = '0%';
    var maxIter = itersFor(view.span, FACTORS[factorIdx]);
    document.getElementById('h-iter').textContent = maxIter.toLocaleString('en-US');
    for (var p = 0; p < PASSES.length; p++) {
      var step = PASSES[p];
      var G = Math.ceil(H / step);
      var parts = (step === 1) ? N * 4 : N;
      var bands = bandsOf(G, parts);
      for (var b = 0; b < bands.length; b++) {
        mainTotal++;
        pending.push({
          msg: { id: renderId, tag: { t: 'm' }, w: W, h: H, step: step, y0: bands[b][0], y1: bands[b][1],
                 cx: view.cx, cy: view.cy, span: view.span, maxIter: maxIter, palette: palette },
          tag: { t: 'm' }
        });
      }
    }
    pump();
  }

  function queueThumb(idx, cx, cy, span, palName) {
    var tw = 224, th = 144;
    var bands = bandsOf(th, Math.min(4, useWorkers ? N : 1));
    var maxIter = itersFor(span, 1);
    for (var b = 0; b < bands.length; b++) {
      thumbQ.push({
        msg: { id: 0, tag: { t: 'b', i: idx }, w: tw, h: th, step: 1, y0: bands[b][0], y1: bands[b][1],
               cx: cx, cy: cy, span: span, maxIter: maxIter, palette: palName },
        tag: { t: 'b', i: idx }
      });
    }
  }

  function nextTask() {
    return pending.length ? pending.shift() : (thumbQ.length ? thumbQ.shift() : null);
  }
  function anyQueued() { return pending.length > 0 || thumbQ.length > 0; }
  function pump() {
    if (!anyQueued()) return;
    if (useWorkers) {
      var t;
      for (var i = 0; i < workers.length; i++) {
        if (!busy[i]) {
          t = nextTask();
          if (!t) return;
          busy[i] = true;
          workers[i].postMessage(t.msg);
        }
      }
    } else if (!fbRunning) {
      runFallback();
    }
  }
  function cancelRender() {           // a gesture in flight drops queued main bands; stale results are discarded by id
    renderId++;
    pending = [];
  }

  function runFallback() {
    fbRunning = true;
    var sliceStart = performance.now();
    function stepFn() {
      while (anyQueued() && performance.now() - sliceStart < 12) {
        var task = nextTask();
        if (!task) break;
        var r = fallbackFn(task.msg);
        onBand({ id: task.msg.id, tag: task.msg.tag, step: task.msg.step,
                 gy0: r.gy0, gw: r.gw, gh: r.gh, buf: r.buf });
      }
      if (anyQueued()) {
        sliceStart = performance.now();
        setTimeout(stepFn, 0);
      } else {
        fbRunning = false;
      }
    }
    setTimeout(stepFn, 0);
  }

  function onBand(d) {
    var tag = d.tag;
    if (tag && tag.t === 'b') {
      var tc = thumbCanvases[tag.i];
      if (!tc) return;
      var tctx = tc.getContext('2d');
      tctx.putImageData(new ImageData(d.buf, d.gw, d.gh), 0, d.gy0);
      return;
    }
    if (d.id !== renderId) return;      // stale band from a cancelled render — discard
    tmpCanvas.width = d.gw; tmpCanvas.height = d.gh;
    tmpCtx.putImageData(new ImageData(d.buf, d.gw, d.gh), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmpCanvas, 0, 0, d.gw, d.gh, 0, d.gy0 * d.step, d.gw * d.step, d.gh * d.step);
    mainDone++;
    prog.style.width = (mainDone / mainTotal * 100).toFixed(1) + '%';
    if (mainDone >= mainTotal && mainTotal > 0) {
      var ms = performance.now() - t0;
      document.getElementById('h-time').textContent =
        (ms < 1000 ? Math.round(ms) : Math.round(ms / 100) / 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
        (ms < 1000 ? ' ms' : ' s');
      prog.style.opacity = '0';
    } else if (!pending.length && mainTotal === 0) {
      prog.style.opacity = '0';
    }
  }

  /* ---------- sizing ---------- */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(2, Math.round(innerWidth * dpr));
    H = Math.max(2, Math.round(innerHeight * dpr));
    canvas.width = W; canvas.height = H;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    startRender();
  }
  var resizeTimer = null;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 160);
  });

  /* ---------- HUD ---------- */
  function fmtZoom() {
    var z = 3.4 / view.span;
    if (z < 1000) return '×' + (z >= 10 ? z.toFixed(1) : z.toFixed(z >= 1 ? 2 : 3)).replace(/0+$/, '').replace(/\.$/, '.0');
    var e = Math.floor(Math.log10(z));
    return '×' + (z / Math.pow(10, e)).toFixed(2) + 'e' + e;
  }
  function updateHUD(reEl, imEl) {
    var dec = view.span < 1e-9 ? 16 : 12;
    document.getElementById('h-re').textContent = (reEl !== undefined ? reEl : view.cx).toFixed(dec);
    document.getElementById('h-im').textContent = (imEl !== undefined ? imEl : view.cy).toFixed(dec);
    document.getElementById('h-zoom').textContent = fmtZoom();
  }
  function complexAt(px, py) { // px,py in CSS px
    var x = px * dpr, y = py * dpr;
    return {
      re: view.cx + (x - W / 2) * view.span / W,
      im: view.cy - (y - H / 2) * view.span / W
    };
  }
  function markGesture() {
    document.getElementById('hint').classList.add('faded');
    activeBk = -1; syncBk();
  }
  var activeBk = 0;
  function syncBk() {
    var els = document.querySelectorAll('.bk');
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('active', i === activeBk);
  }

  /* ---------- bitmap snapshot + animated blits ---------- */
  var snapCanvas = document.createElement('canvas');
  function takeSnapshot() {
    snapCanvas.width = W; snapCanvas.height = H;
    snapCanvas.getContext('2d').drawImage(canvas, 0, 0);
  }
  function blitScaled(k, ax, ay) { // draw snapshot scaled ×k anchored at (ax, ay) device px
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(k, 0, 0, k, ax * (1 - k), ay * (1 - k));
    ctx.imageSmoothingEnabled = k < 1.6;
    ctx.drawImage(snapCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function blitOffset(dx, dy) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(dx, dy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(snapCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  var animId = 0;
  function animateZoomTo(ax, ay, k, done) {
    if (reduced) { done(); return; }
    var myAnim = ++animId, start = performance.now(), DUR = 300;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    (function loop(now) {
      if (myAnim !== animId) return;
      var t = Math.min(1, (now - start) / DUR);
      blitScaled(1 + (k - 1) * ease(t), ax, ay);
      if (t < 1) requestAnimationFrame(loop); else done();
    })(start);
  }

  function zoomAt(px, py, f) { // zoom by factor f about a CSS-px point, keeping that point fixed
    var c = complexAt(px, py);
    view.span = Math.min(8, Math.max(1e-13, view.span / f));
    var scale = view.span / W;               // complex units per device px
    view.cx = c.re - (px * dpr - W / 2) * scale;
    view.cy = c.im + (py * dpr - H / 2) * scale;
  }

  /* ---------- pointer gestures ---------- */
  var drag = null;
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.button !== 2) return;
    markGesture();
    if (e.button === 2) { zoomOutAt(e.clientX, e.clientY); return; }
    drag = { x0: e.clientX, y0: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    animId++; // stop any running zoom animation
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!drag) {
      var p = complexAt(e.clientX, e.clientY);
      updateHUD(p.re, p.im);
      return;
    }
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
      cancelRender();
      takeSnapshot();
    }
    if (drag.moved) blitOffset(dx * dpr, dy * dpr);
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved) {
      if (e.shiftKey) { zoomOutAt(e.clientX, e.clientY); return; }
      var f = 2.5;
      var ax = e.clientX * dpr, ay = e.clientY * dpr;
      takeSnapshot();
      zoomAt(e.clientX, e.clientY, f);
      updateHUD();
      animateZoomTo(ax, ay, f, function () { startRender(); });
      return;
    }
    /* the dragged snapshot is offset by (dx, dy) CSS px; slide the model the other way */
    var s = view.span / (W / dpr); // complex units per CSS px
    view.cx -= (e.clientX - d.x0) * s;
    view.cy += (e.clientY - d.y0) * s;
    updateHUD();
    startRender();
  });
  canvas.addEventListener('pointercancel', function () { drag = null; startRender(); });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    markGesture();
    animId++;
    var f = Math.exp(-e.deltaY * 0.0018);
    if (e.ctrlKey) f = Math.exp(-e.deltaY * 0.01); // pinch-zoom on trackpads
    var oldSpan = view.span;
    zoomAt(e.clientX, e.clientY, f);
    takeSnapshot();
    blitScaled(view.span === oldSpan ? 1 : oldSpan / view.span, e.clientX * dpr, e.clientY * dpr);
    updateHUD();
    startRender();
  }, { passive: false });

  function zoomOutAt(px, py) {
    markGesture(); animId++;
    var ax = px * dpr, ay = py * dpr;
    takeSnapshot();
    zoomAt(px, py, 1 / 2.5);
    updateHUD();
    animateZoomTo(ax, ay, 1 / 2.5, function () { startRender(); });
  }

  /* ---------- keyboard ---------- */
  addEventListener('keydown', function (e) {
    if (e.target !== document.body && e.target.tagName === 'INPUT') return;
    var k = e.key;
    if (k === 'r' || k === 'R') { goBookmark(0, true); }
    else if (k === '+' || k === '=') { bumpIter(1); }
    else if (k === '-' || k === '_') { bumpIter(-1); }
    else if (k === 'Escape') { zoomOutAt(innerWidth / 2, innerHeight / 2); }
    else if (k >= '1' && k <= '4') { setPalette(PALETTE_NAMES[+k - 1]); }
  });

  /* ---------- dock: bookmarks ---------- */
  var thumbCanvases = [];
  var bkWrap = document.getElementById('bookmarks');
  BOOKMARKS.forEach(function (b, i) {
    var btn = document.createElement('button');
    btn.className = 'bk';
    btn.title = b.name + ' — re ' + b.cx + ', im ' + b.cy + ', span ' + b.span;
    var cv = document.createElement('canvas');
    cv.width = 224; cv.height = 144;
    thumbCanvases.push(cv);
    var lbl = document.createElement('span');
    lbl.className = 'name';
    lbl.innerHTML = '<b></b>';
    lbl.firstChild.textContent = b.name;
    btn.appendChild(cv); btn.appendChild(lbl);
    btn.addEventListener('click', function () { goBookmark(i); });
    bkWrap.appendChild(btn);
  });

  function goBookmark(i, silent) {
    var b = BOOKMARKS[i];
    view.cx = b.cx; view.cy = b.cy; view.span = b.span;
    activeBk = i; syncBk();
    if (!silent) document.getElementById('hint').classList.add('faded');
    animId++;
    updateHUD();
    startRender();
  }

  /* ---------- palette segmented control ---------- */
  var seg = document.getElementById('palettes');
  PALETTE_NAMES.forEach(function (name) {
    var b = document.createElement('button');
    b.title = name + ' palette';
    b.dataset.pal = name;
    var sw = document.createElement('i');
    sw.style.background = PALETTE_CSS[name];
    b.appendChild(sw);
    b.addEventListener('click', function () { setPalette(name); });
    seg.appendChild(b);
  });
  function setPalette(name) {
    if (PALETTE_NAMES.indexOf(name) < 0) return;
    palette = name;
    seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b.dataset.pal === name); });
    // re-render thumbnails in the new palette
    BOOKMARKS.forEach(function (bk, i) { queueThumb(i, bk.cx, bk.cy, bk.span, name); });
    startRender();
  }

  /* ---------- iteration stepper ---------- */
  function bumpIter(dir) {
    factorIdx = Math.max(0, Math.min(FACTORS.length - 1, factorIdx + dir));
    document.getElementById('iterval').textContent = '×' + FACTORS[factorIdx];
    startRender();
  }
  document.getElementById('it-minus').addEventListener('click', function () { bumpIter(-1); });
  document.getElementById('it-plus').addEventListener('click', function () { bumpIter(1); });
  document.getElementById('b-zoomout').addEventListener('click', function () { zoomOutAt(innerWidth / 2, innerHeight / 2); });
  document.getElementById('b-reset').addEventListener('click', function () { goBookmark(0); });

  /* ---------- cardioid brand mark ---------- */
  (function drawMark() {
    var svg = document.getElementById('mark');
    var pts = [];
    for (var i = 0; i <= 64; i++) {
      var t = i / 64 * Math.PI * 2;
      var x = 0.5 * Math.cos(t) - 0.25 * Math.cos(2 * t);
      var y = 0.5 * Math.sin(t) - 0.25 * Math.sin(2 * t);
      pts.push((i ? 'L' : 'M') + x.toFixed(3) + ' ' + (-y).toFixed(3));
    }
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pts.join(' ') + ' Z');
    path.setAttribute('fill', 'rgba(240,179,90,0.16)');
    path.setAttribute('stroke', '#f0b35a');
    path.setAttribute('stroke-width', '0.09');
    svg.appendChild(path);
  })();

  document.getElementById('h-threads').textContent = useWorkers ? N + ' workers' : '1 (main)';
  seg.querySelector('button').classList.add('active');
  syncBk();
  resize();
  // thumbnails queued behind the first frame, then rendered through the same pool
  BOOKMARKS.forEach(function (bk, i) { queueThumb(i, bk.cx, bk.cy, bk.span, palette); });
  pump();
})();
