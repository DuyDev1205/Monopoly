// Phông nền tranh vẽ phía sau bàn cờ (trời, mây trôi, núi mờ sương, đồi hoa; vẽ bằng app/tools/render_art.py)
// + mặt hồ gương: nửa dưới phông là bóng tranh lật ngược có gợn sóng, lấp lánh, cánh hoa trôi;
// bóng của bàn cờ 3D soi xuống nước bằng Reflector thật, ghép lên phông theo độ trong suốt.
// Phông vẽ theo không gian màn hình (như sân khấu), trôi nhẹ khi người chơi xoay camera.
import { THREE, ctx, canvas, texOf, flat, glowTex, seeded } from './core.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const WATER_Y = -1.36;
let quad, water, petals, noiseTex;
const texCache = {};
const loader = new THREE.TextureLoader();

function noise() {
  if (noiseTex) return noiseTex;
  // nhiễu giá trị mượt, lặp liền 2 chiều
  const N = 256, [c, g] = canvas(N, N), img = g.createImageData(N, N), rand = seeded(7);
  const grid = (s) => { const a = new Float32Array(s * s); for (let i = 0; i < a.length; i++) a[i] = rand(); return a; };
  const oct = [[8, 0.5], [16, 0.25], [32, 0.15], [64, 0.1]].map(([s, w]) => ({ s, w, g: grid(s) }));
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const o of oct) {
      const fx = (x / N) * o.s, fy = (y / N) * o.s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const at = (i, j) => o.g[((j % o.s + o.s) % o.s) * o.s + ((i % o.s + o.s) % o.s)];
      v += o.w * ((at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty);
    }
    const k = (y * N + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(v * 255); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseTex = texOf(c, { srgb: false });
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  return noiseTex;
}
function art(theme, layer) {
  const k = `${theme}_${layer}`;
  if (!texCache[k]) {
    const t = loader.load(`skin/art/${k}.png`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = layer === 'sky' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    texCache[k] = t;
  }
  return texCache[k];
}

// ---------- phông nền: một tứ giác phủ kín màn hình, vẽ trước mọi thứ ----------
const BG_FRAG = /* glsl */`
uniform sampler2D skyTex, cloudTex, landTex, noiseTex;
uniform vec2 viewSize; uniform float horizon, zoom, drift, wt, petalAmt, sunU, glint;
uniform vec2 shiftPx, waterMix;
uniform vec3 deepCol, tintCol, mistCol, glintCol, petalCol;
varying vec2 vUv;
const float TW = 2560.0, SKH = 900.0, LDH = 460.0;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 scenePx(float u, float y) {
  y = max(y, 0.5);
  float v = clamp(y / SKH, 0.002, 0.998);
  vec3 c = texture2D(skyTex, vec2(clamp(u, 0.001, 0.999), v)).rgb;
  vec4 cl = texture2D(cloudTex, vec2(u + drift, v));
  c = mix(c, cl.rgb, cl.a);
  vec4 ld = texture2D(landTex, vec2(u, clamp(y / LDH, 0.002, 0.998)));
  c = mix(c, ld.rgb, ld.a * step(y, LDH - 1.0));
  return c;
}
float petalLayer(vec2 P, float seed, float amt) {
  vec2 id = floor(P), f = fract(P) - 0.5;
  float h = hash(id + seed);
  vec2 o = (vec2(hash(id + seed + 3.1), hash(id + seed + 7.7)) - 0.5) * 0.44;
  float ang = hash(id + seed + 1.3) * 6.283 + wt * 0.25 * (h - 0.5);
  vec2 g = f - o; g = vec2(g.x * cos(ang) - g.y * sin(ang), g.x * sin(ang) + g.y * cos(ang));
  float sz = mix(0.15, 0.27, hash(id + seed + 5.5));
  float e = length(g * vec2(1.0, 1.6)) / sz;
  return (1.0 - smoothstep(0.85, 1.15, e)) * step(h, amt);
}
void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * viewSize - shiftPx;
  float s = 0.92 * TW / viewSize.x / zoom;
  float hy = horizon * viewSize.y;
  float u = 0.5 + (px.x - 0.5 * viewSize.x) * s / TW;
  float y = (hy - px.y) * s;
  vec3 col = scenePx(u, y);
  if (y < 0.0) {
    float d = -y;
    float dn = clamp(d / (0.62 * viewSize.y * s), 0.0, 1.0);
    float iz = 1.0 / (d + 16.0);
    vec2 P = vec2((px.x - 0.5 * viewSize.x) * s * iz * 11.0, 13500.0 * iz);
    float n1 = texture2D(noiseTex, P * vec2(0.020, 0.115) + vec2(wt * 0.010, wt * 0.022)).r;
    float n2 = texture2D(noiseTex, P * vec2(0.047, 0.260) + vec2(-wt * 0.017, wt * 0.035)).r;
    float n3 = texture2D(noiseTex, P * vec2(0.008, 0.050) + vec2(wt * 0.004, -wt * 0.009)).r;
    float w = (n1 + n2 * 0.6 + n3 * 0.8) / 2.4 - 0.5;
    float du = w * mix(0.0006, 0.0070, dn), dy = w * mix(2.0, 38.0, dn), sm = mix(1.0, 13.0, dn);
    float yr = d * 0.97 + dy;
    vec3 r = scenePx(u + du, yr) * 0.34 + scenePx(u + du * 0.6, yr - sm) * 0.22 + scenePx(u + du * 1.3, yr + sm) * 0.22
           + scenePx(u + du * 0.2, yr - sm * 2.2) * 0.11 + scenePx(u + du * 1.6, yr + sm * 2.2) * 0.11;
    vec3 wcol = mix(r * tintCol, deepCol, mix(waterMix.x, waterMix.y, pow(dn, 0.8)));
    wcol *= 1.0 + w * mix(0.03, 0.11, dn);
    float sp = texture2D(noiseTex, P * vec2(0.11, 0.62) + vec2(wt * 0.05, -wt * 0.08)).r;
    float sp2 = texture2D(noiseTex, P * vec2(0.19, 0.95) - vec2(wt * 0.07, wt * 0.04)).r;
    float spark = pow(clamp(sp * sp2 * 2.9, 0.0, 1.0), 9.0);
    float su = (u - sunU) / (0.020 + 0.085 * dn);
    float path = exp(-su * su) * (1.0 - 0.55 * dn);
    wcol += glintCol * spark * (path * 2.1 + 0.04) * glint * smoothstep(0.0, 30.0, d);
    wcol += glintCol * path * 0.07 * glint;
    if (petalAmt > 0.001) {
      vec2 Pp = P + vec2(wt * 0.035 + w * 0.6, w * 0.4);
      float pt = petalLayer(Pp, 0.0, petalAmt) + petalLayer(Pp * 1.7 + 13.7, 9.0, petalAmt * 0.7);
      pt *= smoothstep(30.0, 150.0, d);
      wcol = mix(wcol, petalCol * (0.93 + 0.14 * hash(floor(Pp))), clamp(pt, 0.0, 1.0) * 0.92);
    }
    wcol = mix(wcol, mistCol, exp(-d / 30.0) * 0.5);
    col = wcol;
  }
  // lùi phông ra sau: giảm tươi + tối nhẹ (thứ bậc tương phản: nền < bàn cờ < nhà < quân)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 0.82) * 0.9;
  col += (hash(gl_FragCoord.xy + fract(wt) * 61.0) - 0.5) / 255.0 * 1.6;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ---------- bóng bàn cờ dưới nước: Reflector + gợn sóng, mờ dần ra xa ----------
const REFL_SHADER = {
  name: 'BoardReflection',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    noiseTex: { value: null }, wt: { value: 0 }, tint: { value: new THREE.Color() }, reach: { value: new THREE.Vector2(6.5, 10.5) }, strength: { value: 0.75 } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    #include <common>
    void main() { vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, noiseTex; uniform float wt, strength; uniform vec3 tint; uniform vec2 reach;
    varying vec4 vUv; varying vec3 vW;
    void main() {
      float n = texture2D(noiseTex, vW.xz * vec2(0.07, 0.32) + vec2(wt * 0.02, wt * 0.05)).r - 0.5;
      float n2 = texture2D(noiseTex, vW.xz * vec2(0.19, 0.6) + vec2(-wt * 0.035, wt * 0.04)).r - 0.5;
      vec4 uv = vUv; uv.x += (n * 0.6 + n2 * 0.4) * 0.09 * uv.w; uv.y += n2 * 0.02 * uv.w;
      vec4 b = texture2DProj(tDiffuse, uv);
      float r = max(abs(vW.x), abs(vW.z));
      float fade = 1.0 - smoothstep(reach.x, reach.y, r);
      float a = b.a * fade * strength;
      vec3 c = mix(b.rgb, tint, 0.28) * 0.9;
      gl_FragColor = vec4(c, a);
      #include <colorspace_fragment>
    }`,
};

export function buildBackdrop(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      skyTex: { value: null }, cloudTex: { value: null }, landTex: { value: null }, noiseTex: { value: noise() },
      viewSize: { value: new THREE.Vector2(1600, 900) }, horizon: { value: 0.4 }, zoom: { value: 1 }, drift: { value: Math.random() },
      wt: { value: 0 }, petalAmt: { value: 0.3 }, sunU: { value: 0.775 }, glint: { value: 1 }, shiftPx: { value: new THREE.Vector2() },
      waterMix: { value: new THREE.Vector2(0.1, 0.5) }, deepCol: { value: new THREE.Color() }, tintCol: { value: new THREE.Color() },
      mistCol: { value: new THREE.Color() }, glintCol: { value: new THREE.Color() }, petalCol: { value: new THREE.Color() },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: BG_FRAG, depthTest: false, depthWrite: false,
  });
  mat.userData.outlineParameters = { visible: false };
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false; quad.renderOrder = -1000; quad.name = 'backdrop';
  scene.add(quad);

  water = new Reflector(new THREE.PlaneGeometry(60, 60), {
    shader: REFL_SHADER, textureWidth: 1024, textureHeight: 1024, clipBias: 0.003, multisample: 4,
  });
  water.material.transparent = true; water.material.depthWrite = false;
  water.material.uniforms.noiseTex.value = noise();
  water.material.userData.outlineParameters = { visible: false };
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y - 0.002; water.renderOrder = -500; water.name = 'lake';
  // khi vẽ bóng: giấu phông + hạt rơi; bỏ qua lượt vẽ viền
  const orig = water.onBeforeRender;
  water.onBeforeRender = function (renderer, sc, camera) {
    if (ctx.outlinePass) return;
    const hide = [quad, petals].filter(Boolean); hide.forEach((o) => { o.visible = false; });
    ctx.inReflect = true;
    orig.call(this, renderer, sc, camera);
    ctx.inReflect = false;
    hide.forEach((o) => { o.visible = true; });
  };
  scene.add(water);
  return { quad, water };
}

