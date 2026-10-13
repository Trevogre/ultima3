/**
 * cards.ts
 *
 * The cards a list shows over the party panel while one of its items is highlighted (this port's, after the Ultima V
 * port's readyCard.ts and shopCard.ts), in place of a line under the menu: a weapon or armour weighed for one member
 * against what they have readied or wear, in the shops' Buy lists and in Ready and Wear. A number that changes is
 * green where it is better for them and red where it is worse; what their class cannot use says so, in red. A
 * spell's card is spells.ts's. The Screen draws them (screen.ts showCard).
 */

import type { World } from './world.ts';
import type { PlayerRecord } from './player.ts';
import { CARD_WIDTH, type Card, type CardTone } from './io.ts';

/** The weapons that shoot: sling, bow, +2 bow, +4 bow (combat.ts). */
export const SHOOTS = [3, 5, 9, 13];

/** In 100, how often a foe's blow lands on a member wearing armour `armour` (combat.ts: a roll of 0 to armour + 16 under 8). */
export function hitChance(armour: number): number {
  return Math.round(800 / (armour + 17));
}

/** A card's line with `label` at its left and `value` at its right. */
export function cardRow(label: string, value: string): string {
  return label + value.padStart(CARD_WIDTH - label.length);
}

/** Words wrapped to a card's width. */
export function cardWrap(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= CARD_WIDTH) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** A weapon's or armour's name as a card says it: hands and skin are what nothing is. */
export function gearName(world: World, isWeapon: boolean, index: number): string {
  if (index === 0) return isWeapon ? 'Hands' : 'Skin';
  return world.resources.strings.WeaponsArmour[(isWeapon ? 0 : 16) + index];
}

/** "A Wizard cannot ready it", over the lines it takes. */
function cannotUse(world: World, p: PlayerRecord, isWeapon: boolean): string[] {
  const careers = String.fromCharCode(...world.resources.misc.careerTable);
  const career = world.resources.strings.Classes[careers.indexOf(p.classLetter)] ?? 'member';
  return cardWrap(`${/^[AEIOU]/.test(career) ? 'An' : 'A'} ${career} cannot ${isWeapon ? 'ready' : 'wear'} it`);
}

/** What else the card says below the comparison: a shop's price (red where the party is short of it), or the pack's count. */
export type CardFoot = { price: number } | { held: number };

/**
 * A weapon or armour weighed for member `p` against what they have readied or wear: whose card it is, what it is
 * weighed against, then a weapon's damage a hit (each step up the list is 3 more, combat.ts) and its reach, or how
 * often foes would hit them in the armour against now; then the price or the pack's count.
 */
export function gearCard(world: World, p: PlayerRecord, isWeapon: boolean, index: number, foot: CardFoot): Card {
  const inUse = p.bytes[isWeapon ? 48 : 40];
  const lines: Card['lines'] = [{ text: p.name, tone: 'dim' }];
  const tone = (better: boolean, worse: boolean): CardTone | undefined => (better ? 'better' : worse ? 'worse' : undefined);
  if (index === inUse) lines.push({ text: isWeapon ? 'In hand now' : 'Worn now', tone: 'dim' });
  else lines.push({ text: `vs ${gearName(world, isWeapon, inUse)}`, tone: 'dim' });
  lines.push({ text: '' });
  if (!world.canUse(p, isWeapon, index)) {
    for (const text of cannotUse(world, p, isWeapon)) lines.push({ text, tone: 'worse' });
  } else if (isWeapon) {
    const more = (index - inUse) * 3;
    lines.push({ text: cardRow('Damage', more === 0 ? 'same' : `${more > 0 ? '+' : ''}${more}`), tone: tone(more > 0, more < 0) });
    const [shoots, shot] = [SHOOTS.includes(index), SHOOTS.includes(inUse)];
    lines.push({ text: cardRow('Reach', shoots ? 'afar' : 'close'), tone: tone(shoots && !shot, shot && !shoots) });
  } else {
    lines.push({ text: cardRow('Foes hit', `${hitChance(index)}%`), tone: tone(index > inUse, index < inUse) });
    if (index !== inUse) lines.push({ text: cardRow('Now', `${hitChance(inUse)}%`), tone: 'dim' });
  }
  lines.push({ text: '' });
  if ('price' in foot) {
    lines.push({ text: cardRow('Price', `${foot.price}gp`), tone: world.party.gold < foot.price ? 'worse' : undefined });
  } else if (index > 0) {
    lines.push({ text: cardRow('In pack', `${foot.held}`), tone: 'dim' });
  }
  return { title: gearName(world, isWeapon, index), lines };
}
