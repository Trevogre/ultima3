import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resourcesFromBundle, type Bundle } from '../../src/data/resources.ts';
import { buildNpcCatalog, textHash } from '../../src/game/npcCatalog.ts';
import { spokenText } from '../../src/ui/dialogueSpeech.ts';
const root = new URL('../../', import.meta.url);
const resources = resourcesFromBundle(JSON.parse(readFileSync(new URL('public/data/resources.json', root), 'utf8')) as Bundle);
const addon = buildNpcCatalog(resources);
writeFileSync(new URL('public/data/npc-addon.json', root), JSON.stringify(addon, null, 2) + '\n');
const jobs = addon.npcs.flatMap((npc) =>
  npc.dialogue
    .filter((line) => !line.template)
    .map((line) => ({
      npcId: npc.id,
      npcName: npc.name,
      lineId: line.id,
      text: spokenText(line.text),
      textHash: textHash(spokenText(line.text)),
      voice: npc.voice,
      gender: npc.gender,
      output: `audio/npcs/${npc.id.replaceAll(':', '-')}/${line.id.replace(':', '-')}.wav`,
      status: 'not-generated',
    })),
);
mkdirSync(new URL('docs/npc-audio/', root), { recursive: true });
writeFileSync(
  new URL('docs/npc-audio/sample-jobs.json', root),
  JSON.stringify(
    {
      version: 1,
      provider: null,
      note: 'Preparation only. No voices generated. Templates require runtime values; do not synthesize placeholder tokens.',
      jobs,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `${addon.npcs.length} unique placements; ${jobs.length} static speech jobs. Catalog: ${fileURLToPath(new URL('public/data/npc-addon.json', root))}`,
);
