// The desktop app's Steam library artwork (desktop/steamArt.cjs puts it in place), made from the 1983 box painting by
// Denis Loubet for Origin Systems: art/box/ultima3-box-c64.jpg, the Commodore 64 box's front. Every picture keeps the
// painting at the scan's own resolution or close to it: smooth, a painting, as the box was.
//   - capsule.png (600x900, the library's portrait capsule): the box, its title at the top, its border and the
//     "Commodore 64" label gone (the lava under the label is the left side's, mirrored), its foot fading to dark under
//     "1983 ~ 2026";
//   - wide.png (920x430, the wide capsule): the painting below the title to the left, fading into the dark; the title
//     and the years to the right;
//   - hero.png (3840x1240, across the game's page; no words, Steam lays the logo over it): the painting below the title,
//     its foot on the bottom edge and the demon's eyes and glowing hands inside Steam's safe zone, the middle 860x380
//     (x 1490-2350, y 430-810) sure to stay in view as the window is resized; the rest the painting's own colours,
//     blurred and darkened, with nothing in the top-right corner the Steam Deck's status bar covers;
//   - logo.png (1280 wide, transparent): the box's painted title, EXODUS and ULTIMA III, cut from the cavern behind it,
//     its 3D block fading out below.
// The years are cut into stone: the wing's veined red for the cut's floor, a darker copy of it as the wall in shadow
// along the top and left of each stroke and a lighter copy as the lit wall along the bottom and right, a thin dark
// outline around. Run `node tools/steam-art.mjs` in web/; it needs ImageMagick 7 (`magick`) and macOS's Arial Black.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = join(WEB, 'art', 'box', 'ultima3-box-c64.jpg');
const OUT = join(WEB, '..', 'desktop', 'build', 'steam');
const FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf';
const tmp = mkdtempSync(join(tmpdir(), 'steam-art-'));
const t = (name) => join(tmp, name);
const magick = (...args) => execFileSync('magick', args.flat(Infinity), { stdio: 'inherit' });
/** Written pictures carry no dates, so the same scan makes the same files. */
const write = (name) => ['-strip', '-define', 'png:exclude-chunks=date,time', join(OUT, name)];
/** An alpha that rises from 0 to 1 over `f` pixels in from the given edges. */
const feather = (f, top = false) => `min(1, min(min(i/${f}, (w-1-i)/${f}), ${top ? `j/${f}` : '1'}))`;

