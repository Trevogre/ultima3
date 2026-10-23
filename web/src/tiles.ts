/** Sprite sheet comparison: the same named sprite across the game’s tile sets. */

import { EXODUS_INDEX, GraphicsSet } from './ui/graphics.ts';
import { TILE_SETS } from './ui/help.ts';
import { Shape } from './game/tiles.ts';

/** Tiles in a sheet: 6 column pairs of 16. */
const TILE_COUNT = 96;
/** An extra cell after the tiles for the door, the letter I's second frame drawn over the ground. */
const DOOR = TILE_COUNT;
/** Sets whose I has no door of its own (its two frames alike): the original machines drew a door as the letter. */
const doorIsLetter = new WeakMap<GraphicsSet, boolean>();
/** The door is the alternate frame of this tile, the letter I. */
const LETTER_I = Shape.Door >> 1;
/** The monsters with variants (Thief to Balron, 23-30), whose two variants sit in pairs at 80-95. */
const FIRST_VARIED = 23;
const LAST_VARIED = 30;
const FIRST_VARIANT = 80;

/**
 * The order the tiles are laid out in: the sheet's, or with each monster's two variants straight after it (the Dragon's
 * Griffon and Wyvern beside the Dragon rather than sixty tiles on). The door comes last either way.
 */
function tileOrder(grouped: boolean): number[] {
  const order: number[] = [];
  for (let index = 0; index < TILE_COUNT; index++) {
    if (grouped && index >= FIRST_VARIANT) continue;
    order.push(index);
    if (grouped && index >= FIRST_VARIED && index <= LAST_VARIED) {
      const first = FIRST_VARIANT + (index - FIRST_VARIED) * 2;
      order.push(first, first + 1);
    }
  }
  order.push(DOOR);
  return order;
}

/** The tiles whose second cells hold Exodus' light panels, 0 to 3 down the column, not frames of their own. */
const PANEL_TILES = [32, 33, 34, 35];
/** The game's animation rate (screen.ts). */
const ANIMATION_INTERVAL_MS = 1000 / 12;

/** Tiles the map draws opaque as a square's terrain; the rest are drawn masked over it. */
const TERRAIN = new Set([...range(0, 8), ...range(31, 57)]);

/** The grounds a tile can be shown on: the terrain a creature or object stands on, or a plain check or black. */
const GROUNDS: { id: string; label: string; shape?: number }[] = [
  { id: 'grass', label: 'Grass', shape: Shape.Grass },
  { id: 'water', label: 'Water', shape: Shape.Water },
  { id: 'brush', label: 'Brush', shape: Shape.Brush },
  { id: 'forest', label: 'Forest', shape: Shape.Forest },
  { id: 'mountains', label: 'Mountains', shape: Shape.Mountains },
  { id: 'floor', label: 'Floor', shape: Shape.Floor },
  { id: 'lava', label: 'Lava', shape: Shape.Lava },
  { id: 'forcefield', label: 'Force field', shape: Shape.ForceField },
  { id: 'moongate', label: 'Moongate', shape: Shape.MoonGate },
  { id: 'wall', label: 'Wall', shape: Shape.Wall },
  { id: 'wall2', label: 'Wall 2', shape: 0x4a },
  { id: 'void', label: 'Void', shape: Shape.Void },
  { id: 'check', label: 'Checkerboard' },
  { id: 'black', label: 'Black' },
];

const SIZES = [32, 48, 64, 96];

/** The shared figures (64-67), shown for several classes by sets without class figures, and the class figures (68-78). */
const PARTY = ['Fighter', 'Cleric', 'Wizard', 'Thief'];
const CLASSES = ['Fighter', 'Cleric', 'Wizard', 'Thief', 'Paladin', 'Barbarian', 'Lark', 'Illusionist', 'Druid', 'Alchemist', 'Ranger'];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** A tile's name: the game's tile strings for 0-63 and the variants (80-95), the party and class figures between. */
function tileName(index: number, names: string[]): string {
  if (index === DOOR) return 'Door';
  if (index < 64) return names[index] ?? '';
  if (index < 68) return `${PARTY[index - 64]} (shared)`; // what a set without class figures shows for several classes
  if (index < 79) return CLASSES[index - 68];
  if (index === 79) return '(empty)';
  return names[index - 16] ?? '';
}

async function loadNames(): Promise<string[]> {
  try {
    const bundle = (await (await fetch('data/resources.json')).json()) as { strings?: { Tiles?: string[] } };
    return bundle.strings?.Tiles ?? [];
  } catch {
    return [];
  }
}

// --- the choices, from and to the URL --------------------------------------

