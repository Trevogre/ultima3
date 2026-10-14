/**
 * tips.ts
 *
 * Pointers for a new player, this port's own: how the game works, without
 * the quest's answers (those are the journal's). Tips, in the Pause menu,
 * lists the topics; A opens one to its text, a page at a time.
 * Prices, places and numbers are as the shop, map and rules code has them.
 */

/** A topic: its heading, and its paragraphs. */
export interface Tip {
  topic: string;
  text: string[];
}

export const TIPS: Tip[] = [
  {
    topic: 'First steps',
    text: [
      "A new party starts next to Lord British's castle and the town of Britain.",
      'Go visit Lord British first!',
      'Walk into townsfolk to talk. Notes are saved to the Journal.',
    ],
  },
  {
    topic: 'Levels',
    text: [
      'Fights give experience. A level is earned every 100 XP.',
      'A character with an L or blue name can level up - go visit Lord British!',
      'Levels increase max hit points by 100.',
      'Abilities are raised at shrines, not by leveling.',
    ],
  },
  {
    topic: 'Food',
    text: [
      'The party eats as it travels. F: shows remaining food.',
      'Grocers sell food at a gold piece a ration.',
      'Out of food, the party starves!',
      'Gameplay -> Starving sets the starvation penalty.',
    ],
  },
  {
    topic: 'Healing',
    text: [
      'Members heal a little as the party travels.',
      'Healers cure poison, heal, raise the dead and restore ashes.',
      "There is a healer in Lord British's castle.",
      "With a member hurt, the command menu puts a caster's heal first.",
    ],
  },
  {
    topic: 'Casters',
    text: [
      "A wizard's mana grows back to its intelligence, a cleric's to its wisdom.",
      'Paladins, larks and the other mixed classes get half.',
      'The spell list greys a spell if the caster lacks sufficient mana.',
      'Mana grows back as the party travels.',
    ],
  },
  {
    topic: 'Chests',
    text: [
      'Defeated monsters leave treasure chests.',
      'About half are trapped with acid, poison, a bomb or gas!',
      'Safe chest, a cleric spell, opens one without springing a trap.',
    ],
  },
  {
    topic: 'Guilds',
    text: [
      'Guilds sell keys, torches, powders and gems. Keys open locked doors.',
      'Powders can pause time in a combat!',
      'Gems can show a map of the area you are in.',
      'Grey is about 60 steps south-west of the castle and has a guild.',
    ],
  },
  {
    topic: 'Dungeons',
    text: [
      'Dungeons are dark.',
      'A torch (Ignite) burns for 255 turns.',
      'The Light spell activates for 10 turns, Long light for 250.',
      'Klimb and Descend to activate ladders.',
    ],
  },
  {
    topic: 'Fights',
    text: [
      "A fight has no way out - you can't run away!",
      'Gameplay -> Timer sets how long a turn waits before automatically passing.',
      'Auto combat plays the fight for you.',
      'If the whole party falls, you can reload or go back to Lord British.',
    ],
  },
  {
    topic: 'Monsters',
    text: [
      'The spell Repel orcs also affects goblins and trolls.',
      'The spell Repel undead affects ghouls and zombies.',
      'Both Repel spells are free, but get one try a fight.',
      'Many monsters poison - stay near a healer until you can cure poison.',
    ],
  },
  {
    topic: 'Ships and horses',
    text: [
      'No one sells ships.',
      'Attack a pirate ship from the shore!',
      'Board the frigate they leave.',
      'Horse dealers sell a horse for each member, 200 gold a head.',
    ],
  },
  {
    topic: 'Stats',
    text: [
      "Strength, dexterity, intelligence and wisdom rise only at Ambrosia's shrines.",
      "Each stops at its race's limit.",
      'Gold paid past it is lost.',
    ],
  },
  {
    topic: 'Saving',
    text: [
      'The game saves itself at every town, castle and dungeon door.',
      'Quit and save saves on the surface.',
      'Export game on the title screen to keep a copy as a file.',
    ],
  },
];

/**
 * A topic's text as pages of at most `rows` lines of `width` characters: its paragraphs wrapped (`wrap`), a blank
 * line between them, and a paragraph that would not fit in the rest of a page starting the next (one longer than a
 * whole page is cut where each page ends).
 */
export function tipPages(tip: Tip, width: number, rows: number, wrap: (text: string, width: number, max: number) => string[]): string[][] {
  const pages: string[][] = [[]];
  let page = pages[0];
  for (const paragraph of tip.text) {
    const lines = wrap(paragraph, width, Infinity);
    if (page.length && page.length + 1 + lines.length > rows) pages.push((page = []));
    else if (page.length) page.push('');
    for (const line of lines) {
      if (page.length === rows) pages.push((page = []));
      page.push(line);
    }
  }
  return pages;
}

/** Said once, on a new game's first turn (Game.run), in the message area's sixteen columns. */
export const TIPS_NUDGE = 'New to Sosaria?\nSee Tips, in the\nPause menu.\n';
