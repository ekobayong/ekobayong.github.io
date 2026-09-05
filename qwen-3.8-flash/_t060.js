
(() => {
"use strict";
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('rain');
const ctx = canvas.getContext('2d');

/* ================= palettes ================= */
const PALETTES = [
  { name:'Jade',           bg:'#04100c', head:'#e8fff3', mid:'#5cffb0', tail:'#0b6b46' },
  { name:'Amber Archive',  bg:'#0d0903', head:'#fff3d6', mid:'#ffb347', tail:'#7a4a0a' },
  { name:'Ice',            bg:'#050912', head:'#f4fbff', mid:'#8fd3ff', tail:'#1f4f7a' },
  { name:'Rose',           bg:'#0f050a', head:'#ffe9f1', mid:'#ff6fa3', tail:'#7a1f45' }
];
let pal = PALETTES[0];

function hex2rgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function mix(a,b,t){
  return [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t)];
}

/* ================= glyph set ================= */
/* 24 invented katakana-like characters: compact SVG paths on a 10-unit grid */
const PATHS = [
  'M2 1 L2 9',
  'M2 1 L8 1',
  'M5 1 L5 9 M2 4 L8 4',
  'M2 9 L2 2 Q2 1 3 1 L8 1',
  'M2 1 L8 1 L8 9',
  'M8 1 L8 9 L2 9',
  'M2 1 L8 9 M8 1 L2 9',
  'M2 1 L8 1 L2 9 L8 9',
  'M2 2 L8 5 L2 8',
  'M5 1 L2 5 L8 5 L5 9',
  'M2 1 L2 9 M8 1 L8 9',
  'M2 1 L2 9 M8 4 L8 9',
  'M2 1 L8 1 L8 9 L2 9 Z',
  'M5 1 L5 7 Q5 9 3 9',
  'M2 9 L5 1 L8 9',
  'M2 1 L5 9 L8 1',
  'M2 4 Q5 1 8 4 M5 4 L5 9',
  'M8 2 L2 2 L8 8 L2 8',
  'M2 1 L2 6 Q2 9 5 9 Q8 9 8 6',
  'M5 9 L5 3 Q5 1 7 1',
  'M2 2 L8 2 M5 2 L5 9',
  'M2 5 L8 1 M2 5 L8 9',
  'M3 1 L7 1 L3 9 L7 9',
  'M2 1 L8 4 M2 9 L8 6'
];
const DIGITS = '0123456789'.split('');
const CAPS   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const N_GLYPHS = PATHS.length + DIGITS.length + CAPS.length; // 60
/* index for a message character (A-Z, 0-9) */
function glyphForChar(c){
  if(c>='0' && c<='9') return PATHS.length + (c.charCodeAt(0)-48);
  return PATHS.length + DIGITS.length + (c.charCodeAt(0)-65);
}
const PATH2D = PATHS.map(p => new Path2D(p));

/* ================= grid / streams ================= */
let CELL=22, cols=0, rows=0, W=0, H=0, dpr=1;
let headY, spd, active, want;
let gb, gg, lock, lockAt, releaseAt;

function cellSize(){
  const w = innerWidth;
  return w < 640 ? 18 : (w >= 2000 ? 26 : 22);
}
function newGrid(){
  const n = cols*rows;
  headY = new Float64Array(cols); spd = new Float64Array(cols);
  active = new Uint8Array(cols); want = new Int16Array(cols);
  gb = new Float32Array(n); gg = new Uint8Array(n);
  lock = new Uint8Array(n); lockAt = new Float64Array(n); releaseAt = new Float64Array(n);
}
function resetGrid(){
  gb.fill(0); gg.fill(0); lock.fill(0);
  for(let c=0;c<cols;c++){
    headY[c] = -Math.random()*rows*1.4;
    spd[c] = 6 + Math.random()*10;         // 6–16 rows / second
    active[c] = Math.random() < density() ? 1 : 0;
    want[c] = -1;
  }
}
function resize(){
  dpr = window.devicePixelRatio || 1;
  CELL = cellSize();
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W*dpr);
  canvas.height = Math.round(H*dpr);
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  cols = Math.ceil(W/CELL); rows = Math.ceil(H/CELL);
  newGrid(); resetGrid(); buildAtlas();
}

