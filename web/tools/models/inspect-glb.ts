import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const file = new URL('../../public/models/atelier/ranger.glb', import.meta.url);
const data = readFileSync(file);
if (data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length)
  throw new Error('Invalid GLB envelope');
interface Accessor {
  bufferView: number;
  byteOffset?: number;
  count: number;
  componentType: number;
  type: string;
  min?: number[];
  max?: number[];
}
interface Glb {
  accessors: Accessor[];
  bufferViews: { byteOffset: number; byteLength: number; byteStride?: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  skins: { joints: number[] }[];
  nodes: { name?: string }[];
  buffers: { uri?: string }[];
  animations: { name: string; samplers: { input: number; output: number }[]; channels: unknown[] }[];
}
const jsonSize = data.readUInt32LE(12),
  g = JSON.parse(data.toString('utf8', 20, 20 + jsonSize)) as Glb;
const bin = 28 + jsonSize;
function floats(index: number): number[] {
  const a = g.accessors[index],
    v = g.bufferViews[a.bufferView];
  if (a.componentType !== 5126) throw new Error('Expected float accessor');
  const components = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type];
  return Array.from({ length: a.count * components }, (_, i) =>
    data.readFloatLE(
      bin + v.byteOffset + (a.byteOffset ?? 0) + Math.floor(i / components) * (v.byteStride ?? components * 4) + (i % components) * 4,
    ),
  );
}
if (g.meshes.length !== 1 || g.skins.length !== 1 || g.skins[0].joints.length > 32) throw new Error('Unexpected character structure');
if (g.buffers.some((b) => b.uri)) throw new Error('External dependency in GLB');
if (g.nodes.some((n) => n.name === 'Cube')) throw new Error('Unrelated scene leaked into character export');
const primitives = g.meshes[0].primitives;
let triangles = 0,
  weightedVertices = 0;
for (const p of primitives) {
  for (const key of ['POSITION', 'NORMAL', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'])
    if (p.attributes[key] === undefined) throw new Error(`Missing ${key}`);
  triangles += g.accessors[p.indices].count / 3;
  const weights = floats(p.attributes.WEIGHTS_0);
  for (let i = 0; i < weights.length; i += 4) {
    const sum = weights.slice(i, i + 4).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-4) throw new Error(`Unnormalised weights at ${i / 4}: ${sum}`);
    weightedVertices++;
  }
}
if (triangles > 30000) throw new Error('Triangle budget exceeded');
const clips = g.animations.map((a) => {
  const times = a.samplers.flatMap((s) => floats(s.input));
  const duration = Math.max(...times) - Math.min(...times);
  if (duration <= 0) throw new Error(`Empty animation ${a.name}`);
  const moves = a.samplers.some((s) => {
    const v = floats(s.output),
      size = ({ VEC3: 3, VEC4: 4 } as Record<string, number>)[g.accessors[s.output].type] ?? 1;
    return v.some((n, i) => Math.abs(n - v[i % size]) > 1e-4);
  });
  if (!moves) throw new Error(`Static clip ${a.name}`);
  return { name: a.name, duration, channels: a.channels.length };
});
for (const name of ['Idle', 'Walk', 'Attack', 'Cast', 'Hit']) if (!clips.some((c) => c.name === name)) throw new Error(`Missing ${name}`);
const position = g.accessors[primitives[0].attributes.POSITION];
const report = {
  file: 'public/models/atelier/ranger.glb',
  sha256: createHash('sha256').update(data).digest('hex'),
  bytes: data.length,
  triangles,
  joints: g.skins[0].joints.length,
  weightedVertices,
  bounds: { min: position.min, max: position.max },
  clips,
  verification:
    'Static GLB structure, budgets, skin weight normalisation and non-static animation channels. Visual quality and runtime playback require separate review.',
};
writeFileSync(new URL('../../docs/models/atelier/glb-inspection.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