try {
  // The painting: the scan with the label's corner covered by the left side's lava (mirrored, its edges feathered),
  // then the striped border trimmed off.
  magick(
    SCAN,
    '-crop',
    '84x132+10+850',
    '+repage',
    '-flop',
    '-alpha',
    'set',
    '-channel',
    'A',
    '-fx',
    'min(1, min(i/24, j/24))',
    '+channel',
    t('patch.png'),
  );
  magick(SCAN, t('patch.png'), '-geometry', '+604+850', '-composite', '-crop', '669x972+15+10', '+repage', t('painting.png'));
  // The scene below the title (the demon, his wings and the rock), and the stone for the years (the left wing, turned).
  magick(t('painting.png'), '-crop', '669x662+0+310', '+repage', t('scene.png'));
  magick(t('painting.png'), '-crop', '56x250+72+435', '+repage', '-rotate', '90', '-modulate', '80,105', t('stone.png'));

  /** "1983 ~ 2026" cut into the stone, `w` x `h` on transparency: the mask, the three stones through it, the outline. */
  const carve = (w, h, out) => {
    const d = Math.floor(h / 18) + 1;
    const x = (p) => Math.floor((w * p) / 100);
    const y = (p) => Math.floor((h * p) / 100);
    const wave = `path 'M ${x(41)},${y(50)} C ${x(45)},${y(18)} ${x(49)},${y(18)} ${x(50)},${y(50)} S ${x(55)},${y(82)} ${x(59)},${y(50)}'`;
    magick(
      ['-size', `${w}x${h}`, 'xc:black', '-fill', 'white', '-font', FONT, '-pointsize', String(y(70))],
      ['-gravity', 'west', '-annotate', '+0+0', '1983', '-gravity', 'east', '-annotate', '+0+0', '2026'],
      ['-gravity', 'northwest', '-fill', 'none', '-stroke', 'white', '-strokewidth', String(Math.floor(h / 9)), '-draw', wave],
      ['-alpha', 'off', '-colorspace', 'gray', t('mask.png')],
    );
    const stone = (brightness, name) =>
      magick(
        t('stone.png'),
        '-resize',
        `${w}x${h}^`,
        '-gravity',
        'center',
        '-extent',
        `${w}x${h}`,
        '-modulate',
        `${brightness},100`,
        t(name),
      );
    stone(100, 'floor.png');
    stone(62, 'dark.png');
    stone(140, 'light.png');
    // The walls: the part of each stroke its own copy shifted down and right leaves bare (the top and left, in shadow),
    // and the part its copy shifted up and left leaves bare (the bottom and right, lit).
    magick(t('mask.png'), '(', t('mask.png'), '-roll', `+${d}+${d}`, '-negate', ')', '-compose', 'Multiply', '-composite', t('shade.png'));
    magick(t('mask.png'), '(', t('mask.png'), '-roll', `-${d}-${d}`, '-negate', ')', '-compose', 'Multiply', '-composite', t('lit.png'));
    const through = (image, mask, name) => magick(t(image), t(mask), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', t(name));
    through('floor.png', 'mask.png', 'l-floor.png');
    through('dark.png', 'shade.png', 'l-shade.png');
    through('light.png', 'lit.png', 'l-lit.png');
    magick(t('mask.png'), '-morphology', 'Dilate', `Disk:${Math.floor(h / 22) + 1}`, t('grown.png'));
    magick(
      '-size',
      `${w}x${h}`,
      'xc:#120303',
      t('grown.png'),
      '-alpha',
      'off',
      '-compose',
      'CopyOpacity',
      '-composite',
      t('l-outline.png'),
    );
    magick(
      t('l-outline.png'),
      t('l-floor.png'),
      '-compose',
      'Over',
      '-composite',
      t('l-shade.png'),
      '-compose',
      'Over',
      '-composite',
      t('l-lit.png'),
      '-compose',
      'Over',
      '-composite',
      out,
    );
  };

  // The title, cut from the cavern: the black around it flooded away from the edges, the cut's edge softened, the 3D
  // block below fading out, and a red streak of the cavern at the bottom left cleared.
  magick(
    [t('painting.png'), '-crop', '669x262+0+0', '+repage', '-alpha', 'set', '-fuzz', '16%', '-fill', 'none'],
    ['0,0', '668,0', '0,150', '668,150', '0,261', '668,261'].flatMap((p) => ['-draw', `color ${p} floodfill`]),
    [t('title-cut.png')],
  );
  magick(
    t('title-cut.png'),
    ['(', '+clone', '-alpha', 'extract', '-blur', '0x0.7'],
    ['(', '-size', '669x262', 'xc:white', '(', '-size', '669x22', 'gradient:white-black', ')', '-geometry', '+0+240', '-composite'],
    ['-fill', 'black', '-draw', 'rectangle 0,215 40,262', ')', '-compose', 'Multiply', '-composite', ')'],
    ['-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-trim', '+repage', t('title.png')],
  );
  magick(t('title.png'), '-filter', 'Lanczos', '-resize', '1280x', '-unsharp', '0x1.2+0.6+0', write('logo.png'));

  // The portrait capsule: the box, 2:3, its foot fading to dark under the years.
  carve(440, 64, t('years-capsule.png'));
  magick(
    [t('painting.png'), '-gravity', 'center', '-crop', '648x972+0+0', '+repage', '-resize', '600x900!', '-unsharp', '0x0.6+0.4+0'],
    ['-gravity', 'northwest', '(', '-size', '600x240', 'gradient:rgba(0,0,0,0)-rgba(6,1,1,0.96)', ')', '-geometry', '+0+660', '-composite'],
    [t('years-capsule.png'), '-geometry', '+80+816', '-composite', write('capsule.png')],
  );

  // The wide capsule: the scene to the left fading into the dark, the title and the years to the right.
  carve(300, 44, t('years-wide.png'));
  magick(t('scene.png'), '-resize', 'x430', '-alpha', 'set', '-channel', 'A', '-fx', 'min(1, (w-1-i)/90)', '+channel', t('wide-scene.png'));
  magick(t('title.png'), '-filter', 'Lanczos', '-resize', '430x', t('wide-title.png'));
  magick(
    ['-size', '430x920', 'gradient:#2a0a06-#050101', '-rotate', '270'],
    [t('wide-scene.png'), '-geometry', '+0+0', '-composite', t('wide-title.png'), '-geometry', '+460+78', '-composite'],
    [t('years-wide.png'), '-geometry', '+525+290', '-composite', '-depth', '8', write('wide.png')],
  );

  // The hero: the scene at 1.48x, its foot on the bottom edge and the eyes at y 520, on its own colours blurred.
  magick(
    t('scene.png'),
    '-resize',
    '3840x1240^',
    '-gravity',
    'center',
    '-extent',
    '3840x1240',
    '-blur',
    '0x60',
    '-modulate',
    '32,60',
    t('hero-ground.png'),
  );
  magick(
    t('scene.png'),
    '-resize',
    '989x978!',
    '-unsharp',
    '0x1+0.5+0',
    '-alpha',
    'set',
    '-channel',
    'A',
    '-fx',
    feather(90, true),
    '+channel',
    t('hero-scene.png'),
  );
  magick(t('hero-ground.png'), t('hero-scene.png'), '-gravity', 'northwest', '-geometry', '+1425+262', '-composite', write('hero.png'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
