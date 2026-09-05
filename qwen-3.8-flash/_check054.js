
'use strict';
var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var MONO_TIP = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/* ---------- shared damped-spring integrator (semi-implicit Euler, 60 Hz) ---------- */
function Spring(x, k, d) { this.x = x; this.v = 0; this.t = x; this.k = k || 180; this.d = d || 18; }
Spring.prototype.set = function (t) { this.t = t; };
Spring.prototype.snap = function (t) { this.t = this.x = t; this.v = 0; };
var SPRINGS = [];
function tick(dt) {
  for (var i = 0; i < SPRINGS.length; i++) {
    var s = SPRINGS[i];
    if (REDUCED) { s.x = s.t; s.v = 0; if (s.onChange) s.onChange(s.x, s.v); continue; }
    var settled = false;
    if (s.x !== s.t || s.v !== 0) {
      s.v += (-s.k * (s.x - s.t) - s.d * s.v) * dt;   // 60 Hz fixed step
      s.x += s.v * dt;
      if (Math.abs(s.x - s.t) < 0.002 && Math.abs(s.v) < 0.01) { s.x = s.t; s.v = 0; settled = true; }
      if (s.onChange) s.onChange(s.x, s.v);
      if (settled && s.onChange) s.onChange(s.x, s.v);
    }
  }
}
(function engine() {
  var last = performance.now();
  function frame(now) {
    var acc = (now - last) / 1000; last = now;
    if (acc > 0.1) acc = 0.1;
    tick(acc);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- 01 magnetic pill ---------- */
(function () {
  var stage = document.getElementById('mag-stage');
  var btn = document.getElementById('mag-btn');
  var label = btn.firstElementChild;
  var sx = new Spring(0, 170, 17), sy = new Spring(0, 170, 17);
  function paint() {
    btn.style.transform = 'translate(' + sx.x.toFixed(2) + 'px,' + sy.x.toFixed(2) + 'px)';
    label.style.transform = 'translate(' + (sx.x * 0.35).toFixed(2) + 'px,' + (sy.x * 0.35).toFixed(2) + 'px)';
  }
  sx.onChange = sy.onChange = paint;
  SPRINGS.push(sx, sy);
  function local(e) {
    var r = stage.getBoundingClientRect();
    var br = btn.getBoundingClientRect();
    var cx = br.left + br.width / 2 - r.left, cy = br.top + br.height / 2 - r.top;
    var dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 140) {
      var pull = 1 - dist / 140;
      var mag = Math.min(26, dist * 0.42) * pull;
      var a = Math.atan2(dy, dx);
      sx.set(Math.cos(a) * mag); sy.set(Math.sin(a) * mag);
    } else { sx.set(0); sy.set(0); }
  }
  stage.addEventListener('pointermove', local);
  stage.addEventListener('pointerleave', function () { sx.set(0); sy.set(0); });
})();

/* ---------- 02 liquid toggle ---------- */
(function () {
  var t = document.getElementById('tgl');
  t.addEventListener('click', function () {
    var on = t.getAttribute('aria-checked') === 'true';
    t.setAttribute('aria-checked', String(!on));
    t.classList.remove('go-on', 'go-off');
    void t.offsetWidth;
    t.classList.add(on ? 'go-off' : 'go-on');
  });
})();

/* ---------- 04 like burst ---------- */
(function () {
  var stage = document.getElementById('like-stage');
  var btn = document.getElementById('like');
  var countEl = document.getElementById('like-count');
  var heart = btn.querySelector('.heart');
  var liked = false, n = 128;
  var COLORS = ['#e11d48', '#f97316', '#facc15', '#6366f1', '#16a34a', '#ec4899'];
  btn.addEventListener('click', function () {
    liked = !liked;
    btn.classList.toggle('liked', liked);
    btn.setAttribute('aria-pressed', String(liked));
    n += liked ? 1 : -1;
    countEl.textContent = n;
    if (!liked || REDUCED) return;
    var r = heart.getBoundingClientRect(), s = stage.getBoundingClientRect();
    var ox = r.left - s.left + r.width / 2, oy = r.top - s.top + r.height / 2;
    for (var i = 0; i < 12; i++) {
      var p = document.createElement('span');
      p.className = 'part';
      p.style.background = COLORS[i % COLORS.length];
      p.style.left = ox - 3.5 + 'px'; p.style.top = oy - 3.5 + 'px';
      stage.appendChild(p);
      var a = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      var dist = 26 + Math.random() * 38, sc = 0.4 + Math.random() * 0.7;
      p.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + Math.cos(a) * dist + 'px,' + Math.sin(a) * dist + 'px) scale(' + sc + ')', opacity: 0 }
      ], { duration: 480 + Math.random() * 380, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'forwards' })
       .onfinish = function () { this.effect.target.remove(); };
    }
  });
})();

