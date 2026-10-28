/*
  MotifFlow — scroll-driven WebGL story.
  One Points cloud, every particle knows where it lives in each act:
    0  Audio        glowing waveform, breathing
    1  Transcribe   3D piano roll (melody, chords, bass)
    2  Variations   stream splits into four coloured lanes flowing through space
    3  Into the DAW particles settle into a 4-row MIDI clip
    4  Release      calm ambient field
  Positions for acts 0, 2 and 4 are computed on the GPU; 1 and 3 are precomputed.
  The page drives it with setTarget(progress 0..4, side -1..1).
*/
import * as THREE from './vendor/three.module.min.js';   // self-hosted three.js r160 (MIT, vendor/three-LICENSE.txt)

const MINT = new THREE.Color('#7cf5b2');
const LANES = ['#5fd4e8', '#f5c46b', '#a594ff', '#ff6f8e'].map((c) => new THREE.Color(c));

/* ---------- deterministic random ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- musical material ---------- */
function buildRollNotes(rand) {
  // 4 bars x 16 steps. pitch in semitones (MIDI-ish)
  const notes = [];
  const prog = [
    { bass: 36, chord: [51, 55, 60] }, // Cm
    { bass: 32, chord: [51, 56, 60] }, // Ab
    { bass: 39, chord: [51, 55, 58] }, // Eb
    { bass: 34, chord: [50, 53, 58] }, // Bb
  ];
  const penta = [60, 63, 65, 67, 70, 72, 75];
  let mi = 3;
  prog.forEach((c, bar) => {
    const b0 = bar * 16;
    notes.push({ part: 'bass', s: b0, l: 6, p: c.bass });
    notes.push({ part: 'bass', s: b0 + 7, l: 3, p: c.bass });
    notes.push({ part: 'bass', s: b0 + 11, l: 4, p: c.bass + (bar % 2 ? 7 : 0) });
    c.chord.forEach((p) => notes.push({ part: 'chord', s: b0, l: 14, p }));
    let s = b0;
    while (s < b0 + 16) {
      const l = [1, 2, 2, 3, 4][Math.floor(rand() * 5)];
      if (rand() > 0.18) {
        mi = Math.max(0, Math.min(penta.length - 1, mi + Math.round((rand() - 0.5) * 3.2)));
        notes.push({ part: 'mel', s, l: Math.min(l, b0 + 16 - s), p: penta[mi] });
      }
      s += l;
    }
  });
  return notes;
}

function buildClipNotes(rand) {
  // per lane row, a short pattern with its own personality
  const rows = [];
  const cfg = [
    { lens: [3, 4, 4, 6], range: 0.35, rest: 0.1 },   // Safe
    { lens: [1, 1, 2, 1, 3], range: 0.4, rest: 0.25 }, // Bounce
    { lens: [2, 3, 4], range: 0.75, rest: 0.08, climb: true }, // Evolution
    { lens: [1, 2, 5, 2], range: 1.0, rest: 0.2 },    // Wild
  ];
  cfg.forEach((c, lane) => {
    const notes = [];
    let s = 0, v = 0.5;
    while (s < 64) {
      const l = c.lens[Math.floor(rand() * c.lens.length)];
      if (rand() > c.rest) {
        if (c.climb) v = 0.15 + 0.7 * (s / 64) + (rand() - 0.5) * 0.25;
        else v = Math.max(0, Math.min(1, 0.5 + (rand() - 0.5) * c.range));
        notes.push({ s, l: Math.min(l, 64 - s), v });
      }
      s += l + (lane === 1 && rand() > 0.6 ? 1 : 0);
    }
    rows.push(notes);
  });
  return rows;
}

/* pick an item from weighted list */
function weightedPicker(items, weightFn, rand) {
  const cum = []; let t = 0;
  items.forEach((it) => { t += weightFn(it); cum.push(t); });
  return () => {
    const r = rand() * t;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    return items[lo];
  };
}

