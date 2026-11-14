import { BLEND_MODES, Geometry, Mesh, Shader } from 'pixi.js';

const VERTEX = `
precision mediump float;
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aUvs;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

/** Animated flame border around a rectangle + a light sweep inside it (premultiplied, additive). */
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uAlpha;
uniform float uPad;
uniform vec2 uSize;
uniform vec3 uCore;
uniform vec3 uGlow;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec2 px = vUv * uSize;
  vec2 inner = uSize - 2.0 * uPad;
  vec2 q = px - uPad;
  vec2 d = max(-q, q - inner);
  float signedDist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  // flame tongues licking upwards along the border
  float n = fbm(vec2(px.x * 0.07, px.y * 0.05 + uTime * 2.6));
  float flicker = fbm(vec2(px.y * 0.03 - uTime * 1.7, px.x * 0.03));
  float edge = abs(signedDist) - n * uPad * 1.1;
  float flame = smoothstep(uPad * 0.85, 0.0, edge) * (0.55 + 0.7 * flicker);
  float hot = smoothstep(0.75, 1.15, flame);           // white-hot only at the very core
  float inside = 1.0 - step(0.0, signedDist);
  float sweep = smoothstep(0.12, 0.0, abs(fract(vUv.y * 0.7 + uTime * 0.8) - 0.5)) * inside * 0.09;
  float pulse = 0.85 + 0.15 * sin(uTime * 7.0);
  vec3 col = mix(uGlow, uCore, hot);
  float a = clamp(flame * pulse * 0.85 + sweep, 0.0, 1.0) * uAlpha;
  gl_FragColor = vec4(col * a, a);
}`;

const rgb = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

/** Quad mesh (w × h plus `pad` flame margin on every side) rendering the flame shader. */
export function createFlameMesh(w: number, h: number, pad: number, core: number, glow: number): Mesh<Shader> {
  const W = w + pad * 2;
  const H = h + pad * 2;
  const geometry = new Geometry()
    .addAttribute('aVertexPosition', [-pad, -pad, w + pad, -pad, w + pad, h + pad, -pad, h + pad], 2)
    .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2)
    .addIndex([0, 1, 2, 0, 2, 3]);
  const shader = Shader.from(VERTEX, FRAGMENT, {
    uTime: 0, uAlpha: 0, uPad: pad, uSize: [W, H], uCore: rgb(core), uGlow: rgb(glow),
  });
  const mesh = new Mesh(geometry, shader);
  mesh.blendMode = BLEND_MODES.ADD;
  return mesh;
}
