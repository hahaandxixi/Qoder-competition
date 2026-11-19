type TrackName = 'menu' | 'level' | 'boss' | 'victory';

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

interface BarPattern {
  bass: BassNote[];
  stabs: StabNote[];
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

class MusicManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private trackName: TrackName | null = null;
  private step = 0;
  private loopSteps = 16;
  private nextTime = 0;
  private schedulerId: number | null = null;
  private tension = false;

  private hbInterval: number | null = null;
  private hbEndTimer: number | null = null;
  private ducked = false;

  private muted = false;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 1;
    this.musicBus.connect(this.master);

    this.drumBus = this.ctx.createGain();
    this.drumBus.gain.value = 0.9;
    this.drumBus.connect(this.musicBus);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'b' || e.key === 'B') this.toggleMute();
    });
  }

  play(name: TrackName): void {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.trackName === name) return;
    this.trackName = name;
    this.step = 0;
    this.loopSteps = 16 * (TRACKS[name].bars?.length ?? 1);
    this.nextTime = this.ctx.currentTime + 0.06;
    this.musicBus?.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    this.musicBus?.gain.setTargetAtTime(this.ducked ? 0.35 : 1, this.ctx.currentTime + 0.2, 0.12);
    if (this.schedulerId === null) {
      this.schedulerId = window.setInterval(() => this.schedule(), 30);
    }
  }

  stop(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    this.trackName = null;
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
    }
  }

  setTension(on: boolean): void {
    this.tension = on;
  }

  setDuck(on: boolean): void {
    this.ducked = on;
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.08);
    }
  }

  stinger(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.01;
    [69, 72, 76].forEach((midi, i) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(NOTE_FREQ(midi), t + i * 0.06);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      g.gain.setValueAtTime(0.0001, t + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.5);
      osc.connect(lp).connect(g).connect(this.master!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.55);
    });
  }

  // 口琴式胜利乐句，衔接雷鬼 Jam
  fanfare(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
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
      lfo.connect(lfoGain).connect(osc.frequency);
      const dur = i === notes.length - 1 ? 0.9 : 0.26;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
      g.gain.setValueAtTime(0.18, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    });
  }

  get heartbeatActive(): boolean {
    return this.hbInterval !== null;
  }

  get state(): string {
    return this.ctx ? this.ctx.state : 'none';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get current(): TrackName | null {
    return this.trackName;
  }

  // 受击后持续 5 秒的心跳背景音
  heartbeat(durationMs = 5000): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    this.clearHeartbeat();
    const thumpPair = (): void => {
      const t = ctx.currentTime + 0.02;
      this.thump(t, 0.7);
      this.thump(t + 0.18, 0.45);
    };
    thumpPair();
    this.hbInterval = window.setInterval(thumpPair, 900);
    this.hbEndTimer = window.setTimeout(() => {
      this.clearHeartbeat();
    }, durationMs);
    this.setDuck(true);
    window.setTimeout(() => {
      if (!this.hbInterval) this.setDuck(false);
    }, durationMs + 30);
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
  }

  private thump(t: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.trackName) return;
    const track = TRACKS[this.trackName];
    const stepDur = 60 / track.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(track, this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % this.loopSteps;
    }
  }

  private playStep(track: TrackDef, absStep: number, t: number): void {
    const bar = Math.floor(absStep / 16);
    const s = absStep % 16;
    const barPat = track.bars ? track.bars[bar % track.bars.length] : null;

    if (track.kick.includes(s)) this.kick(t);
    if (track.snare.includes(s)) this.snare(t);
    if (track.hat.includes(s)) this.hat(t);
    const bassNotes = barPat ? barPat.bass : track.bass;
    for (const b of bassNotes) {
      if (b.step === s) this.bass(t, NOTE_FREQ(b.midi), b.dur);
    }
    const stabNotes = barPat ? barPat.stabs : track.stabs;
    for (const st of stabNotes) {
      if (st.step === s) this.stab(t, st.midis.map(NOTE_FREQ), st.dur, st.gain ?? 1);
    }
    if (track.lead) {
      for (const n of track.lead) {
        if (n.step === s) this.lead(t, NOTE_FREQ(n.midi), n.dur);
      }
    }
    if (s === 0 && track.padMidis && track.padDur) {
      this.pad(t, track.padMidis.map(NOTE_FREQ), track.padDur, 0.035);
    }
    if (this.tension) {
      if (s === 0 && track.tensionPad) {
        this.pad(t, track.tensionPad.map(NOTE_FREQ), track.padDur ?? 2.2, 0.05);
      }
      if (track.tensionStab && track.tensionStab.step === s) {
        this.stab(t, track.tensionStab.midis.map(NOTE_FREQ), 0.5, 0.7);
      }
      if (s === 3 || s === 11) this.kickSub(t);
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.drumBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private kickSub(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.drumBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, t);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private noise(t: number, dur: number, kind: 'snare' | 'hat'): void {
    const ctx = this.ctx;
    if (!ctx || !this.drumBus) return;
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
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
    src.connect(filter).connect(g).connect(this.drumBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private snare(t: number): void {
    this.noise(t, 0.22, 'snare');
  }

  private hat(t: number): void {
    this.noise(t, 0.05, 'hat');
  }

  private bass(t: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
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
    osc.connect(lp).connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private stab(t: number, freqs: number[], dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
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
      osc.connect(lp).connect(g).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private pad(t: number, freqs: number[], dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
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
      osc.connect(g).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private lead(t: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.5, t);
    lfoGain.gain.setValueAtTime(6, t);
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
    g.gain.setValueAtTime(0.12, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }
}

export const music = new MusicManager();