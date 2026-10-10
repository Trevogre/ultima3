# Showcase saves

Saved games at some of Ultima III's sights, each with a party of the level,
gear, marks and gold a player would have there. They are for trying the game
out, taking screenshots and video, and testing.

**To play one:** download its `.json` file, then on the title screen choose
**Import game → From a file** and pick it, then **Journey onward**.
**Importing replaces the game in progress**, its party and roster with it:
export yours first (**Export game**) to come back to it. The settings are
the browser's own and do not change.

The game saves on the surface, so each stands at a sight's door - Enter
goes in - or aboard a ship.

| File | Where | The party |
|---|---|---|
| [01-new-game](01-new-game.json) | Beside Lord British's castle: a new game, as it starts (the rules are asked at Journey onward) | as the game starts |
| [02-lord-british](02-lord-british.json) | On Lord British's castle: Enter, and walk into the king for the level waiting | a level waiting, leather, 800 gold |
| [03-britain](03-britain.json) | On the town of Britain (LCB Towne): Enter, with gold for its shops | level 2, 2500 gold |
| [04-perinian-depths](04-perinian-depths.json) | At the door of the Perinian Depths, north of Britain, torches in the pack | level 3, chain and swords, 20 torches |
| [05-frigate](05-frigate.json) | Aboard a frigate just north of Lord British's castle | level 4, the Mark of Kings |
| [06-dawn](06-dawn.json) | On the town of Dawn, both moons new: Enter, and buy the best arms in Sosaria | level 6, 9000 gold |
| [07-whirlpool](07-whirlpool.json) | Aboard a frigate in the whirlpool's path: it takes the ship to Ambrosia in a few turns | level 8, +2 arms, 9000 gold and 10 keys for the shrines |
| [08-serpent](08-serpent.json) | Aboard a frigate below the great serpent: EVOCARE (Other or Yell) to cross | level 20, stats raised, exotics, every mark and card |
| [09-exodus](09-exodus.json) | On the castle of Exodus, past the serpent: Enter, for the end of the game | level 25, stats at their limits, exotics, every mark and card |

They are made by `npm run saves` in `web/`; the places and parties are in
`web/tools/saves/showcase.ts`.
