import type { World } from './world.ts';
import type { GameIO } from './io.ts';
import { namedNpc, npcId } from './npcCatalog.ts';
import { MapValue } from './tiles.ts';

export type VoiceGender = 'male' | 'female' | 'other';
export interface DialogueSpeaker {
  id: string;
  gender: VoiceGender;
}
export function npcSpeaker(world: World, mon: number): DialogueSpeaker {
  return {
    id: npcId(world.current.id, mon),
    gender:
      world.monsters.type(mon) === MapValue.LordBritish
        ? 'male'
        : (namedNpc(world.current.id, world.monsters.talkIndex(mon))?.gender ?? 'other'),
  };
}
export function sayMessage(world: World, io: GameIO, message: number, speaker: DialogueSpeaker): void {
  io.printMessage(message);
  io.speakLine?.(world.resources.strings.Messages[message - 1] ?? '', speaker);
}
/** Shop text is routed explicitly: menus, item lists, typed keys and journal updates stay silent. */
export function shopDialogue(world: World, io: GameIO, speaker: DialogueSpeaker): GameIO {
  const prose = new Set([...world.resources.strings.Pub, ...world.resources.strings.Radrion]);
  return new Proxy(io, {
    get(target, key) {
      if (key === 'speakLine') return (text: string) => target.speakLine?.(text, speaker);
      if (key === 'printMessage')
        return (n: number) => {
          target.printMessage(n);
          if (n >= 185 && n <= 234 && n !== 197 && (n < 225 || n > 227))
            target.speakLine?.(world.resources.strings.Messages[n - 1] ?? '', speaker);
        };
      if (key === 'print')
        return (text: string) => {
          target.print(text);
          if (prose.has(text)) target.speakLine?.(text, speaker);
        };
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function' ? (value.bind(target) as unknown) : value;
    },
  });
}