/* ---------- 05 elastic slider ---------- */
(function () {
  var el = document.getElementById('slider');
  var fill = el.querySelector('.fill'), thumb = el.querySelector('.thumb'), tip = el.querySelector('.tip');
  var sp = new Spring(35, 210, 20);
  SPRINGS.push(sp);
  var live = false;
  function trackW() { return el.clientWidth; }
  sp.onChange = function (x, v) {
    var w = trackW();
    var px = x / 100 * w;
    var squish = Math.max(-0.32, Math.min(0.32, v * 0.0045));
    var sx2 = 1 + squish, sy2 = 1 - squish * 0.75;
    thumb.style.transform = 'translateX(' + px.toFixed(2) + 'px) scale(' + sx2.toFixed(3) + ',' + sy2.toFixed(3) + ')';
    fill.style.width = Math.max(0, px).toFixed(2) + 'px';
    tip.style.left = px.toFixed(2) + 'px';
    tip.textContent = Math.round(x);
    el.setAttribute('aria-valuenow', Math.round(x));
  };
  function fromPointer(e) {
    var r = el.getBoundingClientRect();
    sp.set(Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)));
  }
  el.addEventListener('pointerdown', function (e) {
    live = true; el.classList.add('live');
    el.setPointerCapture(e.pointerId);
    fromPointer(e); e.preventDefault();
  });
  el.addEventListener('pointermove', function (e) { if (live) fromPointer(e); });
  el.addEventListener('pointerup', function () { live = false; });
  el.addEventListener('pointercancel', function () { live = false; });
  el.addEventListener('mouseenter', function () { el.classList.add('live'); });
  el.addEventListener('mouseleave', function () { if (!live) el.classList.remove('live'); });
  el.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { sp.set(Math.min(100, sp.t + 5)); el.classList.add('live'); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { sp.set(Math.max(0, sp.t - 5)); el.classList.add('live'); e.preventDefault(); }
  });
  el.addEventListener('blur', function () { el.classList.remove('live'); });
  sp.onChange(35, 0);
})();

/* ---------- 06 ripple tabs ---------- */
(function () {
  var box = document.getElementById('tabs');
  var ind = box.querySelector('.ind');
  var btns = box.querySelectorAll('button');
  var sx = new Spring(0, 190, 21), sw = new Spring(0, 190, 21);
  SPRINGS.push(sx, sw);
  sx.onChange = function (x) { ind.style.left = x + 'px'; };
  sw.onChange = function (x) { ind.style.width = x + 'px'; };
  function select(b, e) {
    btns.forEach(function (o) { o.setAttribute('aria-selected', String(o === b)); });
    var r = box.getBoundingClientRect(), br = b.getBoundingClientRect();
    sx.set(br.left - r.left); sw.set(br.width);
    if (e && !REDUCED) {
      var rp = document.createElement('span');
      rp.className = 'rip';
      var d = Math.max(b.clientWidth, b.clientHeight) * 2;
      rp.style.width = rp.style.height = d + 'px';
      rp.style.left = (e.clientX - r.left - (b.offsetLeft - b.offsetLeft)) + 'px';
      rp.style.left = (e.offsetX + b.offsetLeft - d / 2) + 'px';
      rp.style.top = (e.offsetY + b.offsetTop - d / 2) + 'px';
      box.appendChild(rp);
      rp.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }],
        { duration: 550, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' })
        .onfinish = function () { this.effect.target.remove(); };
    }
  }
  btns.forEach(function (b) { b.addEventListener('click', function (e) { select(b, e); }); });
  requestAnimationFrame(function () {
    var r = box.getBoundingClientRect(), br = btns[0].getBoundingClientRect();
    sx.snap(br.left - r.left); sw.snap(br.width);
    sx.onChange(sx.x); sw.onChange(sw.x);
  });
})();

