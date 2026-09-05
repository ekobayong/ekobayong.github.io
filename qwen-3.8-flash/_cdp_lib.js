/* throwaway CDP mechanics library shared by smoke + screenshot drivers */
'use strict';
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9378;
const DIR = __dirname.replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
        const payload = buf.subarray(off, off + len); buf = buf.subarray(off + len);
        if (op === 8){ sock.destroy(); return; }
        if (op && op !== 10){ fragOp = op; frag = [payload]; } else frag.push(payload);
        if (fin){
          const full = Buffer.concat(frag);
          if (fragOp === 1){ const txt = full.toString('utf8'); for (const l of listeners) l(txt); }
          frag = []; fragOp = 0;
        }
      }
    }
    sock.on('data', d => {
      if (!hs){ const i = d.indexOf('\r\n\r\n'); if (i < 0) return; hs = true; buf = d.subarray(i + 4); }
      else buf = Buffer.concat([buf, d]);
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
  return { send, close: () => ws.close(),
    evaluate: async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'page exception');
      return r.result.value;
    } };
}

async function waitPort(){
  for (let i=0;i<120;i++){
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version'); if (r.ok) return; } catch(e){}
    await sleep(250);
  }
  throw new Error('chrome devtools never came up');
}

async function run(file, cb){
  let chrome = run.chrome;
  if (!chrome){
    chrome = run.chrome = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--remote-debugging-port=' + PORT, '--remote-allow-origins=*',
      '--window-size=1280,900', 'about:blank'
    ], { stdio: 'ignore' });
    await waitPort();
  }
  const url = 'file:///' + DIR + '/' + file;
  let resp = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!resp.ok) resp = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url));
  const tgt = await resp.json();
  const s = await session(tgt.webSocketDebuggerUrl);
  await s.send('Page.enable'); await s.send('Runtime.enable');
  for (let i=0;i<80;i++){
    if (await s.evaluate('document.readyState') === 'complete') break;
    await sleep(150);
  }
  s.send = s.send || null;
  const wrapped = { send: (m,p) => s.send(m,p), evaluate: s.evaluate };
  try { await cb(wrapped); } finally {
    try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + tgt.id); } catch(e){}
    s.close();
  }
}
async function shutdown(){ if (run.chrome){ run.chrome.kill('SIGKILL'); run.chrome = null; } }

module.exports = { run, shutdown };
