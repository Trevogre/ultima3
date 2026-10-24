import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Shape } from '../game/tiles.ts';

/** Locally authored mesh prototypes. Z is up; a figure's forward axis is -Y. */
export function modelGeometry(shape: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const part = (geometry: BufferGeometry, colour: number, x = 0, y = 0, z = 0, yaw = 0) => {
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g = g.rotateZ(yaw).translate(x, y, z);
    g.deleteAttribute('uv');
    const rgb = new Color(colour);
    const colours = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colours.length; i += 3) colours.set([rgb.r, rgb.g, rgb.b], i);
    g.setAttribute('color', new BufferAttribute(colours, 3));
    parts.push(g);
  };
  const box = (w: number, d: number, h: number, c: number, x = 0, y = 0, z = h / 2, yaw = 0) =>
    part(new BoxGeometry(w, d, h), c, x, y, z, yaw);
  const cone = (r: number, h: number, c: number, x = 0, y = 0, z = h / 2, sides = 5) =>
    part(new ConeGeometry(r, h, sides).rotateX(Math.PI / 2), c, x, y, z);
  const rock = (r: number, c: number, x = 0, y = 0, z = r) => part(new IcosahedronGeometry(r, 0), c, x, y, z);
  const trunk = (x: number, y: number, h: number) =>
    part(new CylinderGeometry(0.055, 0.085, h, 6).rotateX(Math.PI / 2), 0x715132, x, y, h / 2);
  const house = (x: number, y: number, scale = 1) => {
    box(0.34 * scale, 0.35 * scale, 0.38 * scale, 0xe7d1a1, x, y);
    cone(0.31 * scale, 0.27 * scale, 0xa7523e, x, y, 0.5 * scale, 4);
    box(0.09 * scale, 0.012, 0.18 * scale, 0x35434b, x, y - 0.18 * scale, 0.09 * scale);
    box(0.08 * scale, 0.012, 0.08 * scale, 0xe6b95b, x + 0.1 * scale, y - 0.18 * scale, 0.26 * scale);
  };
  const humanoid = (coat: number, skin = 0xe1b787, mage = false, wings = false) => {
    box(0.13, 0.23, 0.14, 0x493b31, -0.11, -0.03);
    box(0.13, 0.23, 0.14, 0x493b31, 0.11, -0.03);
    box(0.12, 0.13, 0.23, coat, -0.11, 0, 0.23);
    box(0.12, 0.13, 0.23, coat, 0.11, 0, 0.23);
    box(0.32, 0.23, 0.31, coat, 0, 0, 0.46);
    rock(0.15, skin, 0, -0.015, 0.76);
    box(0.055, 0.05, 0.07, skin, 0, -0.15, 0.74);
    for (const x of [-0.06, 0.06]) box(0.025, 0.02, 0.025, 0x17272d, x, -0.134, 0.79);
    box(0.08, 0.12, 0.28, coat, -0.22, 0, 0.46);
    box(0.08, 0.12, 0.28, coat, 0.22, 0, 0.46);
    if (mage) {
      cone(0.17, 0.28, coat, 0, 0, 0.98);
      trunk(0.29, -0.08, 0.8);
      rock(0.07, 0xe9bc62, 0.29, -0.08, 0.86);
    } else {
      box(0.19, 0.07, 0.26, 0x728f9e, -0.25, -0.1, 0.47);
      box(0.03, 0.04, 0.42, 0xd8e1dd, 0.27, -0.12, 0.58);
      box(0.15, 0.05, 0.035, 0xd8ac56, 0.27, -0.12, 0.4);
    }
    if (wings) for (const x of [-0.42, 0.42]) box(0.45, 0.07, 0.35, coat, x, 0.14, 0.61, x);
  };

  if (shape === Shape.Forest || shape === Shape.Brush) {
    const tree = shape === Shape.Forest;
    for (const [x, y, h] of [
      [-0.24, 0.22, 0.92],
      [0.25, 0, 1.1],
      [-0.18, -0.24, 0.8],
    ]) {
      if (tree) {
        trunk(x, y, h * 0.55);
        cone(0.3, h * 0.7, 0x35684a, x, y, h * 0.75);
        cone(0.24, h * 0.55, 0x50844c, x, y, h);
      } else rock(0.23, 0x648c48, x, y, 0.2);
    }
  } else if (shape === Shape.Mountains) {
    cone(0.65, 1.15, 0x7b8584, -0.12, 0.1);
    cone(0.42, 0.83, 0x92938a, 0.28, -0.23);
    cone(0.16, 0.3, 0xd2dbce, -0.12, 0.1, 1.0);
  } else if (shape === Shape.Town) {
    house(-0.2, 0.2, 0.9);
    house(0.23, 0.12, 0.8);
    house(0, -0.24, 1.05);
  } else if (shape === Shape.Castle) {
    box(0.8, 0.7, 0.5, 0xb0b6ab);
    for (const x of [-0.32, 0.32])
      for (const y of [-0.28, 0.28]) {
        box(0.23, 0.23, 0.8, 0xc8c6b0, x, y);
        cone(0.19, 0.22, 0x77778b, x, y, 0.91, 4);
      }
    box(0.19, 0.02, 0.28, 0x293337, 0, -0.36, 0.14);
  } else if (shape === Shape.Dungeon) {
    rock(0.47, 0x79817b, 0, 0.1, 0.34);
    box(0.26, 0.035, 0.36, 0x172327, 0, -0.3, 0.18);
    part(new TorusGeometry(0.2, 0.065, 4, 8).rotateX(Math.PI / 2), 0xa4a593, 0, -0.33, 0.23);
  } else if (shape === Shape.Wall + 4) {
    box(1, 1, 0.5, 0x858c86);
  } else if (shape === Shape.Wall) {
    box(1, 1, 0.7, 0x858c86);
    for (const x of [-0.34, 0, 0.34]) box(0.2, 0.2, 0.15, 0xa5aa9a, x, -0.3, 0.775);
  } else if (shape === Shape.Door) {
    box(0.65, 0.16, 0.8, 0x775133);
    box(0.08, 0.04, 0.08, 0xe3bb5c, 0.2, -0.1, 0.4);
  } else if (shape === Shape.Shrine) {
    box(0.65, 0.6, 0.08, 0xc3c7b5);
    for (const x of [-0.24, 0.24]) for (const y of [-0.21, 0.21]) trunk(x, y, 0.55);
    cone(0.49, 0.3, 0xc2bc91, 0, 0, 0.65, 4);
    rock(0.1, 0x77ccd0, 0, 0, 0.25);
  } else if (shape === Shape.Chest) {
    box(0.5, 0.35, 0.3, 0x946238);
    for (const x of [-0.18, 0.18]) box(0.04, 0.37, 0.32, 0xd1ae59, x);
  } else if (shape === Shape.Horse) {
    box(0.28, 0.58, 0.25, 0xb99b76, 0, 0, 0.48);
    for (const x of [-0.1, 0.1]) for (const y of [-0.21, 0.21]) box(0.07, 0.07, 0.4, 0x876b51, x, y);
    box(0.2, 0.22, 0.34, 0xc3a786, 0, -0.25, 0.7);
    box(0.18, 0.32, 0.15, 0xc3a786, 0, -0.37, 0.77);
  } else if (shape === Shape.Frigate || shape === Shape.Pirate) {
    box(0.42, 0.85, 0.22, 0x795137, 0, 0, 0.02);
    trunk(0, 0, 0.9);
    box(0.46, 0.035, 0.45, shape === Shape.Pirate ? 0x363d45 : 0xe2d9b2, 0, 0, 0.6);
    cone(0.2, 0.3, 0x795137, 0, -0.45, 0.02, 3);
  } else if (shape === Shape.Whirlpool) {
    for (const r of [0.13, 0.27, 0.4]) part(new TorusGeometry(r, 0.025, 3, 12), 0x7aaeb8, 0, 0, 0.01);
  } else if (shape === Shape.MoonGate || shape === Shape.ForceField) {
    part(new TorusGeometry(0.35, 0.06, 4, 12).rotateX(Math.PI / 2), 0x819bea, 0, 0, 0.43);
  } else if (shape === Shape.MagicBall || shape === Shape.FireBall) {
    rock(0.22, shape === Shape.MagicBall ? 0x77bfee : 0xe98945, 0, 0, 0.3);
  } else if (([Shape.Serpent, Shape.ManOWar, Shape.SnakeBottom, Shape.SnakeTop] as number[]).includes(shape)) {
    for (let i = 0; i < 5; i++) rock(0.14, 0x619b7f, Math.sin(i) * 0.15, (i - 2) * 0.15, 0.04 + i * 0.07);
  } else if (shape === 0x3a || shape === 0xb8 || shape === 0xba) {
    // Dragon variants: quadruped body, head, tail and solid wings.
    box(0.34, 0.6, 0.28, 0x7c9464, 0, 0, 0.35);
    for (const x of [-0.2, 0.2]) for (const y of [-0.2, 0.2]) box(0.08, 0.1, 0.24, 0x64794e, x, y);
    rock(0.18, 0x91a96f, 0, -0.4, 0.55);
    cone(0.13, 0.65, 0x64794e, 0, 0.35, 0.28, 3);
    for (const x of [-0.4, 0.4]) box(0.45, 0.4, 0.05, 0xb0ac79, x, 0.07, 0.55, x);
  } else {
    const index = shape >> 1;
    const colours = [0x507aab, 0xc2b99a, 0x7570ac, 0x4d988c, 0x7d91ac, 0xba8053, 0xb76d89, 0x716cb2, 0x638a51, 0xa48252, 0x628347];
    const career = index >= 68 && index <= 78 ? index - 68 : index >= 64 && index <= 67 ? index - 64 : index % 11;
    const skeleton = shape === 0x32 || shape === 0xa4 || shape === 0xa6;
    const orc = shape === 0x30 || shape === 0xa2;
    const demon = shape === 0x36 || shape === 0x3c || shape === 0xbe;
    humanoid(
      skeleton ? 0xd8d5bc : demon ? 0x9b5146 : orc ? 0x537448 : colours[career],
      skeleton ? 0xd8d5bc : orc ? 0x80a15c : 0xe1b787,
      [1, 2, 7, 8, 9].includes(career) && !skeleton && !demon && !orc && !(index >= 24 && index <= 30) && index < 80,
      demon,
    );
  }
  if (shape === Shape.Town || shape === Shape.Castle)
    part(
      new CylinderGeometry(0.012, 0.012, shape === Shape.Town ? 0.7 : 0.4, 6).rotateX(Math.PI / 2),
      0xc7b086,
      0,
      0.06,
      shape === Shape.Town ? 0.96 : 1.11,
    );
  const geometry = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  geometry.computeBoundingSphere();
  return geometry;
}

export function modelGroundColour(shape: number): number {
  if (shape === Shape.Void) return 0;
  if (shape === Shape.Water) return 0x386c86;
  if (shape === Shape.Lava) return 0xb65a38;
  if (shape === Shape.Floor || shape === Shape.Door || (shape >= 76 && shape <= 114)) return 0x8c9183;
  if (shape === Shape.Mountains || shape === Shape.Dungeon || shape === Shape.Wall || shape === Shape.Wall + 4) return 0x788376;
  return 0x607d49;
}

export function hasTerrainModel(shape: number): boolean {
  return (
    shape !== Shape.Void &&
    shape !== Shape.Grass &&
    shape !== Shape.Water &&
    shape !== Shape.Floor &&
    shape !== Shape.Lava &&
    !(shape >= 76 && shape <= 114 && shape !== Shape.Door)
  );
}
