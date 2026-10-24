NPC identity and voice addon

Open Settings / Pause > Audio > NPC voices & catalog (or /npcs.html).
The editor can search all placed characters, filter maps, edit display names,
review gender/pronouns, select a browser voice, audition pitch/rate, and export or
import a version-1 addon. Assignments persist locally, separately from saved games.
The same-origin overlay keeps the game paused; edits are resolved at each new
spoken line. Master mute is respected. Browser speech remains Off by default.

public/data/npc-addon.json is the distributable addon. Rebuild from the pristine
MONS/TLKS/MAPS resources with `npm run npc-catalog` in web/. Each npc:<map>:<slot>
identifies an original placement, never a current position or shared sprite.
The original placement coordinates, map value and table slot are retained for
review. Time Lord IDs include dungeon, level and cell. Merchant speech is bound
to the actual merchant across the counter; approaching from another square must
not produce a new speaker. Spawned wandering monsters are outside this catalog.

Known named gender hints come from the existing reviewed hints. Generic sprites
leave gender unknown/other and pronouns blank. Pitch and rate defaults are small,
deterministic variations, not recordings or claims of unique synthesized actors.
Names/gender/voice fields can be authored in the addon or editor. Imports validate
IDs and clamp voice parameters. Original dialogue, identity/origin and game facts
are rebuilt from resources and cannot be overridden through voice import.

The catalog contains original town lines, conditional Lord British responses,
generic greetings, shop prose pools and the Time Lord clue. Shop behavior varies
with approach Y and transaction state, so merchant entries explicitly contain a
shared conditional prose pool, not a claim that every line plays in every shop.
Menus and stock lists are not speech. Horse-price templates retain placeholders
and are excluded from recording jobs until runtime values are known.

sample-jobs.json is preparation only: no provider is configured and no audio has
been generated. Every static job carries a speaker ID, source line ID, normalized
text/hash, voice parameters and a deterministic output path. The editor exports
an equivalent queue incorporating your current assignments. No automatic network
requests to a voice provider are made. Recorded playback and provider-specific
submission are future integration work; browser speech is the implemented engine.

Additional dialogue/AI profile fields are present but disabled and not executed.
Original clues, quests, inventory and rules remain authoritative. Creating a voice
identity does not authorize invented gameplay or submitting data to a provider.