/* ================= sprite atlas ================= */
const LEVELS = 14;
let atlas=null, SS=0, sdpr=1;
function buildAtlas(){
  sdpr = dpr;
  SS = CELL + 8;
  atlas = document.createElement('canvas');
  atlas.width = Math.ceil(SS*LEVELS*sdpr);
  atlas.height = Math.ceil(SS*N_GLYPHS*sdpr);
  const a = atlas.getContext('2d');
  a.setTransform(sdpr,0,0,sdpr,0,0);
  const bg = hex2rgb(pal.bg), head = hex2rgb(pal.head), mid = hex2rgb(pal.mid), tail = hex2rgb(pal.tail);
  for(let g=0; g<N_GLYPHS; g++){
    for(let l=0; l<LEVELS; l++){
      const x = l*SS + SS/2, y = g*SS + SS/2;
      const t = l/(LEVELS-1);
      const rgb = t < .5 ? mix(tail, mid, t*2) : mix(mid, head, (t-.5)*2);
      const alpha = t < .26 ? .16 + (t/.26)*.84 : 1;
      a.save();
      a.translate(x, y);
      a.fillStyle = a.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
      if(l === LEVELS-1){ a.shadowBlur = 9; a.shadowColor = pal.head; }
      if(g < PATHS.length){
        const k = CELL*.064;                    // 10-unit grid -> cell
        a.scale(k,k); a.translate(-5,-5);
        a.lineWidth = (CELL*.058)/k;
        a.lineCap = 'round'; a.lineJoin = 'round';
        a.stroke(PATH2D[g]);
      } else {
        const ch = g < PATHS.length+DIGITS.length ? DIGITS[g-PATHS.length] : CAPS[g-PATHS.length-DIGITS.length];
        a.font = `700 ${Math.round(CELL*.74)}px ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace`;
        a.textAlign='center'; a.textBaseline='middle';
        a.fillText(ch, 0, Math.round(CELL*.02));
      }
      a.restore();
    }
  }
}

/* ================= controls / state ================= */
const densEl = document.getElementById('dens');
const spdEl  = document.getElementById('spd');
const densVal= document.getElementById('densVal');
const spdVal = document.getElementById('spdVal');
if(reduced){ densEl.value = 35; spdEl.value = 0.35; }
const density = () => +densEl.value/100;
let speedMult = +spdEl.value;
densEl.addEventListener('input', ()=>{ densVal.textContent = densEl.value+'%'; });
spdEl.addEventListener('input', ()=>{ speedMult = +spdEl.value; spdVal.textContent = speedMult.toFixed(2)+'×'; });
densVal.textContent = densEl.value+'%';
spdVal.textContent = speedMult.toFixed(2)+'×';

/* palette swatches */
const swWrap = document.getElementById('swatches');
function applyPalette(i, btn){
  pal = PALETTES[i];
  const r = document.documentElement.style;
  r.setProperty('--bg', pal.bg); r.setProperty('--head', pal.head);
  r.setProperty('--mid', pal.mid); r.setProperty('--tail', pal.tail);
  document.querySelectorAll('.sw').forEach(s=>s.classList.toggle('on', s===btn));
  buildAtlas();
  setStatus();
}
PALETTES.forEach((p,i)=>{
  const b = document.createElement('button');
  b.className = 'sw' + (i===0?' on':'');
  b.innerHTML = `<b>${p.name}</b><span class="bar" style="background:linear-gradient(90deg, ${p.head}, ${p.mid}, ${p.tail})"></span>`;
  b.addEventListener('click', ()=>applyPalette(i,b));
  swWrap.appendChild(b);
});
addEventListener('keydown', e=>{
  if(e.target && e.target.tagName === 'INPUT') return;
  const n = +e.key;
  if(n>=1 && n<=4){ applyPalette(n-1, swWrap.children[n-1]); }
});

