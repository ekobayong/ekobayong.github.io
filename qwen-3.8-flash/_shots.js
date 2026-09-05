/* throwaway screenshot pass — visual confirmation of the four pages */
'use strict';
const fs = require('fs');
const mod = require('./_cdp_lib.js');

(async () => {
  const { run } = mod;
  async function shot(file, prep, name, waitAfter){
    const expr = `(async () => { const s = ms => new Promise(r=>setTimeout(r,ms)); ${prep} await s(${waitAfter}); return document.title; })()`;
    await run(file, async (sess) => {
      await sess.evaluate(expr);
      const r = await sess.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('_shot_' + name + '.png', Buffer.from(r.data, 'base64'));
    });
  }
  await shot('061-leather-field-notebook.html',
    "document.getElementById('cover').click(); await s(1500); document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'})); await s(1350); document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));",
    '061', 1500);
  await shot('062-harmonograph-drawing.html', "document.getElementById('bRand').click();", '062', 5000);
  await shot('063-holographic-concert-ticket.html', "", '063', 1200);
  await shot('064-desert-dunes-parallax.html',
    "const sc=document.getElementById('scrub'); sc.value=780; sc.dispatchEvent(new Event('input',{bubbles:true}));",
    '064', 1500);
  console.log('shots done');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