/* ---------- geometry ---------- */
function buildGeometry(count) {
  const rand = mulberry32(20261027);
  const seed = new Float32Array(count * 4);
  const lane = new Float32Array(count);
  const roll = new Float32Array(count * 4);
  const clip = new Float32Array(count * 4);
  const pos = new Float32Array(count * 3); // dummy, required by three

  const rollNotes = buildRollNotes(rand);
  const pickRoll = weightedPicker(rollNotes, (n) => n.l * (n.part === 'mel' ? 1.5 : 1), rand);
  const clipRows = buildClipNotes(rand);
  const pickClip = clipRows.map((row) => weightedPicker(row, (n) => n.l, rand));

  // piano-roll layout
  const RX0 = -10, RSTEP = 20 / 64, SEMI = 0.135, PMID = 52;
  // clip layout
  const CX0 = -8, CSTEP = 16 / 64, ROWY = [1.0, 0.27, -0.46, -1.19], ROWH = 0.58;
  const CTOP = 1.42, CBOT = -1.58, CHEAD = 0.26;

  for (let i = 0; i < count; i++) {
    const a = rand(), b = rand(), c = rand(), d = rand();
    seed.set([a, b, c, d], i * 4);
    const L = Math.floor(rand() * 4);
    lane[i] = L;

    /* --- piano roll --- */
    if (rand() < 0.86) {
      const n = pickRoll();
      const x = RX0 + (n.s + rand() * (n.l - 0.18)) * RSTEP;
      const y = (n.p - PMID) * SEMI + (rand() - 0.5) * SEMI * 0.7;
      const z = (rand() - 0.5) * 0.32;
      roll.set([x, y, z, n.part === 'mel' ? 0 : n.part === 'chord' ? 0.15 : 0.3], i * 4);
    } else {
      // grid: beat lines (vertical) and octave lines (horizontal) on a back plane
      let x, y;
      if (rand() < 0.65) {
        const beat = Math.floor(rand() * 17);
        x = RX0 + beat * 4 * RSTEP;
        y = (rand() * 52 - 24) * SEMI + 0.3;
      } else {
        const oct = Math.floor(rand() * 5);
        y = (oct * 12 - 22) * SEMI;
        x = RX0 + rand() * 64 * RSTEP;
      }
      roll.set([x, y, -0.45, beatLineKind(x, RX0, RSTEP)], i * 4);
    }

    /* --- MIDI clip --- */
    const r = rand();
    if (r < 0.8) {
      const n = pickClip[L]();
      const x = CX0 + (n.s + rand() * (n.l - 0.2)) * CSTEP;
      const y = ROWY[L] + (n.v - 0.5) * ROWH * 0.8 + (rand() - 0.5) * 0.05;
      clip.set([x, y, (rand() - 0.5) * 0.08, 0], i * 4);
    } else if (r < 0.93) {
      // outline
      const per = 2 * 16 + 2 * (CTOP + CHEAD - CBOT);
      let t = rand() * per, x, y;
      const H = CTOP + CHEAD - CBOT;
      if (t < 16) { x = CX0 + t; y = CTOP + CHEAD; }
      else if (t < 32) { x = CX0 + (t - 16); y = CBOT; }
      else if (t < 32 + H) { x = CX0; y = CBOT + (t - 32); }
      else { x = CX0 + 16; y = CBOT + (t - 32 - H); }
      clip.set([x, y, 0, 1], i * 4);
    } else {
      // header strip
      clip.set([CX0 + rand() * 16, CTOP + rand() * CHEAD, 0, 2], i * 4);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aLane', new THREE.BufferAttribute(lane, 1));
  g.setAttribute('aRoll', new THREE.BufferAttribute(roll, 4));
  g.setAttribute('aClip', new THREE.BufferAttribute(clip, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);
  return g;
}
function beatLineKind(x, x0, step) {
  // 1 = grid line, slightly brighter on bar lines (every 16 steps)
  const s = Math.round((x - x0) / step);
  return s % 16 === 0 ? 1.0 : 1.5;
}

/* ---------- shaders ---------- */
const vert = /* glsl */`
uniform float uTime;
uniform float uP;
uniform float uPR;
uniform float uSize;
uniform float uScale;
uniform float uHalo;
uniform vec3 uMint;
uniform vec3 uLane[4];

attribute vec4 aSeed;
attribute float aLane;
attribute vec4 aRoll;
attribute vec4 aClip;

varying vec3 vCol;
varying float vAlpha;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

vec3 laneCol() {
  int l = int(aLane + 0.5);
  if (l == 0) return uLane[0];
  if (l == 1) return uLane[1];
  if (l == 2) return uLane[2];
  return uLane[3];
}

// ACT 0 — waveform
vec3 sWave(out float b, out vec3 col) {
  float t = uTime;
  float x = mix(-15.5, 15.5, aSeed.x);
  float beat = fract((x + 15.5) / 2.6);
  float env = 0.4 + 2.1 * exp(-beat * 3.6);
  env *= 0.7 + 0.3 * sin(x * 0.83 + 1.1);
  env *= smoothstep(15.5, 9.0, abs(x));
  env *= 1.0 + 0.16 * sin(t * 1.6 - x * 0.42) + 0.06 * sin(t * 3.3 + x * 1.7);
  float r = aSeed.y * 2.0 - 1.0;
  float y;
  if (aSeed.w < 0.2) {
    y = env * sin(x * 11.0 + t * 2.2 + aSeed.z * 0.25) * 0.95;
    b = 1.25 * smoothstep(0.05, 0.6, env);
  } else {
    y = sign(r) * pow(abs(r), 0.62) * env;
    b = 0.35 + 0.65 * (1.0 - abs(r));
  }
  float z = (aSeed.z - 0.5) * (0.4 + env * 0.9);
  b *= 0.12 + 0.88 * smoothstep(-9.0, 1.5, x);   // let the left end fade under the headline
  col = mix(uMint, vec3(0.86, 1.0, 0.94), aSeed.w < 0.2 ? 0.45 : 0.0);
  return vec3(x, y, z);
}

// ACT 1 — piano roll
vec3 sRoll(out float b, out vec3 col) {
  vec3 p = aRoll.xyz;
  float k = aRoll.w;
  if (k >= 1.0) {
    b = k > 1.2 ? 0.12 : 0.28;
    col = uMint * 0.8;
  } else {
    p.z += sin(uTime * 1.3 + aSeed.x * 40.0) * 0.015;
    b = 1.0 - k * 1.2;
    float ph = mod(uTime * 2.4, 24.0) - 12.0;
    b += 0.9 * exp(-pow((p.x - ph) * 2.2, 2.0));
    col = mix(uMint, vec3(0.75, 1.0, 0.9), 0.2 - k * 0.6);
  }
  return p;
}

// ACT 2 — four lanes
vec3 sLanes(out float b, out vec3 col) {
  float u = fract(aSeed.x + uTime * 0.022);
  float x = mix(-20.0, 20.0, u);
  float split = smoothstep(-15.0, -5.0, x);
  float li = aLane - 1.5;
  float stepW = aLane < 0.5 ? 1.25 : aLane < 1.5 ? 0.62 : aLane < 2.5 ? 1.0 : 0.85;
  float si = floor(x / stepW);
  float h = hash(si * 7.13 + aLane * 31.7);
  float range = 0.16 + aLane * 0.13;
  float pitch = (floor(h * 5.0) - 2.0) * range;
  if (aLane > 1.5 && aLane < 2.5) pitch += (x + 5.0) * 0.06; // Evolution climbs
  float rest = step(0.8, hash(si * 3.17 + aLane * 11.3));
  float inStep = fract(x / stepW);
  float gap = smoothstep(0.0, 0.06, inStep) * smoothstep(1.0, 0.88, inStep);
  vec3 p;
  p.x = x;
  p.y = li * 1.65 * split + pitch * split + sin(x * 0.22 + uTime * 0.5 + aLane * 1.7) * 0.35 * split;
  p.z = -li * 2.4 * split + sin(x * 0.18 + aLane) * 0.6 * split;
  float th = mix(0.06, 0.13, split);
  p.y += (aSeed.y - 0.5) * th;
  p.z += (aSeed.z - 0.5) * th * 1.6;
  b = mix(1.0, (0.25 + 0.75 * gap) * (1.0 - rest * 0.8), split);
  b *= smoothstep(20.0, 16.0, abs(x));
  col = mix(uMint, laneCol(), split);
  return p;
}

// ACT 3 — MIDI clip
vec3 sClip(out float b, out vec3 col) {
  vec3 p = aClip.xyz;
  float k = aClip.w;
  if (k < 0.5) {
    b = 1.0;
    float ph = mod(uTime * 1.6, 20.0) - 10.0;
    b += 1.1 * exp(-pow((p.x - ph) * 2.5, 2.0));
    col = laneCol();
  } else if (k < 1.5) {
    b = 0.32; col = uMint;
  } else {
    b = 0.22; col = uMint;
  }
  return p;
}

// ACT 4 — ambient field
vec3 sAmb(out float b, out vec3 col) {
  vec3 p = (aSeed.xyz - 0.5) * vec3(56.0, 32.0, 40.0);
  p.z -= 6.0;
  float t = uTime;
  p += vec3(sin(t * 0.07 + aSeed.w * 6.283), cos(t * 0.05 + aSeed.x * 6.283), sin(t * 0.06 + aSeed.y * 6.283)) * 1.2;
  b = 0.3 + 0.45 * (0.5 + 0.5 * sin(t * 0.8 + aSeed.w * 50.0));
  col = mix(laneCol(), uMint, 0.55);
  return p;
}

vec3 stateP(int k, out float b, out vec3 col) {
  if (k == 0) return sWave(b, col);
  if (k == 1) return sRoll(b, col);
  if (k == 2) return sLanes(b, col);
  if (k == 3) return sClip(b, col);
  return sAmb(b, col);
}

void main() {
  float s = clamp(uP, 0.0, 4.0);
  int i = int(floor(min(s, 3.999)));
  float fr = s - float(i);
  float d = (aSeed.w - 0.5) * 0.36;
  float f = smoothstep(0.18, 0.82, fr + d);

  float bA, bB; vec3 cA, cB;
  vec3 pA = stateP(i, bA, cA);
  vec3 pB = stateP(i + 1, bB, cB);
  vec3 p = mix(pA, pB, f);

  // swirl while travelling between acts
  float tr = sin(f * 3.14159);
  p += vec3(
    sin(p.y * 0.7 + uTime * 0.9 + aSeed.x * 6.0),
    cos(p.x * 0.45 - uTime * 0.7 + aSeed.y * 6.0),
    sin(p.x * 0.3 + p.y * 0.5 + aSeed.z * 6.0)
  ) * tr * (0.6 + aSeed.z * 1.4);

  float b = mix(bA, bB, f);
  vCol = mix(cA, cB, f);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (0.55 + aSeed.y * 0.9) * (0.75 + 0.35 * min(b, 1.6));
  gl_PointSize = clamp(sz * uPR * uScale / -mv.z, 0.0, 64.0 * uPR);
  float near = smoothstep(0.6, 3.0, -mv.z);
  vAlpha = b * near * uHalo;
}
`;

const frag = /* glsl */`
precision highp float;
varying vec3 vCol;
varying float vAlpha;
uniform float uSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * uSoft);
  float a = core * vAlpha;
  gl_FragColor = vec4(vCol * a, a);
}
`;

/* ---------- public API ---------- */
export function createScene(canvas, opts = {}) {
  const reduced = !!opts.reducedMotion;
  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const MAX = isMobile ? 12000 : 40000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0b0f0d, 1);
  let pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();
  scene.fog = null;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  const geo = buildGeometry(MAX);
  const uniforms = {
    uTime: { value: 0 },
    uP: { value: 0 },
    uPR: { value: pr },
    uSize: { value: isMobile ? 0.14 : 0.11 },
    uScale: { value: 1 },
    uHalo: { value: 0.55 },
    uSoft: { value: 4.5 },
    uMint: { value: MINT },
    uLane: { value: LANES },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // soft halo layer: same particles, larger and faint, gives a bloom-like glow without post-processing
  let halo = null;
  if (!isMobile) {
    const haloUniforms = { ...uniforms, uSize: { value: 0.55 }, uHalo: { value: 0.05 }, uSoft: { value: 2.2 } };
    const haloMat = mat.clone();
    haloMat.uniforms = haloUniforms;
    halo = new THREE.Points(geo.clone(), haloMat);
    halo.geometry.setDrawRange(0, Math.floor(MAX * 0.35));
    halo.frustumCulled = false;
    scene.add(halo);
  }

  /* camera path, one key per act */
  const camKeys = [
    { pos: [2.0, 0.2, 15.5], look: [0.6, 0.2, 0] },
    { pos: [4.5, 5.5, 13.5], look: [0, 0.4, 0] },
    { pos: [-11, 3.2, 13], look: [3, 0, -2.5] },
    { pos: [-0.5, -3.4, 31], look: [-0.5, -3.4, 0] },
    { pos: [0, 0, 11], look: [0, 0, -20] },
  ];
  const posCurve = new THREE.CatmullRomCurve3(camKeys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(camKeys.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal');

  const state = {
    p: 0, pTarget: 0, side: 0, sideTarget: 0,
    mx: 0, my: 0, mxT: 0, myT: 0,
    w: 1, h: 1, running: false, raf: 0, last: performance.now(), time: reduced ? 3.2 : 0,
  };
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

  function resize() {
    state.w = window.innerWidth; state.h = window.innerHeight;
    renderer.setSize(state.w, state.h, false);
    camera.aspect = state.w / state.h;
    // keep the composition similar on narrow screens by widening the fov
    camera.fov = state.w / state.h < 0.8 ? 62 : state.w / state.h < 1.2 ? 52 : 42;
    camera.updateProjectionMatrix();
    uniforms.uScale.value = state.h / 2;
    applySide();
    if (!state.running) render();
  }

  function applySide() {
    const wide = state.w > 900;
    const off = wide ? -state.side * state.w * 0.22 : 0;
    // on tall phone screens the hero copy sits low, so lift the waveform into the empty top half
    const tall = state.w / state.h < 0.8;
    const offY = tall ? state.h * 0.2 * Math.max(0, 1 - state.p) : 0;
    camera.setViewOffset(state.w, state.h, off, offY, state.w, state.h);
  }

  function ease(p) {
    const i = Math.min(Math.floor(p), 3);
    const fr = p - i;
    return i + fr * fr * (3 - 2 * fr);
  }

  function updateCamera() {
    const t = ease(state.p) / 4;
    posCurve.getPoint(t, tmpP);
    lookCurve.getPoint(t, tmpL);
    tmpP.x += state.mx * 0.9;
    tmpP.y += state.my * 0.55;
    camera.position.copy(tmpP);
    camera.lookAt(tmpL);
    applySide();
  }

  function render() {
    uniforms.uP.value = state.p;
    uniforms.uTime.value = state.time;
    if (halo) {
      halo.material.uniforms.uP.value = state.p;
      halo.material.uniforms.uTime.value = state.time;
    }
    updateCamera();
    renderer.render(scene, camera);
  }

  /* adaptive quality: watch frame time and trim particles if slow */
  const perf = { frames: 0, acc: 0, count: MAX, checks: 0 };
  function adapt(dt) {
    if (perf.checks > 4) return;
    perf.frames++; perf.acc += dt;
    if (perf.frames >= 90) {
      const avg = perf.acc / perf.frames;
      perf.frames = 0; perf.acc = 0; perf.checks++;
      if (avg > 22 && perf.count > 8000) {
        perf.count = Math.max(8000, Math.floor(perf.count * 0.65));
        geo.setDrawRange(0, perf.count);
        if (halo) halo.geometry.setDrawRange(0, Math.floor(perf.count * 0.25));
        if (avg > 30 && pr > 1) { pr = Math.max(1, pr - 0.5); renderer.setPixelRatio(pr); uniforms.uPR.value = pr; resize(); }
      }
    }
  }

  function loop(now) {
    state.raf = requestAnimationFrame(loop);
    const dt = Math.min(now - state.last, 100);
    state.last = now;
    const k = 1 - Math.pow(0.0025, dt / 1000);   // frame-rate independent smoothing
    state.p += (state.pTarget - state.p) * k;
    state.side += (state.sideTarget - state.side) * k;
    const km = 1 - Math.pow(0.02, dt / 1000);
    state.mx += (state.mxT - state.mx) * km;
    state.my += (state.myT - state.my) * km;
    state.time += dt / 1000;
    render();
    adapt(dt);
  }

  function start() {
    if (state.running || reduced) return;
    state.running = true; state.last = performance.now();
    state.raf = requestAnimationFrame(loop);
  }
  function stop() { state.running = false; cancelAnimationFrame(state.raf); }

  window.addEventListener('resize', resize);
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      state.mxT = (e.clientX / state.w - 0.5) * 2;
      state.myT = -(e.clientY / state.h - 0.5) * 2;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

  resize();
  render();
  start();

  return {
    setTarget(p, side) {
      state.pTarget = p; state.sideTarget = side;
      if (reduced) { state.p = p; state.side = side; render(); }
    },
    jump(p, side) { state.p = state.pTarget = p; state.side = state.sideTarget = side; render(); },
    get particleCount() { return perf.count; },
    // debugging / screenshot helpers
    freeze(time) { stop(); state.p = state.pTarget; state.side = state.sideTarget; state.mx = state.my = 0; if (time != null) state.time = time; render(); },
    resume() { start(); },
  };
}
