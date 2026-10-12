/**
 * tips.ts
 *
 * Pointers for a new player, this port's own: how the game works, without
 * the quest's answers (those are the journal's). The Tips page in the Pause
 * menu lists the topics, the one under the cursor opened to its text.
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
      "A new party starts a few steps west of Lord British's castle, by the town of Britain. Walk into the king.",
      'Walk into townsfolk to talk. What they tell of the quest goes in the Journal.',
      'Help, in this menu, lists the keys and buttons.',
    ],
  },
  {
    topic: 'Levels',
    text: [
      'Fights give experience: a level for every 100 points.',
      'Only Lord British grants a level, and 100 hit points with it. An L by a name (blue with the Standard tiles) says one is waiting.',
      'After a few he asks for the Mark of Kings. The most is 25.',
    ],
  },
  {
    topic: 'Food',
    text: [
      'The party eats as it travels; F, on the top border, is what is left.',
      'Grocers sell food at a gold piece a ration. Out of food, members go hungry: Starving, in this menu, says how hard that is.',
    ],
  },
  {
    topic: 'Healing',
    text: [
      'Members heal a little as the party travels.',
      'Healers cure poison for 100 gold, heal for 200, raise the dead for 500 and restore ashes for 900.',
      "With a member hurt, the command menu puts a caster's heal first.",
    ],
  },
  {
    topic: 'Casters',
    text: [
      "A wizard's mana grows back to its intelligence, a cleric's to its wisdom. Paladins, larks and the other mixed classes get half.",
      'The spell list greys a spell its caster cannot pay for.',
    ],
  },
  {
    topic: 'Chests',
    text: [
      'Beaten monsters leave chests: gold, and now and then arms. About half are trapped, with acid, poison, a bomb or gas.',
      'Safe chest, a cleric spell, opens one without its trap. On a chest, the menu offers it.',
    ],
  },
  {
    topic: 'Guilds',
    text: [
      'Guilds sell keys (50 gold), five torches (30), powders (90) and gems (75).',
      'A key opens a locked door: walk into it. A powder stops the foes in a fight for ten rounds (Negate time). A gem shows the whole map of where you stand, and fills it in on View map (Peer at gem).',
    ],
  },
  {
    topic: 'Dungeons',
    text: [
      'Dungeons are dark. A torch (Ignite) burns for 255 turns, the Light spell for 10, Long light for 250.',
      'Klimb and Descend take the ladders.',
    ],
  },
  {
    topic: 'Fights',
    text: [
      'Walk into a monster to fight it. A fight has no way out: pick them with care.',
      'Timer, in this menu, sets how long a turn waits. Auto combat plays the fight for you.',
      'If the whole party falls, the game offers the last save again.',
    ],
  },
  {
    topic: 'Ships and horses',
    text: [
      'No one sells ships. Attack a pirate ship from the shore: with its crew beaten, Board the frigate they leave.',
      'Horse dealers sell a horse for each member, 200 gold a head.',
    ],
  },
  {
    topic: 'Stats',
    text: [
      "Strength, dexterity, intelligence and wisdom rise only at Ambrosia's shrines, for gold.",
      "Each stops at its race's limit. Gold paid past it is lost.",
    ],
  },
  {
    topic: 'Saving',
    text: [
      'The game saves itself at every town, castle and dungeon door. Quit and save, in this menu, saves on the surface.',
      'Export game, on the title screen, keeps a copy as a file.',
    ],
  },
];

/** The Tips page: every topic's heading, the selected one opened to its text. */
export interface TipsPage {
  lines: string[];
  /** The line of the selected topic's heading. */
  cursorLine: number;
  /** The line after the selected topic's text. */
  openEnd: number;
}

/**
 * Lay out the Tips page, the topic at `selected` (clamped to the list)
 * opened to its paragraphs. `width` is the page's width in characters;
 * `wrap` wraps a paragraph to it.
 */
export function tipsPage(
  tips: Tip[],
  selected: number,
  width: number,
  wrap: (text: string, width: number, max: number) => string[],
): TipsPage {
  const lines: string[] = [];
  let cursorLine = 0;
  let openEnd = 0;
  const pick = Math.max(0, Math.min(tips.length - 1, selected));
  tips.forEach((tip, i) => {
    if (i === pick) cursorLine = lines.length;
    lines.push(`- ${tip.topic}`);
    if (i !== pick) return;
    for (const paragraph of tip.text) lines.push(...wrap(paragraph, width, Infinity), '');
    openEnd = lines.length;
  });
  return { lines, cursorLine, openEnd };
}

/** Said once, on a new game's first turn (Game.run), in the message area's sixteen columns. */
export const TIPS_NUDGE = 'New to Sosaria?\nSee Tips, in the\nPause menu.\n';
