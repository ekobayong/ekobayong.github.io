// temporary CDP verification driver — deleted after use
const base = 'http://127.0.0.1:9333';
const DIR = 'file:///D:/Project/uji-model/html/qwen-3.8-flash';
const j = async (p, opt) => { const r = await fetch(base + p, opt); return r.json(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function attach(urlFrag) {
  const t = await j('/json/new?url=about:blank', { method: 'PUT' });
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || 'exc').split('\n')[0]);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console: ' + JSON.stringify(m.params.args.map(a => a.value)));
  };
  const send = (method, params) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const loaded = new Promise(res => {
    const h = e => { const m = JSON.parse(e.data); if (m.method === 'Page.loadEventFired') { res(); ws.removeEventListener ? null : null; } };
    ws.addEventListener('message', h);
  });
  await send('Page.navigate', { url: DIR + '/' + urlFrag });
  await loaded; await sleep(400);
  const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    .then(m => { if (m.result?.exceptionDetails) return 'EVAL-ERR: ' + (m.result.exceptionDetails.exception?.description || '').split('\n')[0]; return m.result?.result?.value; });
  const href = await ev('location.href');
  if (!href.includes(urlFrag)) throw new Error('wrong context: ' + href);
  return { ws, ev, errs };
}

async function test089() {
  console.log('== 089 keyboard playability ==');
  const { ws, ev, errs } = await attach('089-mini-synth-keyboard.html');
  console.log('keys rendered:', await ev("document.querySelectorAll('.key').length"));
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ'}))");
  await sleep(300);
  console.log('after Z       → status:', await ev("document.getElementById('statusText').textContent"),
    '| powerLED:', await ev("document.getElementById('powerLed').classList.contains('on')"),
    '| keys lit:', await ev("document.querySelectorAll('.key.on').length"),
    '| signalLED:', await ev("document.getElementById('sigLed').classList.contains('on')"),
    '| audioCtx:', await ev("(function(){try{return new AudioContext().sampleRate}catch(e){return 'x'}})()"));
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}))");
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ'}))");
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ'}))"); // repeat ignored
  await sleep(250);
  console.log('poly Z+E+Q    → keys lit:', await ev("document.querySelectorAll('.key.on').length"));
  await ev("['KeyZ','KeyE','KeyQ'].forEach(c=>document.dispatchEvent(new KeyboardEvent('keyup',{code:c})))");
  await sleep(150);
  console.log('after keyups  → keys lit:', await ev("document.querySelectorAll('.key.on').length"));
  const gliss = await ev(`(async () => {
    const keys=document.getElementById('keys');
    const ws=[...keys.querySelectorAll('.key.w')];
    const pt=(el)=>{const b=el.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height*0.75};};
    const a=pt(ws[1]), b=pt(ws[10]);
    ws[1].dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,clientX:a.x,clientY:a.y,bubbles:true}));
    await new Promise(r=>setTimeout(r,60));
    const hit=ws[1].classList.contains('on');
    ws[10].dispatchEvent(new PointerEvent('pointermove',{pointerId:7,clientX:b.x,clientY:b.y,bubbles:true}));
    await new Promise(r=>setTimeout(r,60));
    const mid=document.querySelectorAll('.key.on').length;
    const moved=ws[10].classList.contains('on');
    ws[10].dispatchEvent(new PointerEvent('pointerup',{pointerId:7,clientX:b.x,clientY:b.y,bubbles:true}));
    await new Promise(r=>setTimeout(r,60));
    return {hit, mid, moved, after:document.querySelectorAll('.key.on').length};
  })()`);
  console.log('glissando     →', JSON.stringify(gliss));
  await ev("document.getElementById('octUp').click()");
  console.log('octave +      →', await ev("document.getElementById('octReadout').textContent"),
    '| C3 label now:', await ev("document.querySelector('.key.w .note').textContent"));
  await ev("document.getElementById('octDown').click()");
  const arp = await ev(`(async () => {
    ['KeyZ','KeyX','KeyE'].forEach(c=>document.dispatchEvent(new KeyboardEvent('keydown',{code:c})));
    document.getElementById('arpBtn').click();
    await new Promise(r=>setTimeout(r,1100));
    const leds=document.querySelectorAll('#stepLeds i.on').length;
    const heldLit=document.querySelectorAll('.key.on').length;
    document.getElementById('arpBtn').click();
    ['KeyZ','KeyX','KeyE'].forEach(c=>document.dispatchEvent(new KeyboardEvent('keyup',{code:c})));
    await new Promise(r=>setTimeout(r,80));
    return {leds, heldLit, afterRelease:document.querySelectorAll('.key.on').length};
  })()`);
  console.log('arp w/ 3 held → step LED on:', arp.leds, '| held keys lit:', arp.heldLit, '| cleared:', arp.afterRelease);
  const knob = await ev(`(async () => {
    const k=document.querySelector('#knobs-flt .knob');
    const r=k.getBoundingClientRect(), x=r.x+8, y=r.y+8;
    k.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,clientX:x,clientY:y,bubbles:true}));
    k.dispatchEvent(new PointerEvent('pointermove',{pointerId:9,clientX:x,clientY:y-80,bubbles:true}));
    k.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,clientX:x,clientY:y-80,bubbles:true}));
    await new Promise(r=>setTimeout(r,120));
    return 'aria='+k.getAttribute('aria-valuenow')+' val='+k.nextElementSibling.textContent+' rot='+k.style.transform;
  })()`);
  console.log('cutoff drag   →', knob);
  console.log('089 errors:', errs.length ? errs : 'none');
  ws.close();
}

