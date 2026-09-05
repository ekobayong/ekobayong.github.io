
(() => {
"use strict";
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- season palettes ---------------- */
const SEASONS = {
  spring:{ leaves:['#f4a9bc','#f9c9d5','#ea8ea6','#fff1f3'], sky:'rgba(226,196,182,.26)' },
  summer:{ leaves:['#5f8f45','#78a659','#3e6d33','#93bb6e'], sky:'rgba(212,224,192,.26)' },
  autumn:{ leaves:['#d98a2c','#c2561f','#e6b04b','#a63d1a'], sky:'rgba(226,196,158,.30)' },
  winter:{ leaves:[],                                          sky:'rgba(198,208,218,.34)' }
};
let season = 'spring';

/* ---------------- seeded xorshift rng ---------------- */
function makeRng(seed){
  let s = seed >>> 0;
  if(!s) s = 0x9e3779b9;
  return function(){
    s ^= (s << 13); s >>>= 0;
    s ^= (s >>> 17);
    s ^= (s << 5);  s >>>= 0;
    return s / 4294967296;
  };
}

/* ---------------- constants ---------------- */
const ORDER_MS  = 55;    // ms of age before a segment of order N appears
const GROW_MS   = 100;   // cubic ease-out of its length
const BLOOM_S   = 0.7;   // leaf scale ease-in, seconds
const SHRINK_S  = 0.55;  // leaves collapse
const REGROW_S  = 0.7;   // leaves re-bloom after collapse

/* ---------------- L-system: five stochastic derivations ---------------- */
function lindenStr(rnd){
  const rules = ['F[+X]F[-X]+X','F[-X]F[+X]-X','F[+X][-X]FX'];
  let str = 'X';
  for(let d=0; d<5; d++){
    let out = '';
    for(let i=0;i<str.length;i++){
      const c = str[i];
      if(c === 'X'){
        const r = rnd();
        out += r < .40 ? rules[0] : r < .75 ? rules[1] : rules[2];
      } else if(c === 'F'){
        out += 'FF';
      } else out += c;
    }
    str = out;
    if(str.length > 26000) break;
  }
  return str;
}

/* ---------------- turtle interpretation -> segment hierarchy ---------------- */
function buildTree(seed, len){
  const rnd  = makeRng(seed);
  const str  = lindenStr(rnd);
  const base = 22 + rnd()*6;                     // 22–28°, jittered per tree
  const root = { rel:0, depth:0, order:0, len:0, w:1, kids:[], tip:false,
                 leaf:null, bloomT:-1 };
  const st = [{ h:-Math.PI/2, node:root }];
  let maxOrder = 0, minX=1e9, maxX=-1e9, minY=1e9, maxY=-1e9, count=0;
  let x=0, y=0;
  for(let i=0;i<str.length && count<1400;i++){
    const c = str[i];
    if(c==='F'){
      const p = st[st.length-1];
      const n = { depth:p.node.depth, order:p.node.order+1, len,
                  kids:[], tip:false, leaf:null, bloomT:-1, w:0 };
      // rel = turn relative to the parent segment's heading (root heads -PI/2)
      n.absH = p.h;
      n.rel  = p.h - (p.node === root ? -Math.PI/2 : p.node.absH) + (rnd()-.5)*.06;
      if(n.order > maxOrder) maxOrder = n.order;
      x += Math.cos(p.h)*n.len; y += Math.sin(p.h)*n.len;
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
      p.node.kids.push(n);
      st[st.length-1] = { h:p.h, node:n };
      count++;
    }
    else if(c==='+'){ st[st.length-1].h += (base + (rnd()*4-2)) * Math.PI/180; }
    else if(c==='-'){ st[st.length-1].h -= (base + (rnd()*4-2)) * Math.PI/180; }
    else if(c==='['){ const p=st[st.length-1]; st.push({ h:p.h, node:p.node }); }
    else if(c===']'){ st.pop(); }
  }
  root.tip = root.kids.length===0;
  const pal = SEASONS[season].leaves;
  (function assign(n){
    if(n.kids.length===0 && n.order>0) n.tip = true;
    if(n.tip && n.order>0 && pal.length) n.leaf = newLeaf(rnd, pal, len);
    n.kids.forEach(assign);
  })(root);
  // assign width taper
  (function widths(n){
    if(n.order) n.w = Math.pow(1 - n.order/(maxOrder+1), 1.6);
    n.kids.forEach(widths);
  })(root);
  return { root, maxOrder, len, bounds:{minX,maxX,minY,maxY}, seed };
}

/* ---------------- tree population ---------------- */
let now = performance.now()/1000;
const trees = [];
let windAmt = 0.30;

function newLeaf(rnd, pal, len){
  // offsets and radii in plate pixels (decoupled from turtle units so leaves stay visible)
  const a = rnd()*Math.PI*2, rr = 4 + rnd()*11;
  return { dx:Math.cos(a)*rr, dy:Math.sin(a)*rr,
           rx:2 + rnd()*3.4, ry:1.1 + rnd()*2.1,
           rot:rnd()*Math.PI, col:pal[(rnd()*pal.length)|0] };
}

function spawnTree(xN, yN, scaleN, isMain){
  // at most eight saplings (plus the main plate tree)
  if(!isMain){
    const saplings = trees.filter(t=>!t.main);
    if(saplings.length >= 8){
      const old = saplings[0];
      trees.splice(trees.indexOf(old), 1);
    }
  }
  const len = 5.6 + 5.0*scaleN;
  const t = buildTree((Math.random()*0xffffffff)>>>0, len);
  t.xN = xN; t.yN = yN; t.scaleN = scaleN;
  t.main = !!isMain;
  t.born = reduced ? now - 60 : now;
  t.seasonEpoch = reduced ? now - 60 : now;
  trees.push(t);
  trees.sort((a,b)=>a.scaleN-b.scaleN);   // distant saplings first
  return t;
}
function replant(){
  trees.length = 0;
  spawnTree(.5, .80, 1, true);
}
replant();

/* ---------------- canvas sizing ---------------- */
let W=0, H=0;
function resize(){
  const dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width  = Math.max(1, Math.round(W*dpr));
  canvas.height = Math.max(1, Math.round(H*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize);
resize();

const clamp01 = x => x<0?0:x>1?1:x;
const easeOutCubic = x => 1 - Math.pow(1-x,3);

function treeLayout(t){
  const groundY = H * t.yN;
  const b = t.bounds;
  const bw = Math.max(1, b.maxX-b.minX), bh = Math.max(1, b.maxY-b.minY);
  const availH = groundY - H*.18;
  let s = Math.min(.78*W/bw, availH*.88/bh);
  s *= (.55 + .55*t.scaleN);
  return { s, cx: W*t.xN - ((b.minX+b.maxX)/2)*s, groundY };
}

/* ---------------- wind ---------------- */
function windOffset(t, n){
  const r = t.maxOrder || 1;
  const o  = n.order / r;
  return windAmt * (0.003 + 0.014*o) * Math.sin(now*1.6 + n.order*0.35)
       + windAmt * 0.0022 * (n.depth+1) * Math.sin(now*4.7 + n.order*0.9 + n.depth*1.7);
}

/* ---------------- ground / mist / snow ---------------- */
const grass = (()=>{ const r = makeRng(1234), a=[];
  for(let i=0;i<95;i++) a.push({ xn:r(), zn:r(), h:4+r()*8, lean:(r()*2-1)*.22, ph:r()*7 });
  return a; })();
const mist = [
  { xn:.10, yo:  8, rx:.30, ry:.045, v:.0062, a:.11 },
  { xn:.55, yo: 18, rx:.24, ry:.036, v:.0041, a:.085 },
  { xn:.80, yo:  2, rx:.28, ry:.042, v:.0084, a:.10 }
];
const flakes = [];
const HORIZON = () => H*.58;

function drawScene(){
  // seasonal sky tint fading toward the ground
  const sg = ctx.createLinearGradient(0,H*.10,0,HORIZON());
  sg.addColorStop(0,'rgba(0,0,0,0)');
  sg.addColorStop(1,SEASONS[season].sky);
  ctx.fillStyle = sg; ctx.fillRect(0,H*.08,W,HORIZON()-H*.08);
  // soft earth
  const gg = ctx.createLinearGradient(0,HORIZON(),0,H);
  gg.addColorStop(0,'rgba(146,118,78,.04)');
  gg.addColorStop(.55,'rgba(126,98,60,.15)');
  gg.addColorStop(1,'rgba(94,70,40,.30)');
  ctx.fillStyle = gg; ctx.fillRect(0,HORIZON(),W,H-HORIZON());
  // hand-ruled horizon
  ctx.strokeStyle='rgba(43,35,24,.42)'; ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=0;x<=W;x+=6){
    const y = HORIZON() + Math.sin(x*.045)*.6 + Math.sin(x*.9+2)*.3
            + ((Math.sin(x*12.9898)*43758.5453)%1)*.5;
    x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.stroke();
  // grass ticks leaning with the wind
  ctx.strokeStyle='rgba(62,48,30,.42)'; ctx.lineWidth=1; ctx.lineCap='round';
  ctx.beginPath();
  for(const b of grass){
    const x = b.xn*W;
    const y = HORIZON() + 5 + b.zn*b.zn*(H-HORIZON()-8);
    const lean = b.lean + windAmt*.30*Math.sin(now*1.6 + b.xn*7 + b.ph);
    ctx.moveTo(x,y); ctx.lineTo(x + lean*b.h, y - b.h*(.5+.6*b.zn));
  }
  ctx.stroke();
  // drifting mist ellipses
  for(const m of mist){
    const x = (((m.xn + now*m.v) % 1.35) - .18) * W;
    const y = HORIZON() - 14 + m.yo;
    const rx = m.rx*W, ry = m.ry*H;
    const rg = ctx.createRadialGradient(x,y,1,x,y,rx);
    rg.addColorStop(0,`rgba(246,240,228,${m.a})`);
    rg.addColorStop(1,'rgba(246,240,228,0)');
    ctx.save();
    ctx.translate(x,y); ctx.scale(1, ry/rx); ctx.translate(-x,-y);
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x,y,rx,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}
function drawSnow(dt){
  if(season!=='winter') return;
  if(reduced) return;
  if(flakes.length < 85){
    flakes.push({ x:Math.random()*W, y:-8, r:.8+Math.random()*1.7,
                  vy:12+Math.random()*22, ph:Math.random()*Math.PI*2 });
  }
  ctx.fillStyle='rgba(255,255,255,.85)';
  for(const f of flakes){
    if(!reduced){
      f.y += f.vy*dt;
      f.x += Math.sin(now*.8+f.ph)*14*dt + windAmt*30*dt;
      if(f.y > H+10 || f.x > W+14 || f.x < -14){ f.x = Math.random()*W; f.y = -6; }
    }
    ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fill();
  }
}

/* ---------------- tree drawing ---------------- */
function leafFactor(t){
  if(!SEASONS[season].leaves.length) return 0;
  const k = now - t.seasonEpoch;
  if(k < SHRINK_S) return Math.max(0, 1 - k/SHRINK_S);
  return easeOutCubic(clamp01((k - SHRINK_S - .08)/REGROW_S));
}
function drawTree(t){
  const lay = treeLayout(t);
  const s = lay.s;
  const age = (now - t.born) * 1000;
  const lf = leafFactor(t);
  const winter = season === 'winter';
  ctx.lineCap='round'; ctx.lineJoin='round';
  (function rec(n, ox, oy, h){
    let ex = ox, ey = oy, nh = h, grown = 1;
    if(n.order){
      const g = clamp01((age - n.order*ORDER_MS)/GROW_MS);
      grown = easeOutCubic(g);
      nh = h + windOffset(t, n);
      ex = ox + Math.cos(nh)*n.len*s*grown;
      ey = oy + Math.sin(nh)*n.len*s*grown;
      if(g > 0){
        ctx.lineWidth = Math.max(.5, (0.6 + n.w*5.6) * (0.5 + 0.55*t.scaleN));
        ctx.strokeStyle = '#3b2a1c';
        ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ex,ey); ctx.stroke();
        if(winter && n.order < t.maxOrder*.5){
          ctx.strokeStyle='rgba(255,255,255,.62)'; ctx.lineWidth=.9;
          ctx.beginPath(); ctx.moveTo(ox, oy-1.2); ctx.lineTo(ex, ey-1.2); ctx.stroke();
        }
      }
      if(g >= 1 && n.tip && n.bloomT < 0) n.bloomT = reduced ? now - BLOOM_S : now;
    }
    for(const k of n.kids) rec(k, ex, ey, nh);
    if(n.leaf && n.tip && n.bloomT >= 0 && lf > 0){
      const sc = easeOutCubic(clamp01((now - n.bloomT)/BLOOM_S)) * lf;
      if(sc > .02){
        const L = n.leaf;
        const k = 0.62 + 0.55*t.scaleN;
        const lx = ex + L.dx*k*sc;
        const ly = ey + L.dy*k*sc;
        ctx.save();
        ctx.globalAlpha = .95*sc;
        ctx.translate(lx, ly);
        ctx.rotate(L.rot + windAmt*.35*Math.sin(now*2.1 + L.dx));
        ctx.fillStyle = L.col;
        ctx.beginPath();
        ctx.ellipse(0, 0, L.rx*k*sc, L.ry*k*sc, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }
  })(t.root, lay.cx, lay.groundY, -Math.PI/2);
}

/* ---------------- season switching ---------------- */
function setSeason(next){
  if(next === season) return;
  season = next;
  const pal = SEASONS[next].leaves;
  for(const t of trees){
    t.seasonEpoch = reduced ? now - 60 : now;
    (function rec(n){
      if(n.tip && n.order > 0){
        n.bloomT = -1;
        n.leaf = pal.length ? newLeaf(Math.random, pal, t.len) : null;
      }
      n.kids.forEach(rec);
    })(t.root);
    // leaves of an already-mature tree should re-bloom soon after the shrink completes
    if(!reduced){
      (function stamp(n){
        if(n.tip && n.order) n.bloomT = now + SHRINK_S + .1 + (n.order%3)*.12;
        n.kids.forEach(stamp);
      })(t.root);
    } else {
      (function stamp(n){
        if(n.tip && n.order) n.bloomT = now - BLOOM_S;
        n.kids.forEach(stamp);
      })(t.root);
    }
  }
  document.querySelectorAll('#seasons .pill')
    .forEach(p => p.classList.toggle('active', p.dataset.s === next));
}

/* ---------------- controls ---------------- */
const windSlider = document.getElementById('wind');
const windLabel  = document.getElementById('windLabel');
const windWord = v => v<=1 ? 'still' : v<34 ? 'gentle' : v<70 ? 'brisk' : 'gale';
function syncWind(){
  windAmt = windSlider.value/100;
  windLabel.textContent = windWord(+windSlider.value);
}
windSlider.addEventListener('input', syncWind);
syncWind();

document.querySelectorAll('#seasons .pill').forEach(p=>{
  p.addEventListener('click', ()=>setSeason(p.dataset.s));
});
document.querySelector('#seasons .pill[data-s=spring]').classList.add('active');

document.getElementById('btnPlant').addEventListener('click', replant);
addEventListener('keydown', e=>{
  if(e.code === 'Space' && document.activeElement.tagName !== 'INPUT'){
    e.preventDefault(); replant();
  }
});

const toast = document.getElementById('toast');
let toastTimer = null;
canvas.addEventListener('pointerdown', e=>{
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const yN = Math.min(.92, Math.max(.60, py/H));   // keep saplings on the ground band
  const scaleN = .28 + .58*((yN - .60)/(.92 - .60));
  spawnTree(Math.min(.97, Math.max(.03, px/W)), yN, scaleN, false);
  toast.textContent = 'Sapling planted';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove('show'), 1700);
});

/* ---------------- main loop ---------------- */
let last = now;
function frame(ts){
  const t0 = ts/1000;
  let dt = Math.min(.05, t0 - last);
  last = t0; now = t0;
  ctx.clearRect(0,0,W,H);
  drawScene();
  for(const t of trees) drawTree(t);
  drawSnow(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
