/* throwaway CDP driver — real-time interaction smoke test for the 4 pages */
'use strict';
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9377;
const DIR = __dirname.replace(/\\/g, '/');

/* ---------- minimal websocket client ---------- */
function wsConnect(wsUrl){
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\nHost: ' + u.host +
        '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    let hs = false, buf = Buffer.alloc(0), fragOp = 0, frag = [];
    const listeners = new Set();
    function pump(){
      while (true){
        if (buf.length < 2) return;
        const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f;
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126){ if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127){ if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) return;
        let payload = buf.subarray(off, off + len); buf = buf.subarray(off + len);
        if (op === 8){ sock.destroy(); return; }
        if (op === 9){ continue; }               /* ping: browsers tolerate missing pong over localhost CDP */
        if (op && op !== 10) { fragOp = op; frag = [payload]; }
        else frag.push(payload);
        if (fin){
          const full = Buffer.concat(frag.length ? frag : [payload]);
          if (fragOp === 1 || op === 1){ const txt = full.toString('utf8'); for (const l of listeners) l(txt); }
          frag = []; fragOp = 0;
        }
      }
    }
    sock.on('data', d => {
      if (!hs){
        const i = d.indexOf('\r\n\r\n');
        if (i < 0) return;
        hs = true; buf = d.subarray(i + 4);
      } else buf = Buffer.concat([buf, d]);
      try { pump(); } catch(e){ reject(e); }
    });
    sock.on('error', reject);
    const api = {
      send(str){
        const p = Buffer.from(str, 'utf8');
        const mask = crypto.randomBytes(4);
        let head;
        if (p.length < 126) head = Buffer.from([0x81, 0x80 | p.length]);
        else if (p.length < 65536){ head = Buffer.alloc(4); head[0]=0x81; head[1]=0x80|126; head.writeUInt16BE(p.length, 2); }
        else { head = Buffer.alloc(10); head[0]=0x81; head[1]=0x80|127; head.writeBigUInt64BE(BigInt(p.length), 2); }
        const m = Buffer.from(p); for (let i=0;i<m.length;i++) m[i] ^= mask[i%4];
        sock.write(Buffer.concat([head, mask, m]));
      },
      onMessage(fn){ listeners.add(fn); },
      close(){ try{ sock.destroy(); }catch(e){} }
    };
    setTimeout(() => resolve(api), 250);
  });
}

/* ---------- CDP session ---------- */
async function session(targetWs){
  const ws = await wsConnect(targetWs);
  let id = 0;
  const pend = new Map();
  ws.onMessage(txt => {
    const m = JSON.parse(txt);
    if (m.id && pend.has(m.id)){ const {res, rej} = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  });
  const send = (method, params) => new Promise((res, rej) => {
    const my = ++id; pend.set(my, {res, rej});
    ws.send(JSON.stringify({ id: my, method, params: params || {} }));
  });
  return { send, close: () => ws.close() };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitPort(){
  for (let i=0;i<80;i++){
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) return; } catch(e){}
    await sleep(250);
  }
  throw new Error('chrome devtools never came up');
}

async function runTest(file, expr){
  const url = 'file:///' + DIR + '/' + file;
  let resp = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!resp.ok) resp = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url));
  const tgt = await resp.json();
  const s = await session(tgt.webSocketDebuggerUrl);
  await s.send('Runtime.enable');
  for (let i=0;i<60;i++){
    const r = await s.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (r.result.value === 'complete') break;
    await sleep(150);
  }
  const out = await s.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + tgt.id); } catch(e){}
  s.close();
  if (out.exceptionDetails) return { file, error: (out.exceptionDetails.exception && out.exceptionDetails.exception.description) || out.exceptionDetails.text };
  return { file, result: out.result.value };
}

/* ==================== test programs (run inside each page) ==================== */
const T = {};

