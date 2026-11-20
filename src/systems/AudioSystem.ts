type MusicMode = 'menu' | 'level' | 'boss' | 'result' | 'none';

type SoundName =
  | 'jump'
  | 'doubleJump'
  | 'shoot'
  | 'dash'
  | 'hit'
  | 'hurt'
  | 'enemyHit'
  | 'enemyDown'
  | 'parry'
  | 'fail'
  | 'tick'
  | 'card'
  | 'door'
  | 'select'
  | 'victory'
  | 'defeat'
  | 'hitBoss'
  | 'stagger'
  | 'burst';

type AudioContextCtor = typeof AudioContext;

interface ExtendedWindow extends Window {
  webkitAudioContext?: AudioContextCtor;
}

export const TRACK_NAMES = ['menu', 'level', 'boss', 'victory'] as const;
export type TrackName = (typeof TRACK_NAMES)[number];

export function isTrackName(value: string | null | undefined): value is TrackName {
  return value === 'menu' || value === 'level' || value === 'boss' || value === 'victory';
}

type DuckSource = 'quiz' | 'heartbeat';

interface BassNote {
  step: number;
  midi: number;
  dur: number;
}

interface StabNote {
  step: number;
  midis: number[];
  dur: number;
  gain?: number;
}

interface LeadNote {
  step: number;
  midi: number;
  dur: number;
}

interface BarPattern {
  bass: BassNote[];
  stabs: StabNote[];
}

interface TrackDef {
  bpm: number;
  kick: number[];
  snare: number[];
  hat: number[];
  bass: BassNote[];
  stabs: StabNote[];
  lead?: LeadNote[];
  padMidis?: number[];
  padDur?: number;
  tensionPad?: number[];
  tensionStab?: { step: number; midis: number[] };
  bars?: BarPattern[];
}

const NOTE_FREQ = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

