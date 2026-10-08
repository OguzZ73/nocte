/* NOCTÉ — catalogue. Prices in Turkish lira. */
export const fmt = (n) => '₺' + n.toLocaleString('tr-TR');

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export const COLLECTION = [
  {
    id: 'ceket', garment: 0, cat: 'Ceket', ghost: 'Ceket', name: ['Denim Çalışma', 'Ceketi'], price: 6950,
    desc: '14 oz selvedge denimden, zincir dikişli çalışma ceketi. Kapaklı göğüs cepleri, iki büyük yama cep ve düşük omuzlu rahat bir kalıp.',
    specs: [['Kumaş', '14 oz selvedge denim'], ['Dokuma', 'Okayama, Japonya'], ['Kalıp', 'Rahat, düşük omuz'], ['Üretim', 'Karaköy, İstanbul']],
    colors: [{ n: 'Ham indigo', hex: '#2b3b52', orig: true }, { n: 'Taş yıkama', hex: '#6f86a2' }, { n: 'Kömür', hex: '#2a2a2e' }],
    bg: '#d9d1c3', fg: '#16130f',
  },
  {
    id: 'tisort', garment: 1, cat: 'Tişört', ghost: 'Tişört', name: ['Ağır Gramaj', 'Tişört'], price: 1650,
    desc: 'Ege pamuğundan kompakt süprem. 280 gramlık gövde yıkandıkça yumuşar ama formunu korur. Kutu kesim, 2×1 ribana yaka.',
    specs: [['Kumaş', '%100 Ege pamuğu'], ['Gramaj', '280 g/m²'], ['Kalıp', 'Kutu kesim'], ['Yaka', '2×1 ribana, 2,5 cm']],
    colors: [{ n: 'Optik beyaz', hex: '#ececea', orig: true }, { n: 'Mürekkep', hex: '#2a2c33' }, { n: 'Adaçayı', hex: '#8e9a83' }],
    bg: '#17181b', fg: '#ece9e2',
  },
  {
    id: 'kapusonlu', garment: 2, cat: 'Kapüşonlu', ghost: 'Kapüşon', name: ['Ribana', 'Kapüşonlu'], price: 3250,
    desc: 'İçi şardonlu 460 gramlık ilmek örgü. Çift kat kapüşon, uçları kaplı pamuk bağcık ve tek parça kanguru cep.',
    specs: [['Kumaş', '%100 organik pamuk'], ['Gramaj', '460 g/m²'], ['Kalıp', 'Düşük omuz, rahat beden'], ['Detay', 'Çift kat kapüşon']],
    colors: [{ n: 'Beyaz', hex: '#e8e8eb', orig: true }, { n: 'Kül', hex: '#8f8b84' }, { n: 'Gece', hex: '#262d3d' }],
    bg: '#8c9581', fg: '#14160f',
  },
  {
    id: 'mont', garment: 3, cat: 'Mont', ghost: 'Mont', name: ['Kuzu Yakalı', 'Bomber Mont'], price: 7900,
    desc: 'Su itici naylon dış yüz, ısı tutan elyaf dolgu ve sherpa yaka. Ribana manşet ve bel, metal fermuar, düğmeli kapaklı yan cepler.',
    specs: [['Dış yüz', 'Su itici geri dönüştürülmüş naylon'], ['Dolgu', '120 g/m² ısı tutan elyaf'], ['Yaka', 'Sherpa, pamuk astar'], ['Konfor', '−5 °C']],
    colors: [{ n: 'Lacivert', hex: '#2c3a52', orig: true }, { n: 'Siyah', hex: '#232326' }, { n: 'Zeytin', hex: '#5a5e41' }],
    bg: '#cfc3ad', fg: '#16130f',
  },
];

/* the shop grid: every colourway is its own card */
export const PRODUCTS = [
  { ref: 'ceket', c: 0, tag: 'Yeni' },
  { ref: 'mont', c: 0, tag: 'Sınırlı' },
  { ref: 'tisort', c: 0 },
  { ref: 'kapusonlu', c: 0 },
  { ref: 'ceket', c: 1 },
  { ref: 'tisort', c: 1 },
  { ref: 'kapusonlu', c: 2 },
  { ref: 'mont', c: 1 },
].map((p, i) => {
  const m = COLLECTION.find((x) => x.id === p.ref);
  return { ...p, id: `${p.ref}-${p.c}`, i, garment: m.garment, cat: m.cat, name: m.name.join(' '), price: m.price, color: m.colors[p.c] };
});

export const FREE_SHIPPING = 2500;