/* ---------- 07 cursor-lit card ---------- */
(function () {
  var lit = document.getElementById('lit');
  lit.addEventListener('pointermove', function (e) {
    var r = lit.getBoundingClientRect();
    lit.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    lit.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
})();

/* ---------- 08 floating-label email ---------- */
(function () {
  var fld = document.getElementById('fld');
  var input = document.getElementById('email');
  var msg = document.getElementById('fld-msg');
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    fld.classList.remove('bad', 'good', 'shake');
    if (ok) {
      fld.classList.add('good');
      msg.textContent = 'Subscribed — see you in the inbox.';
    } else {
      void fld.offsetWidth;
      fld.classList.add('bad');
      if (!REDUCED) fld.classList.add('shake');
      msg.textContent = input.value.trim() ? 'That address looks wrong.' : 'Type an address first.';
    }
  });
  input.addEventListener('input', function () { fld.classList.remove('good'); });
})();

/* ---------- 09 rubber-band segmented pill ---------- */
(function () {
  var box = document.getElementById('seg9');
  var pill = box.querySelector('.pill');
  var btns = box.querySelectorAll('button');
  var sx = new Spring(0, 165, 19), sw = new Spring(0, 165, 19);
  SPRINGS.push(sx, sw);
  var baseW = 0;
  function paint(x, v) {
    var stretch = REDUCED ? 0 : Math.max(0, Math.min(28, Math.abs(v) * 0.14));
    var lead = v > 0 ? stretch : (v < 0 ? 0 : stretch * 0.5);
    pill.style.transform = 'translateX(' + x + 'px)';
    pill.style.width = (baseW + lead + (v !== 0 ? 0 : 0)) + 'px';
    // trailing edge lags: shift left by stretch minus lead handled via extra on trailing side
    pill.style.transform = 'translateX(' + (x - (stretch - lead)) + 'px)';
    pill.style.width = (baseW + stretch) + 'px';
  }
  sx.onChange = function (x, v) { paint(x, sw.v); };
  sw.onChange = function (x, v) { paint(sx.x, v); };
  function place(b, animate) {
    btns.forEach(function (o) { o.classList.toggle('on', o === b); o.setAttribute('aria-checked', String(o === b)); });
    baseW = b.offsetWidth;
    sx.set(b.offsetLeft - 4 + 4); // pill coordinates relative to padding box (translateX from left:0)
    sx.t = b.offsetLeft;
    if (!animate) { sx.snap(b.offsetLeft); sw.snap(b.offsetWidth); }
    paint(sx.x, 0);
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { place(b, true); }); });
  place(btns[0], false);
  addEventListener('resize', function () {
    var on = box.querySelector('button.on'); if (on) place(on, false);
  });
})();

/* ---------- 10 download morph ---------- */
(function () {
  var dl = document.getElementById('dl');
  var fg = dl.querySelector('.ring .fg');
  var busy = false;
  dl.addEventListener('click', function () {
    if (busy) return;
    busy = true;
    dl.classList.remove('done');
    dl.classList.add('busy');
    fg.style.stroke = '#fff';
    fg.setAttribute('stroke-dashoffset', 100);
    var DUR = REDUCED ? 10 : 2200;
    fg.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }],
      { duration: DUR, easing: 'cubic-bezier(.16,.62,.3,1)', fill: 'forwards' }).onfinish = function () {
        dl.classList.remove('busy');
        dl.classList.add('done');
        setTimeout(function () {
          dl.classList.remove('done');
          fg.getAnimations().forEach(function (a) { a.cancel(); });
          busy = false;
        }, 1800);
      };
  });
})();
