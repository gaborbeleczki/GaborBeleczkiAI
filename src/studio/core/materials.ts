import * as THREE from 'three';

// Baked surfaces: colour = albedo × light, where light cross-fades between the evening and
// day bakes. Light maps are stored as sRGB(L / Lmax) in 8-bit WebP; the GPU decodes sRGB and
// we scale back by Lmax. Tone mapping (AgX) and output colour space come from the renderer,
// so baked and live-lit objects share the same exposure.

// Secondary motion on the GPU. Blender writes a per-vertex 'sway' attribute (r weight, g kind,
// b phase): curtains billow, leaves flutter, the pendant swings about its ceiling hook. The
// angles and the breeze come from the physics on the CPU; the bake stays as it is (the motion is
// a few centimetres at most).
const vertex = /* glsl */ `
  #ifdef USE_SWAY
  attribute vec4 sway;
  #endif
  uniform float time;
  uniform float wind;
  uniform vec2 pendant;   // pendulum tilt about x and z (radians)
  uniform vec3 pivot;     // where the pendant cord meets the ceiling
  varying vec2 vUv;

  vec3 swing(vec3 r, vec2 a) {
    float cx = cos(a.x), sx = sin(a.x), cz = cos(a.y), sz = sin(a.y);
    r = vec3(r.x, r.y * cx - r.z * sx, r.y * sx + r.z * cx);
    return vec3(r.x * cz - r.y * sz, r.x * sz + r.y * cz, r.z);
  }

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    #ifdef USE_SWAY
    float w = sway.r;
    if (w > 0.002) {
      float ph = sway.b * 6.2831853;
      if (sway.g > 0.62) {
        wp.xyz = pivot + swing(wp.xyz - pivot, pendant);
      } else if (sway.g > 0.37) {
        // leaves: a quick flutter, livelier in a gust
        vec3 f = vec3(sin(time * 3.1 + ph), 0.5 * sin(time * 2.3 + ph * 1.3), cos(time * 2.7 + ph * 0.7));
        wp.xyz += f * 0.0035 * w * (0.35 + wind);
      } else {
        // curtains: a slow billow into the room, a little sideways
        float billow = sin(time * 0.62 + ph) * 0.6 + sin(time * 1.27 + ph * 2.0) * 0.25;
        wp.z += billow * 0.016 * w * (0.25 + wind);
        wp.x += sin(time * 0.8 + ph * 0.5) * 0.004 * w * (0.25 + wind);
      }
    }
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D albedoMap;
  uniform sampler2D lightA;
  uniform sampler2D lightB;
  uniform float scaleA;
  uniform float scaleB;
  uniform float mixT;
  uniform float boost;
  varying vec2 vUv;
  void main() {
    vec3 albedo = texture2D(albedoMap, vUv).rgb;
    vec3 la = texture2D(lightA, vUv).rgb * scaleA;
    vec3 lb = texture2D(lightB, vUv).rgb * scaleB;
    vec3 light = mix(la, lb, mixT);
    gl_FragColor = vec4(albedo * light * boost, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface BakedSet {
  albedo: THREE.Texture;
  evening: THREE.Texture;
  day: THREE.Texture;
  scaleEvening: number;
  scaleDay: number;
}

/** Uniforms shared by every baked material (one update moves them all). */
export interface MotionUniforms {
  time: { value: number };
  wind: { value: number };
  pendant: { value: THREE.Vector2 };
  pivot: { value: THREE.Vector3 };
}

export function motionUniforms(pivot: THREE.Vector3): MotionUniforms {
  return { time: { value: 0 }, wind: { value: 0 }, pendant: { value: new THREE.Vector2() }, pivot: { value: pivot.clone() } };
}

export function bakedMaterial(set: BakedSet, motion: MotionUniforms, sway: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'baked',
    defines: sway ? { USE_SWAY: '' } : {},
    uniforms: {
      albedoMap: { value: set.albedo },
      lightA: { value: set.evening },
      lightB: { value: set.day },
      scaleA: { value: set.scaleEvening },
      scaleB: { value: set.scaleDay },
      mixT: { value: 0 },
      boost: { value: 1 },
      ...motion,
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    toneMapped: true,
  });
}

/** Lamp bulbs, the pendant diffuser and the linen shade: lit live, glowing in the evening. */
export function emitterMaterial(base: THREE.Color, glow: THREE.Color, strength: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: base,
    roughness: 0.85,
    metalness: 0,
    emissive: glow,
    emissiveIntensity: strength,
  });
  m.userData.glowStrength = strength;
  return m;
}

export function configureTexture(tex: THREE.Texture, opts: { srgb: boolean; flipY: boolean; aniso?: number }): THREE.Texture {
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.flipY = opts.flipY;
  tex.anisotropy = opts.aniso ?? 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