const TRACKS: Record<TrackName, TrackDef> = {
  // 冷雨废土：稀疏、压抑的氛围铺垫
  menu: {
    bpm: 72,
    kick: [],
    snare: [],
    hat: [0, 4, 8, 12],
    bass: [{ step: 0, midi: 45, dur: 2.2 }],
    stabs: [],
    lead: [
      { step: 4, midi: 76, dur: 1.0 },
      { step: 12, midi: 72, dur: 1.4 },
    ],
    padMidis: [45, 52, 55, 60, 64],
    padDur: 2.4,
  },
  // 紫电走廊：100BPM 小调 Funk-Rock，持续推进的压迫律动
  level: {
    bpm: 100,
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    hat: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
    bass: [
      { step: 0, midi: 45, dur: 0.22 },
      { step: 2, midi: 45, dur: 0.14 },
      { step: 3, midi: 48, dur: 0.12 },
      { step: 4, midi: 43, dur: 0.2 },
      { step: 6, midi: 45, dur: 0.2 },
      { step: 8, midi: 50, dur: 0.14 },
      { step: 10, midi: 48, dur: 0.16 },
      { step: 12, midi: 43, dur: 0.2 },
      { step: 14, midi: 40, dur: 0.14 },
      { step: 15, midi: 43, dur: 0.12 },
    ],
    stabs: [
      { step: 2, midis: [57, 60, 64, 67], dur: 0.13 },
      { step: 7, midis: [57, 60, 64, 67], dur: 0.1 },
      { step: 9, midis: [53, 57, 60, 64], dur: 0.12 },
      { step: 13, midis: [57, 60, 64, 67], dur: 0.1 },
    ],
    padMidis: [45, 57, 60, 64],
    padDur: 2.2,
    tensionPad: [45, 51],
    tensionStab: { step: 15, midis: [57, 60, 63] },
  },
  // 发布会暴走：132BPM 小调，音墙推进
  boss: {
    bpm: 132,
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
    bass: [
      { step: 0, midi: 38, dur: 0.18 },
      { step: 2, midi: 38, dur: 0.12 },
      { step: 3, midi: 41, dur: 0.12 },
      { step: 6, midi: 38, dur: 0.16 },
      { step: 8, midi: 36, dur: 0.16 },
      { step: 10, midi: 38, dur: 0.12 },
      { step: 12, midi: 45, dur: 0.14 },
      { step: 14, midi: 41, dur: 0.12 },
      { step: 15, midi: 38, dur: 0.12 },
    ],
    stabs: [
      { step: 0, midis: [62, 65, 69], dur: 0.1, gain: 1.2 },
      { step: 3, midis: [62, 65, 69], dur: 0.08 },
      { step: 8, midis: [62, 65, 69], dur: 0.1, gain: 1.2 },
      { step: 11, midis: [60, 64, 67], dur: 0.08 },
      { step: 14, midis: [62, 65, 69], dur: 0.08 },
    ],
    tensionPad: [38, 44],
    tensionStab: { step: 15, midis: [62, 65, 68] },
  },
  // 归名雷鬼：76BPM 一提鼓 + 反拍切分，D–Bm–G–A 四小节 Jam
  victory: {
    bpm: 76,
    kick: [8],
    snare: [8],
    hat: [2, 6, 10, 14],
    bass: [],
    stabs: [],
    bars: [
      {
        bass: [
          { step: 0, midi: 38, dur: 0.5 },
          { step: 6, midi: 50, dur: 0.25 },
          { step: 10, midi: 45, dur: 0.35 },
          { step: 14, midi: 43, dur: 0.2 },
        ],
        stabs: [
          { step: 2, midis: [62, 66, 69], dur: 0.12 },
          { step: 6, midis: [62, 66, 69], dur: 0.12 },
          { step: 10, midis: [62, 66, 69], dur: 0.12 },
          { step: 14, midis: [62, 66, 69], dur: 0.12 },
        ],
      },
      {
        bass: [
          { step: 0, midi: 35, dur: 0.5 },
          { step: 6, midi: 47, dur: 0.25 },
          { step: 10, midi: 42, dur: 0.35 },
          { step: 14, midi: 40, dur: 0.2 },
        ],
        stabs: [
          { step: 2, midis: [59, 62, 66], dur: 0.12 },
          { step: 6, midis: [59, 62, 66], dur: 0.12 },
          { step: 10, midis: [59, 62, 66], dur: 0.12 },
          { step: 14, midis: [59, 62, 66], dur: 0.12 },
        ],
      },
      {
        bass: [
          { step: 0, midi: 31, dur: 0.5 },
          { step: 6, midi: 43, dur: 0.25 },
          { step: 10, midi: 38, dur: 0.35 },
          { step: 14, midi: 40, dur: 0.2 },
        ],
        stabs: [
          { step: 2, midis: [55, 59, 62], dur: 0.12 },
          { step: 6, midis: [55, 59, 62], dur: 0.12 },
          { step: 10, midis: [55, 59, 62], dur: 0.12 },
          { step: 14, midis: [55, 59, 62], dur: 0.12 },
        ],
      },
      {
        bass: [
          { step: 0, midi: 33, dur: 0.5 },
          { step: 6, midi: 45, dur: 0.25 },
          { step: 10, midi: 40, dur: 0.35 },
          { step: 14, midi: 43, dur: 0.2 },
        ],
        stabs: [
          { step: 2, midis: [57, 61, 64], dur: 0.12 },
          { step: 6, midis: [57, 61, 64], dur: 0.12 },
          { step: 10, midis: [57, 61, 64], dur: 0.12 },
          { step: 14, midis: [57, 61, 64], dur: 0.12 },
        ],
      },
    ],
    lead: [
      { step: 2, midi: 78, dur: 0.18 },
      { step: 5, midi: 81, dur: 0.25 },
      { step: 7, midi: 78, dur: 0.12 },
      { step: 10, midi: 76, dur: 0.22 },
      { step: 13, midi: 74, dur: 0.25 },
      { step: 15, midi: 73, dur: 0.12 },
    ],
  },
};

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private loopSteps = 16;
  private mode: MusicMode = 'none';
  private trackName: TrackName | null = null;
  private muted = false;
  private tension = false;
  private ducked = false;
  private readonly duckSources = new Set<DuckSource>();
  private hbInterval: number | null = null;
  private hbEndTimer: number | null = null;
  private resultTimer: number | null = null;

  private static readonly MUSIC_VOLUME = 0.5;
  private static readonly DUCK_VOLUME = 0.2;

  init(muted: boolean): void {
    this.muted = muted;
  }

  unlock(): void {
    try {
      if (!this.ctx) {
        const ctor = window.AudioContext ?? (window as ExtendedWindow).webkitAudioContext;
        if (!ctor) {
          return;
        }
        this.ctx = new ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.34;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = AudioSystem.MUSIC_VOLUME;
        this.musicGain.connect(this.master);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined);
      }
      this.startScheduler();
    } catch {
      // Audio is optional; the game remains fully playable without it.
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      try {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.34, this.ctx.currentTime, 0.02);
      } catch {
        // Ignore transient audio graph errors.
      }
    }
  }

  isHeartbeatActive(): boolean {
    return this.hbInterval !== null;
  }

  setMusic(mode: MusicMode): void {
    if (this.mode === mode && (mode === 'none' || mode === 'result' || this.trackName !== null)) {
      return;
    }
    this.mode = mode;
    if (mode === 'none' || mode === 'result') {
      this.stopTrack();
    } else {
      this.playTrack(mode);
    }
  }

  // 胜利：口琴式 fanfare 后衔接雷鬼 Jam；失败：不播胜利音乐，保留原有失败音效
  setResult(win: boolean): void {
    this.resetSceneMix();
    this.mode = 'result';
    this.stopTrack();
    if (!win) {
      return;
    }
    this.fanfare();
    this.resultTimer = window.setTimeout(() => {
      this.resultTimer = null;
      this.playTrack('victory');
    }, 1600);
  }

  setTension(on: boolean): void {
    this.tension = on;
  }

  resetSceneMix(): void {
    this.clearHeartbeat();
    this.duckSources.clear();
    this.applyDuck();
    this.tension = false;
  }

  setDuck(on: boolean, source: DuckSource = 'quiz'): void {
    if (on) {
      this.duckSources.add(source);
    } else {
      this.duckSources.delete(source);
    }
    this.applyDuck();
  }

  private applyDuck(): void {
    const ducked = this.duckSources.size > 0;
    if (ducked === this.ducked) {
      return;
    }
    this.ducked = ducked;
    if (!this.ctx || !this.musicGain) {
      return;
    }
    try {
      this.musicGain.gain.setTargetAtTime(
        ducked ? AudioSystem.DUCK_VOLUME : AudioSystem.MUSIC_VOLUME,
        this.ctx.currentTime,
        0.08,
      );
    } catch {
      // Ignore.
    }
  }

  play(name: SoundName): void {
    if (!this.ctx || !this.master || this.muted) {
      return;
    }
    if (this.ctx.state !== 'running') {
      return;
    }
    const now = this.ctx.currentTime;
    if (name === 'hurt') {
      this.heartbeat(5000);
    }
    switch (name) {
      case 'jump':
        this.tone(now, 360, 0.1, 'square', 0.07, 560);
        break;
      case 'doubleJump':
        this.tone(now, 520, 0.11, 'square', 0.07, 820);
        this.tone(now + 0.04, 660, 0.08, 'triangle', 0.04, 980);
        break;
      case 'shoot':
        this.tone(now, 880, 0.055, 'square', 0.045, 300);
        this.noise(now, 0.04, 0.025);
        break;
      case 'dash':
        this.tone(now, 240, 0.13, 'sawtooth', 0.05, 90);
        this.noise(now, 0.09, 0.03);
        break;
      case 'hit':
        this.tone(now, 170, 0.06, 'square', 0.055, 90);
        this.noise(now, 0.05, 0.04);
        break;
      case 'hurt':
        this.tone(now, 210, 0.18, 'sawtooth', 0.08, 70);
        this.noise(now, 0.12, 0.05);
        break;
      case 'enemyHit':
        this.tone(now, 320, 0.06, 'triangle', 0.05, 220);
        break;
      case 'enemyDown':
        this.tone(now, 240, 0.18, 'square', 0.06, 80);
        this.noise(now, 0.15, 0.05);
        break;
      case 'parry':
        this.arp(now, [523.25, 659.25, 783.99, 1046.5, 1318.5], 0.075, 'square', 0.08);
        this.noise(now, 0.22, 0.08);
        break;
      case 'fail':
        this.tone(now, 220, 0.28, 'sawtooth', 0.07, 90);
        this.tone(now + 0.1, 160, 0.22, 'square', 0.05, 70);
        break;
      case 'tick':
        this.tone(now, 1100, 0.035, 'square', 0.04, 900);
        break;
      case 'card':
        this.tone(now, 660, 0.12, 'triangle', 0.07, 990);
        this.tone(now + 0.08, 1320, 0.14, 'triangle', 0.04, 1500);
        break;
      case 'door':
        this.tone(now, 180, 0.22, 'sawtooth', 0.06, 360);
        this.tone(now + 0.12, 360, 0.18, 'square', 0.04, 540);
        break;
      case 'select':
        this.tone(now, 620, 0.04, 'square', 0.035, 700);
        break;
      case 'victory':
        this.arp(now, [392, 523.25, 659.25, 783.99, 1046.5], 0.16, 'square', 0.07);
        break;
      case 'defeat':
        this.arp(now, [392, 349.23, 293.66, 220], 0.2, 'sawtooth', 0.05);
        break;
      case 'hitBoss':
        this.tone(now, 140, 0.08, 'square', 0.06, 90);
        this.noise(now, 0.04, 0.03);
        break;
      case 'stagger':
        this.noise(now, 0.3, 0.09);
        this.tone(now, 90, 0.35, 'sawtooth', 0.07, 50);
        break;
      case 'burst':
        this.arp(now, [523.25, 659.25, 783.99, 1046.5], 0.1, 'square', 0.08);
        this.noise(now, 0.2, 0.05);
        break;
      default:
        break;
    }
  }

  // 口琴式胜利乐句，衔接雷鬼 Jam
  fanfare(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }
    const t0 = ctx.currentTime + 0.02;
    const notes: [number, number][] = [
      [74, 0],
      [78, 0.32],
      [81, 0.64],
      [81, 0.98],
    ];
    notes.forEach(([midi, off], i) => {
      const t = t0 + off;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(NOTE_FREQ(midi), t);
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.5, t);
      lfoGain.gain.setValueAtTime(7, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const dur = i === notes.length - 1 ? 0.9 : 0.26;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
      g.gain.setValueAtTime(0.18, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    });
  }

  // 受击后持续 5 秒的心跳背景音
  heartbeat(durationMs = 5000): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted || ctx.state !== 'running') {
      return;
    }
    this.clearHeartbeat();
    const thumpPair = (): void => {
      const t = ctx.currentTime + 0.02;
      this.thump(t, 0.7);
      this.thump(t + 0.18, 0.45);
    };
    thumpPair();
    this.hbInterval = window.setInterval(thumpPair, 900);
    this.setDuck(true, 'heartbeat');
    this.hbEndTimer = window.setTimeout(() => {
      this.clearHeartbeat();
    }, durationMs);
  }

  private clearHeartbeat(): void {
    if (this.hbInterval !== null) {
      window.clearInterval(this.hbInterval);
      this.hbInterval = null;
    }
    if (this.hbEndTimer !== null) {
      window.clearTimeout(this.hbEndTimer);
      this.hbEndTimer = null;
    }
    this.setDuck(false, 'heartbeat');
  }

  private thump(t: number, vol: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      return;
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private tone(
    start: number,
    from: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    to?: number,
  ): void {
    if (!this.ctx || !this.master) {
      return;
    }
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Ignore a failed sound; gameplay state is unaffected.
    }
  }

  private noise(start: number, duration: number, volume: number): void {
    if (!this.ctx || !this.master) {
      return;
    }
    try {
      const frames = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buffer;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      src.connect(gain);
      gain.connect(this.master);
      src.start(start);
    } catch {
      // Ignore.
    }
  }

  private arp(start: number, notes: number[], spacing: number, type: OscillatorType, volume: number): void {
    notes.forEach((freq, index) => {
      this.tone(start + index * spacing, freq, spacing * 1.4, type, volume);
    });
  }

  private startScheduler(): void {
    if (!this.ctx || this.timer !== null || !this.trackName) {
      return;
    }
    try {
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.scheduleMusic(), 30);
      this.scheduleMusic();
    } catch {
      this.timer = null;
    }
  }

  private stopScheduler(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private clearResultTimer(): void {
    if (this.resultTimer !== null) {
      window.clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
  }

  private playTrack(name: TrackName): void {
    if (name !== 'victory') {
      this.clearResultTimer();
    }
    this.trackName = name;
    this.step = 0;
    this.loopSteps = 16 * (TRACKS[name].bars?.length ?? 1);
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.06;
      if (this.musicGain) {
        this.musicGain.gain.setTargetAtTime(
          this.ducked ? AudioSystem.DUCK_VOLUME : AudioSystem.MUSIC_VOLUME,
          this.ctx.currentTime,
          0.06,
        );
      }
      this.startScheduler();
    }
  }

  private stopTrack(): void {
    this.clearResultTimer();
    this.stopScheduler();
    this.trackName = null;
    if (this.ctx && this.musicGain) {
      try {
        this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
      } catch {
        // Ignore.
      }
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.trackName || ctx.state !== 'running') {
      return;
    }
    try {
      const track = TRACKS[this.trackName];
      const stepDur = 60 / track.bpm / 4;
      // 后台标签页会积压过期步进；先归位，再限制单次补帧数量。
      if (this.nextNoteTime < ctx.currentTime - stepDur) {
        this.nextNoteTime = ctx.currentTime + 0.05;
      }
      let guard = 0;
      while (this.nextNoteTime < ctx.currentTime + 0.15 && guard < 8) {
        this.playStep(track, this.step, this.nextNoteTime);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % this.loopSteps;
        guard += 1;
      }
    } catch {
      // Ignore music scheduling issues.
    }
  }

  private playStep(track: TrackDef, absStep: number, t: number): void {
    const bar = Math.floor(absStep / 16);
    const s = absStep % 16;
    const barPat = track.bars ? track.bars[bar % track.bars.length] : null;

    if (track.kick.includes(s)) {
      this.musicKick(t);
    }
    if (track.snare.includes(s)) {
      this.musicNoise(t, 0.22, 'snare');
    }
    if (track.hat.includes(s)) {
      this.musicNoise(t, 0.05, 'hat');
    }
    const bassNotes = barPat ? barPat.bass : track.bass;
    for (const b of bassNotes) {
      if (b.step === s) {
        this.musicBass(t, NOTE_FREQ(b.midi), b.dur);
      }
    }
    const stabNotes = barPat ? barPat.stabs : track.stabs;
    for (const st of stabNotes) {
      if (st.step === s) {
        this.musicStab(t, st.midis.map(NOTE_FREQ), st.dur, st.gain ?? 1);
      }
    }
    if (track.lead) {
      for (const n of track.lead) {
        if (n.step === s) {
          this.musicLead(t, NOTE_FREQ(n.midi), n.dur);
        }
      }
    }
    if (s === 0 && track.padMidis && track.padDur) {
      this.musicPad(t, track.padMidis.map(NOTE_FREQ), track.padDur, 0.035);
    }
    if (this.tension) {
      if (s === 0 && track.tensionPad) {
        this.musicPad(t, track.tensionPad.map(NOTE_FREQ), track.padDur ?? 2.2, 0.05);
      }
      if (track.tensionStab && track.tensionStab.step === s) {
        this.musicStab(t, track.tensionStab.midis.map(NOTE_FREQ), 0.5, 0.7);
      }
      if (s === 3 || s === 11) {
        this.musicKickSub(t);
      }
    }
  }

  private musicKick(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private musicKickSub(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, t);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private musicNoise(t: number, dur: number, kind: 'snare' | 'hat'): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    if (kind === 'snare') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.Q.value = 1;
    } else {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, t);
    }
    const g = ctx.createGain();
    const vol = kind === 'snare' ? 0.3 : 0.09;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private musicBass(t: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(620, t);
    lp.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private musicStab(t: number, freqs: number[], dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private musicPad(t: number, freqs: number[], dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 12, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.6);
      g.gain.setValueAtTime(gain, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private musicLead(t: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) {
      return;
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.5, t);
    lfoGain.gain.setValueAtTime(6, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
    g.gain.setValueAtTime(0.12, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }
}

export const audio = new AudioSystem();