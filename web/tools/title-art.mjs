// The box's title drawn afresh as vectors, for the key art where it stands alone (tools/key-art.mjs: the logo, the
// wide capsule and the banner): EXODUS in the box's heavy capitals set in its keystone, each a cracked teal face
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

/**
 * A polygon's corners [x, y, radius], clockwise on screen, as points: each corner rounded (its arc in steps of a few
 * degrees), each long edge in short steps, so the outline bends truly when it is set in the keystone.
 */
function flatten(points) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i + n - 1) % n];
    const [x, y, r = 0] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const [al, bl] = [Math.hypot(px - x, py - y), Math.hypot(nx - x, ny - y)];
    const [ax, ay, bx, by] = [(px - x) / al, (py - y) / al, (nx - x) / bl, (ny - y) / bl];
    const angle = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by)));
    const t = angle > Math.PI - 1e-3 ? 0 : Math.min(r / Math.tan(angle / 2), al / 2, bl / 2);
    if (t < 0.01) out.push([x, y]);
    else {
      // The arc's middle lies along the corner's bisector.
      const radius = t * Math.tan(angle / 2);
      const [hx, hy] = [ax + bx, ay + by];
      const reach = radius / Math.sin(angle / 2) / Math.hypot(hx, hy);
      const [cx, cy] = [x + hx * reach, y + hy * reach];
      const from = Math.atan2(y + ay * t - cy, x + ax * t - cx);
      let span = Math.atan2(y + by * t - cy, x + bx * t - cx) - from;
      if (span > Math.PI) span -= 2 * Math.PI;
      if (span < -Math.PI) span += 2 * Math.PI;
      const steps = Math.max(2, Math.ceil(Math.abs(span) / (Math.PI / 32)));
      for (let k = 0; k <= steps; k++)
        out.push([cx + radius * Math.cos(from + (span * k) / steps), cy + radius * Math.sin(from + (span * k) / steps)]);
    }
  }
  const fine = [];
  out.forEach(([x, y], i) => {
    const [nx, ny] = out[(i + 1) % out.length];
    const steps = Math.ceil(Math.hypot(nx - x, ny - y) / 3);
    for (let k = 0; k < steps; k++) fine.push([x + ((nx - x) * k) / steps, y + ((ny - y) * k) / steps]);
  });
  return fine;
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

// EXODUS, each letter its outline and any counters (holes), 100 tall, upright, from x 0: their widths at the foot are
// the box's (measured along its baseline), the keystone narrows them above.
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
    w: 62,
    outline: [
      [0, 0, 2],
      [25, 0, 2],
      [31, 34, 2],
      [37, 0, 2],
      [62, 0, 2],
      [48, 50, 2],
      [62, 100, 2],
      [38, 100, 2],
      [31, 70, 2],
      [24, 100, 2],
      [0, 100, 2],
      [14, 50, 2],
    ],
    holes: [],
    glints: [
      [29, 30],
      [59, 3],
      [33, 73],
    ],
  },
  {
    w: 52,
    outline: [
      [0, 0, 21],
      [52, 0, 21],
      [52, 100, 21],
      [0, 100, 21],
    ],
    holes: [
      [
        [20, 24, 6],
        [32, 24, 6],
        [32, 75, 6],
        [20, 75, 6],
      ],
    ],
    glints: [
      [10, 6],
      [31, 74],
      [47, 92],
    ],
  },
  {
    w: 52,
    outline: [
      [0, 0, 2],
      [52, 0, 22],
      [52, 100, 22],
      [0, 100, 2],
    ],
    holes: [
      [
        [17, 24, 1],
        [33, 24, 8],
        [33, 76, 8],
        [17, 76, 1],
      ],
    ],
    glints: [
      [3, 3],
      [31, 76],
    ],
  },
  {
    w: 51,
    outline: [
      [0, 0, 2],
      [19.5, 0, 1],
      [19.5, 73, 6],
      [31.5, 73, 6],
      [31.5, 0, 1],
      [51, 0, 2],
      [51, 100, 21],
      [0, 100, 21],
    ],
    holes: [],
    glints: [
      [3, 3],
      [34, 3],
      [28, 73],
      [47, 90],
    ],
  },
  {
    w: 51,
    outline: [
      [0, 0, 18],
      [51, 0, 12],
      [51, 30, 2],
      [17, 30, 6],
      [17, 42, 6],
      [51, 42, 16],
      [51, 100, 18],
      [0, 100, 12],
      [0, 73, 2],
      [34, 73, 6],
      [34, 61, 6],
      [0, 61, 16],
    ],
    holes: [],
    glints: [
      [8, 5],
      [48, 27],
      [35, 63],
      [46, 95],
    ],
  },
];

