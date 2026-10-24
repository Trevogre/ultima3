import { describe, expect, it } from 'vitest';
import { mapDoors } from '../src/ui/doorStates.ts';
import { newWorld, FakeIO } from './helpers.ts';
import { unlockToward } from '../src/game/interact.ts';
import { MapId } from '../src/data/resources.ts';
import { MapValue } from '../src/game/tiles.ts';
import { Location } from '../src/game/party.ts';
describe('persistent visible door identity', () => {
  it('recognises unlocked leaves from the original map after their tile becomes floor', async () => {
    const world = newWorld();
    world.enterMap(MapId.LordBritishCastle);
    world.party.location = Location.Town;
    world.monsters.bytes.fill(0);
    const door = mapDoors(world)[0];
    expect(door).toBeDefined();
    expect(door.open).toBe(false);
    world.x = door.x - 1;
    world.y = door.y;
    world.party.keys = 1;
    world.putXYVal(MapValue.Floor, world.x, world.y);
    await unlockToward(world, new FakeIO(world.resources), 1, 0);
    expect(world.getXYVal(door.x, door.y)).toBe(MapValue.Floor);
    expect(mapDoors(world).find((d) => d.x === door.x && d.y === door.y)?.open).toBe(true);
    world.enterMap(MapId.LordBritishCastle);
    expect(mapDoors(world).find((d) => d.x === door.x && d.y === door.y)?.open).toBe(false);
  });
});