/* ================= message mode ================= */
const statusEl = document.getElementById('status');
const phraseEl = document.getElementById('phrase');
let phase = 'idle';          // idle | resolving | holding | dissolving
let pending = 0, landedN = 0, totalN = 0, holdEnd = 0;
let targetRow = 0;
function setStatus(txt){
  if(txt !== undefined){ statusEl.textContent = txt; return; }
  if(phase==='resolving') statusEl.textContent = `resolving ${landedN} / ${totalN}`;
  else if(phase==='holding') statusEl.textContent = 'locked · holding';
  else if(phase==='dissolving') statusEl.textContent = 'dissolving';
  else statusEl.textContent = 'idle · rain';
}
function releaseAll(instant){
  for(let i=0;i<lock.length;i++) if(lock[i]){
    if(instant){ lock[i]=0; }
    else if(releaseAt[i] === 0) releaseAt[i] = performance.now()/1000 + Math.random()*1.6;
  }
}
function resolve(text){
  const clean = (text||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,40);
  if(!clean) return;
  releaseAll(true);
  want.fill(-1); colTgt.fill(-1);
  phase = 'resolving'; pending = clean.length; landedN = 0; totalN = clean.length; holdEnd = 0;
  targetRow = Math.floor(rows*0.46);
  const startCol = Math.max(0, Math.floor((cols - clean.length)/2));
  for(let i=0;i<clean.length;i++){
    const c = startCol + i;
    if(c >= cols) { pending--; totalN--; continue; }
    want[c] = glyphForChar(clean[i]);
    active[c] = 1;
    headY[c] = targetRow - 4 - i*1.35 - Math.random()*4;
    spd[c] = 8 + Math.random()*5;
    // store per-column target row in a parallel array
    colTgt[c] = targetRow;
  }
  setStatus();
}
const colTgt = new Int16Array(4096);
phraseEl.addEventListener('keydown', e=>{ if(e.key==='Enter') resolve(phraseEl.value); });
document.getElementById('resolve').addEventListener('click', ()=>resolve(phraseEl.value));
canvas.addEventListener('click', ()=>{ if(phase==='holding'){ beginDissolve(); } });
function beginDissolve(){
  phase = 'dissolving';
  for(let c=0;c<cols;c++) colTgt[c] = -1;
  releaseAll(false);
  setStatus();
}