const params = new URLSearchParams(location.search);
const state = {
  set: TILE_SETS.includes(params.get('set') ?? '') || params.get('set') === 'All' ? params.get('set')! : 'All',
  ground: GROUNDS.some((g) => g.id === params.get('ground')) ? params.get('ground')! : 'grass',
  size: SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : 64,
  frames: params.get('frames') !== '0',
  animate: params.get('animate') !== '0',
  grouped: params.get('grouped') !== '0',
};

function saveState(): void {
  const q = new URLSearchParams({ set: state.set, ground: state.ground, size: String(state.size) });
  if (!state.frames) q.set('frames', '0');
  if (!state.animate) q.set('animate', '0');
  if (!state.grouped) q.set('grouped', '0');
  history.replaceState(null, '', `?${q}`);
}

// --- drawing -----------------------------------------------------------------

interface Panel {
  name: string;
  gfx: GraphicsSet;
  canvas: HTMLCanvasElement;
  index: number;
}

let panels: Panel[] = [];
let names: string[] = [];
const loaded = new Map<string, Promise<GraphicsSet>>();

function load(name: string): Promise<GraphicsSet> {
  let set = loaded.get(name);
  if (!set) loaded.set(name, (set = GraphicsSet.load(name)));
  return set;
}

/** Each table cell shows the live sprite, with its sheet frames beneath. */
function layout() {
  const s = state.size;
  const frame = state.frames ? s / 2 : 0;
  return { s, frame, width: s, height: s + (frame ? frame + 4 : 0) };
}

function sizeCanvas(canvas: HTMLCanvasElement): void {
  const { width, height } = layout();
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}

/** The chosen ground under a cell: the set's own terrain tile (scrolling as the game scrolls it), a check, or black. */
function drawGround(ctx: CanvasRenderingContext2D, gfx: GraphicsSet, x: number, y: number, size: number): void {
  const ground = GROUNDS.find((g) => g.id === state.ground)!;
  if (ground.shape !== undefined) {
    gfx.drawShape(ctx, ground.shape, x, y, size);
    return;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, size, size);
  if (ground.id !== 'check') return;
  const n = 8;
  const step = size / n;
  ctx.fillStyle = '#555';
  for (let j = 0; j < n; j++) for (let i = (j & 1) === 0 ? 0 : 1; i < n; i += 2) ctx.fillRect(x + i * step, y + j * step, step, step);
}

/** One sheet frame, still: terrain over black as the game draws it, anything else over the ground. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  gfx: GraphicsSet,
  index: number,
  second: boolean,
  x: number,
  y: number,
  size: number,
): void {
  const tile = index === DOOR ? LETTER_I : index;
  if (TERRAIN.has(tile) && index !== DOOR) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, size, size);
  } else {
    drawGround(ctx, gfx, x, y, size);
  }
  const r = gfx.tileRect(tile, second);
  ctx.drawImage(gfx.maskedTiles, r.x, r.y, r.w, r.h, x, y, size, size);
}

function draw(panel: Panel): void {
  const { canvas, gfx, index } = panel;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > innerHeight || bounds.right < 0 || bounds.left > innerWidth) return;
  const ctx = canvas.getContext('2d')!;
  const dpr = canvas.width / parseFloat(canvas.style.width);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const { s, frame } = layout();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const x = 0;
  const y = 0;
  // The tile as the map draws it: terrain opaque, the rest over the ground.
  const terrain = index !== DOOR && TERRAIN.has(index);
  if (!terrain) drawGround(ctx, gfx, x, y, s);
  gfx.drawShape(ctx, index === DOOR ? Shape.Door : index * 2, x, y, s, { masked: !terrain });
  if (frame && index === EXODUS_INDEX) {
    // Exodus' own cells are blank: its four light panels, in the second cells of 32-35, in sheet order.
    for (let n = 0; n < PANEL_TILES.length; n++) drawFrame(ctx, gfx, PANEL_TILES[n], true, x + (n * frame) / 2, y + s + 4, frame / 2);
  } else if (frame) {
    // The I's second frame is the door, and 32-35's are Exodus' panels: each is shown with the tile that uses it.
    if (index !== DOOR) drawFrame(ctx, gfx, index, false, x, y + s + 4, frame);
    const ownSecond = index !== LETTER_I && !PANEL_TILES.includes(index);
    if (ownSecond) drawFrame(ctx, gfx, index, true, index === DOOR ? x : x + frame, y + s + 4, frame);
  }
}

/** Whether the set draws a door as the letter I: the I's two sheet frames are the same picture. */
function drawsDoorAsLetter(gfx: GraphicsSet): boolean {
  let same = doorIsLetter.get(gfx);
  if (same === undefined) {
    const ctx = gfx.maskedTiles.getContext('2d')!;
    const frame = (second: boolean) => {
      const r = gfx.tileRect(LETTER_I, second);
      return ctx.getImageData(r.x, r.y, r.w, r.h).data;
    };
    const letter = frame(false);
    const door = frame(true);
    same = letter.every((v, i) => v === door[i]);
    doorIsLetter.set(gfx, same);
  }
  return same;
}

