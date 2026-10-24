import { BoxGeometry, BufferGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Shape } from '../game/tiles.ts';
import { colourPart } from './modelPaint.ts';

/** Fuller, UV-mapped forms based on the generated set's buildings and palette. */
export function painterlyGeometry(shape: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const part = (g: BufferGeometry, c: number, slot: number, x = 0, y = 0, z = 0, yaw = 0) => {
    let mesh = g.index ? g.toNonIndexed() : g;
    if (mesh !== g) g.dispose();
    mesh = mesh.rotateZ(yaw).translate(x, y, z);
    parts.push(colourPart(mesh, c, slot));
  };
  const box = (w: number, d: number, h: number, c: number, slot: number, x = 0, y = 0, z = h / 2) =>
    part(new BoxGeometry(w, d, h), c, slot, x, y, z);
  const sphere = (rx: number, ry: number, rz: number, c: number, slot: number, x = 0, y = 0, z = rz) =>
    part(new SphereGeometry(1, 18, 12).scale(rx, ry, rz), c, slot, x, y, z);
  const cylinder = (r: number, h: number, c: number, slot: number, x = 0, y = 0, z = h / 2) =>
    part(new CylinderGeometry(r, r, h, 16).rotateX(Math.PI / 2), c, slot, x, y, z);
  const roof = (r: number, h: number, x: number, y: number, z: number) =>
    part(new ConeGeometry(r, h, 20).rotateX(Math.PI / 2), 0xbd5433, 4, x, y, z);
  const opening = (x: number, y: number, z: number, w = 0.1, h = 0.16) => {
    box(w, 0.025, h, 0x19394c, 3, x, y, z);
    part(new TorusGeometry(w / 2, 0.014, 5, 12, Math.PI).rotateX(Math.PI / 2), 0xe6cb91, 2, x, y - 0.018, z + h / 2);
  };
  if (shape === Shape.Forest || shape === Shape.Brush) {
    for (const [x, y, s] of [
      [-0.25, 0.2, 0.82],
      [0.22, 0.03, 1],
      [-0.2, -0.25, 0.7],
    ]) {
      if (shape === Shape.Forest) {
        part(new CylinderGeometry(0.045, 0.1, 0.7 * s, 12).rotateX(Math.PI / 2), 0x9b6738, 5, x, y, 0.35 * s);
        for (const side of [-1, 1])
          part(
            new CapsuleGeometry(0.025, 0.3 * s, 4, 8).rotateX(Math.PI / 2).rotateY(side * 0.6),
            0x9b6738,
            5,
            x + side * 0.07,
            y,
            0.55 * s,
          );
        for (const [dx, dy, dz, r] of [
          [0, 0, 0.92, 0.34],
          [-0.16, 0.02, 0.8, 0.25],
          [0.15, 0.03, 0.86, 0.26],
          [0, -0.13, 0.97, 0.23],
        ])
          sphere(r * s, r * s, r * s * 1.1, 0x4b8744, 8, x + dx * s, y + dy * s, dz * s);
      } else
        for (const [dx, dy] of [
          [0, 0],
          [-0.1, 0.04],
          [0.1, -0.03],
        ])
          sphere(0.17 * s, 0.18 * s, 0.22 * s, 0x6c9144, 8, x + dx, y + dy, 0.19 * s);
    }
  } else if (shape === Shape.Town || shape === Shape.Castle) {
    const castle = shape === Shape.Castle;
    box(0.72, 0.42, 0.55, 0xe2cf9c, 2);
    const towers = castle ? [-0.33, 0.33] : [-0.33];
    for (const x of towers) {
      cylinder(0.19, 0.85, 0xe8d7aa, 2, x, 0);
      cylinder(0.21, 0.07, 0xf0dfb9, 2, x, 0, 0.82);
      for (let k = 0; k < 8; k++)
        box(0.075, 0.075, 0.11, 0xebd6aa, 2, x + Math.cos((k * Math.PI) / 4) * 0.17, Math.sin((k * Math.PI) / 4) * 0.17, 0.91);
      for (const z of [0.32, 0.58]) opening(x, -0.19, z, 0.07, 0.1);
      for (const side of [-1, 1]) opening(x + side * 0.18, 0, zForWindow(side), 0.055, 0.1);
    }
    if (!castle) {
      box(0.42, 0.5, 0.64, 0xe9d5a5, 2, 0.19);
      roof(0.36, 0.5, 0.19, 0, 0.89);
    }
    opening(0, -0.225, 0.18, 0.22, 0.35);
    part(new TorusGeometry(0.14, 0.035, 6, 20, Math.PI).rotateX(Math.PI / 2), 0xf0d69d, 2, 0, -0.25, 0.36);
    box(0.06, 0.03, 0.1, 0xd6a642, 6, 0, -0.25, 0.12);
    cylinder(0.015, 0.42, 0xdfc99c, 2, castle ? 0 : -0.33, 0.06, 1.09);
  } else if (shape === Shape.Mountains || shape === Shape.Dungeon) {
    for (const [x, y, r, h] of [
      [-0.17, 0.14, 0.58, 1.2],
      [0.25, -0.18, 0.42, 0.85],
    ]) {
      const peak = new ConeGeometry(r, h, 18, 6).rotateX(Math.PI / 2);
      const positions = peak.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const a = positions.getX(i),
          b = positions.getY(i),
          z = positions.getZ(i);
        positions.setXYZ(i, a * (1 + Math.sin(z * 12 + b * 9) * 0.1), b * (1 + Math.cos(z * 9 + a * 12) * 0.1), z);
      }
      peak.computeVertexNormals();
      part(peak, 0xa69779, 2, x, y, h / 2);
      part(new ConeGeometry(r * 0.2, h * 0.24, 18, 3).rotateX(Math.PI / 2), 0xe8ddbd, 2, x, y, h * 0.89);
    }
    if (shape === Shape.Dungeon) {
      opening(0, -0.42, 0.22, 0.3, 0.42);
      part(new TorusGeometry(0.2, 0.065, 8, 20, Math.PI).rotateX(Math.PI / 2), 0xccba95, 2, 0, -0.45, 0.35);
    }
  } else if (shape === Shape.Wall || shape === Shape.Wall + 4 || shape === Shape.Door) {
    const door = shape === Shape.Door,
      h = shape === Shape.Wall + 4 ? 0.5 : 1;
    box(1, door ? 0.08 : 1, h, door ? 0x986537 : 0xd5c295, door ? 5 : 2);
    if (door) for (const z of [0.25, 0.75]) box(0.96, 0.015, 0.025, 0xc8ab62, 6, 0, -0.05, z);
    else
      for (let row = 0; row < Math.round(h * 6); row++)
        for (let brick = 0; brick < 3; brick++)
          box(0.29, 0.015, 0.12, 0xcbbb93, 2, -0.33 + brick * 0.33 + (row % 2 ? 0.04 : 0), -0.505, row * 0.16 + 0.07);
  } else if (shape === Shape.Shrine) {
    cylinder(0.4, 0.08, 0xdfcda8, 2);
    for (const x of [-0.25, 0.25]) for (const y of [-0.22, 0.22]) cylinder(0.045, 0.62, 0xf2dcad, 2, x, y, 0.35);
    roof(0.48, 0.3, 0, 0, 0.8);
    sphere(0.08, 0.08, 0.13, 0x7cd5e1, 3, 0, 0, 0.27);
  } else if (shape === Shape.Chest) {
    box(0.55, 0.36, 0.28, 0x9f6c35, 5);
    part(new CylinderGeometry(0.18, 0.18, 0.55, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), 0xb6813a, 5, 0, 0, 0.27);
    for (const x of [-0.2, 0.2]) box(0.035, 0.38, 0.34, 0xd5ae4e, 6, x);
  } else if (shape === Shape.Horse) {
    sphere(0.18, 0.34, 0.2, 0xe6dfc5, 2, 0, 0, 0.52);
    part(new CapsuleGeometry(0.09, 0.25, 5, 14).rotateX(Math.PI / 2).rotateX(-0.35), 0xe6dfc5, 2, 0, -0.27, 0.74);
    sphere(0.12, 0.2, 0.1, 0xe6dfc5, 2, 0, -0.38, 0.88);
    for (const x of [-0.07, 0.07]) part(new ConeGeometry(0.035, 0.14, 10).rotateX(Math.PI / 2), 0xc7b78f, 5, x, -0.27, 1.04);
    for (const x of [-0.12, 0.12])
      for (const y of [-0.23, 0.23]) {
        part(new CapsuleGeometry(0.035, 0.34, 4, 10).rotateX(Math.PI / 2), 0xd8cfb0, 2, x, y, 0.27);
        box(0.08, 0.1, 0.07, 0x65543f, 5, x, y);
      }
    for (let i = 0; i < 5; i++) sphere(0.06, 0.04, 0.055, 0x8d7656, 5, 0, -0.17 + i * 0.045, 0.77 - i * 0.012);
    part(new CapsuleGeometry(0.035, 0.28, 4, 10).rotateX(Math.PI / 2).rotateX(-0.45), 0x8d7656, 5, 0, 0.37, 0.42);
  } else if ([58, 184, 186].includes(shape)) {
    sphere(0.24, 0.4, 0.24, 0x6c9648, 0, 0, 0, 0.38);
    sphere(0.13, 0.16, 0.19, 0x8aa656, 0, 0, -0.35, 0.7);
    sphere(0.12, 0.22, 0.09, 0x9daf63, 0, 0, -0.5, 0.63);
    for (const x of [-0.07, 0.07]) {
      part(new ConeGeometry(0.035, 0.18, 12).rotateX(Math.PI / 2).rotateY(x * 3), 0xe4d5a1, 2, x, -0.3, 0.91);
      sphere(0.02, 0.025, 0.025, 0xd67a39, 4, x, -0.47, 0.76);
    }
    for (const x of [-0.21, 0.21])
      for (const y of [-0.25, 0.25]) part(new CapsuleGeometry(0.055, 0.17, 4, 12).rotateX(Math.PI / 2), 0x729048, 0, x, y, 0.18);
    for (let i = 0; i < 5; i++) {
      sphere(0.1 - i * 0.016, 0.13, 0.08, 0x729048, 0, Math.sin(i * 0.4) * 0.12, 0.35 + i * 0.14, 0.3 - i * 0.035);
      part(new ConeGeometry(0.04, 0.12, 10).rotateX(Math.PI / 2), 0xc9c179, 6, 0, -0.15 + i * 0.13, 0.61 - i * 0.02);
    }
  } else if (shape === Shape.MagicBall || shape === Shape.FireBall) {
    sphere(0.22, 0.22, 0.22, shape === Shape.MagicBall ? 0x5faed9 : 0xe48638, shape === Shape.MagicBall ? 3 : 4, 0, 0, 0.3);
  } else if (shape === Shape.Frigate || shape === Shape.Pirate) {
    sphere(0.29, 0.55, 0.17, 0x996333, 5, 0, 0, 0.04);
    box(0.46, 0.8, 0.03, 0xb18c51, 5, 0, 0, 0.18);
    cylinder(0.018, 1.05, 0x9e703d, 5, 0, 0, 0.55);
    for (const y of [-0.27, 0.27]) sphere(0.015, 0.18, 0.02, 0xd6ad66, 6, 0, y, 0.14);
  } else if (shape === Shape.Whirlpool || shape === Shape.MoonGate || shape === Shape.ForceField) {
    if (shape === Shape.Whirlpool) for (const r of [0.12, 0.24, 0.38]) part(new TorusGeometry(r, 0.025, 8, 40), 0x71b9dc, 1, 0, 0, 0.015);
    else part(new TorusGeometry(0.35, 0.045, 10, 40).rotateX(Math.PI / 2), 0x87b5e3, 3, 0, 0, 0.45);
  } else {
    // Creature/prop fallback still has volume; directional articulated figures
    // are supplied separately by the shared rig factory.
    sphere(0.22, 0.32, 0.22, 0x7d9c66, 0, 0, 0, 0.3);
    sphere(0.13, 0.14, 0.14, 0xa3af70, 0, 0, -0.3, 0.55);
    for (const x of [-0.17, 0.17]) for (const y of [-0.2, 0.2]) cylinder(0.045, 0.25, 0x806b46, 5, x, y);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
function zForWindow(side: number): number {
  return side < 0 ? 0.3 : 0.58;
}
