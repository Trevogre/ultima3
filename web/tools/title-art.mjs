// The box's title drawn afresh as vectors, for the Steam artwork where it stands alone (tools/steam-art.mjs: the logo
// Steam lays over the hero, and the wide capsule): EXODUS in the box's heavy slanted capitals, each a cracked teal face
// in a gold rim that turns to copper below its middle (the chrome's horizon), the letters' depth falling away below them
// in dark red, glints on their corners; ULTIMA III under it in gold. Drawn from the Commodore 64 box's front
// (art/box/ultima3-box-c64.jpg), not traced: the letters are polygons with rounded corners, in units of EXODUS's height.

/** A seeded random number generator (mulberry32), so the cracks and specks fall the same way each time. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Number(n.toFixed(2));

/** A polygon's corners [x, y, radius], clockwise on screen, as a path with each corner rounded. */
function rounded(points) {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i + n - 1) % n];
    const [x, y, r = 0] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const [ax, ay, al] = [px - x, py - y, Math.hypot(px - x, py - y)];
    const [bx, by, bl] = [nx - x, ny - y, Math.hypot(nx - x, ny - y)];
    const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl))));
    const t = Math.min(r / Math.tan(angle / 2), al / 2, bl / 2);
    const radius = t * Math.tan(angle / 2);
    const [sx, sy] = [x + (ax / al) * t, y + (ay / al) * t];
    const [ex, ey] = [x + (bx / bl) * t, y + (by / bl) * t];
    const sweep = (x - px) * (ny - y) - (y - py) * (nx - x) > 0 ? 1 : 0;
    d += `${i ? 'L' : 'M'}${f(sx)} ${f(sy)}`;
    if (t > 0.01) d += `A${f(radius)} ${f(radius)} 0 0 ${sweep} ${f(ex)} ${f(ey)}`;
  }
  return `${d}Z`;
}

/**
 * The polygon moved `s` in from each edge (out, where `s` is negative): each edge shifted along its inward normal, the
 * corners where the shifted edges meet, the rounding shrunk on outer corners and grown on inner ones.
 */
function inset(points, s) {
  const n = points.length;
  const lines = points.map(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % n];
    const l = Math.hypot(nx - x, ny - y);
    const [dx, dy] = [(nx - x) / l, (ny - y) / l];
    return { x: x - dy * s, y: y + dx * s, dx, dy };
  });
  return points.map(([, , r = 0], i) => {
    const a = lines[(i + n - 1) % n];
    const b = lines[i];
    const cross = a.dx * b.dy - a.dy * b.dx;
    const k = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / cross;
    return [a.x + a.dx * k, a.y + a.dy * k, Math.max(0, cross > 0 ? r - s : r + s)];
  });
}

// EXODUS, each letter its outline and any counters (holes), 100 tall, from x 0; its width after.
const EXODUS = [
  {
    w: 50,
    outline: [
      [0, 0, 3],
      [50, 0, 3],
      [50, 23, 2],
      [17, 23, 2],
      [17, 36, 2],
      [47, 36, 2],
      [47, 58, 2],
      [17, 58, 2],
      [17, 71, 2],
      [50, 71, 2],
      [50, 100, 3],
      [0, 100, 3],
    ],
    holes: [],
    glints: [
      [3, 3],
      [47, 25],
      [44, 56],
      [4, 97],
    ],
  },
  {
    w: 54,
    outline: [
      [0, 0, 2],
      [22, 0, 2],
      [27, 34, 2],
      [32, 0, 2],
      [54, 0, 2],
      [41, 50, 2],
      [54, 100, 2],
      [33, 100, 2],
      [27, 70, 2],
      [21, 100, 2],
      [0, 100, 2],
      [13, 50, 2],
    ],
    holes: [],
    glints: [
      [25, 30],
      [51, 3],
      [29, 73],
    ],
  },
  {
    w: 50,
    outline: [
      [0, 0, 21],
      [50, 0, 21],
      [50, 100, 21],
      [0, 100, 21],
    ],
    holes: [
      [
        [19, 24, 6],
        [31, 24, 6],
        [31, 75, 6],
        [19, 75, 6],
      ],
    ],
    glints: [
      [10, 6],
      [30, 74],
      [45, 92],
    ],
  },
  {
    w: 50,
    outline: [
      [0, 0, 2],
      [50, 0, 22],
      [50, 100, 22],
      [0, 100, 2],
    ],
    holes: [
      [
        [17, 24, 1],
        [31, 24, 8],
        [31, 76, 8],
        [17, 76, 1],
      ],
    ],
    glints: [
      [3, 3],
      [29, 76],
    ],
  },
  {
    w: 50,
    outline: [
      [0, 0, 2],
      [19, 0, 1],
      [19, 73, 6],
      [31, 73, 6],
      [31, 0, 1],
      [50, 0, 2],
      [50, 100, 21],
      [0, 100, 21],
    ],
    holes: [],
    glints: [
      [3, 3],
      [33, 3],
      [28, 73],
      [46, 90],
    ],
  },
  {
    w: 52,
    outline: [
      [0, 0, 18],
      [52, 0, 12],
      [52, 30, 2],
      [17, 30, 6],
      [17, 42, 6],
      [52, 42, 16],
      [52, 100, 18],
      [0, 100, 12],
      [0, 73, 2],
      [35, 73, 6],
      [35, 61, 6],
      [0, 61, 16],
    ],
    holes: [],
    glints: [
      [8, 5],
      [49, 27],
      [36, 63],
      [47, 95],
    ],
  },
];

