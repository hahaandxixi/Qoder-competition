type MusicMode = 'menu' | 'level' | 'boss' | 'result' | 'none';

type BossDashBeat = 1 | 2 | 3 | 4;

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
  | 'burst'
  | 'paper'
  | 'rewind'
  | 'bell'
  | 'spray'
  | 'stampThud'
  | 'scan';

type AudioContextCtor = typeof AudioContext;

interface ExtendedWindow extends Window {
  webkitAudioContext?: AudioContextCtor;
}

const MELODIES: Record<Exclude<MusicMode, 'none'>, { tempo: number; bass: number[]; lead: number[] }> = {
  menu: {
    tempo: 0.34,
    bass: [0, 0, 7, 0, 5, 5, 3, 0],
    lead: [12, 15, 19, 15, 17, 14, 12, 7],
  },
  level: {
    tempo: 0.3,
    bass: [0, 0, 7, 0, 5, 5, 3, 7],
    lead: [12, 14, 16, 14, 12, 10, 7, 10],
  },
  boss: {
    tempo: 0.235,
    bass: [0, 0, 1, 0, 3, 3, 1, 0],
    lead: [12, 13, 12, 8, 15, 13, 12, 7],
  },
  result: {
    tempo: 0.48,
    bass: [0, 0, 5, 5, 7, 7, 3, 3],
    lead: [12, 7, 12, 10, 8, 7, 3, 7],
  },
};

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private mode: MusicMode = 'menu';
  private muted = false;
  private bossDashBus: GainNode | null = null;
  private bossDashSources: AudioScheduledSourceNode[] = [];

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
        this.musicGain.gain.value = 0.2;
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

  setMusic(mode: MusicMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.step = 0;
    this.nextNoteTime = 0;
    if (mode === 'none') {
      this.stopScheduler();
    } else {
      this.startScheduler();
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
      case 'paper':
        // 吐纸：一段短促的“滋啦”抖纸声。
        this.noise(now, 0.16, 0.05);
        this.tone(now, 900, 0.13, 'triangle', 0.03, 320);
        break;
      case 'rewind':
        // 磁带倒带：先升后降的卷带啸叫。
        this.tone(now, 320, 0.42, 'sawtooth', 0.035, 940);
        this.tone(now + 0.18, 880, 0.3, 'sawtooth', 0.03, 260);
        this.noise(now, 0.5, 0.015);
        break;
      case 'bell':
        // 取件铃：双音“叮——叮”。
        this.tone(now, 1318.5, 0.34, 'sine', 0.08);
        this.tone(now + 0.14, 1760, 0.42, 'sine', 0.055);
        break;
      case 'spray':
        // 喷壶洒水：细长的气流声。
        this.noise(now, 0.24, 0.03);
        break;
      case 'stampThud':
        // 印章砸下：低频闷响加一点纸面震动。
        this.tone(now, 130, 0.16, 'sawtooth', 0.08, 46);
        this.noise(now, 0.1, 0.05);
        break;
      case 'scan':
        // 旧扫码枪：一声干脆的“滴”。
        this.tone(now, 1480, 0.09, 'square', 0.055, 1420);
        this.tone(now + 0.085, 1180, 0.16, 'sine', 0.045, 1160);
        break;
      default:
        break;
    }
  }

  /** 三连残影冲刺的四拍：1 是举章预警，2/3/4 分别贴着三次冲刺启动。 */
  playBossDashBeat(beat: BossDashBeat): void {
    if (!this.ctx || !this.master || this.muted || this.ctx.state !== 'running') {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      if (beat === 1) {
        this.stopBossDashCue();
      }
      const bus = this.bossDashBus ?? this.createBossDashBus(now);
      if (!bus) {
        return;
      }
      switch (beat) {
        case 1:
          // 章柄磕铁讲台：高频瞬态 + 不和谐金属泛音 + 短低频闷击。
          this.dashMetal(bus, now, 1174.66, 0.34, 0.11);
          this.dashTone(bus, now, 196, 0.1, 'triangle', 0.055, 92, 0.003);
          this.dashNoise(bus, now, 0.055, 0.09, 'highpass', 2500, 1200, 0.7);
          break;
        case 2:
          // 第一段：公章擦过金属导轨，短而亮。
          this.dashMetal(bus, now, 1396.91, 0.16, 0.055);
          this.dashTone(bus, now, 880, 0.18, 'sawtooth', 0.045, 380);
          this.dashNoise(bus, now, 0.2, 0.075, 'bandpass', 2200, 720, 1.4);
          this.dashTone(bus, now, 180, 0.17, 'triangle', 0.035, 70);
          break;
        case 3:
          // 第二段：同一条导轨，音高略低，保持同一件道具的质感。
          this.dashMetal(bus, now, 1244.51, 0.18, 0.06);
          this.dashTone(bus, now, 740, 0.2, 'sawtooth', 0.045, 320);
          this.dashNoise(bus, now, 0.22, 0.08, 'bandpass', 1900, 620, 1.3);
          this.dashTone(bus, now, 160, 0.18, 'triangle', 0.038, 62);
          break;
        case 4:
          // 第三段收尾：更厚的低频、更长的金属余响。
          this.dashMetal(bus, now, 1046.5, 0.62, 0.1);
          this.dashTone(bus, now, 174, 0.12, 'triangle', 0.07, 78, 0.003);
          this.dashNoise(bus, now, 0.32, 0.09, 'bandpass', 2400, 520, 1.1);
          this.dashTone(bus, now, 520, 0.34, 'sawtooth', 0.05, 160, 0.006);
          break;
        default:
          break;
      }
    } catch {
      // Ignore a failed cue; gameplay timing is unaffected.
    }
  }

  /** 取消招式或离开场景时，切断这一组四拍尚未结束的余响。 */
  stopBossDashCue(): void {
    const bus = this.bossDashBus;
    const sources = this.bossDashSources;
    this.bossDashBus = null;
    this.bossDashSources = [];
    if (!this.ctx || !bus) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(0.0001, now, 0.012);
      for (const source of sources) {
        try {
          source.stop(now + 0.06);
        } catch {
          // A source may already have ended.
        }
      }
      window.setTimeout(() => {
        try {
          bus.disconnect();
        } catch {
          // The bus may already be disconnected.
        }
      }, 140);
    } catch {
      // Ignore transient audio graph errors.
    }
  }

  private createBossDashBus(now: number): GainNode | null {
    if (!this.ctx || !this.master) {
      return null;
    }
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(1, now);
    bus.connect(this.master);
    this.bossDashBus = bus;
    this.bossDashSources = [];
    return bus;
  }

  private dashMetal(bus: GainNode, start: number, base: number, duration: number, volume: number): void {
    const partials = [
      { ratio: 1, level: 0.5, decay: 1 },
      { ratio: 1.58, level: 0.28, decay: 0.78 },
      { ratio: 2.38, level: 0.16, decay: 0.56 },
      { ratio: 3.17, level: 0.09, decay: 0.4 },
    ];
    for (const partial of partials) {
      this.dashTone(
        bus,
        start + (partial.ratio === 1 ? 0 : 0.002),
        base * partial.ratio,
        duration * partial.decay,
        'sine',
        volume * partial.level,
        undefined,
        0.003,
      );
    }
  }

  private dashTone(
    bus: GainNode,
    start: number,
    from: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    to?: number,
    attack = 0.008,
  ): void {
    if (!this.ctx) {
      return;
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.5));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(bus);
    this.trackBossDashSource(osc);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private dashNoise(
    bus: GainNode,
    start: number,
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    fromFreq: number,
    toFreq: number,
    q: number,
  ): void {
    if (!this.ctx) {
      return;
    }
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(fromFreq, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq), start + duration);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    this.trackBossDashSource(src);
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  private trackBossDashSource(source: AudioScheduledSourceNode): void {
    if (!this.bossDashBus) {
      return;
    }
    this.bossDashSources.push(source);
    source.addEventListener(
      'ended',
      () => {
        const index = this.bossDashSources.indexOf(source);
        if (index >= 0) {
          this.bossDashSources.splice(index, 1);
        }
      },
      { once: true },
    );
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
    if (!this.ctx || this.timer !== null || this.mode === 'none') {
      return;
    }
    try {
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.timer = window.setInterval(() => this.scheduleMusic(), 420);
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

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain || this.mode === 'none') {
      return;
    }
    if (this.ctx.state !== 'running') {
      return;
    }
    try {
      const tune = MELODIES[this.mode];
      const horizon = this.ctx.currentTime + 0.9;
      let guard = 0;
      while (this.nextNoteTime < horizon && guard < 8) {
        const index = this.step % tune.bass.length;
        const bassNote = tune.bass[index] ?? 0;
        const leadNote = tune.lead[index] ?? 0;
        if (index % 2 === 0 || this.mode === 'boss') {
          this.musicTone(this.nextNoteTime, this.midi(40 + bassNote), 0.11, 'triangle', 0.05);
        }
        this.musicTone(this.nextNoteTime + 0.02, this.midi(72 + leadNote), 0.07, 'square', 0.022);
        if (this.mode === 'boss' && index % 4 === 2) {
          this.noise(this.nextNoteTime, 0.05, 0.012);
        }
        this.nextNoteTime += tune.tempo;
        this.step += 1;
        guard += 1;
      }
    } catch {
      // Ignore music scheduling issues.
    }
  }

  private musicTone(
    start: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.ctx || !this.musicGain) {
      return;
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private midi(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }
}

export const audio = new AudioSystem();