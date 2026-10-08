/* NOCTÉ — shop grid, filters and the cart drawer. */
import { COLLECTION, PRODUCTS, FREE_SHIPPING, fmt } from './data.js';

const $ = (s, el = document) => el.querySelector(s);

export function variant(ref, c) {
  const m = COLLECTION.find((x) => x.id === ref);
  return { id: `${ref}-${c}`, ref, c, garment: m.garment, name: m.name.join(' '), price: m.price, color: m.colors[c] };
}

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

export function createCart({ renders = {}, lenis }) {
  const KEY = 'nocte-cart-v1';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]').filter((i) => i && i.id && i.qty > 0); } catch { items = []; }
  const els = {
    cart: $('#cart'), backdrop: $('#cartBackdrop'), list: $('#cartItems'), empty: $('#cartEmpty'),
    total: $('#cartTotal'), count: $('#cartCount'), head: $('#cartHeadCount'), ship: $('#shipText'), bar: $('#shipBar'),
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } };

  function render() {
    const n = items.reduce((a, i) => a + i.qty, 0);
    const sum = items.reduce((a, i) => a + i.qty * variant(i.ref, i.c).price, 0);
    els.count.textContent = n; els.head.textContent = n;
    els.total.textContent = fmt(sum);
    els.empty.hidden = items.length > 0;
    const left = FREE_SHIPPING - sum;
    els.ship.textContent = sum === 0 ? `${fmt(FREE_SHIPPING)} üzeri ücretsiz kargo` : left > 0 ? `Ücretsiz kargoya ${fmt(left)} kaldı` : 'Kargo bizden';
    els.bar.style.transform = `scaleX(${Math.min(1, sum / FREE_SHIPPING)})`;
    els.list.innerHTML = items.map((it, k) => {
      const v = variant(it.ref, it.c), img = renders[v.id]?.front;
      return `<li class="cart__item" style="--card:${v.color.hex}">
        <div class="cart__thumb">${img ? `<img src="${img}" alt="">` : ''}</div>
        <div class="cart__meta"><h3>${v.name}</h3><p class="mono">${v.color.n} · ${it.size}</p>
          <div class="qty"><button type="button" data-k="${k}" data-d="-1" aria-label="Bir azalt">−</button><span>${it.qty}</span><button type="button" data-k="${k}" data-d="1" aria-label="Bir artır">+</button></div></div>
        <div class="cart__right"><strong>${fmt(v.price * it.qty)}</strong><button type="button" class="cart__remove" data-rm="${k}">Kaldır</button></div>
      </li>`;
    }).join('');
  }

  els.list.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rm !== undefined) items.splice(+b.dataset.rm, 1);
    else if (b.dataset.d) { const it = items[+b.dataset.k]; it.qty += +b.dataset.d; if (it.qty <= 0) items.splice(+b.dataset.k, 1); }
    save(); render();
  });

  function open() {
    els.cart.classList.add('is-open'); els.backdrop.classList.add('is-open');
    els.cart.setAttribute('aria-hidden', 'false'); lenis?.stop();
    setTimeout(() => $('#cartClose').focus({ preventScroll: true }), 300);
  }
  function close() {
    els.cart.classList.remove('is-open'); els.backdrop.classList.remove('is-open');
    els.cart.setAttribute('aria-hidden', 'true'); lenis?.start();
  }
  $('#cartOpen').addEventListener('click', open);
  $('#cartClose').addEventListener('click', close);
  els.backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && els.cart.classList.contains('is-open')) close(); });
  $('#checkout').addEventListener('click', () => toast(items.length ? 'Bu bir tanıtım mağazası: sipariş oluşturulmadı.' : 'Önce sepete bir parça ekle.'));

  function add(ref, c, size = 'M') {
    const found = items.find((i) => i.ref === ref && i.c === c && i.size === size);
    if (found) found.qty += 1; else items.push({ id: `${ref}-${c}`, ref, c, size, qty: 1 });
    save(); render();
    const v = variant(ref, c);
    toast(`${v.name} · ${v.color.n} · ${size} sepete eklendi`);
    if (window.gsap) gsap.fromTo('#cartCount', { scale: 1.6 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, .4)' });
  }
  render();
  return { add, open, close, setRenders(r) { renders = r; render(); } };
}

export function initShop({ renders, cart, onAdd }) {
  const grid = $('#grid');
  grid.innerHTML = PRODUCTS.map((p) => {
    const r = renders[p.id];
    const media = r
      ? `<img src="${r.front}" alt="${p.name}, ${p.color.n}, önden" loading="lazy"><img src="${r.back}" alt="" aria-hidden="true" loading="lazy">`
      : '';
    return `<article class="card" data-cat="${p.cat}" style="--card:${p.color.hex}">
      <div class="card__media${r ? '' : ' card__media--empty'}" data-cursor="Çevir">${media || p.cat}
        ${p.tag ? `<span class="card__tag mono">${p.tag}</span>` : ''}
        <button type="button" class="card__add" data-ref="${p.ref}" data-c="${p.c}">Hızlı ekle · M</button>
      </div>
      <div class="card__info">
        <h3 class="card__name">${p.name}</h3><span class="card__price">${fmt(p.price)}</span>
        <span class="card__color mono"><i></i>${p.color.n}</span>
      </div>
    </article>`;
  }).join('');
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.card__add'); if (!b) return;
    onAdd?.(b);
    cart.add(b.dataset.ref, +b.dataset.c, 'M');
  });

  const cards = [...grid.children];
  document.querySelectorAll('.filter').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', b === btn); });
    const f = btn.dataset.filter;
    const state = window.Flip ? Flip.getState(cards) : null;
    cards.forEach((c) => c.classList.toggle('is-out', !(f === 'all' || c.dataset.cat === f)));
    if (state) {
      Flip.from(state, {
        duration: 0.75, ease: 'power3.inOut', absolute: true, scale: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.4 }),
        onComplete: () => window.ScrollTrigger && ScrollTrigger.refresh(),
      });
    }
  }));
  return cards;
}
