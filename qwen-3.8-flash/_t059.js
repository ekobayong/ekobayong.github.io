
(() => {
"use strict";
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* nav condense */
const nav = document.getElementById('nav');
addEventListener('scroll', ()=>{
  nav.classList.toggle('scrolled', scrollY > 40);
}, { passive:true });
nav.classList.toggle('scrolled', scrollY > 40);

/* reveal on scroll */
const io = new IntersectionObserver(entries=>{
  for(const e of entries){
    if(!e.isIntersecting) continue;
    const el = e.target;
    io.unobserve(el);
    const d = parseInt(el.dataset.d || '0', 10) || 0;
    if(reduced){ el.classList.add('in'); continue; }
    setTimeout(()=>el.classList.add('in'), d);
  }
}, { threshold:.16, rootMargin:'0px 0px -6% 0px' });
document.querySelectorAll('[data-reveal]').forEach(el=>io.observe(el));

/* experiences strip */
const track = document.getElementById('expTrack');
function cardStep(){ const c = track.querySelector('.exp'); return c ? c.getBoundingClientRect().width + 22 : 320; }
document.getElementById('expNext').addEventListener('click', ()=>track.scrollBy({left:cardStep(), behavior:reduced?'auto':'smooth'}));
document.getElementById('expPrev').addEventListener('click', ()=>track.scrollBy({left:-cardStep(), behavior:reduced?'auto':'smooth'}));

/* booking */
const eur = n => '€' + n.toLocaleString('en-US');
const $ = id => document.getElementById(id);
const arr = $('arrival'), dep = $('departure'), guestsOut = $('guests'), roomSel = $('roomSel');
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const DAY = 86400000;
const today = new Date();
const a0 = new Date(today.getTime() + 14*DAY);
const d0 = new Date(a0.getTime() + 3*DAY);
arr.value = iso(a0); dep.value = iso(d0);
arr.min = iso(today);
let guests = 2;
function syncMins(){
  const a = new Date(arr.value + 'T12:00:00');
  if(!isNaN(a)) dep.min = iso(new Date(a.getTime() + DAY));
}
syncMins();
function nights(){
  const a = new Date(arr.value + 'T12:00:00'), d = new Date(dep.value + 'T12:00:00');
  if(isNaN(a) || isNaN(d)) return 3;
  return Math.max(1, Math.round((d - a)/DAY));
}
function calc(){
  const n = nights();
  const rate = +roomSel.value;
  const base = rate * n;
  const extra = Math.max(0, guests - 2) * 60 * n;
  const sub = base + extra;
  const courtesy = n >= 5 ? Math.round(sub * .10) : 0;
  $('sNights').textContent = n + (n===1 ? ' night' : ' nights');
  $('sRoom').textContent = eur(base);
  const er = $('sExtraRow');
  er.hidden = extra === 0;
  $('sExtraLabel').textContent = guests >= 3 ? `Extra guests (×${guests-2})` : 'Extra guests';
  $('sExtra').textContent = eur(extra);
  $('sCourtesyRow').hidden = courtesy === 0;
  $('sCourtesy').textContent = '−' + eur(courtesy);
  $('sTotal').textContent = eur(sub - courtesy);
}
arr.addEventListener('change', ()=>{ syncMins(); calc(); });
dep.addEventListener('change', calc);
roomSel.addEventListener('change', calc);
$('gMinus').addEventListener('click', ()=>{ guests = Math.max(1, guests-1); guestsOut.textContent = guests; $('gMinus').disabled = guests<=1; $('gPlus').disabled = guests>=4; calc(); });
$('gPlus').addEventListener('click',  ()=>{ guests = Math.min(4, guests+1); guestsOut.textContent = guests; $('gMinus').disabled = guests<=1; $('gPlus').disabled = guests>=4; calc(); });
$('gMinus').disabled = guests<=1; $('gPlus').disabled = guests>=4;
calc();
$('reqBtn').addEventListener('click', ()=>{
  const c = $('confirm');
  c.innerHTML = `Thank you — we have your request for <b>${guests} ${guests===1?'guest':'guests'}</b>,
    ${arr.value} to ${dep.value} (${nights()} night${nights()===1?'':'s'}) in the
    ${roomSel.selectedOptions[0].textContent.split(' — ')[0]}. A note from the desk will reach you within 24 hours.`;
  c.classList.add('show');
});

/* testimonials */
const quotes = [...document.querySelectorAll('.tstage blockquote')];
const dots = [...document.querySelectorAll('#dots button')];
let ti = 0, timer = null;
function show(i){
  ti = (i + quotes.length) % quotes.length;
  quotes.forEach((q,k)=>q.classList.toggle('on', k===ti));
  dots.forEach((d,k)=>d.classList.toggle('on', k===ti));
}
function auto(){
  clearInterval(timer);
  timer = setInterval(()=>show(ti+1), reduced ? 20000 : 6500);
}
dots.forEach((d,k)=>d.addEventListener('click', ()=>{ show(k); auto(); }));
auto();
})();
