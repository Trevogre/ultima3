import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { environmentFromGLTF } from '../src/ui/atelierEnvironment.ts';
import { worldPreviewLibrary, PREVIEW_FIGURE_SCALE } from '../tools/models/world-preview.ts';

describe('isolated world-map authoring scale', () => {
  it('makes mountains larger than forest, figures and grass without modifying the in-game source geometry', async () => {
    const bytes = readFileSync(new URL('../public/models/atelier/environment.glb', import.meta.url));
    const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const original = environmentFromGLTF(asset),
      preview = worldPreviewLibrary(original);
    const treeHeights: number[] = [],
      mountainHeights: number[] = [];
    for (const [name, geometry] of original) {
      const adjusted = preview.get(name)!;
      expect(adjusted).not.toBe(geometry);
      const height = adjusted.boundingBox!.max.z;
      if (name.startsWith('tree-')) treeHeights.push(height * 0.65 * 1.21);
      if (name.startsWith('rock-')) mountainHeights.push(height * 1.15 * 0.76);
      if (name.startsWith('grass-')) expect(height * 1.21).toBeLessThan(0.025);
      expect(adjusted.getAttribute('position').array).not.toBe(geometry.getAttribute('position').array);
    }
    expect(Math.min(...mountainHeights)).toBeGreaterThan(Math.max(...treeHeights) * 2);
    expect(Math.max(...treeHeights)).toBeGreaterThan(0.9 * PREVIEW_FIGURE_SCALE);
    expect(original.get('tree-0')!.boundingBox!.max.z).toBeGreaterThan(2.8);
    for (const g of preview.values()) g.dispose();
    for (const g of original.values()) g.dispose();
  });
});