async function test090() {
  console.log('== 090 scene ==');
  const { ws, ev, errs } = await attach('090-bioluminescent-deep-sea.html');
  await sleep(1500);
  console.log('medusae HUD:', await ev("document.getElementById('nJelly').textContent"));
  await ev("window.dispatchEvent(new PointerEvent('pointerdown',{clientX:600,clientY:300,bubbles:true}))");
  await sleep(400);
  console.log('after click   → medusae:', await ev("document.getElementById('nJelly').textContent"),
    '| hint faded:', await ev("document.getElementById('hint').classList.contains('fade')"),
    '| depth:', await ev("document.getElementById('depth').textContent"));
  // cap at nine
  await ev("(async()=>{for(let i=0;i<8;i++){window.dispatchEvent(new PointerEvent('pointerdown',{clientX:100+i*40,clientY:200,bubbles:true})); await new Promise(r=>setTimeout(r,30));}})()");
  console.log('after 10 clicks → medusae:', await ev("document.getElementById('nJelly').textContent"));
  console.log('090 errors:', errs.length ? errs : 'none');
  ws.close();
}

async function test091() {
  console.log('== 091 blueprint ==');
  const { ws, ev, errs } = await attach('091-blueprint-schematic-draw.html');
  console.log('rooms:', await ev("document.querySelectorAll('#sheet101 .room').length"),
    '| dw els sheet1:', await ev("document.querySelectorAll('#sheet101 .dw').length"));
  // switch to sheet 2 via keyboard
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true}))");
  await sleep(300);
  console.log('after key 2   → sheet2 visible:', await ev("document.getElementById('sheet201').classList.contains('live')"),
    '| titleblock:', await ev("document.getElementById('tbSheet').textContent"), await ev("document.getElementById('tbScale').textContent"));
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'3',bubbles:true}))");
  await sleep(200);
  console.log('after key 3   → sheet3 visible:', await ev("document.getElementById('sheet301').classList.contains('live')"));
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}))");
  await sleep(200);
  console.log('print toggle  → body.print:', await ev("document.body.classList.contains('print')"),
    '| ink var:', await ev("getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()"));
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}))");
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true}))");
  await sleep(9000);
  console.log('sheet1 replay → status:', await ev("document.getElementById('statTxt').textContent"),
    '| dasharray set on els:', await ev("[...document.querySelectorAll('#sheet101 .dw')].filter(e=>e.style.strokeDasharray).length"));
  // room hover → tooltip
  const tt = await ev(`(() => {
    const hit=document.querySelector('#sheet101 .room .roomfill');
    const r=hit.getBoundingClientRect();
    hit.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true}));
    return document.getElementById('tip').textContent + ' | display:' + getComputedStyle(document.getElementById('tip')).display;
  })()`);
  console.log('room tooltip  →', tt);
  console.log('091 errors:', errs.length ? errs : 'none');
  ws.close();
}

async function test092() {
  console.log('== 092 foundry ==');
  const { ws, ev, errs } = await attach('092-gradient-type-hero.html');
  console.log('cascade rows:', await ev("document.querySelectorAll('.cascaderow').length"),
    '| info:', await ev("document.getElementById('info').textContent"),
    '| feat cards:', await ev("document.querySelectorAll('.feat').length"));
  const f = await ev(`(() => {
    const card=document.querySelector('.feat');
    card.click();
    return 'on:' + card.classList.contains('on') + ' pill:' + card.querySelector('.pill').textContent + ' aria:' + card.getAttribute('aria-pressed');
  })()`);
  console.log('feature click →', f);
  const t = await ev(`(() => {
    const el=document.getElementById('tsize'); el.value=120; el.dispatchEvent(new Event('input',{bubbles:true}));
    const tx=document.getElementById('ttext');
    document.querySelector('.chip[data-case="uppercase"]').click();
    return document.getElementById('oSize').textContent + ' | ' + document.getElementById('info').textContent + ' | tf:' + getComputedStyle(document.getElementById('preview')).textTransform;
  })()`);
  console.log('tester ctl    →', t);
  console.log('092 errors:', errs.length ? errs : 'none');
  ws.close();
}

async function overflow() {
  console.log('== 375px horizontal overflow ==');
  for (const f of ['089-mini-synth-keyboard.html','090-bioluminescent-deep-sea.html','091-blueprint-schematic-draw.html','092-gradient-type-hero.html']) {
    const { ws, ev } = await attach(f);
    await send2(ws, 'Emulation.setDeviceMetricsOverride', { width: 375, height: 700, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
    const r = await ev("JSON.stringify({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth})");
    console.log(f.slice(0,3), r);
    ws.close();
  }
}
function send2(ws, method, params){ return new Promise(res=>{ const i=Math.floor(Math.random()*1e6); const h=e=>{const m=JSON.parse(e.data); if(m.id===i){ws.removeEventListener('message',h);res(m);}}; ws.addEventListener('message',h); ws.send(JSON.stringify({id:i,method,params})); }); }

(async () => {
  await test089(); await test090(); await test091(); await test092();
  await overflow();
})().catch(e => { console.error('DRIVER FAIL:', e.message); process.exit(1); });

