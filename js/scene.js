/* NOCTÉ — the fixed WebGL "studio" every section borrows. */
import * as THREE from 'three';
import { buildPhotoGarments, G } from './photo.js';

const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.4, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Showroom {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(this.dpr);
    r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    this.camera.position.set(0, 0, 7.6);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false }));
    this.shadow.renderOrder = -1;
    this.scene.add(this.shadow);

    this.state = { x: 0, y: 0, s: 1, ry: 0, rx: 0, rz: 0, m: 0, reveal: 1 };
    this.target = { ...this.state };
    this.intro = 0;
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    this.velocity = 0; this.vs = 0;
    this.userRy = 0; this.userRyS = 0; this.dragging = false;
    this.garments = [];
    this.drawn = false;
    this._v = new THREE.Vector3(); this._c = new THREE.Vector3();
  }

  async build(defs, onStep) {
    this.defs = defs;
    this.garments = await buildPhotoGarments(this.renderer, defs, onStep);
    for (const g of this.garments) this.root.add(g.group);
    this.resize();
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch { this.renderer.compile(this.scene, this.camera); }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.visW = this.visH * this.camera.aspect;
    this.fit = Math.min((this.visH * 0.8) / 2.6, (this.visW * 0.9) / 2.5);
  }

  applyReveal(reveal) {
    const n = this.garments.length;
    const m = clamp(this.state.m, 0, n - 1), i = Math.floor(m), f = m - i;
    this.garments.forEach((g, j) => {
      let v = 0, inv = 0;
      if (j === i) v = 1 - f;
      else if (j === i + 1) { v = f; inv = 1; }
      g.setReveal(v * reveal, inv);
    });
  }

  frame(dt, t) {
    if (!this.garments.length) return;
    const s = this.state, tg = this.target;
    for (const k in s) s[k] = damp(s[k], tg[k], k === 'm' ? 4.2 : 5.2, dt);
    const M = this.mouse;
    M.sx = damp(M.sx, M.x, 2.6, dt); M.sy = damp(M.sy, M.y, 2.6, dt);
    this.vs = damp(this.vs, this.velocity, 5, dt);
    if (!this.dragging) this.userRy = damp(this.userRy, 0, 1.8, dt);
    this.userRyS = damp(this.userRyS, this.userRy, 8, dt);
    G.uTime.value = t;
    G.uWave.value = Math.min(1, Math.abs(this.vs) / 2600);

    const reveal = s.reveal * this.intro;
    this.applyReveal(reveal);
    const bob = Math.sin(t * 0.8) * 0.02;
    const sc = s.s * this.fit;
    this.root.position.set((s.x * this.visW) / 2, (s.y * this.visH) / 2 + bob * this.fit, 0);
    this.root.scale.setScalar(sc);
    this.root.rotation.set(
      s.rx + M.sy * 0.1 + clamp(this.vs / 6000, -0.18, 0.18),
      s.ry + this.userRyS + M.sx * 0.3,
      s.rz + Math.sin(t * 0.55) * 0.012,
    );
    this.root.updateMatrixWorld(true);
    this.shadow.position.set(this.root.position.x, this.root.position.y - 1.32 * sc - bob * this.fit, -0.6);
    this.shadow.scale.set(2.3 * sc * (1 - bob * 2), 0.42 * sc, 1);
    this.shadow.material.opacity = clamp(reveal, 0, 1) * 0.55;
    this.shadow.visible = reveal > 0.01;

    let any = false;
    for (const g of this.garments) {
      g.u.uGInv.value.copy(g.group.matrixWorld).invert();
      if (g.group.visible) any = true;
    }
    if (any) { this.renderer.render(this.scene, this.camera); this.drawn = true; }
    else if (this.drawn) { this.renderer.clear(); this.drawn = false; }
  }

  /** screen-space position of a named anchor on garment `gi` */
  project(gi, name, out = {}) {
    const g = this.garments[gi], a = g && g.anchors[name];
    if (!a) return null;
    a.getWorldPosition(this._v);
    this.root.getWorldPosition(this._c);
    out.front = this._v.z > this._c.z - 0.02;
    this._v.project(this.camera);
    out.x = (this._v.x * 0.5 + 0.5) * this.w;
    out.y = (-this._v.y * 0.5 + 0.5) * this.h;
    return out;
  }

  setTint(gi, color, amt) { this.tints = this.tints || []; this.tints[gi] = [color, amt]; this.garments[gi]?.setTint(color, amt); }

  /** studio renders for the shop grid: [{gi, color, amt, ry}] → dataURLs */
  snapshots(list, w = 640, h = 800) {
    const r = this.renderer, cam = this.camera, out = [];
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    G.uWave.value = 0;
    this.shadow.visible = false;
    for (const { gi, color, amt, ry } of list) {
      this.garments.forEach((g, j) => g.setReveal(j === gi ? 1 : 0, 0));
      const g = this.garments[gi];
      g.setTint(color, amt);
      this.root.position.set(0, -0.02, 0);
      this.root.scale.setScalar((this.visH * 0.86) / 2.6);
      this.root.rotation.set(0.03, ry, 0);
      this.root.updateMatrixWorld(true);
      g.u.uGInv.value.copy(g.group.matrixWorld).invert();
      r.render(this.scene, cam);
      out.push(this.canvas.toDataURL('image/webp', 0.9));
    }
    (this.tints || []).forEach((tn, j) => tn && this.garments[j].setTint(tn[0], tn[1]));
    this.resize();
    r.clear();
    return out;
  }
}
