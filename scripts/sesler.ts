/**
 * Generates every sound the game plays, the same way `gorseller.ts` generates
 * every image: from code, into `assets/sounds/`, committed as the result.
 * Nothing is downloaded and no sample is licensed from anywhere.
 *
 * Run with `npm run sesler`. Needs `ffmpeg` on PATH to compress the synthesized
 * WAVs to m4a; without it the WAVs are kept, which works but ships ~10x larger.
 *
 * Design rule, borrowed from the `oyun-motoru` skill's haptic table: a sound
 * that fires constantly has to be quieter than one that marks an event. A
 * bounce happens dozens of times a second at forty balls; a break happens once.
 * They cannot share a volume.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22050;
const OUT = join(import.meta.dirname, '..', 'assets', 'sounds');

type Wave = 'sine' | 'triangle';

function osc(wave: Wave, phase: number): number {
  const t = phase % 1;
  if (wave === 'sine') return Math.sin(t * Math.PI * 2);
  // Triangle: softer than a square, still has the upper harmonics a pure sine
  // lacks — a bare sine "tick" is nearly inaudible over a phone speaker.
  return 4 * Math.abs(t - 0.5) - 1;
}

/** One enveloped tone, added into `buffer` starting at `atSeconds`. */
function tone(
  buffer: Float32Array,
  atSeconds: number,
  opts: {
    from: number;
    to?: number;
    seconds: number;
    gain: number;
    wave?: Wave;
    /** Fraction of the tone spent fading in — 0 is a click, which is what a
     * bounce actually wants and a pad never does. */
    attack?: number;
  },
): void {
  const { from, to = from, seconds, gain, wave = 'sine', attack = 0.01 } = opts;
  const start = Math.floor(atSeconds * RATE);
  const length = Math.floor(seconds * RATE);
  let phase = 0;

  for (let i = 0; i < length; i++) {
    const index = start + i;
    if (index >= buffer.length) break;

    const progress = i / length;
    const frequency = from + (to - from) * progress;
    phase += frequency / RATE;

    const rise = attack === 0 ? 1 : Math.min(1, progress / attack);
    const fall = Math.pow(1 - progress, 2.2);
    buffer[index] = (buffer[index] ?? 0) + osc(wave, phase) * gain * rise * fall;
  }
}

/** Filtered noise — the body of a breaking block, which a tone alone cannot be. */
function noise(buffer: Float32Array, atSeconds: number, seconds: number, gain: number): void {
  const start = Math.floor(atSeconds * RATE);
  const length = Math.floor(seconds * RATE);
  let previous = 0;

  for (let i = 0; i < length; i++) {
    const index = start + i;
    if (index >= buffer.length) break;

    // One-pole lowpass: raw white noise reads as static, not as an impact.
    previous = previous * 0.72 + (Math.random() * 2 - 1) * 0.28;
    buffer[index] = (buffer[index] ?? 0) + previous * gain * Math.pow(1 - i / length, 3);
  }
}

