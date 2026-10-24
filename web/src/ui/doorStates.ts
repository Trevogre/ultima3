import type { World } from '../game/world.ts';
import { Location } from '../game/party.ts';
import { MapValue } from '../game/tiles.ts';

export interface DoorState {
  x: number;
  y: number;
  open: boolean;
}
/** Unlocking replaces the tile with floor. Recover its identity from the pristine
 * map so presentation can retain an open leaf, including after loading a save.
 * Rendering still admits only visibility-filtered cells at these coordinates. */
export function mapDoors(world: World): DoorState[] {
  if (world.combat || world.party.location === Location.Dungeon) return [];
  const raw = world.resources.maps.get(world.current.id);
  if (!raw) return [];
  const doors: DoorState[] = [];
  const side = world.mapSize;
  for (let i = 0; i < side * side; i++) {
    if (raw[i + 1] !== MapValue.LetterI) continue;
    const x = i % side,
      y = Math.floor(i / side);
    const mon = world.monsters.at(x, y);
    const current = mon >= 0 ? world.monsters.tileUnder(mon) : world.current.tiles[i];
    doors.push({ x, y, open: current !== MapValue.LetterI });
  }
  return doors;
}
