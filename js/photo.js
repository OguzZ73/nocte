/* NOCTÉ — photographed garments.
   Each product photo is cut out, and its own silhouette is inflated into a soft shell.
   The photo is projected onto the front, its shadows and highlights become a gentle
   relief, and colourways are painted onto the real fabric by luminance transfer.
   Every material shares the dissolve shader so pieces can re-weave into one another. */
import * as THREE from 'three';
import { clamp, ccw, chaikin, resample, Field, makeSurface, inflatedGeometry, BODY_MESH, NOISE_GLSL } from './mesh.js';

export const G = { uTime: { value: 0 }, uWave: { value: 0 } };
const GARMENT_H = 2.45;

function patchMaterial(m, u) {
  m.defines = { ...(m.defines || {}) };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uReveal: u.uReveal, uInvert: u.uInvert, uEdge: u.uEdge, uGInv: u.uGInv,
      uTint: u.uTint, uTintAmt: u.uTintAmt, uSrcLum: u.uSrcLum, uShade: u.uShade, uBack: u.uBack,
      uTime: G.uTime, uWave: G.uWave,
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uGInv; uniform float uTime; uniform float uWave; varying vec3 vDPos; varying vec3 vShadeN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 gp = uGInv * modelMatrix * vec4(position, 1.0);
vDPos = gp.xyz;
vShadeN = normalize(normalMatrix * normal);
transformed.z += uWave * sin(gp.y * 3.1 + uTime * 2.2 + gp.x * 1.4) * 0.06 * smoothstep(1.3, -1.2, gp.y);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uReveal; uniform float uInvert; uniform vec3 uEdge;
uniform vec3 uTint; uniform float uTintAmt; uniform float uSrcLum; uniform float uShade; uniform float uBack;
varying vec3 vDPos; varying vec3 vShadeN;
${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float nzEdge = 0.0;
if (uReveal < 0.999) {
  float f = nzField(vDPos); f = mix(f, 1.0 - f, uInvert);
  if (f > uReveal) discard;
  nzEdge = 1.0 - smoothstep(0.0, 0.045, uReveal - f);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 t = uTint * clamp(l / max(uSrcLum, 1e-3), 0.0, 3.2);
  c = mix(c, t, uTintAmt);
  vec3 n = normalize(vShadeN); if (!gl_FrontFacing) n = -n;
  float key = max(dot(n, normalize(vec3(-0.45, 0.55, 0.75))), 0.0);
  float fill = max(dot(n, normalize(vec3(0.6, -0.1, 0.8))), 0.0);
  float shade = 0.58 + 0.42 * key + 0.16 * fill;
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
  c = c * mix(1.0, shade, uShade) + rim * 0.045 * uShade;
  diffuseColor.rgb = c * uBack;
}`)
      .replace('#include <opaque_fragment>', 'outgoingLight += uEdge * nzEdge * 2.4;\n#include <opaque_fragment>');
  };
  return m;
}

class PhotoGarment {
  constructor(def) {
    this.id = def.id;
    this.def = def;
    this.group = new THREE.Group();
    this.anchors = {};
    this.u = {
      uReveal: { value: 1 }, uInvert: { value: 0 }, uEdge: { value: new THREE.Color('#e2b679') }, uGInv: { value: new THREE.Matrix4() },
      uTint: { value: new THREE.Color(def.meanColor) }, uTintAmt: { value: 0 }, uSrcLum: { value: def.meanLum }, uShade: { value: 1 },
    };
  }
  setReveal(v, invert) { this.u.uReveal.value = v; this.u.uInvert.value = invert; this.group.visible = v > 0.002; }
  /** colour = css colour string; amt 0 = the photo as shot, 1 = fully re-dyed */
  setTint(color, amt) { this.u.uTint.value.set(color); this.u.uTintAmt.value = amt; }
}

/** blurred, normalised luminance of the photo → relief sampler in uv space */
function reliefSampler(img, meanLum) {
  const H = 150, W = Math.max(8, Math.round((H * img.width) / img.height));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  let L = new Float32Array(W * H);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  for (let i = 0; i < W * H; i++) {
    if (d[i * 4 + 3] < 128) { L[i] = 0; continue; }
    const l = 0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2]);
    L[i] = clamp((l - meanLum) / (meanLum + 0.035), -1.4, 1.4);
  }
  for (let pass = 0; pass < 3; pass++) { // box blur
    const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; s += L[yy * W + xx]; n++;
      }
      o[y * W + x] = s / n;
    }
    L = o;
  }
  return (u, v) => {
    const x = clamp(u * W - 0.5, 0, W - 1.001), y = clamp(v * H - 0.5, 0, H - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const a = L[y0 * W + x0], b = L[y0 * W + x0 + 1], c = L[(y0 + 1) * W + x0], e = L[(y0 + 1) * W + x0 + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
  };
}

function buildOne(def, tex, renderer) {
  const g = new PhotoGarment(def);
  const Hh = GARMENT_H * (def.scale ?? 1), Ww = Hh * def.aspect;
  const toXY = ([u, v]) => [(u - 0.5) * Ww, (0.5 - v) * Hh];
  const boundary = resample(chaikin(ccw(def.poly.map(toXY)), 2), 0.018);
  const field = new Field(boundary);
  const relief = reliefSampler(tex.image, def.meanLum);
  const k = def.relief ?? 0.05;
  const surf = makeSurface({
    profile: def.profile ?? { R: 0.12, H: 0.06, B: 0.12, L: 0.3, back: 0.7 },
    fold: (x, y) => k * relief(x / Ww + 0.5, 0.5 - y / Hh),
  }, field);
  const geo = inflatedGeometry(boundary, field, surf, { ...BODY_MESH, uv: (x, y) => [x / Ww + 0.5, y / Hh + 0.5] });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mk = (back) => {
    const m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false });
    patchMaterial(m, { ...g.u, uBack: { value: back ? 0.62 : 1 } });
    return m;
  };
  const mesh = new THREE.Mesh(geo, [mk(false), mk(true)]);
  g.group.add(mesh);
  g.mesh = mesh;
  for (const [name, [u, v]] of Object.entries(def.anchors || {})) {
    const [x, y] = toXY([u, v]);
    const o = new THREE.Object3D(); o.position.set(x, y, surf(x, y).zf + 0.01); mesh.add(o);
    g.anchors[name] = o;
  }
  g.size = { w: Ww, h: Hh };
  return g;
}

export async function buildPhotoGarments(renderer, defs, onStep = () => {}) {
  const loader = new THREE.TextureLoader();
  const texs = await Promise.all(defs.map((d) => loader.loadAsync(d.src)));
  onStep(0, defs.length);
  const list = [];
  for (let i = 0; i < defs.length; i++) {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    list.push(buildOne(defs[i], texs[i], renderer));
    onStep(i + 1, defs.length);
  }
  return list;
}