/* ================= update & render ================= */
let nowT = performance.now()/1000;
function update(dt){
  const m = speedMult;
  for(let c=0;c<cols;c++){
    if(!active[c]){
      /* wake chance keeps roughly `density` of the columns raining */
      if(Math.random() < density()*0.55*dt + 0.0015) respawn(c);
      continue;
    }
    const oldH = headY[c], newH = oldH + spd[c]*dt*m;
    headY[c] = newH;
    const r0 = Math.floor(oldH), r1 = Math.floor(newH);
    for(let r = Math.max(0, r0+1); r <= Math.min(rows-1, r1); r++){
      const idx = r*cols + c;
      if(lock[idx]) continue;                       // never overwrite a locked letter
      gb[idx] = 1;
      gg[idx] = (Math.random()*N_GLYPHS)|0;
    }
    /* message arrival */
    if(want[c] >= 0 && newH >= colTgt[c] && !lock[colTgt[c]*cols+c]){
      const idx = colTgt[c]*cols + c;
      lock[idx] = 1; lockAt[idx] = nowT; releaseAt[idx] = 0;
      gb[idx] = 1; gg[idx] = want[c];
      want[c] = -1; colTgt[c] = -1;
      landedN++; pending--;
      if(pending<=0 && phase==='resolving'){ phase='holding'; holdEnd = nowT + 4.5; }
      setStatus();
    }
    if(newH > rows + 8){
      if(Math.random() < density()) respawn(c);
      else active[c] = 0;
    }
  }
  /* exponential tail decay */
  const k = Math.exp(-1.6*dt*m);
  for(let i=0;i<gb.length;i++){
    if(!lock[i] && gb[i] > 0.002){
      gb[i] *= k;
      if(gb[i] <= .002) gb[i] = 0;
    }
  }
  /* flicker: ~15% of a column's worth of cells swap glyph each frame */
  if(!reduced){
    const nf = Math.round(rows*0.15);
    for(let i=0;i<nf;i++){
      const c = (Math.random()*cols)|0, r = (Math.random()*rows)|0;
      const idx = r*cols+c;
      if(!lock[idx] && gb[idx] > 0.05) gg[idx] = (Math.random()*N_GLYPHS)|0;
    }
  }
  /* holding / dissolving */
  if(phase==='holding' && nowT >= holdEnd) beginDissolve();
  if(phase==='dissolving'){
    let left = 0;
    for(let c=0;c<cols;c++){
      for(let r=0;r<rows;r++){
        const idx = r*cols+c;
        if(lock[idx]){
          if(releaseAt[idx] && nowT >= releaseAt[idx]){ lock[idx]=0; gb[idx]=.9; }
          else left++;
        }
      }
    }
    if(left===0){ phase='idle'; setStatus(); }
  }
}
function respawn(c){
  active[c] = 1;
  headY[c] = -Math.random()*10 - 1;
  spd[c] = 6 + Math.random()*10;
}
function render(){
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0,0,W,H);
  const src = SS*sdpr;
  for(let c=0;c<cols;c++){
    const x = c*CELL + CELL/2;
    for(let r=0;r<rows;r++){
      const idx = r*cols+c;
      const l = lock[idx];
      const b = gb[idx];
      if(!l && b < 0.035) continue;
      const y = r*CELL + CELL/2;
      if(l){
        const t = Math.min(1, (nowT - lockAt[idx])/.35);
        const s = 1.7 - 0.7*t;                              // pop 1.7x -> 1x
        const pulse = .55 + .45*Math.sin(nowT*2.6 + idx);
        /* soft halo */
        const rg = ctx.createRadialGradient(x,y,1,x,y,CELL*1.1);
        rg.addColorStop(0, hexA(pal.head, .28*pulse));
        rg.addColorStop(1, hexA(pal.head, 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(x,y,CELL*1.1,0,Math.PI*2); ctx.fill();
        const size = SS*s;
        ctx.drawImage(atlas, 13*src, gg[idx]*src, src, src, x-size/2, y-size/2, size, size);
        /* thin underline in head colour */
        ctx.fillStyle = hexA(pal.head, .8);
        ctx.fillRect(x-CELL*.34, y+CELL*.40, CELL*.68, Math.max(1, CELL*.06));
      } else {
        const lv = Math.min(LEVELS-1, Math.floor(b*LEVELS));
        ctx.drawImage(atlas, lv*src, gg[idx]*src, src, src, x-SS/2, y-SS/2, SS, SS);
      }
    }
  }
}
function hexA(h, a){
  const [r,g,b] = hex2rgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

/* ================= stats ================= */
const statsEl = document.getElementById('stats');
let fps = 60, statT = 0;
function statsTick(){
  let act = 0; for(let i=0;i<cols;i++) act += active[i];
  statsEl.textContent = `${cols} × ${rows} GRID\n${act} STREAMS ACTIVE\n${Math.round(fps)} FPS`;
  statsEl.style.whiteSpace = 'pre';
}

/* ================= main loop ================= */
let last = performance.now()/1000;
function frame(ts){
  const t = ts/1000;
  let dt = t - last; last = t;
  if(dt > .05) dt = .05;
  nowT = t;
  fps = fps*.92 + (1/Math.max(dt,1e-4))*.08;
  update(dt);
  render();
  if(t - statT > .5){ statT = t; statsTick(); }
  requestAnimationFrame(frame);
}
addEventListener('resize', resize);
resize();
setStatus();
requestAnimationFrame(frame);

/* demo phrase resolves itself two seconds after load */
setTimeout(()=>{ if(phase==='idle') resolve('TYPE IS RAIN'); }, 2000);
})();
