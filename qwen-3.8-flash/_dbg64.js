/* throwaway: isolate the 064 rectangular glow artifact */
'use strict';
const fs = require('fs');
const { run, shutdown } = require('./_cdp_lib.js');

(async () => {
  await run('064-desert-dunes-parallax.html', async (sess) => {
    await sess.evaluate(`(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));
      const sc=document.getElementById('scrub'); sc.value=780; sc.dispatchEvent(new Event('input',{bubbles:true}));
      await s(800);
      document.getElementById('sun').style.filter='none';
      await s(400);})()`);
    let r = await sess.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('_dbg_sun_nofilter.png', Buffer.from(r.data, 'base64'));
    await sess.evaluate(`(async()=>{const h=document.querySelector('.haze-band'); h.style.display='none';})()`);
    r = await sess.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('_dbg_haze_off.png', Buffer.from(r.data, 'base64'));
  });
  await shutdown();
  console.log('dbg done');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
