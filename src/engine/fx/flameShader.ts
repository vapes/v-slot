import { Geometry, Mesh, Shader } from 'pixi.js';

// Pixi v8 GLSL (version / precision are added by Pixi; it maps in/out for WebGL1 and 2)
const VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUv;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUv = aUV;
}`;

/** Animated flame border around a rectangle + a light sweep inside it (premultiplied, additive). */
const FRAGMENT = `
in vec2 vUv;
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

/** Uniforms of the flame shader (`mesh.shader.resources.flame.uniforms`). */
export interface FlameUniforms {
  uTime: number;
  uAlpha: number;
}

export type FlameMesh = Mesh<Geometry, Shader>;

/** Quad mesh (w × h plus `pad` flame margin on every side) rendering the flame shader. */
export function createFlameMesh(w: number, h: number, pad: number, core: number, glow: number): FlameMesh {
  const W = w + pad * 2;
  const H = h + pad * 2;
  const geometry = new Geometry({
    attributes: {
      aPosition: [-pad, -pad, w + pad, -pad, w + pad, h + pad, -pad, h + pad],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const shader = Shader.from({
    gl: { vertex: VERTEX, fragment: FRAGMENT },
    resources: {
      flame: {
        uTime: { value: 0, type: 'f32' },
        uAlpha: { value: 0, type: 'f32' },
        uPad: { value: pad, type: 'f32' },
        uSize: { value: [W, H], type: 'vec2<f32>' },
        uCore: { value: rgb(core), type: 'vec3<f32>' },
        uGlow: { value: rgb(glow), type: 'vec3<f32>' },
      },
    },
  });
  const mesh = new Mesh({ geometry, shader });
  mesh.blendMode = 'add';
  return mesh;
}

/** Live uniforms of a flame mesh (set uTime / uAlpha every frame). */
export function flameUniforms(mesh: FlameMesh): FlameUniforms {
  return (mesh.shader!.resources.flame as { uniforms: FlameUniforms }).uniforms;
}