export function setBackdropTheme(key, T) {
  const u = quad.material.uniforms;
  u.skyTex.value = art(key, 'sky'); u.cloudTex.value = art(key, 'clouds'); u.landTex.value = art(key, 'land');
  u.deepCol.value.set(T.deep); u.tintCol.value.set(T.tint); u.mistCol.value.set(T.mist); u.glintCol.value.set(T.glint); u.petalCol.value.set(T.petal);
  u.petalAmt.value = T.petals; u.sunU.value = T.sunU; u.glint.value = T.glintAmt; u.waterMix.value.set(...T.waterMix);
  water.material.uniforms.tint.value.set(T.refl);
  // cánh hoa / lá rơi quanh bàn cờ
  if (petals) { petals.parent?.remove(petals); petals.geometry.dispose(); petals = null; }
  if (T.fallN > 0) petals = buildPetals(T);
  if (petals) ctx.scene.add(petals);
}

// ---------- cánh hoa rơi chậm trong không gian quanh bàn cờ ----------
let _petal;
function petalTex() {
  if (_petal) return _petal;
  const [c, g] = canvas(64, 64);
  g.translate(32, 32);
  const gr = g.createLinearGradient(0, -26, 0, 26); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#f2d8e2');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 26); g.bezierCurveTo(-24, 10, -20, -22, -4, -26); g.lineTo(0, -20); g.lineTo(4, -26); g.bezierCurveTo(20, -22, 24, 10, 0, 26); g.fill();
  return (_petal = texOf(c));
}
function buildPetals(T) {
  const n = T.fallN, rand = seeded(11);
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), flat('#ffffff', { map: petalTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false }), n);
  const cols = T.fall.map((h) => new THREE.Color(h));
  const data = [];
  for (let k = 0; k < n; k++) {
    data.push({ x: (rand() - 0.5) * 22, y: rand() * 9 - 1.4, z: (rand() - 0.5) * 22, vy: 0.25 + rand() * 0.35, sw: rand() * 6.3, rs: 0.6 + rand() * 1.4, s: 0.7 + rand() * 0.8 });
    m.setColorAt(k, cols[k % cols.length]);
  }
  m.userData.data = data; m.frustumCulled = false; m.renderOrder = 5; m.name = 'petals';
  return m;
}

