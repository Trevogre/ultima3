import { InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import { terrainElevation } from './terrainDepth.ts';

/** Left, right, bottom, top unknown neighbours; only already-known tiles fade. */
export function fogEdges(shapes: ArrayLike<number>, side: number, index: number, wraps: boolean): number[] {
  if (shapes[index] === Shape.Void) return [0, 0, 0, 0];
  const x = index % side,
    y = Math.floor(index / side);
  return [
    [-1, 0],
    [1, 0],
    [0, 1],
    [0, -1],
  ].map(([dx, dy]) => {
    const nx = x + dx,
      ny = y + dy;
    if (!wraps && (nx < 0 || ny < 0 || nx >= side || ny >= side)) return 1;
    return shapes[((ny + side) % side) * side + ((nx + side) % side)] === Shape.Void ? 1 : 0;
  });
}

export class FogEdges {
  readonly geometry = new PlaneGeometry(1, 1);
  readonly edges = new InstancedBufferAttribute(new Float32Array(4096 * 4), 4);
  readonly material = new ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    vertexShader: `attribute vec4 fogEdges; varying vec4 edges; varying vec2 tileUV;
      void main(){ edges=fogEdges; tileUV=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec4 edges; varying vec2 tileUV;
      void main(){ vec4 fade=1.0-smoothstep(vec4(0.0),vec4(0.22),vec4(tileUV.x,1.0-tileUV.x,tileUV.y,1.0-tileUV.y));
      float a=max(max(fade.x*edges.x,fade.y*edges.y),max(fade.z*edges.z,fade.w*edges.w)); gl_FragColor=vec4(0.0,0.0,0.0,a); }`,
  });
  readonly mesh = new InstancedMesh(this.geometry, this.material, 4096);
  private matrix = new Matrix4();
  constructor() {
    this.geometry.setAttribute('fogEdges', this.edges);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.6;
  }
  set(landscape: Landscape | null, cells: ViewCell[], enabled: boolean, recessed: boolean) {
    this.mesh.count = 0;
    if (!enabled) return;
    const shapes = landscape?.shapes ?? cells.map((c) => c.base);
    const side = landscape?.side ?? Math.sqrt(cells.length);
    shapes.forEach((shape, i) => {
      const edges = fogEdges(shapes, side, i, landscape?.wraps ?? false);
      if (!edges.some(Boolean)) return;
      const x = landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2;
      const y = landscape
        ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
        : (side - 1) / 2 - Math.floor(i / side);
      this.mesh.setMatrixAt(this.mesh.count, this.matrix.makeTranslation(x, y, terrainElevation(shape, recessed) + 0.006));
      this.edges.setXYZW(this.mesh.count++, edges[0], edges[1], edges[2], edges[3]);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.edges.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
