# NOCTÉ Atelier

Kurgusal bir İstanbul giyim markası için hazırlanmış, scroll animasyonlu tanıtım ve mağaza sitesi.

- Gerçek ürün fotoğrafları WebGL (Three.js) ile hacim kazanıp scroll'la dönüyor ve birbirine dönüşüyor
- GSAP ScrollTrigger, SplitText, Flip ve Lenis ile yumuşak kaydırma ve sabitlenen bölümler
- Renk seçenekleri gerçek fotoğrafın üzerine boyanıyor; sepet ve filtreler çalışıyor (ödeme yok)

## Çalıştırma

```bash
python3 -m http.server 5173
```

Ardından `http://localhost:5173` adresini açın.

Fotoğraflar Unsplash ve Pexels lisanslıdır; fotoğrafçılar sitenin alt bilgisinde listelenmiştir.

`index.html` sitenin kendisidir. `artifact.html` aynı sayfanın Claude Artifact sürümüdür; değiştirdikten sonra `tools/wrap.sh` ile `index.html` yeniden üretilir.
