/**
 * Generates every store image this app needs — run with `npm run gorseller`.
 *
 * The icons are drawn as SVG and rasterised, not painted by hand or by an image
 * model. That is a deliberate choice for a series: every icon comes out at an
 * exact pixel size, stays crisp, and shares one geometry across all five apps,
 * which is what makes them read as a family. Regenerating after a colour or
 * symbol change is one command rather than an afternoon.
 *
 * What it does NOT produce is screenshots. Those must come from the real
 * running app — Google treats a screenshot of something the app cannot do as
 * grounds for rejection.
 *
 * Each derived app edits only the BRAND block below.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

/* -------------------------------------------------------------------------- */
/* Brand — the only part a derived app changes                                */
/* -------------------------------------------------------------------------- */

const BRAND = {
  name: 'Sekme',
  tagline: 'Seken toplar, inen bloklar',
  /**
   * A soft two-stop gradient. The stops stay close in hue and moderate in
   * saturation on purpose: a hard, high-contrast gradient shouts, and these
   * apps are quiet. Calm first, distinctive second.
   */
  gradient: { from: '#0C8049', to: '#2FB37A' },
  /** Which glyph to draw. See `GLYPHS` below. */
  glyph: 'bounce' as GlyphName,
};

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* -------------------------------------------------------------------------- */

const SIZE = 1024;
const CENTER = SIZE / 2;

// Android may crop an icon to a circle, a squircle or a rounded square, so
// nothing meaningful goes outside the central 660px circle. Every glyph below
// is drawn well inside it.

/** Symbols are drawn light on the gradient, softened so they do not glare. */
const INK = 'rgba(255,255,255,0.94)';

type GlyphName = 'ring' | 'blocks' | 'lines' | 'capsule' | 'bounce';

/**
 * Each glyph fits inside the safe circle and stays legible at 48px, which is
 * the size that actually decides whether someone finds the app on their home
 * screen. No text, no numerals — those turn to mud when scaled down.
 */
const GLYPHS: Record<GlyphName, string> = {
  // An open ring: a counter that has not come all the way round yet.
  ring: (() => {
    const r = 228;
    const circumference = 2 * Math.PI * r;
    const drawn = circumference * 0.78;
    return `<circle cx="${CENTER}" cy="${CENTER}" r="${r}"
      fill="none" stroke="${INK}" stroke-width="96" stroke-linecap="round"
      stroke-dasharray="${drawn} ${circumference - drawn}"
      transform="rotate(-108 ${CENTER} ${CENTER})" />`;
  })(),

  // Three of four squares: blocks placed, one space left.
  blocks: (() => {
    const s = 196;
    const gap = 44;
    const origin = CENTER - (s + gap / 2);
    const at = (col: number, row: number) =>
      `<rect x="${origin + col * (s + gap)}" y="${origin + row * (s + gap)}"
         width="${s}" height="${s}" rx="46" fill="${INK}" />`;
    return at(0, 0) + at(1, 0) + at(0, 1);
  })(),

  // Four rounded bars of uneven length: the four boxes waiting to be filled.
  lines: (() => {
    const widths = [548, 452, 512, 386];
    const h = 78;
    const gap = 44;
    const totalH = widths.length * h + (widths.length - 1) * gap;
    const top = CENTER - totalH / 2;
    const left = CENTER - 274;
    return widths
      .map(
        (w, i) =>
          `<rect x="${left}" y="${top + i * (h + gap)}" width="${w}" height="${h}"
             rx="${h / 2}" fill="${INK}" />`,
      )
      .join('');
  })(),

  // A capsule, split — the one glyph everyone reads as medication instantly.
  capsule: (() => {
    const w = 560;
    const h = 240;
    const x = CENTER - w / 2;
    const y = CENTER - h / 2;
    return `<g transform="rotate(-45 ${CENTER} ${CENTER})">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${INK}" />
      <rect x="${CENTER - 9}" y="${y}" width="18" height="${h}"
        fill="rgba(0,0,0,0.18)" />
    </g>`;
  })(),

  // A ball on its way up to a block it is about to break. Two shapes and the
  // gap between them do the work: the eye reads the trajectory without a
  // drawn line, and the mark survives being shrunk to a launcher icon.
  bounce: (() => {
    const block = `<rect x="${CENTER - 250}" y="${CENTER - 268}" width="500" height="196"
      rx="56" />`;
    // Off to the lower right, so the implied path is a diagonal rather than a
    // dead-straight vertical, which would read as a full stop.
    const ball = `<circle cx="${CENTER + 128}" cy="${CENTER + 176}" r="116" />`;
    // One small companion ball: a single circle reads as a dot, two read as
    // motion.
    const trail = `<circle cx="${CENTER - 24}" cy="${CENTER + 296}" r="52" opacity="0.55" />`;

    return `<g opacity="0.94" fill="#FFFFFF">${block}${ball}${trail}</g>`;
  })(),
};