// ULTIMA III, 100 tall in its own units (it is drawn smaller), blocky upright capitals.
const ULTIMA = [
  {
    w: 58,
    outline: [
      [0, 0, 2],
      [21, 0, 2],
      [21, 70, 4],
      [37, 70, 4],
      [37, 0, 2],
      [58, 0, 2],
      [58, 100, 14],
      [0, 100, 14],
    ],
  },
  {
    w: 48,
    outline: [
      [0, 0, 2],
      [21, 0, 2],
      [21, 77, 1],
      [48, 77, 2],
      [48, 100, 2],
      [0, 100, 2],
    ],
  },
  {
    w: 58,
    outline: [
      [0, 0, 2],
      [58, 0, 2],
      [58, 23, 2],
      [39.5, 23, 1],
      [39.5, 100, 2],
      [18.5, 100, 2],
      [18.5, 23, 1],
      [0, 23, 2],
    ],
  },
  {
    w: 21,
    outline: [
      [0, 0, 2],
      [21, 0, 2],
      [21, 100, 2],
      [0, 100, 2],
    ],
  },
  {
    w: 78,
    outline: [
      [0, 0, 2],
      [24, 0, 2],
      [39, 42, 1],
      [54, 0, 2],
      [78, 0, 2],
      [78, 100, 2],
      [58, 100, 2],
      [58, 46, 1],
      [45, 82, 1],
      [33, 82, 1],
      [20, 46, 1],
      [20, 100, 2],
      [0, 100, 2],
    ],
  },
  {
    w: 66,
    outline: [
      [0, 100, 2],
      [19, 0, 3],
      [47, 0, 3],
      [66, 100, 2],
      [45, 100, 2],
      [42, 82, 1],
      [24, 82, 1],
      [21, 100, 2],
    ],
    holes: [
      [
        [25, 64, 1],
        [41, 64, 1],
        [35.5, 27, 2],
        [30.5, 27, 2],
      ],
    ],
  },
  { w: 26 },
  {
    w: 21,
    outline: [
      [0, 0, 2],
      [21, 0, 2],
      [21, 100, 2],
      [0, 100, 2],
    ],
  },
  {
    w: 21,
    outline: [
      [0, 0, 2],
      [21, 0, 2],
      [21, 100, 2],
      [0, 100, 2],
    ],
  },
  {
    w: 21,
    outline: [
      [0, 0, 2],
      [21, 0, 2],
      [21, 100, 2],
      [0, 100, 2],
    ],
  },
];

const SLANT = 0.28; // EXODUS leans: x moves this much left for each unit down
const GAP = 1; // between EXODUS's letters: their rims all but touch
const RIM = 5; // the gold rim's width, inside each letter's edge

/** A letter's outline and counters as one path (its counters holes, even-odd). */
const shape = (letter, s = 0) => [letter.outline, ...(letter.holes ?? [])].map((p, i) => rounded(i ? inset(p, -s) : inset(p, s))).join(' ');

