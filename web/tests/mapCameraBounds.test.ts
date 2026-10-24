import { describe, expect, it } from 'vitest';
import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { battlefieldZoom, mapCameraTarget, minimumMapZoom } from '../src/ui/mapCameraBounds.ts';

describe('gameplay camera coverage', () => {
  it('fits the entire battlefield and raised sprites at every supported camera angle', () => {
    for (const yaw of [0, Math.PI / 36, Math.PI / 4, Math.PI / 2, -Math.PI / 3]) {
      for (const tilt of [0, Math.PI / 4, (70 * Math.PI) / 180]) {
        const camera = new OrthographicCamera(-5.5, 5.5, 5.5, -5.5, 0.1, 500);
        camera.position.set(150 * Math.sin(yaw) * Math.sin(tilt), -150 * Math.cos(yaw) * Math.sin(tilt), 150 * Math.cos(tilt));
        camera.up.set(-Math.sin(yaw) * Math.cos(tilt), Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt));
        camera.lookAt(0, 0, 0);
        camera.zoom = battlefieldZoom(11, yaw, tilt);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        for (const x of [-5.5, 5.5])
          for (const y of [-5.5, 5.5])
            for (const z of [-0.2, 0, 1.2]) {
              const projected = new Vector3(x, y, z).project(camera);
              expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.91);
              expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.91);
            }
      }
    }
  });
  it('keeps the original top-down camera scale available', () => {
    expect(minimumMapZoom(11, 64, 0, 0)).toBe(11 / 64);
    expect(minimumMapZoom(11, 11, 0, 0)).toBe(1);
    expect(mapCameraTarget(11, 64, 0, 0, 1, -0.5, 0.5)).toEqual({ x: 0, y: 0 });
  });

  it('zooms closer as tilt or diagonal rotation exposes more ground', () => {
    const top = minimumMapZoom(11, 64, 0, 0);
    expect(minimumMapZoom(11, 64, Math.PI / 4, 0)).toBeGreaterThan(top);
    expect(minimumMapZoom(11, 64, 0, Math.PI / 3)).toBeGreaterThan(top);
  });

  it('keeps actual camera rays inside map edges at all allowed angles and near bounded corners', () => {
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const ray = new Raycaster();
    const hit = new Vector3();
    for (const side of [11, 64]) {
      for (const yaw of [0, Math.PI / 8, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 3]) {
        for (const tilt of [0, Math.PI / 6, Math.PI / 3, (70 * Math.PI) / 180]) {
          for (const [cx, cy] of [
            [0, 0],
            [-0.5, 0.5],
            [side / 2 - 0.5, -side / 2 + 0.5],
          ]) {
            for (const requested of [0.01, 1, 2.5]) {
              const zoom = Math.max(requested, minimumMapZoom(11, side, yaw, tilt));
              const target = mapCameraTarget(11, side, yaw, tilt, zoom, cx, cy);
              const s = Math.sin(yaw),
                c = Math.cos(yaw),
                st = Math.sin(tilt),
                ct = Math.cos(tilt);
              const camera = new OrthographicCamera(-5.5, 5.5, 5.5, -5.5, 0.1, 500);
              camera.position.set(target.x + 150 * s * st, target.y - 150 * c * st, 150 * ct);
              camera.up.set(-s * ct, c * ct, st);
              camera.lookAt(target.x, target.y, 0);
              camera.zoom = zoom;
              camera.updateProjectionMatrix();
              camera.updateMatrixWorld();
              for (const x of [-1, 1])
                for (const y of [-1, 1]) {
                  ray.setFromCamera(new Vector2(x, y), camera);
                  expect(ray.ray.intersectPlane(plane, hit)).not.toBeNull();
                  expect(Math.abs(hit.x - cx)).toBeLessThanOrEqual(side / 2 + 1e-8);
                  expect(Math.abs(hit.y - cy)).toBeLessThanOrEqual(side / 2 + 1e-8);
                }
            }
          }
        }
      }
    }
  });
});
