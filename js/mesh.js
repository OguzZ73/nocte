/* NOCTÉ — meshing core: turns a 2D silhouette into a soft, two-sided shell. */
import * as THREE from 'three';

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const circ = (t) => { t = clamp(t); return Math.sqrt(1 - (1 - t) * (1 - t)); };

/* ───────────── 2D polygon helpers ───────────── */
const area = (p) => { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
export const ccw = (p) => (area(p) < 0 ? p.slice().reverse() : p);
export function chaikin(p, iters = 2) {
  for (let k = 0; k < iters; k++) {
    const o = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = o;
  }
  return p;
}
export function resample(p, spacing, closed = true) {
  const pts = closed ? [...p, p[0]] : p;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  const n = Math.max(2, Math.round(total / spacing));
  const out = [];
  let j = 1;
  for (let k = 0; k < (closed ? n : n + 1); k++) {
    const s = (k / n) * total;
    while (j < pts.length - 1 && lens[j] < s) j++;
    const t = (s - lens[j - 1]) / (lens[j] - lens[j - 1] || 1);
    out.push([lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)]);
  }
  return out;
}
/** half: from top-centre (x=0) down the right side to bottom-centre (x=0). */
function distLine(px, py, line) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = line[i - 1][0], ay = line[i - 1][1], dx = line[i][0] - ax, dy = line[i][1] - ay;
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-12); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - px, ey = ay + t * dy - py, d2 = ex * ex + ey * ey;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

export class Field {
  constructor(poly) {
    const n = (this.n = poly.length);
    this.x = new Float64Array(n); this.y = new Float64Array(n);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.forEach(([x, y], i) => { this.x[i] = x; this.y[i] = y; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
    this.bbox = { minX, minY, maxX, maxY };
  }
  inside(px, py) {
    const { x, y, n, bbox } = this;
    if (px < bbox.minX || px > bbox.maxX || py < bbox.minY || py > bbox.maxY) return false;
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) if ((y[i] > py) !== (y[j] > py) && px < ((x[j] - x[i]) * (py - y[i])) / (y[j] - y[i]) + x[i]) c = !c;
    return c;
  }
  dist(px, py) {
    const { x, y, n } = this;
    let best = Infinity;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = x[j], ay = y[j], dx = x[i] - ax, dy = y[i] - ay;
      let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-12); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d2 = ex * ex + ey * ey;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }
}


/* ───────────── meshing ───────────── */
function genPoints(boundary, field, o) {
  const s = o.spacing, pts = [], CELL = 0.012, grid = new Map();
  const key = (cx, cy) => (cx + 4096) * 8192 + (cy + 4096);
  const add = (x, y) => { const k = key(Math.floor(x / CELL), Math.floor(y / CELL)); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(pts.length); pts.push([x, y]); };
  const near = (x, y, r) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), k = Math.ceil(r / CELL), r2 = r * r;
    for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) {
      const a = grid.get(key(cx + i, cy + j)); if (!a) continue;
      for (const q of a) { const dx = pts[q][0] - x, dy = pts[q][1] - y; if (dx * dx + dy * dy < r2) return true; }
    }
    return false;
  };
  boundary.forEach(([x, y]) => add(x, y));
  const nB = pts.length;
  let prev = 0;
  o.rings.forEach((dl, ri) => {
    const step = o.steps[ri], minR = Math.min(dl - prev, s * 0.5) * 0.6; prev = dl;
    for (let i = 0; i < nB; i += step) {
      const a = boundary[(i - 1 + nB) % nB], b = boundary[(i + 1) % nB];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const x = boundary[i][0] - ty * dl, y = boundary[i][1] + tx * dl;
      if (!field.inside(x, y) || field.dist(x, y) < dl * 0.8 || near(x, y, minR)) continue;
      add(x, y);
    }
  });
  const inner = o.rings[o.rings.length - 1];
  for (const line of o.densify || []) {
    const L = resample(line, s * 0.42, false);
    for (let i = 0; i < L.length; i++) {
      const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      for (const off of [0, 0.012, -0.012, 0.028, -0.028, 0.05, -0.05]) {
        const x = L[i][0] - ty * off, y = L[i][1] + tx * off;
        if (!field.inside(x, y) || field.dist(x, y) < 0.012 || near(x, y, 0.0085)) continue;
        add(x, y);
      }
    }
  }
  const { minX, maxX, minY, maxY } = field.bbox, dy = s * 0.866;
  for (let row = 0, y = minY + dy * 0.5; y < maxY; y += dy, row++)
    for (let x = minX + (row & 1 ? s * 0.5 : 0); x < maxX; x += s) {
      if (!field.inside(x, y) || field.dist(x, y) < inner + s * 0.35 || near(x, y, s * 0.55)) continue;
      add(x, y);
    }
  return { pts, nB };
}