/** Cracks over a letter's face: thin dark lines wandering from random points, each with a lit edge, and specks. */
function cracks(rand, w) {
  let lines = '';
  for (let c = 0; c < 3; c++) {
    let [x, y] = [rand() * w, 8 + rand() * 84];
    let angle = rand() * Math.PI * 2;
    let d = `M${f(x)} ${f(y)}`;
    for (let s = 0; s < 9; s++) {
      angle += (rand() - 0.5) * 1.3;
      x += Math.cos(angle) * 5;
      y += Math.sin(angle) * 5;
      d += `L${f(x)} ${f(y)}`;
    }
    lines += `<path d="${d}"/>`;
  }
  let specks = '';
  for (let s = 0; s < 26; s++) specks += `<circle cx="${f(rand() * w)}" cy="${f(rand() * 100)}" r="${f(0.25 + rand() * 0.35)}"/>`;
  return { lines, specks };
}

/** A four-pointed glint: thin rays crossing over a soft white glow. */
const glint = (x, y, size) => `<g transform="translate(${f(x)} ${f(y)})">
  <circle r="${f(size * 0.55)}" fill="url(#glow)"/>
  <path d="M0 ${-size}L${f(size * 0.07)} 0 0 ${size} ${f(-size * 0.07)} 0Z M${-size} 0 0 ${f(size * 0.07)} ${size} 0 0 ${f(-size * 0.07)}Z" fill="#fff"/>
</g>`;

const DEFS = `
  <linearGradient id="rim" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
    <stop offset="0" stop-color="#ffd27a"/><stop offset="0.08" stop-color="#e8962e"/><stop offset="0.3" stop-color="#f0ae3a"/>
    <stop offset="0.46" stop-color="#ffe68a"/><stop offset="0.475" stop-color="#7a2410"/><stop offset="0.62" stop-color="#9a3416"/>
    <stop offset="0.85" stop-color="#d0682a"/><stop offset="1" stop-color="#f6b04c"/>
  </linearGradient>
  <linearGradient id="face" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
    <stop offset="0" stop-color="#3fc7c0"/><stop offset="0.12" stop-color="#16b0aa"/><stop offset="0.25" stop-color="#10a088"/>
    <stop offset="0.4" stop-color="#1d7c74"/><stop offset="0.55" stop-color="#1b4c46"/><stop offset="0.7" stop-color="#14262b"/>
    <stop offset="0.85" stop-color="#1c2236"/><stop offset="1" stop-color="#0c1018"/>
  </linearGradient>
  <linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
    <stop offset="0" stop-color="#fff0a8"/><stop offset="0.3" stop-color="#ffc848"/><stop offset="0.55" stop-color="#f08a2a"/>
    <stop offset="0.8" stop-color="#c04a1a"/><stop offset="1" stop-color="#ff9a3a"/>
  </linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="#d8ecff" stop-opacity="0.55"/><stop offset="1" stop-color="#9cc8ff" stop-opacity="0"/></radialGradient>`;

/**
 * The title as an SVG: EXODUS, and ULTIMA III under it unless `ultima` is false; `width` the picture's width in pixels.
 * Returns the SVG and its height in pixels.
 */