// ULTIMA III, 100 tall in its own units (it is drawn smaller), blocky upright capitals; `kern` draws a letter nearer
// the one before.
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
    kern: -14, // the T's bar over the L's foot
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

// The box's lettering stands in a keystone, as if leaning back: each letter upright at the word's middle, those either
// side leaning in toward it, the top of the word 14% narrower than its foot.
const KEYSTONE = 0.14;
const GAP = 3; // between EXODUS's letters, as on the box
const RIM = 5; // the gold rim's width, inside each letter's edge

/** Where a point of the word (100 tall, its foot at y 100) stands in the keystone about column `middle`. */
const keystone = (middle) => (x, y) => [middle + (x - middle) * (1 - KEYSTONE * (1 - y / 100)), y];

/** A letter's outline and counters as one path (its counters holes, even-odd), moved in `s`, each point set by `place`. */
const shape = (letter, s, place) =>
  [letter.outline, ...(letter.holes ?? [])]
    .map(
      (p, i) =>
        `M${flatten(inset(p, i ? -s : s))
          .map(([x, y]) => place(x, y).map(f).join(' '))
          .join('L')}Z`,
    )
    .join(' ');

/** Cracks over a letter's face: thin dark lines wandering from random points, each with a lit edge, and specks. */
function cracks(rand, w, place) {
  let lines = '';
  for (let c = 0; c < 3; c++) {
    let [x, y] = [rand() * w, 8 + rand() * 84];
    let angle = rand() * Math.PI * 2;
    const line = [[x, y]];
    for (let s = 0; s < 9; s++) {
      angle += (rand() - 0.5) * 1.3;
      x += Math.cos(angle) * 5;
      y += Math.sin(angle) * 5;
      line.push([x, y]);
    }
    lines += `<path d="M${line.map(([px, py]) => place(px, py).map(f).join(' ')).join('L')}"/>`;
  }
  let specks = '';
  for (let s = 0; s < 26; s++) {
    const [cx, cy] = place(rand() * w, rand() * 100);
    specks += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(0.25 + rand() * 0.35)}"/>`;
  }
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
  <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="#d8ecff" stop-opacity="0.55"/><stop offset="1" stop-color="#9cc8ff" stop-opacity="0"/></radialGradient>`;

/**
 * The title as an SVG: EXODUS, and ULTIMA III under it unless `ultima` is false; `width` the picture's width in pixels.
 * Returns the SVG and its height in pixels.
 */
export function titleSvg(width, { ultima = true } = {}) {
  const rand = random(1983);
  const margin = 6;
  const exodusWidth = EXODUS.reduce((sum, l) => sum + l.w, 0) + GAP * (EXODUS.length - 1);
  const middle = margin + exodusWidth / 2;
  const set = keystone(middle);
  let x = margin;
  const placed = EXODUS.map((l) => {
    const at = x;
    x += l.w + GAP;
    return { ...l, place: (px, py) => set(at + px, py) };
  });
  // The depth: the letters' outlines again and again, each a little nearer a point far below the word's middle, darker
  // as they go, fading out; their corners leave lit streaks.
  const vp = { x: middle, y: 420 };
  const layers = 120;
  const depth = 0.1; // the deepest layer this much nearer the point
  const outlines = placed.map((l) => `<path d="${shape(l, 0, l.place)}"/>`).join('');
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
  placed.forEach((l, i) => {
    const { lines, specks } = cracks(rand, l.w, l.place);
    const face = shape(l, RIM, l.place);
    front += `<g fill-rule="evenodd">
      <path d="${shape(l, -1.2, l.place)}" fill="#160604"/>
      <path d="${shape(l, 0, l.place)}" fill="url(#rim)"/>
      <path d="${shape(l, 0.9, l.place)}" fill="none" stroke="#fff3c0" stroke-opacity="0.35" stroke-width="0.5"/>
      <clipPath id="face${i}"><path d="${face}" clip-rule="evenodd"/></clipPath>
      <path d="${shape(l, RIM - 0.7, l.place)}" fill="#4a1408"/>
      <path d="${face}" fill="url(#face)"/>
      <g clip-path="url(#face${i})">
        <g fill="none" stroke="#9ff0e0" stroke-opacity="0.35" stroke-width="0.45" transform="translate(0.45 0.45)">${lines}</g>
        <g fill="none" stroke="#04140f" stroke-opacity="0.85" stroke-width="0.4">${lines}</g>
        <g fill="#03100c" fill-opacity="0.7">${specks}</g>
      </g>
    </g>`;
  });
  // The glints, over everything, where the box has them: on the rims' corners.
  let glints = '';
  for (const l of placed) for (const [gx, gy] of l.glints) glints += glint(...l.place(gx, gy), 5.5);

  let height = 100 + 22;
  let ultimaSvg = '';
  if (ultima) {
    // As the box sets it: wide and heavy, about half EXODUS's width, standing in the same keystone just below it.
    const [sx, sy] = [0.35, 0.26];
    const gap = 6;
    const uw = ULTIMA.reduce((sum, l) => sum + l.w + (l.kern ?? 0), 0) + gap * (ULTIMA.length - 1);
    const top = 104;
    let ux = middle - (uw * sx) / 2;
    // Its gold from the top of its letters to their foot.
    let letters = `<defs><linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${f(top + 100 * sy)}">
      <stop offset="0" stop-color="#fff0a8"/><stop offset="0.3" stop-color="#ffc848"/><stop offset="0.5" stop-color="#ffe070"/>
      <stop offset="0.52" stop-color="#c0501c"/><stop offset="0.8" stop-color="#a03814"/><stop offset="1" stop-color="#ff9a3a"/>
    </linearGradient></defs>`;
    for (const l of ULTIMA) {
      ux += (l.kern ?? 0) * sx;
      const at = ux;
      const place = (px, py) => set(at + px * sx, top + py * sy);
      if (l.outline) {
        const outline = shape(l, 0, place);
        let deep = '';
        for (let i = 8; i >= 1; i--)
          deep += `<path transform="translate(0 ${f(i * 0.57)})" d="${outline}" fill="rgb(${100 - i * 8},${20 - i},${10 - i})"/>`;
        letters += `<g fill-rule="evenodd">${deep}
          <path d="${shape(l, -5, place)}" fill="#2a0603"/>
          <path d="${outline}" fill="url(#gold)"/>
          <path d="${shape(l, 3, place)}" fill="none" stroke="#fff6d0" stroke-opacity="0.45" stroke-width="0.45"/>
        </g>`;
      }
      ux += (l.w + gap) * sx;
    }
    const left = middle - (uw * sx) / 2;
    ultimaSvg =
      letters +
      glint(...set(left + 1, top + 1), 4) +
      glint(...set(middle + (uw * sx) / 2 - 1, top + 24), 4) +
      glint(...set(middle - 8, top + 1), 3.5);
    height = top + 100 * sy + 12;
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
