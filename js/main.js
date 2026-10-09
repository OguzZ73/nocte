/* NOCTÉ — page choreography. */
import { COLLECTION, PRODUCTS, SIZES, fmt } from './data.js';
import { createCart, initShop } from './shop.js';

const { gsap, ScrollTrigger, SplitText, Flip, CustomEase } = window;
gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase);
CustomEase.create('silk', 'M0,0 C0.16,1 0.3,1 1,1');
CustomEase.create('curtain', 'M0,0 C0.76,0 0.24,1 1,1');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
let isMobile = innerWidth < 861;
const root = document.documentElement;

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.body.classList.add('is-loading');

/* ───────── loader ───────── */
const L = { p: 0, shown: 0, num: $('.loader__num'), bar: $('.loader__bar i'), task: $('.loader__task') };
const progress = (p, task) => { L.p = Math.max(L.p, p); if (task) L.task.textContent = task; };
gsap.fromTo('.loader__word span', { y: 0, yPercent: 105 }, { yPercent: 0, duration: 1.1, ease: 'silk', stagger: 0.06, delay: 0.1 });
gsap.ticker.add(() => {
  if (L.done) return;
  L.shown += (L.p - L.shown) * 0.09;
  L.num.textContent = String(Math.round(L.shown * 100)).padStart(3, '0');
  L.bar.style.transform = `scaleX(${L.shown})`;
});

/* ───────── 3D studio ───────── */
let studio = null, photoDefs = [];
const renders = {};
async function bootStudio() {
  try {
    const [{ Showroom }, { PHOTO_DEFS }] = await Promise.all([import('./scene.js'), import('./products.js')]);
    photoDefs = PHOTO_DEFS;
    progress(0.12, 'Fotoğraflar yükleniyor');
    studio = new Showroom($('.gl'));
    const tasks = ['Kalıplar çıkarılıyor', 'Kumaşa hacim veriliyor', 'Dikişler kontrol ediliyor', 'Askılar diziliyor', 'Stüdyo ışıkları'];
    await studio.build(PHOTO_DEFS, (i, n) => progress(0.16 + (i / n) * 0.46, tasks[Math.min(i, tasks.length - 1)]));
    COLLECTION.forEach((m) => applyColor(m.garment, m.colors[0], true));
    progress(0.66, 'Ürün fotoğrafları çekiliyor');
    await new Promise((r) => requestAnimationFrame(r));
    const shots = [];
    COLLECTION.forEach((m) => m.colors.forEach((col, c) => {
      const inShop = PRODUCTS.some((p) => p.ref === m.id && p.c === c);
      const base = { id: `${m.id}-${c}`, gi: m.garment, color: col.hex, amt: col.orig ? 0 : 1 };
      shots.push({ ...base, side: 'front', ry: -0.16 });
      if (inShop) shots.push({ ...base, side: 'back', ry: 0.62 });
    }));
    const urls = studio.snapshots(shots);
    shots.forEach((s, i) => { (renders[s.id] ||= {})[s.side] = urls[i]; });
  } catch (err) {
    console.warn('[NOCTÉ] 3D studio unavailable:', err);
    studio = null;
    $('.gl').style.display = 'none';
  }
}

