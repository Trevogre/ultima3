import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { environmentFromGLTF } from '../../src/ui/atelierEnvironment.ts';
const file = new URL('../../public/models/atelier/environment.glb', import.meta.url),
  bytes = readFileSync(file);
if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length)
  throw new Error('Invalid GLB');
const length = bytes.readUInt32LE(12),
  meta = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as {
    buffers: { uri?: string }[];
    images?: unknown[];
    meshes: unknown[];
    animations?: unknown[];
  };
if (meta.buffers.some((b) => b.uri) || meta.images?.length || meta.animations?.length)
  throw new Error('Environment library has unexpected external dependencies or animation');
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const library = environmentFromGLTF(gltf);
const meshes = [...library].map(([name, geometry]) => {
  const triangles = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  if (!Number.isInteger(triangles) || triangles <= 0 || triangles > 10000) throw new Error(`Triangle budget: ${name}`);
  for (const key of ['position', 'normal', 'color', 'composedWind'])
    if (!Array.from(geometry.getAttribute(key).array).every(Number.isFinite)) throw new Error(`Invalid ${key}: ${name}`);
  if (geometry.boundingBox!.min.z < -0.001 || geometry.boundingBox!.max.z > 3.5) throw new Error(`Dimensions: ${name}`);
  return { name, triangles, bounds: { min: geometry.boundingBox!.min.toArray(), max: geometry.boundingBox!.max.toArray() } };
});
const report = {
  file: 'public/models/atelier/environment.glb',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length,
  meshes,
  verification:
    'Actual GLB parsed with the runtime loader: required variants, colours, finite geometry, grounded local bounds and per-mesh triangle budgets. Blender staging translations excluded. Visual review and runtime GPU checks are separate.',
};
writeFileSync(new URL('../../docs/models/atelier/environment-inspection.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`${meshes.length} verified environment meshes, ${bytes.length} bytes, sha256 ${report.sha256}`);
