import { DataTexture, DoubleSide, InstancedMesh, LinearFilter, Matrix4, MeshBasicMaterial, PlaneGeometry } from 'three';
import { Shape } from '../game/tiles.ts';

/** Only land creatures/objects with actual card artwork cast contact shadows. */
export function castsContactShadow(shape: number, ground: number): boolean {
  if (ground === Shape.Void || ground === Shape.Water) return false;
  return (
    shape === Shape.Chest ||
    shape === Shape.Horse ||
    (shape >= 0x20 && shape <= 0x3c) ||
    shape === Shape.Ranger ||
    (shape >= 0x80 && shape <= 0x9c) ||
    (shape >= 0xa0 && shape <= 0xbe)
  );
}

/** A neutral, soft ellipse. No source artwork or light-direction dependency. */
export function shadowPixels(side = 64): Uint8Array {
  const pixels = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const radius = Math.hypot(((x + 0.5) / side) * 2 - 1, ((y + 0.5) / side) * 2 - 1);
      pixels[(y * side + x) * 4 + 3] = Math.round(255 * 0.4 * Math.max(0, 1 - radius * radius) ** 1.3);
    }
  return pixels;
}

export class ContactShadows {
  private readonly texture = new DataTexture(shadowPixels(), 64, 64);
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material: MeshBasicMaterial;
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();

  constructor() {
    this.texture.minFilter = this.texture.magFilter = LinearFilter;
    this.texture.needsUpdate = true;
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.mesh = new InstancedMesh(this.geometry, this.material, 4224);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.75;
    this.mesh.count = 0;
  }

  reset(): void {
    this.mesh.count = 0;
  }

  add(x: number, y: number, size: number): void {
    if (this.mesh.count >= 4224) return;
    this.matrix.makeScale(size * 0.95, size * 0.6, 1).setPosition(x, y, 0.002);
    this.mesh.setMatrixAt(this.mesh.count++, this.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