async function preloadImages() {
  const imgs = $$('.look img, .reveal img').slice(0, 7);
  await Promise.race([
    Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
}

/* ───────── collection panels ───────── */
const chosen = COLLECTION.map(() => ({ c: 0, size: 'M' }));
function buildCollection() {
  $('.collection__panels').innerHTML = COLLECTION.map((m, i) => `
    <article class="product${i === 0 ? ' is-active' : ''}" data-i="${i}" aria-label="${m.name.join(' ')}">
      <p class="product__no"><span>${String(i + 1).padStart(2, '0')}</span></p>
      <h3 class="product__name">${m.name.map((l) => `<span class="line-mask"><span class="ln">${l}</span></span>`).join('')}</h3>
      <p class="product__desc fx">${m.desc}</p>
      <dl class="specs fx">${m.specs.map(([k, v]) => `<dt class="mono">${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="opts fx">
        <div class="opt-row"><span class="mono">Renk</span>${m.colors.map((c, k) => `<button type="button" class="swatch${k === 0 ? ' is-active' : ''}" style="--c:${c.hex}" data-c="${k}" aria-label="${c.n}" aria-pressed="${k === 0}"></button>`).join('')}<span class="swatch-name">${m.colors[0].n}</span></div>
        <div class="opt-row opt-row--size"><span class="mono">Beden</span>${SIZES.map((s) => `<button type="button" class="size${s === 'M' ? ' is-active' : ''}" data-s="${s}" aria-pressed="${s === 'M'}">${s}</button>`).join('')}</div>
      </div>
      <div class="buy fx"><span class="price">${fmt(m.price)}</span><button type="button" class="btn" data-magnetic data-add="${i}"><span>Sepete ekle</span></button></div>
    </article>`).join('');
  $('.collection__ghost').innerHTML = COLLECTION.map((m, i) => `<div class="ghost" data-i="${i}">${[...m.ghost].map((ch) => `<span class="char">${ch}</span>`).join('')}</div>`).join('');
  $('.collection__rail').innerHTML = COLLECTION.map((m, i) => `<li class="mono${i === 0 ? ' is-active' : ''}">${m.cat}<i></i></li>`).join('');
  $$('.ghost').forEach((g, i) => i && gsap.set(g.children, { yPercent: 135 }));
  $$('.product').forEach((p, i) => {
    if (!i) return;
    gsap.set($$('.ln, .product__no span', p), { yPercent: 115 });
    gsap.set($$('.fx', p), { autoAlpha: 0, y: 18 });
  });

  $('.collection__panels').addEventListener('click', (e) => {
    const prod = e.target.closest('.product'); if (!prod) return;
    const i = +prod.dataset.i, m = COLLECTION[i];
    const sw = e.target.closest('.swatch');
    if (sw) {
      const c = +sw.dataset.c; chosen[i].c = c;
      $$('.swatch', prod).forEach((b) => { b.classList.toggle('is-active', b === sw); b.setAttribute('aria-pressed', b === sw); });
      const name = $('.swatch-name', prod);
      gsap.to(name, { autoAlpha: 0, y: -6, duration: 0.2, onComplete: () => { name.textContent = m.colors[c].n; gsap.to(name, { autoAlpha: 1, y: 0, duration: 0.35 }); } });
      applyColor(m.garment, m.colors[c]);
      return;
    }
    const sz = e.target.closest('.size');
    if (sz) {
      chosen[i].size = sz.dataset.s;
      $$('.size', prod).forEach((b) => { b.classList.toggle('is-active', b === sz); b.setAttribute('aria-pressed', b === sz); });
      return;
    }
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) { flyToCart(addBtn); cart.add(m.id, chosen[i].c, chosen[i].size); }
  });
}

/* a brass bead arcs from the button into the cart */
function flyToCart(from) {
  if (reduce) return;
  const a = from.getBoundingClientRect(), b = $('#cartCount').getBoundingClientRect();
  const dot = document.createElement('i'); dot.className = 'fly-dot'; document.body.appendChild(dot);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const o = { t: 0 };
  gsap.to(o, {
    t: 1, duration: 0.9, ease: 'power2.inOut',
    onUpdate: () => {
      const t = o.t, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * 160;
      dot.style.transform = `translate(${x}px, ${y}px) scale(${1 - t * 0.5})`;
    },
    onComplete: () => dot.remove(),
  });
}

const tintNow = {};
function applyColor(gi, col, instant) {
  if (!studio) return;
  const to = { hex: col.hex, amt: col.orig ? 0 : 1 }, from = tintNow[gi] || to;
  tintNow[gi] = to;
  if (instant || reduce) { studio.setTint(gi, to.hex, to.amt); return; }
  const a = hexRGB(from.hex), b = hexRGB(to.hex), o = { t: 0 };
  gsap.to(o, {
    t: 1, duration: 0.9, ease: 'power2.inOut',
    onUpdate: () => { const c = a.map((v, k) => Math.round(v + (b[k] - v) * o.t)); studio.setTint(gi, `rgb(${c.join(',')})`, from.amt + (to.amt - from.amt) * o.t); },
  });
}
const hexRGB = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

let curProduct = 0;
const PANEL_IN = (p) => $$('.ln, .product__no span', p);
function showProduct(i) {
  if (i === curProduct) return;
  const prev = curProduct; curProduct = i;
  const P = $$('.product'), G = $$('.ghost'), dir = i > prev ? 1 : -1;
  P.forEach((p, k) => {
    if (k === i || k === prev) return;
    p.classList.remove('is-active');
    gsap.set(PANEL_IN(p), { yPercent: 115, overwrite: true });
    gsap.set($$('.fx', p), { autoAlpha: 0, overwrite: true });
    gsap.set(G[k].children, { yPercent: 135, overwrite: true });
  });
  const out = P[prev], inn = P[i];
  gsap.to(PANEL_IN(out), { yPercent: -115 * dir, duration: 0.55, ease: 'power3.in', stagger: 0.04, overwrite: true });
  gsap.to($$('.fx', out), { autoAlpha: 0, y: -14 * dir, duration: 0.35, ease: 'power2.in', overwrite: true, onComplete: () => curProduct !== prev && out.classList.remove('is-active') });
  inn.classList.add('is-active');
  gsap.fromTo(PANEL_IN(inn), { yPercent: 115 * dir }, { yPercent: 0, duration: 1.1, ease: 'silk', stagger: 0.07, delay: 0.25, overwrite: true });
  gsap.fromTo($$('.fx', inn), { autoAlpha: 0, y: 18 * dir }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'silk', stagger: 0.06, delay: 0.4, overwrite: true });
  gsap.to(G[prev].children, { yPercent: -135 * dir, duration: 0.6, ease: 'power3.in', stagger: 0.03, overwrite: true });
  gsap.fromTo(G[i].children, { yPercent: 135 * dir }, { yPercent: 0, duration: 1.2, ease: 'silk', stagger: 0.05, delay: 0.2, overwrite: true });
  $$('.collection__rail li').forEach((li, k) => li.classList.toggle('is-active', k === i));
  $('.collection__cur').textContent = String(i + 1).padStart(2, '0');
  setTheme(COLLECTION[i].bg, COLLECTION[i].fg);
}

/* ───────── theme ───────── */
let themeNow = '';
function setTheme(bg, fg, instant) {
  const key = bg + fg; if (key === themeNow) return; themeNow = key;
  gsap.to(root, { '--bg': bg, '--fg': fg, duration: instant ? 0 : 1.1, ease: 'power2.out', overwrite: 'auto' });
}

/* ───────── choreography: scroll → garment pose ───────── */
const KEYS = [
  ['hero', 0, { x: 0, y: 0.03, s: 0.9, ry: -0.24, rx: 0.03, rz: 0, m: 0, reveal: 1 }, { s: 0.92, y: 0.04 }],
  ['hero', 1, { x: 0.42, s: 0.84, ry: 0.5, rx: 0.02 }, { x: 0, y: 0.3, s: 0.6, reveal: 0 }],
  ['mani', 1, { x: 0.42, s: 0.84, ry: -0.38 }, { x: 0, y: 0.33, s: 0.66, reveal: 0 }],
  ['col', 0, { x: 0.27, s: 0.86, ry: -0.28, rx: 0.03 }, { x: 0, y: 0.33, s: 0.66, reveal: 1 }],
  ['col', 0.18, { ry: 0.22, m: 0 }],
  ['col', 0.32, { ry: -0.22, m: 1 }],
  ['col', 0.43, { ry: 0.22, m: 1 }],
  ['col', 0.57, { ry: -0.22, m: 2 }],
  ['col', 0.68, { ry: 0.22, m: 2 }],
  ['col', 0.82, { ry: -0.22, m: 3 }],
  ['col', 1, { ry: 0.3, m: 3, reveal: 1, y: 0 }, { y: 0.33 }],
  ['lbIn', 0.55, { y: 0.4, s: 0.8, ry: 0.9, reveal: 0 }, { y: 0.7 }],
  ['anIn', 0.25, { m: 0, x: 0, y: -0.1, s: 0.74, ry: -0.7, rx: 0.04, reveal: 0 }, { y: 0.04, s: 0.78 }],
  ['anIn', 1, { y: 0.02, s: 0.8, ry: -0.16, reveal: 1 }, { y: 0.1, s: 0.82 }],
  ['an', 0.5, { ry: 0.1 }],
  ['an', 1, { ry: 0.26, rx: 0.05 }],
  ['crIn', 0.45, { y: 0.4, reveal: 0 }],
];
const ST = {};
let keyTrack = { d: [], m: [] };
function buildKeys() {
  const fill = (mobile) => {
    let acc = {};
    return KEYS.map(([id, at, s, mo]) => {
      acc = { ...acc, ...s, ...(mobile ? mo : null) };
      const st = ST[id];
      return { y: st ? st.start + (st.end - st.start) * at : 0, s: { ...acc } };
    }).sort((a, b) => a.y - b.y);
  };
  keyTrack = { d: fill(false), m: fill(true) };
}
function poseAt(y) {
  const K = isMobile ? keyTrack.m : keyTrack.d;
  if (!K.length) return null;
  if (y <= K[0].y) return K[0].s;
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i], b = K[i + 1];
    if (y < b.y) {
      let t = (y - a.y) / Math.max(1, b.y - a.y); t = t * t * (3 - 2 * t);
      const o = {};
      for (const k in a.s) o[k] = a.s[k] + (b.s[k] - a.s[k]) * t;
      return o;
    }
  }
  return K[K.length - 1].s;
}

/* ───────── scroll scenes ───────── */
let lenis = null, cart = null;
function scenes() {
  // collection — pinned through four garments
  ST.col = ScrollTrigger.create({
    trigger: '#collection', start: 'top top', end: () => '+=' + innerHeight * (isMobile ? 3.2 : 4), pin: true, anticipatePin: 1,
    onUpdate: (self) => { const p = self.progress; showProduct(p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3); },
    onToggle: (self) => {
      if (self.isActive) {
        setTheme(COLLECTION[curProduct].bg, COLLECTION[curProduct].fg);
        COLLECTION.forEach((m, i) => applyColor(m.garment, m.colors[chosen[i].c]));
      }
    },
  });

  // lookbook — horizontal track
  const track = $('.lookbook__track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const lbTween = gsap.to(track, { x: () => -dist(), ease: 'none' });
  const skewTo = gsap.quickTo('.look', 'skewX', { duration: 0.6, ease: 'power3' });
  const looks = $$('.look');
  ST.lb = ScrollTrigger.create({
    trigger: '#lookbook', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.9, animation: lbTween, invalidateOnRefresh: true, anticipatePin: 1,
    onUpdate: (self) => {
      $('.lookbook__progress b').style.transform = `scaleX(${self.progress})`;
      $('.lookbook__idx').textContent = String(Math.min(6, Math.max(1, Math.round(self.progress * 5) + 1))).padStart(2, '0');
      if (!reduce) skewTo(gsap.utils.clamp(-7, 7, self.getVelocity() / -350));
    },
  });
  looks.forEach((fig) => {
    gsap.fromTo($('img', fig), { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: fig, containerAnimation: lbTween, start: 'left right', end: 'right left', scrub: true } });
    gsap.fromTo($('.look__media', fig), { clipPath: 'inset(10% 0% 10% 30%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: fig, containerAnimation: lbTween, start: 'left 105%', end: 'center 60%', scrub: true } });
  });

  // full-bleed reveal
  $$('.reveal__line').forEach((l) => { l.innerHTML = `<span>${l.innerHTML}</span>`; });
  const rv = gsap.timeline({ scrollTrigger: { trigger: '#reveal', start: 'top top', end: '+=140%', pin: true, scrub: 1, anticipatePin: 1 } });
  rv.fromTo('.reveal__media', { clipPath: 'inset(24% 32% 24% 32%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.inOut', duration: 1 })
    .fromTo('.reveal__media img', { scale: 1.35 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.reveal__line > span', { yPercent: 115 }, { yPercent: 0, stagger: 0.12, duration: 0.45, ease: 'power3.out' }, 0.62)
    .fromTo('.reveal__cap', { autoAlpha: 0 }, { autoAlpha: 0.8, duration: 0.3 }, 0.85);

  // anatomy — pinned jacket with callouts and loupes
  ST.an = ScrollTrigger.create({
    trigger: '#anatomy', start: 'top top', end: () => '+=' + innerHeight * 2.6, pin: true, anticipatePin: 1,
    onUpdate: (self) => setCallouts(self.progress),
    onToggle: (self) => { anatomyLive = self.isActive; if (self.isActive) applyColor(0, COLLECTION[0].colors[0]); else setCallouts(self.progress > 0.5 ? 1 : 0); },
  });

  // measuring triggers (created after pins so positions include pin spacing)
  const measure = (id, trigger, start, end) => (ST[id] = ScrollTrigger.create({ trigger, start, end }));
  measure('hero', '#hero', 'top top', 'bottom top');
  measure('mani', '#manifesto', 'top top', 'bottom bottom');
  measure('lbIn', '#lookbook', 'top bottom', 'top top');
  measure('anIn', '#anatomy', 'top bottom', 'top top');
  measure('crIn', '#craft', 'top bottom', 'top top');
  ScrollTrigger.create({ trigger: $('#anatomy').closest('.pin-spacer') || '#anatomy', start: 'top 85%', end: 'bottom top', onToggle: (s) => { anatomyNear = s.isActive; } });

  // section themes
  $$('section[data-bg], .footer').forEach((sec) => {
    const bg = sec.dataset.bg || '#0e0c0a', fg = sec.dataset.fg || '#ece6db';
    const trig = sec.closest('.pin-spacer') || sec;
    ScrollTrigger.create({
      trigger: trig, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return;
        if (sec.id === 'collection') setTheme(COLLECTION[curProduct].bg, COLLECTION[curProduct].fg);
        else setTheme(bg, fg);
      },
    });
  });

  // hero exit
  const heroLetters = $$('.hero__title span');
  gsap.to(heroLetters, { yPercent: (i) => -45 - i * 16, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__meta, .hero__foot', { autoAlpha: 0, y: -40, ease: 'none', scrollTrigger: { trigger: '#hero', start: '20% top', end: '70% top', scrub: true } });

  // manifesto — words light up as you read
  const split = SplitText.create('.manifesto__text', { type: 'words', wordsClass: 'word' });
  gsap.fromTo(split.words, { opacity: 0.12 }, { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.manifesto__text', start: 'top 78%', end: 'bottom 42%', scrub: true } });
  gsap.from('.manifesto__facts > div', { y: 30, autoAlpha: 0, stagger: 0.1, duration: 1, ease: 'silk', scrollTrigger: { trigger: '.manifesto__facts', start: 'top 88%' } });

  // headings: masked line rise
  $$('.split-lines').forEach((h) => {
    SplitText.create(h, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.2, ease: 'silk', stagger: 0.1, scrollTrigger: { trigger: h, start: 'top 85%' } }),
    });
  });
  gsap.from('.lookbook__text, .lookbook__intro .label', { autoAlpha: 0, y: 20, duration: 1, ease: 'silk', delay: 0.2, scrollTrigger: { trigger: '#lookbook', start: 'top 70%' } });

  // craft
  $$('.craft__fig').forEach((f, i) => {
    gsap.fromTo($('img', f), { yPercent: -9 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'curtain', delay: i * 0.1, scrollTrigger: { trigger: f, start: 'top 85%' } });
  });
  gsap.from('.steps li', { y: 40, autoAlpha: 0, stagger: 0.1, duration: 1, ease: 'silk', scrollTrigger: { trigger: '.steps', start: 'top 80%' } });
  $$('.count').forEach((el) => {
    const to = +el.dataset.to, o = { v: 0 };
    gsap.to(o, { v: to, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('tr-TR'); } });
  });

  // shop + footer
  ScrollTrigger.batch('.card', { start: 'top 90%', once: true, onEnter: (els) => gsap.fromTo(els, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 1.1, ease: 'silk' }) });
  gsap.set('.card', { autoAlpha: 0 });
  gsap.from('.footer__word span', { yPercent: 100, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: 1 } });

  ScrollTrigger.addEventListener('refresh', buildKeys);
  ScrollTrigger.refresh();
}

/* ───────── anatomy callouts ───────── */
let anatomyLive = false, anatomyNear = false;
const CALL_AT = [0.12, 0.3, 0.48, 0.66];
const callouts = $$('.callout'), paths = $$('.anatomy__lines path'), dots = $$('.anatomy__dots i'), loupes = $$('.loupe');
function setCallouts(p) {
  callouts.forEach((c, i) => {
    const on = p > CALL_AT[i] && (!isMobile || p < (CALL_AT[i + 1] ?? 0.98)) && p < 0.98;
    c.classList.toggle('is-on', on); paths[i].classList.toggle('is-on', on); dots[i].classList.toggle('is-on', on); loupes[i]?.classList.toggle('is-on', on);
  });
}
function setupLoupes() {
  const def = photoDefs[0]; if (!def) return;
  loupes.forEach((l, i) => {
    const anchor = def.anchors?.[callouts[i].dataset.anchor]; if (!anchor) return;
    l.style.backgroundImage = `url(${def.src})`;
    l.dataset.u = anchor[0]; l.dataset.v = anchor[1];
  });
}
const pt = {};
function drawCallouts() {
  if (!studio || !(anatomyLive || anatomyNear)) return;
  const sec = $('#anatomy').getBoundingClientRect(), def = photoDefs[0];
  callouts.forEach((c, i) => {
    const a = studio.project(0, c.dataset.anchor, pt);
    if (!a) return;
    const ax = a.x - sec.left, ay = a.y - sec.top;
    dots[i].style.transform = `translate(${ax}px, ${ay}px)`;
    dots[i].style.visibility = a.front ? 'visible' : 'hidden';
    if (isMobile) return;
    const r = c.getBoundingClientRect(), left = c.dataset.side === 'left';
    const sx = (left ? r.right + 18 : r.left - 18) - sec.left, sy = r.top + 10 - sec.top;
    const L = loupes[i], R = L ? L.offsetWidth / 2 : 0;
    const lx = sx + (left ? 1 : -1) * (40 + R), ly = sy + R * 0.35;
    if (L && def) {
      const bw = (R * 2) / 0.19, bh = bw / def.aspect;
      L.style.transform = `translate(${lx - R}px, ${ly - R}px)`;
      L.style.backgroundSize = `${bw}px ${bh}px`;
      L.style.backgroundPosition = `${R - L.dataset.u * bw}px ${R - L.dataset.v * bh}px`;
    }
    paths[i].setAttribute('d', `M${sx},${sy} L${lx},${ly} L${ax},${ay}`);
  });
}

/* ───────── drag to turn the garment ───────── */
function dragSpin() {
  const zone = $('.collection__drag');
  if (!zone || !studio) return;
  let down = false, lx = 0, moved = 0;
  zone.addEventListener('pointerdown', (e) => { down = true; studio.dragging = true; moved = 0; lx = e.clientX; zone.setPointerCapture?.(e.pointerId); });
  zone.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx);
    studio.userRy = Math.max(-1.15, Math.min(1.15, studio.userRy + dx * 0.009));
  });
  const up = () => { down = false; studio.dragging = false; };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
}

/* ───────── marquee ───────── */
function marquee() {
  const tr = $('.marquee__track');
  let x = 0, dir = 1;
  gsap.ticker.add((_, dt) => {
    if (reduce) return;
    const v = lenis ? lenis.velocity : 0;
    if (v) dir = v > 0 ? 1 : -1;
    x -= (0.6 + Math.min(Math.abs(v), 40) * 0.5) * dir * (dt / 16.7);
    const half = tr.scrollWidth / 2;
    if (x < -half) x += half; if (x > 0) x -= half;
    tr.style.transform = `translate3d(${x}px,0,0)`;
  });
}

/* ───────── cursor + magnetic ───────── */
function cursor() {
  if (!finePointer) return;
  root.classList.add('has-cursor');
  const el = $('.cursor'), dot = $('.cursor__dot'), label = $('.cursor__label');
  const cx = gsap.quickTo(el, 'x', { duration: 0.22, ease: 'power3' }), cy = gsap.quickTo(el, 'y', { duration: 0.22, ease: 'power3' });
  const rot = gsap.quickSetter(dot, 'rotation', 'deg'), sx = gsap.quickTo(dot, 'scaleX', { duration: 0.3 }), sy = gsap.quickTo(dot, 'scaleY', { duration: 0.3 });
  let lx = 0, ly = 0;
  addEventListener('pointermove', (e) => {
    cx(e.clientX); cy(e.clientY);
    // stretch along the direction of travel, never while it carries a label
    const vx = e.clientX - lx, vy = e.clientY - ly, sp = Math.min(Math.hypot(vx, vy) / 60, 0.45);
    lx = e.clientX; ly = e.clientY;
    if (!el.classList.contains('is-label') && sp > 0.02) { rot(Math.atan2(vy, vx) * 180 / Math.PI); sx(1 + sp); sy(1 - sp * 0.5); }
    else { sx(1); sy(1); }
    clearTimeout(el._t); el._t = setTimeout(() => { sx(1); sy(1); }, 80);
    if (studio) { studio.mouse.x = (e.clientX / innerWidth) * 2 - 1; studio.mouse.y = (e.clientY / innerHeight) * 2 - 1; }
    root.style.setProperty('--glow-x', `${40 + (e.clientX / innerWidth) * 20}%`);
  });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => el.classList.add('is-out'));
  document.addEventListener('pointerenter', () => el.classList.remove('is-out'));
  let px = -1, py = -1;
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  const update = (target) => {
    if (!target) return;
    const t = target.closest('[data-cursor]');
    if (t) { label.textContent = t.dataset.cursor; el.classList.add('is-label'); el.classList.remove('is-hover'); rot(0); return; }
    el.classList.remove('is-label');
    el.classList.toggle('is-hover', !!target.closest('a, button, input'));
  };
  let tick = 0;
  addEventListener('scroll', () => { if (px < 0 || ++tick % 4) return; update(document.elementFromPoint(px, py)); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor]');
    if (t) { label.textContent = t.dataset.cursor; el.classList.add('is-label'); el.classList.remove('is-hover'); rot(0); return; }
    el.classList.remove('is-label');
    el.classList.toggle('is-hover', !!e.target.closest('a, button, input'));
  });
  $$('[data-magnetic]').forEach((m) => {
    const mx = gsap.quickTo(m, 'x', { duration: 0.6, ease: 'power3' }), my = gsap.quickTo(m, 'y', { duration: 0.6, ease: 'power3' });
    m.addEventListener('pointermove', (e) => { const r = m.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * 0.3); my((e.clientY - r.top - r.height / 2) * 0.4); });
    m.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

/* ───────── intro ───────── */
function intro() {
  L.done = true;
  L.num.textContent = '100'; L.bar.style.transform = 'scaleX(1)';
  const tl = gsap.timeline({ defaults: { ease: 'silk' } });
  tl.to('.loader__word span', { yPercent: -210, duration: 0.8, stagger: 0.04, ease: 'power3.in' })
    .to('.loader__row, .loader__eyebrow, .loader__bar', { autoAlpha: 0, duration: 0.4 }, 0)
    .to('.loader', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'curtain' }, 0.55)
    .set('.loader', { display: 'none' })
    .from('.hero__title span', { yPercent: 105, duration: 1.6, stagger: 0.07 }, 0.95)
    .from('.hero__meta > *, .hero__foot > *', { autoAlpha: 0, y: 20, duration: 1.2, stagger: 0.06 }, 1.3)
    .from('.nav', { autoAlpha: 0, y: -16, duration: 1 }, 1.3);
  if (studio) {
    studio.state.ry = -Math.PI * 1.2; studio.state.s = 0.7; studio.state.y = -0.08;
    tl.to(studio, { intro: 1, duration: 2.4, ease: 'power2.out' }, 0.95);
  }
  tl.add(() => { document.body.classList.remove('is-loading'); lenis?.start(); }, 1.6);
}

/* ───────── boot ───────── */
async function boot() {
  progress(0.04, 'Kumaş dokunuyor');
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await fonts;
  progress(0.1);
  await bootStudio();
  progress(0.85, 'Vitrin hazırlanıyor');
  await preloadImages();
  progress(1, 'Hazır');

  if (!reduce) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  cart = createCart({ renders, lenis });
  buildCollection();
  initShop({ renders, cart, onAdd: flyToCart });
  scenes();
  setTheme('#0e0c0a', '#ece6db', true);
  marquee();
  cursor();
  dragSpin();
  setupLoupes();

  $$('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (!id || id[0] !== '#') return;
    e.preventDefault();
    const target = id === '#top' ? 0 : $(id);
    if (lenis) lenis.scrollTo(target, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (target === 0) scrollTo({ top: 0, behavior: 'smooth' }); else target.scrollIntoView({ behavior: 'smooth' });
  }));
  $('#newsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#newsEmail'), note = $('#newsNote');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim())) { note.textContent = 'Geçerli bir e-posta adresi yaz: ad@ornek.com'; note.classList.remove('is-ok'); inp.focus(); return; }
    note.textContent = 'Teşekkürler. Bu bir tanıtım sitesi, adresin kaydedilmedi.'; note.classList.add('is-ok'); inp.value = '';
  });

  // frame loop
  gsap.ticker.add((t, dt) => {
    if (!studio) return;
    const pose = poseAt(window.scrollY);
    if (pose) Object.assign(studio.target, pose);
    if (studio.state.reveal < 0.02 && studio.target.reveal < 0.02) studio.state.m = studio.target.m;
    studio.velocity = lenis ? lenis.velocity * 60 : 0;
    studio.frame(Math.min(dt / 1000, 0.05), t);
    drawCallouts();
  });

  let rw = innerWidth;
  addEventListener('resize', () => {
    isMobile = innerWidth < 861;
    studio?.resize();
    if (Math.abs(innerWidth - rw) > 2) { rw = innerWidth; }
  });

  window.__nocte = { lenis, studio, ST, poseAt };
  intro();
}

boot().catch((err) => {
  console.error('[NOCTÉ] boot failed:', err);
  L.done = true;
  document.body.classList.remove('is-loading');
  $('.loader').style.display = 'none';
  lenis?.start();
});