/** Counts builds, so one overtaken by a newer choice stops adding panels. */
let generation = 0;

async function build(): Promise<void> {
  const mine = ++generation;
  const main = document.getElementById('sets')!;
  const shown = state.set === 'All' ? TILE_SETS : [state.set];
  const status = document.getElementById('status')!;
  status.textContent = 'Loading sprite sheets…';
  const results = await Promise.allSettled(shown.map((name) => load(name)));
  if (mine !== generation) return;
  const available: { name: string; gfx: GraphicsSet }[] = [];
  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') available.push({ name: shown[i], gfx: result.value });
    else failed.push(shown[i]);
  });
  status.textContent = failed.length ? `Could not load: ${failed.join(', ')}. Reload to try again.` : '';
  const table = document.createElement('table');
  const caption = table.createCaption();
  caption.textContent = 'Compare each sprite across tile sets';
  const header = table.createTHead().insertRow();
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.textContent = 'Sprite';
  header.append(corner);
  for (const { name } of available) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = name;
    header.append(th);
  }
  const body = table.createTBody();
  panels = [];
  for (const index of tileOrder(state.grouped)) {
    const row = body.insertRow();
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = `${index === DOOR ? '' : `${index} · `}${tileName(index, names)}`;
    if (index !== DOOR && TERRAIN.has(index)) label.className = 'terrain';
    row.append(label);
    for (const { name, gfx } of available) {
      const cell = row.insertCell();
      const canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${tileName(index, names)} — ${name}`);
      if (index === DOOR && drawsDoorAsLetter(gfx)) cell.title = 'This set uses the letter I for doors';
      cell.append(canvas);
      const panel = { name, gfx, canvas, index };
      sizeCanvas(canvas);
      panels.push(panel);
    }
  }
  main.replaceChildren(table);
  redrawAll();
}

function redrawAll(resize = false): void {
  for (const panel of panels) {
    if (resize) sizeCanvas(panel.canvas);
    draw(panel);
  }
}

// --- controls ------------------------------------------------------------------

function fill(select: HTMLSelectElement, options: { value: string; label: string }[], value: string): void {
  select.replaceChildren(...options.map((o) => new Option(o.label, o.value, false, o.value === value)));
}

function setUp(): void {
  const set = document.getElementById('set') as HTMLSelectElement;
  const ground = document.getElementById('ground') as HTMLSelectElement;
  const size = document.getElementById('size') as HTMLSelectElement;
  const frames = document.getElementById('frames') as HTMLInputElement;
  const animate = document.getElementById('animate') as HTMLInputElement;
  const grouped = document.getElementById('grouped') as HTMLInputElement;
  fill(
    set,
    [...TILE_SETS, 'All'].map((n) => ({ value: n, label: n === 'All' ? 'All sets' : n })),
    state.set,
  );
  fill(
    ground,
    GROUNDS.map((g) => ({ value: g.id, label: g.label })),
    state.ground,
  );
  fill(
    size,
    SIZES.map((n) => ({ value: String(n), label: `${n} px` })),
    String(state.size),
  );
  frames.checked = state.frames;
  animate.checked = state.animate;
  grouped.checked = state.grouped;

  set.onchange = () => {
    state.set = set.value;
    saveState();
    void build();
  };
  ground.onchange = () => {
    state.ground = ground.value;
    saveState();
    redrawAll();
  };
  size.onchange = () => {
    state.size = Number(size.value);
    saveState();
    redrawAll(true);
  };
  frames.onchange = () => {
    state.frames = frames.checked;
    saveState();
    redrawAll(true);
  };
  animate.onchange = () => {
    state.animate = animate.checked;
    saveState();
  };
  grouped.onchange = () => {
    state.grouped = grouped.checked;
    saveState();
    void build();
  };
  window.addEventListener('resize', () => redrawAll(true));
  document.getElementById('sets')!.addEventListener('scroll', () => redrawAll());
  window.addEventListener('scroll', () => redrawAll());
}

/** Advance every shown set's animation at the game's rate, and redraw. */
function run(): void {
  let last = 0;
  const frame = (time: number) => {
    if (state.animate && time - last >= ANIMATION_INTERVAL_MS) {
      last = time;
      for (const gfx of new Set(panels.map((panel) => panel.gfx))) gfx.tick();
      redrawAll();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

setUp();
names = await loadNames();
await build();
run();
