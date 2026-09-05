
(() => {
"use strict";
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROWS = 11;

/* ================= 5x7 bitmap font — binary row literals ================= */
const FONT = {
  ' ':[0,0,0,0,0,0,0],
  'A':[0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'B':[0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  'C':[0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110],
  'D':[0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  'E':[0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  'F':[0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  'G':[0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01111],
  'H':[0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'I':[0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  'J':[0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
  'K':[0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  'L':[0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  'M':[0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001],
  'N':[0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  'O':[0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'P':[0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  'Q':[0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  'R':[0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  'S':[0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  'T':[0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  'U':[0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'V':[0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
  'W':[0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
  'X':[0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  'Y':[0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  'Z':[0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
  '0':[0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
  '1':[0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
  '2':[0b01110,0b10001,0b00001,0b00110,0b01000,0b10001,0b11111],
  '3':[0b11110,0b00001,0b00001,0b01110,0b00001,0b00001,0b11110],
  '4':[0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
  '5':[0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
  '6':[0b00110,0b01000,0b10000,0b11110,0b10001,0b10001,0b01110],
  '7':[0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
  '8':[0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
  '9':[0b01110,0b10001,0b10001,0b01111,0b00001,0b00010,0b01100],
  '.':[0,0,0,0,0,0b00100,0b00100],
  ',':[0,0,0,0,0,0b00100,0b01000],
  '!':[0b00100,0b00100,0b00100,0b00100,0b00100,0,0b00100],
  '?':[0b01110,0b10001,0b00001,0b00110,0b00100,0,0b00100],
  "'":[0b00100,0b00100,0,0,0,0,0],
  '"':[0b01010,0b01010,0,0,0,0,0],
  '-':[0,0,0,0b01110,0,0,0],
  '_':[0,0,0,0,0,0,0b11111],
  ':':[0,0b00100,0b00100,0,0b00100,0b00100,0],
  ';':[0,0b00100,0b00100,0,0b00100,0b01000,0],
  '/':[0b00001,0b00010,0b00010,0b00100,0b01000,0b01000,0b10000],
  '&':[0b01100,0b10010,0b10100,0b01000,0b10101,0b10010,0b01101],
  '+':[0,0b00100,0b00100,0b11111,0b00100,0b00100,0],
  '=':[0,0,0b11111,0,0b11111,0,0],
  '(':[0b00010,0b00100,0b01000,0b01000,0b01000,0b00100,0b00010],
  ')':[0b01000,0b00100,0b00010,0b00010,0b00010,0b00100,0b01000],
  '#':[0b01010,0b11111,0b01010,0b01010,0b11111,0b01010,0],
  '$':[0b00100,0b01111,0b10100,0b01110,0b00101,0b11110,0b00100],
  '%':[0b11001,0b11010,0b00010,0b00100,0b01000,0b01011,0b10011],
  '@':[0b01110,0b10001,0b10111,0b10101,0b10111,0b10000,0b01110],
  '*':[0,0b00100,0b10101,0b01110,0b10101,0b00100,0],
  '<':[0b00010,0b00100,0b01000,0b10000,0b01000,0b00100,0b00010],
  '>':[0b01000,0b00100,0b00010,0b00001,0b00010,0b00100,0b01000],
  '\u2665':[0,0b01010,0b11111,0b11111,0b01110,0b00100,0]   // heart
};
const BOX = [0b11111,0b10001,0b10001,0b10001,0b10001,0b10001,0b11111]; // unknown -> hollow box

/* rasterise a string into 7-bit column masks, one blank column between glyphs */
function raster(text){
  const cols = [];
  for(let i=0;i<text.length;i++){
    const rows = FONT[text[i]] || BOX;
    for(let c=0;c<5;c++){
      let m = 0;
      for(let r=0;r<7;r++) m |= ((rows[r]>>(4-c))&1) << r;
      cols.push(m);
    }
    if(i < text.length-1) cols.push(0);
  }
  return cols;
}

/* ================= state ================= */
const COLORMAP = [
  { name:'amber', hex:'#ffb000' }, { name:'red', hex:'#ff2a1a' },
  { name:'green', hex:'#39ff5a' }, { name:'cyan', hex:'#29e6ff' },
  { name:'white', hex:'#f4f4ff' }
];
let msgCols = [];
let scrollPos = 0;     // fractional source column offset (scroll/bounce)
let bounceDir = -1;

const msgInput = document.getElementById('msg');
const chEl = document.getElementById('ch');
function refreshMessage(){
  const v = msgInput.value.toUpperCase();
  msgCols = raster(v);
  chEl.textContent = v.length + ' CH';
  scrollPos = 0; bounceDir = -1;
}

/* ================= canvases ================= */
const mainC = document.getElementById('main');
const clockC = document.getElementById('clock');
const mctx = mainC.getContext('2d');
const cctx = clockC.getContext('2d');

function hexRgb(h){
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function fit(canvas, cssH){
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 600;
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(w*dpr);
  canvas.height = Math.round(cssH*dpr);
  const c = canvas.getContext('2d');
  c.setTransform(dpr,0,0,dpr,0,0);
  return { w, h:cssH };
}
let mainW=0, mainH=0, clockW=0, clockH=0, mainCols=0;
function layout(){
  mainH = ROWS*pitch;
  const a = fit(mainC, mainH);
  mainW = a.w;
  mainCols = Math.floor(mainW/pitch);
  const cp = clockPitch();
  const b = fit(clockC, ROWS*cp);
  clockW = b.w; clockH = ROWS*cp;
}
function clockPitch(){ return Math.max(5, Math.round(pitch*0.7)); }

/* ================= led rendering ================= */
function drawLeds(ctx, cssW, rows, cols, p, bits){
  const [r,g,b2] = hexRgb(ledColor);
  ctx.clearRect(0,0,cssW,rows*p);
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const cx = x*p + p/2, cy = y*p + p/2;
      const lit = bits(x,y);
      if(lit){
        ctx.fillStyle = `rgba(${r},${g},${b2},.16)`;
        ctx.beginPath(); ctx.arc(cx,cy, p*.62, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = ledColor;
        ctx.beginPath(); ctx.arc(cx,cy, p*.30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.arc(cx - p*.10, cy - p*.10, p*.075, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = '#171a1e';
        ctx.beginPath(); ctx.arc(cx,cy, p*.17, 0, Math.PI*2); ctx.fill();
      }
    }
  }
}

/* ================= main loop ================= */
const mainBits = new Uint8Array(4096*ROWS);
let litCount = 0;
let lastT = performance.now()/1000;
let readoutAt = 0;

function sourceCol(c){
  const n = msgCols.length;
  if(n===0) return -1;
  const strip = n + 8;
  if(mode==='scroll'){
    const src = Math.floor(scrollPos + c) % strip;
    return src < n ? src : -1;
  }
  if(mode==='static'){
    const left = Math.floor((mainCols - n)/2);
    const src = left + c;
    return (src>=0 && src<n) ? src : -1;
  }
  // bounce
  const src = Math.floor(scrollPos) + c;
  return (src>=0 && src<n) ? src : -1;
}

function frame(ts){
  const t = ts/1000;
  let dt = Math.min(.1, t - lastT); lastT = t;
  const eff = reduced ? 1/3 : 1;
  const n = msgCols.length;
  const strip = n + 8;
  if(n){
    if(mode==='scroll'){
      scrollPos = (scrollPos + speed*dt*eff) % strip;
    } else if(mode==='bounce'){
      const lo = Math.min(0, mainCols - n);
      const hi = Math.max(0, mainCols - n);
      scrollPos += bounceDir * speed*dt*eff;
      if(scrollPos <= lo){ scrollPos = lo; bounceDir = 1; }
      if(scrollPos >= hi){ scrollPos = hi; bounceDir = -1; }
    }
  }
  // sample bits into buffer (for lit-count + stable draw)
  litCount = 0;
  for(let x=0;x<mainCols;x++){
    const src = sourceCol(x);
    const m = src>=0 ? msgCols[src] : 0;
    for(let y=0;y<ROWS;y++) mainBits[y*mainCols+x] = (m>>y)&1;
    let m2 = m; while(m2){ litCount += m2 & 1; m2 >>= 1; }
  }
  drawLeds(mctx, mainW, ROWS, mainCols, pitch, (x,y)=>mainBits[y*mainCols+x]);

  /* clock display */
  const cp = clockPitch();
  const ccols = Math.floor(clockW/cp);
  const d = new Date();
  const half = reduced ? false : (d.getMilliseconds() >= 500);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  const colon = half ? ' ' : ':';
  const timeCols = raster(`${hh}${colon}${mm}${colon}${ss}`);
  const tn = timeCols.length;
  const tleft = Math.floor((ccols - tn)/2);
  drawLeds(cctx, clockW, ROWS, ccols, cp, (x,y)=>{
    const src = x - tleft;
    return (src>=0 && src<tn) ? ((timeCols[src]>>y)&1) : 0;
  });

  if(t - readoutAt > .25){
    readoutAt = t;
    document.getElementById('roLit').textContent = litCount.toLocaleString('en-US');
    document.getElementById('roTotal').textContent = 'of ' + (mainCols*ROWS).toLocaleString('en-US') + ' leds';
    document.getElementById('roDims').textContent = mainCols + ' × ' + ROWS + ' grid';
  }
  requestAnimationFrame(frame);
}

/* ================= controls ================= */
msgInput.addEventListener('input', refreshMessage);
document.querySelectorAll('#mode button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    mode = btn.dataset.m;
    scrollPos = mode==='bounce' ? Math.min(0, mainCols-msgCols.length) : 0;
    bounceDir = -1;
    document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('active', b===btn));
  });
});
const swWrap = document.getElementById('swatches');
COLORMAP.forEach((c,i)=>{
  const el = document.createElement('button');
  el.className = 'swatch' + (i===0?' active':'');
  el.title = c.name;
  el.setAttribute('aria-label', c.name + ' leds');
  el.style.background = `radial-gradient(circle at 34% 30%, rgba(255,255,255,.85), ${c.hex} 46%, ${c.hex} 70%, rgba(0,0,0,.55))`;
  el.addEventListener('click', ()=>{
    ledColor = c.hex;
    document.documentElement.style.setProperty('--accent', c.hex);
    document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('active', s===el));
    const [r,g,b] = hexRgb(c.hex);
    document.querySelectorAll('.chcount,.val').forEach(e=>e.style.color=c.hex);
    const ro = document.querySelector('.readout .big');
    ro.style.textShadow = `0 0 12px rgba(${r},${g},${b},.4)`;
    el.style.boxShadow = `0 0 12px ${c.hex}, 0 0 4px ${c.hex}`;
  });
  swWrap.appendChild(el);
});
document.querySelector('.swatch.active').style.boxShadow = '0 0 12px #ffb000, 0 0 4px #ffb000';
const speedEl = document.getElementById('speed');
const pitchEl = document.getElementById('pitch');
speedEl.addEventListener('input', ()=>{ speed = +speedEl.value; document.getElementById('speedVal').textContent = speed; });
pitchEl.addEventListener('input', ()=>{
  pitch = +pitchEl.value;
  document.getElementById('pitchVal').textContent = pitch + ' PX';
  layout();
});
addEventListener('resize', layout);

layout();
refreshMessage();
requestAnimationFrame(frame);
})();
