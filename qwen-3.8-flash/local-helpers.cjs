async function openTab(url){
  return await browser.open({ name: "t"+Math.random().toString(36).slice(2,7), url, viewport:{width:1440,height:900} });
}
async function openWatched(url){
  const tab = await browser.open({ name: "w"+Math.random().toString(36).slice(2,7), url: "about:blank", viewport:{width:1440,height:900} });
  await tab.run(async ({ page }, u) => {
    globalThis.__errs = [];
    page.on('pageerror', e => globalThis.__errs.push(String((e && e.stack || e).split('\n').slice(0,3).join(' | '))));
    await page.goto(u);
  }, { args: [url] });
  return tab;
}
async function getErrs(tab){ return await tab.run(async () => globalThis.__errs || []); }
async function ev(tab, src){
  return await tab.run(async ({ page }, code) => {
    const fn = (0, eval)('(' + code + ')');
    return await page.evaluate(fn);
  }, { args: [src] });
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
module.exports = { openTab, openWatched, getErrs, ev, sleep };
