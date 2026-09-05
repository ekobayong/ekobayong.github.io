
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


function probe(cr, ci, span, iter, pal){
  var w=101,h=101,s=span/w;
  var m={w:w,h:h,step:1,y0:0,y1:1,cx:cr,cy:ci-50*s,span:span,maxIter:iter,palette:pal};
  var r=computeBand(m); var o=50*4;
  return [r.buf[o],r.buf[o+1],r.buf[o+2],r.buf[o+3]];
}
function isBlack(p){return p[0]===0&&p[1]===0&&p[2]===0&&p[3]===255;}
var t1=probe(-1.0,0.02,3.4,500,'Ultra');   console.log('bulb (-1.0,0.02):', t1, isBlack(t1)?'BLACK ok':'FAIL');
var t2=probe(-0.3,0.1,3.4,500,'Ultra');    console.log('cardioid (-0.3,0.1):', t2, isBlack(t2)?'BLACK ok':'FAIL');
var t3=probe(-1.25,0.02,3.4,500,'Ultra');  console.log('interior (-1.25,0.02):', t3, isBlack(t3)?'BLACK ok':'FAIL');
var t4=probe(1,1,3.4,500,'Ember');         console.log('outside (1,1):', t4, isBlack(t4)?'FAIL':'colored ok');
var t5=probe(-1.7548776,0,0.028,2500,'Ice');console.log('mini-brot center:', t5, isBlack(t5)?'BLACK ok':'hmm');
var t6=probe(-0.7435669,0.1314023,0.0022,1800,'Ultra'); console.log('seahorse center:', t6);
// smoothness: adjacent outside pixels should rarely jump to black
var w=101,h=101,span=0.0022,s=span/w;
var m={w:w,h:h,step:1,y0:0,y1:h,cx:-0.7435669,cy:0.1314023-50*s,span:span,maxIter:1800,palette:'Ultra'};
var r=computeBand(m); var black=0, tot=0, uniq=new Set();
for(var i=0;i<r.gw*r.gh;i++){ if(r.buf[i*4+3]===255) tot++; black+= (r.buf[i*4]===0&&r.buf[i*4+1]===0&&r.buf[i*4+2]===0)?1:0; uniq.add(r.buf[i*4]+','+r.buf[i*4+1]+','+r.buf[i*4+2]); }
console.log('seahorse band:', tot,'px', (black/tot*100).toFixed(1)+'% black', uniq.size,'distinct colors');