function triangulate(pts, field, maxEdge) {
  const coords = new Float64Array(pts.length * 2);
  pts.forEach((p, i) => { coords[i * 2] = p[0]; coords[i * 2 + 1] = p[1]; });
  const t = new window.Delaunator(coords).triangles, out = [], m2 = maxEdge * maxEdge;
  const edgeOk = (x0, y0, x1, y1) => { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; return field.inside(mx, my) || field.dist(mx, my) < 0.005; };
  for (let i = 0; i < t.length; i += 3) {
    let a = t[i], b = t[i + 1], c = t[i + 2];
    const [ax, ay] = pts[a], [bx, by] = pts[b], [cx, cy] = pts[c];
    const ar = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(ar) < 1e-10) continue;
    if ((bx - ax) ** 2 + (by - ay) ** 2 > m2 || (cx - bx) ** 2 + (cy - by) ** 2 > m2 || (ax - cx) ** 2 + (ay - cy) ** 2 > m2) continue;
    if (!field.inside((ax + bx + cx) / 3, (ay + by + cy) / 3)) continue;
    if (!edgeOk(ax, ay, bx, by) || !edgeOk(bx, by, cx, cy) || !edgeOk(cx, cy, ax, ay)) continue;
    if (ar < 0) { const k = b; b = c; c = k; }
    out.push(a, b, c);
  }
  return out;
}

export function makeSurface(spec, field) {
  const P = spec.profile, seams = spec.seams || [], hol = spec.hollows || [];
  return (x, y, d) => {
    if (d === undefined) d = field.dist(x, y);
    const e = circ(d / P.R), body = 1 - Math.exp(-Math.max(0, d - P.R * 0.25) / P.L);
    let zf = P.H * e + P.B * body, zb = zf * P.back, ao = 1;
    const f = spec.fold ? spec.fold(x, y) * smooth(0.015, 0.2, d) : 0;
    for (const h of hol) {
      const r = Math.hypot((x - h.x) / h.rx, (y - h.y) / h.ry), k = 1 - smooth(h.inner ?? 0.7, 1, r);
      if (k > 0) { zf = lerp(zf, zf * 0.05 + 0.003, k); ao -= (h.ao ?? 0.6) * k; }
    }
    for (const s of seams) {
      const ds = distLine(x, y, s.line), p = Math.exp(-(ds * ds) / (s.width * s.width)) * s.depth;
      if (p > 0.002) { zf *= 1 - p; zb *= 1 - p * 0.85; ao *= 1 - p * (s.ao ?? 1.3); }
    }
    if (spec.tint) ao *= spec.tint(x, y);
    return { zf: zf + f, zb: -zb + f * 0.6, ao: clamp(ao, 0.12, 1) };
  };
}

export function inflatedGeometry(boundary, field, surf, o) {
  const { pts, nB } = genPoints(boundary, field, o);
  const tris = triangulate(pts, field, o.spacing * 6);
  const N = pts.length, pos = [], col = [], uv = [], back = new Int32Array(N);
  const S = pts.map(([x, y], i) => surf(x, y, i < nB ? 0 : undefined));
  const uvf = o.uv || ((x, y) => [x, y]);
  for (let i = 0; i < N; i++) { const [x, y] = pts[i]; pos.push(x, y, i < nB ? 0 : S[i].zf); col.push(S[i].ao, S[i].ao, S[i].ao); uv.push(...uvf(x, y, false)); }
  const index = tris.slice();
  if (o.twoSided !== false) {
    let k = N;
    for (let i = 0; i < N; i++) {
      if (i < nB) { back[i] = i; continue; }
      back[i] = k++;
      const [x, y] = pts[i], a = Math.min(1, S[i].ao * 1.1);
      pos.push(x, y, S[i].zb); col.push(a, a, a); uv.push(...uvf(x, y, true));
    }
    for (let i = 0; i < tris.length; i += 3) index.push(back[tris[i]], back[tris[i + 2]], back[tris[i + 1]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  g.addGroup(0, tris.length, 0);
  if (index.length > tris.length) g.addGroup(tris.length, index.length - tris.length, 1);
  return g;
}

export const BODY_MESH = { spacing: 0.04, rings: [0.008, 0.024, 0.048, 0.08, 0.12], steps: [1, 1, 1, 2, 2] };

/* ───────────── dissolve shader patch ───────────── */
export const NOISE_GLSL = /* glsl */ `
vec3 nz_m289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 nz_m289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 nz_perm(vec4 x){return nz_m289(((x*34.)+1.)*x);}
vec4 nz_tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float nz_snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=nz_m289(i);
  vec4 p=nz_perm(nz_perm(nz_perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=nz_tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float nzField(vec3 p){
  float n = nz_snoise(p*2.3)*.55 + nz_snoise(p*5.7)*.25;
  n = n*.5+.5;
  float sweep = clamp((1.5 - p.y)/3.0, 0., 1.);
  return clamp(mix(n, sweep, .5), 0., 1.);
}`;