export function titleSvg(width, { ultima = true } = {}) {
  const rand = random(1983);
  const exodusWidth = EXODUS.reduce((sum, l) => sum + l.w, 0) + GAP * (EXODUS.length - 1) + SLANT * 100;
  const margin = 6;
  // The depth: the letters' outlines again and again, each a little nearer a point far below the word's middle, darker
  // as they go, fading out; their corners leave lit streaks.
  const vp = { x: margin + exodusWidth / 2, y: 420 };
  const layers = 120;
  const depth = 0.1; // the deepest layer this much nearer the point
  let x = margin + SLANT * 100;
  const placed = EXODUS.map((l) => {
    const at = x;
    x += l.w + GAP;
    return { ...l, at };
  });
  const word = (s) =>
    placed
      .map((l) => `<path transform="translate(${f(l.at)} 0) skewX(${f((-Math.atan(SLANT) * 180) / Math.PI)})" d="${shape(l, s)}"/>`)
      .join('');
  const outlines = word(0);
  let back = '';
  for (let i = layers; i >= 1; i--) {
    const t = i / layers;
    const k = 1 - depth * t;
    const shade = Math.round(128 - 104 * Math.sqrt(t));
    const fill = `rgb(${shade},${Math.round(shade * 0.24)},${Math.round(shade * 0.12)})`;
    const opacity = f(Math.min(1, (1 - t) * 2.5));
    back += `<g transform="translate(${f(vp.x)} ${f(vp.y)}) scale(${k.toFixed(5)}) translate(${f(-vp.x)} ${f(-vp.y)})" fill="${fill}" fill-opacity="${opacity}" stroke="#ff8a40" stroke-opacity="${f(0.05 * (1 - t))}" stroke-width="0.35" fill-rule="evenodd">${outlines}</g>`;
  }
  let front = '';
  for (const l of placed) {
    const transform = `translate(${f(l.at)} 0) skewX(${f((-Math.atan(SLANT) * 180) / Math.PI)})`;
    const { lines, specks } = cracks(rand, l.w);
    const id = `f${l.at.toFixed(0)}`;
    front += `<g transform="${transform}" fill-rule="evenodd">
      <path d="${shape(l, -1.2)}" fill="#160604"/>
      <path d="${shape(l, 0)}" fill="url(#rim)"/>
      <path d="${shape(l, 0.9)}" fill="none" stroke="#fff3c0" stroke-opacity="0.35" stroke-width="0.5"/>
      <clipPath id="${id}"><path d="${shape(l, RIM)}" clip-rule="evenodd"/></clipPath>
      <path d="${shape(l, RIM - 0.7)}" fill="#4a1408"/>
      <path d="${shape(l, RIM)}" fill="url(#face)"/>
      <g clip-path="url(#${id})">
        <g fill="none" stroke="#9ff0e0" stroke-opacity="0.35" stroke-width="0.45" transform="translate(0.45 0.45)">${lines}</g>
        <g fill="none" stroke="#04140f" stroke-opacity="0.85" stroke-width="0.4">${lines}</g>
        <g fill="#03100c" fill-opacity="0.7">${specks}</g>
      </g>
    </g>`;
  }
  // The glints, over everything, where the box has them: on the rims' corners.
  let glints = '';
  for (const l of placed) for (const [gx, gy] of l.glints) glints += glint(l.at + gx - SLANT * gy, gy, 5.5);

  let height = 100 + 22;
  let ultimaSvg = '';
  if (ultima) {
    // As the box sets it: wide and heavy, about half EXODUS's width.
    const [sx, scale] = [0.35, 0.26];
    const gap = 6;
    const uw = ULTIMA.reduce((sum, l) => sum + l.w, 0) + gap * (ULTIMA.length - 1);
    let ux = vp.x - (uw * sx) / 2;
    const top = 104;
    let letters = '';
    for (const l of ULTIMA) {
      if (l.outline) {
        const t = `translate(${f(ux)} ${top}) scale(${sx} ${scale})`;
        let deep = '';
        for (let i = 8; i >= 1; i--)
          deep += `<path transform="translate(0 ${f(i * 2.2)})" d="${shape(l, 0)}" fill="rgb(${100 - i * 8},${20 - i},${10 - i})"/>`;
        letters += `<g transform="${t}" fill-rule="evenodd">${deep}
          <path d="${shape(l, -5)}" fill="#2a0603"/>
          <path d="${shape(l, 0)}" fill="url(#gold)"/>
          <path d="${shape(l, 3)}" fill="none" stroke="#fff6d0" stroke-opacity="0.45" stroke-width="1.6"/>
        </g>`;
      }
      ux += (l.w + gap) * sx;
    }
    ultimaSvg =
      letters + glint(vp.x - (uw * sx) / 2 + 2, top + 1, 4) + glint(vp.x + (uw * sx) / 2 - 2, top + 24, 4) + glint(vp.x - 8, top + 1, 3.5);
    height = top + 100 * scale + 22 * 0.27 + 6;
  }
  const w = exodusWidth + margin * 2;
  const px = width / w;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-margin} ${f(w)} ${f(height + margin)}" width="${width}" height="${Math.round((height + margin) * px)}">
  <defs>${DEFS}</defs>
  <g>${back}</g>${front}${ultimaSvg}${glints}</svg>`,
    height: Math.round((height + margin) * px),
  };
}
