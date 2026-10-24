import { LinearMipmapLinearFilter, NearestFilter, Vector2, type CanvasTexture, type MeshBasicMaterial } from 'three';
import type { ZoomFiltering } from './view3DSettings.ts';

/** Tile-clamped mip sampling: never average the neighbouring atlas artwork. */
export function addZoomFiltering(material: MeshBasicMaterial, texture: CanvasTexture, columns: number, rows: number, alpha = false) {
  const mode = { value: 0 };
  const previousKey = material.customProgramCacheKey();
  const previous = material.onBeforeCompile.bind(material);
  material.customProgramCacheKey = () => `${previousKey}:tile-filter:${columns}:${rows}:${alpha}`;
  material.onBeforeCompile = function (shader, renderer) {
    previous(shader, renderer);
    shader.uniforms.zoomFilterMode = mode;
    shader.uniforms.tileTextureSize = { value: new Vector2(texture.image.width, texture.image.height) };
    shader.uniforms.tileGrid = { value: new Vector2(columns, rows) };
    shader.fragmentShader = `uniform float zoomFilterMode;
      uniform vec2 tileTextureSize;
      uniform vec2 tileGrid;
      vec4 tileSample(sampler2D tex, vec2 uv) {
        vec2 pixels = uv * tileTextureSize;
        vec4 crisp = textureLod(tex, (floor(pixels) + 0.5) / tileTextureSize, 0.0);
        if (zoomFilterMode < 0.5) return crisp;
        vec2 footprint = fwidth(pixels);
        float lod = clamp(log2(max(max(footprint.x, footprint.y), 1.0)), 0.0, 5.0);
        vec2 tile = floor(uv * tileGrid);
        vec2 inset = vec2(0.5 * exp2(ceil(lod))) / tileTextureSize;
        vec2 safeUV = clamp(uv, tile / tileGrid + inset, (tile + 1.0) / tileGrid - inset);
        vec4 stable = textureLod(tex, safeUV, lod);
        ${alpha ? 'stable.rgb /= max(stable.a, 0.001);' : ''}
        float blend = zoomFilterMode < 1.5 ? 1.0 : smoothstep(0.3, 1.6, lod);
        return mix(crisp, stable, blend);
      }
      ${shader.fragmentShader}`.replace('#include <map_fragment>', 'diffuseColor *= tileSample(map, vMapUv);');
  };
  return (value: ZoomFiltering) => {
    mode.value = value === 'Crisp' ? 0 : value === 'Stable' ? 1 : 2;
    const mipmaps = value !== 'Crisp';
    if (texture.generateMipmaps !== mipmaps || texture.minFilter !== (mipmaps ? LinearMipmapLinearFilter : NearestFilter)) {
      texture.generateMipmaps = mipmaps;
      texture.minFilter = mipmaps ? LinearMipmapLinearFilter : NearestFilter;
      texture.magFilter = NearestFilter;
      texture.needsUpdate = true;
    }
  };
}
