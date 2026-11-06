import * as THREE from 'three';

// Baked surfaces: colour = albedo × light, where light cross-fades between the evening and
// day bakes. Light maps are stored as sRGB(L / Lmax) in 8-bit WebP; the GPU decodes sRGB and
// we scale back by Lmax. Tone mapping (AgX) and output colour space come from the renderer,
// so baked and live-lit objects share the same exposure.

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

export function bakedMaterial(set: BakedSet): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'baked',
    uniforms: {
      albedoMap: { value: set.albedo },
      lightA: { value: set.evening },
      lightB: { value: set.day },
      scaleA: { value: set.scaleEvening },
      scaleB: { value: set.scaleDay },
      mixT: { value: 0 },
      boost: { value: 1 },
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
