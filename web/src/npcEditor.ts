import { loadResources } from './data/resources.ts';
import { editedNpc, textHash, type NpcRecord, type NpcAddon } from './game/npcCatalog.ts';
import { addonEdits, loadNpcAddon, loadNpcEdits, saveNpcEdits } from './ui/npcVoices.ts';
import { DialogueSpeech, readSpeechPreferences, spokenText } from './ui/dialogueSpeech.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const select = (id: string) => element<HTMLSelectElement>(id);
const status = (text: string) => {
  element('status').textContent = text;
};
const resources = await loadResources(),
  addon = await loadNpcAddon(resources);
const edits = loadNpcEdits();
let current = addon.npcs[0];
const player = new DialogueSpeech();
try {
  const settings = JSON.parse(localStorage.getItem('ultima3.settings') ?? '{}') as Record<string, unknown>;
  player.settings = readSpeechPreferences(settings.npcSpeech);
  player.muted = settings.audioMuted === true;
} catch {
  /* defaults */
}
player.setCatalog(addon);
const effective = () => editedNpc(current, edits);
for (const [id, name] of new Map(addon.npcs.map((n) => [n.mapId, n.mapName]))) select('location').add(new Option(name, String(id)));
function voices() {
  const voice = effective().voice.voiceURI,
    dropdown = select('voice');
  dropdown.replaceChildren(new Option('Automatic / gender default', ''));
  const available = player.voices().sort((a, b) => a.name.localeCompare(b.name));
  for (const v of available) dropdown.add(new Option(`${v.name} (${v.lang})${v.localService ? ' · local' : ''}`, v.voiceURI));
  if (voice && !available.some((v) => v.voiceURI === voice)) dropdown.add(new Option(`Unavailable here: ${voice}`, voice));
  dropdown.value = voice;
}
function detail(npc: NpcRecord) {
  current = npc;
  const n = effective();
  element('detail').hidden = false;
  element('heading').textContent = n.name;
  element('identity').textContent = n.id;
  element('origin').textContent =
    `${n.mapName} · ${n.role} · original placement (${n.origin.x}, ${n.origin.y})${n.origin.slot === null ? ` · level ${(n.origin.level ?? 0) + 1}` : ` · slot ${n.origin.slot}`} · gender ${n.genderSource}`;
  input('name').value = n.name;
  select('gender').value = n.gender;
  input('pronouns').value = n.pronouns;
  for (const key of ['pitch', 'rate'] as const) {
    input(key).value = String(n.voice[key]);
    element(`${key}-value`).textContent = n.voice[key].toFixed(2);
  }
  element<HTMLTextAreaElement>('direction').value = n.voice.direction;
  voices();
  element('lines').replaceChildren(
    ...n.dialogue.map((line) => {
      const box = document.createElement('section'),
        source = document.createElement('small'),
        text = document.createElement('pre');
      source.textContent = `${line.source} · ${line.id}${line.template ? ' · dynamic template' : ''}`;
      text.textContent = line.text;
      box.append(source, text);
      return box;
    }),
  );
}
function list() {
  const q = input('search').value.trim().toLowerCase(),
    map = select('location').value;
  const filtered = addon.npcs.filter(
    (n) => (!map || String(n.mapId) === map) && `${editedNpc(n, edits).name} ${n.role} ${n.id}`.toLowerCase().includes(q),
  );
  element('count').textContent = `${filtered.length} of ${addon.npcs.length} unique placements`;
  element('people').replaceChildren(
    ...filtered.map((n) => {
      const button = document.createElement('button');
      button.textContent = editedNpc(n, edits).name;
      button.setAttribute('aria-pressed', String(n.id === current?.id));
      button.title = `${n.id} · ${n.mapName} · (${n.origin.x},${n.origin.y})`;
      button.onclick = () => {
        player.stop();
        detail(n);
        list();
      };
      return button;
    }),
  );
}
function save() {
  edits[current.id] = {
    name: input('name').value,
    gender: select('gender').value as NpcRecord['gender'],
    pronouns: input('pronouns').value,
    voice: {
      voiceURI: select('voice').value,
      pitch: Number(input('pitch').value),
      rate: Number(input('rate').value),
      direction: element<HTMLTextAreaElement>('direction').value,
    },
  };
  status(
    saveNpcEdits(edits)
      ? 'Saved on this device. Export the addon to keep or share these assignments.'
      : 'Storage unavailable. Export your addon to keep these assignments.',
  );
  element('heading').textContent = effective().name;
  list();
  for (const key of ['pitch', 'rate']) element(`${key}-value`).textContent = Number(input(key).value).toFixed(2);
}
for (const id of ['name', 'gender', 'pronouns', 'voice', 'pitch', 'rate', 'direction']) element(id).addEventListener('input', save);
input('search').oninput = list;
select('location').onchange = list;
if (typeof speechSynthesis !== 'undefined')
  speechSynthesis.addEventListener('voiceschanged', () => {
    if (current) voices();
  });
element('preview').onclick = () => {
  if (player.muted) {
    status('Game audio is muted. Unmute with the game’s master audio button to hear previews.');
    return;
  }
  if (!player.supported) {
    status('Browser speech is unavailable here. Assignments can still be edited and exported.');
    return;
  }
  const n = effective(),
    speaker = { id: n.id, gender: n.gender };
  player.begin(speaker);
  player.speak(n.dialogue.find((l) => !l.template)?.text ?? 'Welcome, traveler.', speaker, true);
  status('Previewing this character’s voice.');
};
element('stop').onclick = () => player.stop();
element('reset').onclick = () => {
  delete edits[current.id];
  saveNpcEdits(edits);
  detail(current);
  list();
  status('Restored this character’s addon defaults.');
};
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
element('export').onclick = () =>
  download('npc-addon.json', { version: 1, npcs: addon.npcs.map((n) => editedNpc(n, edits)) } satisfies NpcAddon);
element('jobs').onclick = () =>
  download('npc-audio-jobs.json', {
    version: 1,
    provider: null,
    jobs: addon.npcs.flatMap((n) => {
      const npc = editedNpc(n, edits);
      return npc.dialogue
        .filter((l) => !l.template)
        .map((l) => ({
          npcId: npc.id,
          lineId: l.id,
          text: spokenText(l.text),
          textHash: textHash(spokenText(l.text)),
          gender: npc.gender,
          voice: npc.voice,
          output: `audio/npcs/${npc.id.replaceAll(':', '-')}/${l.id.replace(':', '-')}.wav`,
          status: 'not-generated',
        }));
    }),
  });
element('import-button').onclick = () => input('import').click();
input('import').onchange = async () => {
  const file = input('import').files?.[0];
  if (!file) return;
  try {
    const imported = addonEdits(JSON.parse(await file.text()));
    const known = new Set(addon.npcs.map((n) => n.id));
    let count = 0;
    for (const [id, edit] of Object.entries(imported))
      if (known.has(id)) {
        edits[id] = edit;
        count++;
      }
    saveNpcEdits(edits);
    detail(current);
    list();
    status(`Imported ${count} known character assignments.`);
  } catch {
    status('Could not import: expected a version 1 NPC addon JSON file.');
  }
  input('import').value = '';
};
window.addEventListener('pagehide', () => player.stop());
if (current) detail(current);
list();