function wav(samples: Float32Array): Buffer {
  const header = Buffer.alloc(44);
  const body = Buffer.alloc(samples.length * 2);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + body.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(body.length, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    body.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  return Buffer.concat([header, body]);
}

function empty(seconds: number): Float32Array {
  return new Float32Array(Math.ceil(seconds * RATE));
}

/* -------------------------------------------------------------------------- */
/* The sounds                                                                 */
/* -------------------------------------------------------------------------- */

/** A ball meeting a wall or a block. Fires constantly, so it is the quietest
 * thing here and shorter than a blink. */
function bounce(): Float32Array {
  const buffer = empty(0.05);
  tone(buffer, 0, { from: 760, to: 620, seconds: 0.045, gain: 0.16, wave: 'triangle', attack: 0 });
  return buffer;
}

/** A block reaching zero. The one hit that changed the board, so it gets a
 * body (noise) the plain bounce does not. */
function breakBlock(): Float32Array {
  const buffer = empty(0.28);
  tone(buffer, 0, { from: 440, to: 150, seconds: 0.26, gain: 0.3, wave: 'triangle', attack: 0 });
  noise(buffer, 0, 0.12, 0.22);
  return buffer;
}

/** Picking up a ball: two notes up, because the run just got better. */
function ballPickup(): Float32Array {
  const buffer = empty(0.24);
  tone(buffer, 0, { from: 659, seconds: 0.1, gain: 0.24 });
  tone(buffer, 0.07, { from: 988, seconds: 0.16, gain: 0.22 });
  return buffer;
}

/** Gold: same idea, one note wider, so the two are told apart without looking. */
function goldPickup(): Float32Array {
  const buffer = empty(0.3);
  tone(buffer, 0, { from: 784, seconds: 0.09, gain: 0.22 });
  tone(buffer, 0.06, { from: 988, seconds: 0.1, gain: 0.2 });
  tone(buffer, 0.12, { from: 1319, seconds: 0.16, gain: 0.2 });
  return buffer;
}

/** The run ending. Falling, minor, and the longest sound in the game. */
function gameOver(): Float32Array {
  const buffer = empty(0.9);
  tone(buffer, 0, { from: 440, seconds: 0.3, gain: 0.26, attack: 0.05 });
  tone(buffer, 0.18, { from: 349, seconds: 0.3, gain: 0.24, attack: 0.05 });
  tone(buffer, 0.36, { from: 262, seconds: 0.5, gain: 0.26, attack: 0.05 });
  return buffer;
}

/** A new record — the one moment the game celebrates, per `oyun.tsx`. */
function record(): Float32Array {
  const buffer = empty(0.7);
  tone(buffer, 0, { from: 523, seconds: 0.14, gain: 0.22 });
  tone(buffer, 0.1, { from: 659, seconds: 0.14, gain: 0.22 });
  tone(buffer, 0.2, { from: 784, seconds: 0.14, gain: 0.22 });
  tone(buffer, 0.3, { from: 1047, seconds: 0.35, gain: 0.24, attack: 0.03 });
  return buffer;
}

/**
 * The background loop: eight seconds at 132 BPM, A minor pentatonic, with a
 * pulse. An earlier version was a slow ambient pad on the theory that
 * something playing for hours should be ignorable — but this is an arcade
 * game whose whole feel is a fast volley, and a drifting pad under it read as
 * two unrelated things happening at once. It now drives: a kick on every
 * beat, an offbeat tick, and a sixteenth-note bass that keeps moving.
 *
 * Eight seconds is an exact number of bars, and nothing is left ringing at
 * the end, so the loop point is not an audible seam.
 */
function music(): Float32Array {
  const bars = 8;
  const buffer = empty(bars);
  const beat = 60 / 132;

  // Kick: a fast pitch drop is the whole trick — no sample needed.
  for (let i = 0; beat * i < bars - 0.1; i++) {
    tone(buffer, beat * i, { from: 150, to: 48, seconds: 0.14, gain: 0.5, attack: 0 });
  }

  // Offbeat tick, so the pulse has something between the kicks.
  for (let i = 0; beat * (i + 0.5) < bars - 0.1; i++) {
    noise(buffer, beat * (i + 0.5), 0.045, 0.13);
  }

  // Sixteenth bass line, A minor pentatonic.
  const bass = [110, 110, 164.81, 110, 130.81, 110, 196, 164.81];
  const sixteenth = beat / 2;
  for (let step = 0; sixteenth * step < bars - 0.1; step++) {
    tone(buffer, sixteenth * step, {
      from: bass[step % bass.length]!,
      seconds: sixteenth * 0.9,
      gain: 0.22,
      wave: 'triangle',
      attack: 0.02,
    });
  }

  // A lead that enters on the second half, so the loop is not eight seconds
  // of the same bar.
  const lead = [659.25, 783.99, 880, 783.99, 659.25, 587.33];
  for (let step = 0; step < 12; step++) {
    const at = bars / 2 + step * (beat / 2);
    if (at > bars - 0.3) break;
    tone(buffer, at, { from: lead[step % lead.length]!, seconds: beat * 0.42, gain: 0.12, attack: 0.03 });
  }

  return buffer;
}

/* -------------------------------------------------------------------------- */

/**
 * One master trim on the effects, rather than fifteen edited numbers: the
 * relative balance between them was already right, the whole set was simply
 * too quiet against the music on a phone speaker. `wav()` clamps, and the
 * loudest single effect peaks near 0.5 before this, so nothing clips.
 */
const SFX_GAIN = 1.8;

function amplify(samples: Float32Array, factor: number): Float32Array {
  for (let i = 0; i < samples.length; i++) samples[i] = (samples[i] ?? 0) * factor;
  return samples;
}

const SOUNDS: Record<string, () => Float32Array> = {
  sek: () => amplify(bounce(), SFX_GAIN),
  kir: () => amplify(breakBlock(), SFX_GAIN),
  top: () => amplify(ballPickup(), SFX_GAIN),
  altin: () => amplify(goldPickup(), SFX_GAIN),
  bitti: () => amplify(gameOver(), SFX_GAIN),
  rekor: () => amplify(record(), SFX_GAIN),
  muzik: music,
};

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  for (const file of readdirSync(OUT)) rmSync(join(OUT, file));

  const compress = hasFfmpeg();
  if (!compress) {
    console.warn('ffmpeg bulunamadı — sesler sıkıştırılmadan (wav) bırakılıyor.');
  }

  for (const [name, make] of Object.entries(SOUNDS)) {
    const wavPath = join(OUT, `${name}.wav`);
    writeFileSync(wavPath, wav(make()));

    if (!compress) {
      console.log(`  ${name}.wav`);
      continue;
    }

    const m4aPath = join(OUT, `${name}.m4a`);
    execFileSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', m4aPath],
      { stdio: 'inherit' },
    );
    rmSync(wavPath);
    console.log(`  ${name}.m4a`);
  }

  if (!existsSync(OUT)) throw new Error('çıktı klasörü yazılamadı');
  console.log(`\n${Object.keys(SOUNDS).length} ses üretildi → assets/sounds/`);
}

main();