T['061-leather-field-notebook.html'] = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  document.getElementById('cover').click();
  await s(1600);
  const book = document.getElementById('book');
  out.open = book.classList.contains('open');
  out.bandOpacity = getComputedStyle(document.querySelector('.band')).opacity;
  out.coverTransformIsRotated = getComputedStyle(document.querySelector('.cover')).transform.includes('matrix3d');
  for (let i = 0; i < 3; i++){ document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await s(1350); }
  out.flipped = document.querySelectorAll('.sheet.flipped').length;
  out.status = document.getElementById('status').textContent;
  out.activeDot = [...document.querySelectorAll('.dot')].findIndex(d => d.classList.contains('on'));
  out.nextDisabled = document.getElementById('btnNext').disabled;
  out.folds = document.querySelectorAll('.fold').length;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await s(1350);
  out.flippedAfterBack = document.querySelectorAll('.sheet.flipped').length;
  return out;
})()`;

T['062-harmonograph-drawing.html'] = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  const cvT = document.getElementById('cvTrace');
  const bright = () => { const d = cvT.getContext('2d').getImageData(0, 0, cvT.width, cvT.height).data; let n = 0; for (let i = 0; i < d.length; i += 320) if (d[i] + d[i+1] + d[i+2] > 150) n++; return n; };
  const ro = () => document.getElementById('readout').textContent;
  await s(2600);
  out.inkWhileDrawing = bright();
  out.drawingFlag = ro().includes('pen down');
  document.getElementById('bLift').click();
  out.afterLiftFlag = ro().includes('pen raised');
  document.getElementById('bDraw').click(); await s(900);
  out.resumedFlag = ro().includes('pen down');
  document.getElementById('bLift').click();
  document.getElementById('bReplay').click(); await s(1600);
  out.replayActive = ro().includes('pen down');
  out.replayInk = bright();
  document.getElementById('bLift').click();
  document.getElementById('bClear').click();
  out.clearFlag = ro().includes('plate clear');
  out.inkAfterClear = bright();
  document.getElementById('bRand').click(); await s(1300);
  out.randActive = ro().includes('pen down');
  out.randInk = bright();
  return out;
})()`;

T['063-holographic-concert-ticket.html'] = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  await s(400);
  const t = document.getElementById('ticket');
  out.tiltLive = getComputedStyle(t).transform.includes('matrix') && !!t.style.getPropertyValue('--px');
  const stub = document.getElementById('tstub'); stub.setPointerCapture = () => {};
  const qr = document.getElementById('qr');
  const dark = () => { const d = qr.getContext('2d').getImageData(0, 0, qr.width, qr.height).data; let n = 0; for (let i = 0; i < d.length; i += 40) if (d[i] < 60) n++; return n; };
  out.qrDark0 = dark();
  const r = stub.getBoundingClientRect(); const W = r.width;
  const PE = (ty, x) => stub.dispatchEvent(new PointerEvent(ty, { bubbles: true, pointerId: 7, clientX: x, clientY: r.top + 10 }));
  PE('pointerdown', r.left);
  for (let m = 1; m <= 6; m++){ PE('pointermove', r.left + m * (W * 2.8 / 6)); await s(60); }
  out.torn = t.classList.contains('torn');
  out.stubReparented = stub.parentElement === document.body;
  PE('pointerup', 0);
  await s(6500);
  out.reprintShown = document.getElementById('reprint').classList.contains('show');
  out.stubFell = stub.getBoundingClientRect().top > r.top + 40;
  out.stubRotated = getComputedStyle(stub).transform.includes('matrix');
  document.getElementById('reprint').click();
  await s(500);
  out.restored = stub.parentElement === t && !t.classList.contains('torn');
  out.qrDark1 = dark();
  return out;
})()`;

T['064-desert-dunes-parallax.html'] = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  const g = v => document.documentElement.style.getPropertyValue(v);
  const out = {};
  const a = { sunx: g('--sunx'), suny: g('--suny'), clock: document.getElementById('clock').textContent, d1: g('--d1') };
  await s(13500);
  const b = { sunx: g('--sunx'), suny: g('--suny'), clock: document.getElementById('clock').textContent, d1: g('--d1'), sky2: g('--sky2') };
  out.t0 = a; out.t13 = b;
  out.cycleMoves = a.sunx !== b.sunx && a.clock !== b.clock;
  out.sunDesends = parseFloat(b.suny) > parseFloat(a.suny);
  const sc = document.getElementById('scrub');
  sc.value = 950; sc.dispatchEvent(new Event('input', { bubbles: true }));
  await s(350);
  out.scrub = { clock: document.getElementById('clock').textContent, starA: g('--starA'), sunA: g('--sunA'), pauseLabel: document.getElementById('pause').textContent, sky2: g('--sky2') };
  out.wind = document.getElementById('wind').textContent;
  const cv = document.getElementById('sand');
  out.sandSized = cv.width > 0 && cv.height > 0;
  return out;
})()`;

/* ==================== main ==================== */
(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*',
    '--window-size=1280,900', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    await waitPort();
    const all = {};
    for (const f of Object.keys(T)){
      try { all[f] = await runTest(f, T[f]); }
      catch(e){ all[f] = { error: String(e) }; }
    }
    console.log(JSON.stringify(all, null, 1));
  } finally {
    chrome.kill('SIGKILL');
  }
  process.exit(0);
})().catch(e => { console.error('DRIVER FAIL', e); process.exit(1); });