const dummy = new THREE.Object3D();
/** cập nhật mỗi khung hình: kích thước màn hình, trôi theo camera, sóng nước, cánh hoa */
export function updateBackdrop(t, dt, view) {
  if (!quad) return;
  const u = quad.material.uniforms;
  u.viewSize.value.set(innerWidth, innerHeight);
  u.wt.value = t % 3600;
  u.drift.value = (u.drift.value + dt * 0.00042) % 1;
  u.horizon.value = view.horizon; u.zoom.value = view.zoom; u.shiftPx.value.set(view.shiftX, view.shiftY);
  water.material.uniforms.wt.value = t % 3600;
  if (petals) {
    const d = petals.userData.data;
    for (let k = 0; k < d.length; k++) {
      const p = d[k];
      p.y -= p.vy * dt; p.x += (Math.sin(t * 0.8 + p.sw) * 0.35 + 0.18) * dt; p.z += 0.12 * dt;
      if (p.y < -1.35) { p.y = 7.5; p.x = (Math.random() - 0.5) * 22; p.z = (Math.random() - 0.5) * 22; }
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(t * p.rs + p.sw, t * p.rs * 0.7, Math.sin(t + p.sw)); dummy.scale.setScalar(p.s); dummy.updateMatrix();
      petals.setMatrixAt(k, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  }
}
export const glow = glowTex;