function gradientDef(id: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BRAND.gradient.from}" />
    <stop offset="1" stop-color="${BRAND.gradient.to}" />
  </linearGradient>`;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

/** The launcher icon: gradient ground plus symbol, no transparency. */
function iconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>${gradientDef('g')}</defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)" />
    ${GLYPHS[BRAND.glyph]}
  </svg>`;
}

/** Adaptive icon background: the gradient alone, for Android to mask. */
function backgroundSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>${gradientDef('g')}</defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)" />
  </svg>`;
}

/** Adaptive icon foreground: the symbol on transparency. */
function foregroundSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${GLYPHS[BRAND.glyph]}
  </svg>`;
}

/**
 * Themed icon: Android tints a single-colour silhouette to match the user's
 * wallpaper, so this one is pure white with no softening.
 */
function monochromeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${GLYPHS[BRAND.glyph].replaceAll(INK, '#FFFFFF').replaceAll('rgba(0,0,0,0.18)', 'none')}
  </svg>`;
}

/** Splash symbol: the glyph alone, drawn in the accent over the splash ground. */
function splashSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>${gradientDef('g')}</defs>
    ${GLYPHS[BRAND.glyph].replaceAll(INK, 'url(#g)').replaceAll('rgba(0,0,0,0.18)', 'none')}
  </svg>`;
}

const FEATURE_W = 1024;
const FEATURE_H = 500;

/**
 * Play Store feature graphic. Text is allowed here (unlike the icon) but stays
 * well clear of the edges — Google crops this differently across surfaces.
 */
function featureSvg(): string {
  // Keep the glyph clear of the left edge: Play crops this graphic differently
  // across surfaces, and anything inside ~80px can be shaved off.
  const glyphScale = 0.32;
  const glyphOffset = 190 - (SIZE * glyphScale) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FEATURE_W}" height="${FEATURE_H}">
    <defs>${gradientDef('g')}</defs>
    <rect width="${FEATURE_W}" height="${FEATURE_H}" fill="url(#g)" />
    <g transform="translate(${glyphOffset} ${FEATURE_H / 2 - (SIZE * glyphScale) / 2}) scale(${glyphScale})">
      ${GLYPHS[BRAND.glyph]}
    </g>
    <text x="360" y="${FEATURE_H / 2 - 10}"
      font-family="Segoe UI, Noto Sans, DejaVu Sans, Arial, sans-serif"
      font-size="72" font-weight="700" fill="#FFFFFF">${escapeXml(BRAND.name)}</text>
    <text x="360" y="${FEATURE_H / 2 + 56}"
      font-family="Segoe UI, Noto Sans, DejaVu Sans, Arial, sans-serif"
      font-size="34" font-weight="400" fill="rgba(255,255,255,0.85)">${escapeXml(BRAND.tagline)}</text>
  </svg>`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* -------------------------------------------------------------------------- */
/* Output                                                                     */
/* -------------------------------------------------------------------------- */

type Target = { path: string; svg: string; width: number; height: number; flatten?: string };

const TARGETS: Target[] = [
  // Play Store requires the launcher icon to have no alpha channel.
  { path: 'assets/images/icon.png', svg: iconSvg(), width: SIZE, height: SIZE, flatten: BRAND.gradient.from },
  { path: 'assets/images/android-icon-background.png', svg: backgroundSvg(), width: SIZE, height: SIZE },
  { path: 'assets/images/android-icon-foreground.png', svg: foregroundSvg(), width: SIZE, height: SIZE },
  { path: 'assets/images/android-icon-monochrome.png', svg: monochromeSvg(), width: SIZE, height: SIZE },
  { path: 'assets/images/splash-icon.png', svg: splashSvg(), width: 512, height: 512 },
  { path: 'assets/images/favicon.png', svg: iconSvg(), width: 96, height: 96, flatten: BRAND.gradient.from },
  { path: 'store/feature-graphic.png', svg: featureSvg(), width: FEATURE_W, height: FEATURE_H },
];

async function main(): Promise<void> {
  const root = join(import.meta.dirname, '..');

  for (const target of TARGETS) {
    const out = join(root, target.path);
    await mkdir(dirname(out), { recursive: true });

    let pipeline = sharp(Buffer.from(target.svg)).resize(target.width, target.height);
    if (target.flatten) pipeline = pipeline.flatten({ background: target.flatten });

    await writeFile(out, await pipeline.png().toBuffer());
    console.log(`  ${target.path}  ${target.width}×${target.height}`);
  }

  console.log(`\n${TARGETS.length} görsel üretildi — ${BRAND.name}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
