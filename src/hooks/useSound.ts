/**
 * Poker Sound Effects — Premium Royal Casino Sounds
 * Synthesized via Web Audio API. No external files needed.
 * All sounds use rich harmonics, reverb, and warm tones.
 */

export type SoundEvent =
  | 'card-deal'
  | 'chip-bet'
  | 'check'
  | 'fold'
  | 'win'
  | 'all-in'
  | 'round-start';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Create a simple convolver reverb for richness */
function createReverb(ctx: AudioContext, duration = 0.6, decay = 2): ConvolverNode {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = impulse;
  return conv;
}

// ── Card Deal: Smooth elegant swoosh ──

function playCardDeal() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Soft filtered noise swoosh
  const len = ctx.sampleRate * 0.12;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.4;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2200, now);
  bp.frequency.exponentialRampToValueAtTime(600, now + 0.12);
  bp.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  const reverb = createReverb(ctx, 0.3, 3);
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;

  src.connect(bp).connect(gain);
  gain.connect(dry).connect(ctx.destination);
  gain.connect(reverb).connect(wet).connect(ctx.destination);

  src.start(now);
  src.stop(now + 0.15);
}

// ── Chip Bet: Rich ceramic chip stack sound ──

function playChipBet() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Multiple ceramic-like tones with harmonics
  const tones = [
    { freq: 2800, delay: 0, dur: 0.08 },
    { freq: 3400, delay: 0.02, dur: 0.06 },
    { freq: 4100, delay: 0.04, dur: 0.05 },
    { freq: 2200, delay: 0.06, dur: 0.07 },
  ];

  const reverb = createReverb(ctx, 0.4, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  reverb.connect(wet).connect(ctx.destination);

  tones.forEach(({ freq, delay: d, dur }) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + d);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + d + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + d);
    g.gain.linearRampToValueAtTime(0.06, now + d + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + d + dur);

    osc.connect(g);
    g.connect(ctx.destination);
    g.connect(reverb);
    osc.start(now + d);
    osc.stop(now + d + dur + 0.01);
  });
}

// ── Check: Elegant double-tap on felt ──

function playCheck() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Two soft muted taps like knocking on a felt table
  [0, 0.07].forEach((offset) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now + offset);
    osc.frequency.exponentialRampToValueAtTime(100, now + offset + 0.06);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + offset);
    g.gain.linearRampToValueAtTime(0.12, now + offset + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

    // Add warmth with a lowpass
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;

    osc.connect(lp).connect(g).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.08);
  });
}

// ── Fold: Gentle card slide with soft air ──

function playFold() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const len = ctx.sampleRate * 0.25;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5) * 0.2;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1800, now);
  lp.frequency.exponentialRampToValueAtTime(150, now + 0.25);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  src.connect(lp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.3);

  // Subtle descending tone
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.04, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(og).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

// ── Win: Elegant ascending chord with sparkle ──

function playWin() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const reverb = createReverb(ctx, 1.0, 2);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  reverb.connect(wet).connect(ctx.destination);

  // Warm major chord arpeggio: C4 E4 G4 C5
  const notes = [261.63, 329.63, 392.00, 523.25];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Add a harmonic for richness
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;

    const g = ctx.createGain();
    const offset = i * 0.09;
    g.gain.setValueAtTime(0, now + offset);
    g.gain.linearRampToValueAtTime(0.08, now + offset + 0.02);
    g.gain.setValueAtTime(0.08, now + offset + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.5);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now + offset);
    g2.gain.linearRampToValueAtTime(0.02, now + offset + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);

    osc.connect(g);
    osc2.connect(g2);
    g.connect(ctx.destination);
    g.connect(reverb);
    g2.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.55);
    osc2.start(now + offset);
    osc2.stop(now + offset + 0.35);
  });

  // Shimmer/sparkle overlay
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const sparkleFreq = 2000 + Math.random() * 3000;
    osc.frequency.value = sparkleFreq;

    const g = ctx.createGain();
    const offset = 0.15 + i * 0.06;
    g.gain.setValueAtTime(0, now + offset);
    g.gain.linearRampToValueAtTime(0.015, now + offset + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

    osc.connect(g).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.1);
  }
}

// ── All-In: Deep dramatic impact with tension ──

function playAllIn() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const reverb = createReverb(ctx, 0.8, 2);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  reverb.connect(wet).connect(ctx.destination);

  // Deep bass impact
  const bass = ctx.createOscillator();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(80, now);
  bass.frequency.exponentialRampToValueAtTime(30, now + 0.4);

  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.25, now);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  bass.connect(bg);
  bg.connect(ctx.destination);
  bg.connect(reverb);
  bass.start(now);
  bass.stop(now + 0.45);

  // Dramatic sub-octave
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, now);
  sub.frequency.exponentialRampToValueAtTime(25, now + 0.5);

  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.15, now);
  sg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  sub.connect(sg).connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.55);

  // Impact noise burst
  const len = ctx.sampleRate * 0.08;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4) * 0.5;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.18, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  src.connect(ng);
  ng.connect(ctx.destination);
  ng.connect(reverb);
  src.start(now);
  src.stop(now + 0.1);

  // Tension chord: minor 2nd dissonance
  [130.81, 138.59].forEach(freq => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + 0.05);
    g.gain.linearRampToValueAtTime(0.04, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    o.connect(g);
    g.connect(ctx.destination);
    g.connect(reverb);
    o.start(now + 0.05);
    o.stop(now + 0.65);
  });
}

// ── Round Start: Elegant shuffle with warm tone ──

function playRoundStart() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const reverb = createReverb(ctx, 0.4, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  reverb.connect(wet).connect(ctx.destination);

  // Shuffle: several soft filtered noise bursts
  for (let i = 0; i < 5; i++) {
    const len = ctx.sampleRate * 0.035;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < len; j++) {
      d[j] = (Math.random() * 2 - 1) * Math.sin((j / len) * Math.PI) * 0.3;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600 + i * 300;
    bp.Q.value = 1;

    const g = ctx.createGain();
    const offset = i * 0.04;
    g.gain.setValueAtTime(0.08, now + offset);
    g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.035);

    src.connect(bp).connect(g);
    g.connect(ctx.destination);
    g.connect(reverb);
    src.start(now + offset);
    src.stop(now + offset + 0.05);
  }

  // Warm tonal finish — soft rising fifth
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 220;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 330;

  [o1, o2].forEach((o, i) => {
    const g = ctx.createGain();
    const t = 0.18 + i * 0.04;
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.03, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.2);
    o.connect(g);
    g.connect(ctx.destination);
    g.connect(reverb);
    o.start(now + t);
    o.stop(now + t + 0.25);
  });
}

// ── Public API ────────────────────────────────────────────────────────────

const SOUND_MAP: Record<SoundEvent, () => void> = {
  'card-deal': playCardDeal,
  'chip-bet': playChipBet,
  'check': playCheck,
  'fold': playFold,
  'win': playWin,
  'all-in': playAllIn,
  'round-start': playRoundStart,
};

export function playSound(event: SoundEvent) {
  try {
    SOUND_MAP[event]();
  } catch {
    // Silently fail — audio is not critical
  }
}
