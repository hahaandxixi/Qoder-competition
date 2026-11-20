import Phaser from 'phaser';
import { BOSS } from '../config/balance';
import { COLORS, TEX } from '../config/theme';
import { BOSS_ZHEN } from '../data';
import type { BossConfig, BossPhase } from '../types/game';
import { audio } from '../systems/AudioSystem';

export interface BossHost {
  burstAt: (x: number, y: number, color: number, count: number) => void;
  floatText: (x: number, y: number, text: string, color?: number) => void;
  onPhaseReached: (phase: BossPhase) => void;
  onStaggered: () => void;
  onFakeVictory: () => void;
  onDefeated: () => void;
}

export interface BossOptions {
  config: BossConfig;
  texture: string;
  glitchTexture: string;
  glitchTint: number;
  bodyWidth: number;
  bodyHeight: number;
  bodyOffsetX: number;
  bodyOffsetY: number;
}

const DEFAULT_BOSS_OPTIONS: BossOptions = {
  config: BOSS_ZHEN,
  texture: TEX.boss,
  glitchTexture: TEX.bossGlitch,
  glitchTint: COLORS.neon,
  bodyWidth: 112,
  bodyHeight: 176,
  bodyOffsetX: 34,
  bodyOffsetY: 30,
};

export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly config: BossConfig;
  private readonly host: BossHost;
  private readonly firstBarMax: number;
  private maxHp: number;
  private hp: number;
  private bar: 1 | 2 = 1;
  private secondBarStarted = false;
  private awaitingSecondBar = false;
  private phaseIndex = 0;
  private staggerUntil = 0;
  private invulnUntil = 0;
  private dead = false;
  private lastHitSoundAt = 0;
  private readonly glitch: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, host: BossHost, options: Partial<BossOptions> = {}) {
    const settings = { ...DEFAULT_BOSS_OPTIONS, ...options };
    super(scene, x, y, settings.texture);
    this.config = settings.config;
    this.host = host;
    this.firstBarMax = this.config.hp;
    this.maxHp = this.config.hp;
    this.hp = this.maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(24);
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(settings.bodyWidth, settings.bodyHeight);
    body.setOffset(settings.bodyOffsetX, settings.bodyOffsetY);
    body.setMaxVelocity(1000, 1000);

    this.glitch = scene.add.image(x + 8, y - 4, settings.glitchTexture);
    this.glitch.setDepth(23);
    this.glitch.setAlpha(0.55);
    this.glitch.setTint(settings.glitchTint);
  }

  tick(time: number): void {
    if (!this.active) {
      return;
    }
    if (!this.dead && !this.awaitingSecondBar) {
      this.setAngle(Math.sin(time / 520) * 1.4);
      if (time < this.staggerUntil) {
        this.glitch.setAlpha(0.8);
        this.glitch.setX(this.x + Math.sin(time / 40) * 10);
        this.glitch.setY(this.y + Math.cos(time / 46) * 6);
      } else {
        this.glitch.setAlpha(0.35 + Math.sin(time / 210) * 0.12);
        this.glitch.setX(this.x + Math.sin(time / 900) * 7);
        this.glitch.setY(this.y + Math.cos(time / 760) * 4);
      }
      this.glitch.setAngle(this.angle * 1.5);
    }
  }

  takeDamage(amount: number): number {
    const now = this.scene.time.now;
    if (this.dead || this.awaitingSecondBar || now < this.invulnUntil) {
      return 0;
    }
    const actual = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - actual);
    this.setTintFill(0xfff7e4);
    this.scene.time.delayedCall(60, () => {
      if (this.active && !this.dead && !this.awaitingSecondBar) {
        this.clearTint();
      }
    });
    this.host.burstAt(this.x, this.y - 20, COLORS.warning, 5);
    if (now - this.lastHitSoundAt > 90) {
      this.lastHitSoundAt = now;
      audio.play('hitBoss');
    }

    if (this.hp <= 0) {
      if (this.bar === 1 && this.hasSecondBar()) {
        this.hp = 0;
        this.awaitingSecondBar = true;
        this.invulnUntil = Number.MAX_SAFE_INTEGER;
        this.host.onFakeVictory();
      } else {
        this.beginDeath();
      }
      return actual;
    }

    const previousPhase = this.phaseIndex;
    while (this.phaseIndex < this.config.phases.length - 1) {
      const next = this.config.phases[this.phaseIndex + 1];
      if (!next || (next.bar ?? 1) !== this.bar) {
        break;
      }
      if (this.hp / this.maxHp <= next.fromHpPct) {
        this.phaseIndex += 1;
      } else {
        break;
      }
    }
    if (this.phaseIndex !== previousPhase) {
      this.host.onPhaseReached(this.getPhaseConfig());
    }
    return actual;
  }

  hasSecondBar(): boolean {
    return this.config.phases.some((phase) => phase.bar === 2);
  }

  startSecondBar(): void {
    if (this.dead || this.secondBarStarted || !this.hasSecondBar()) {
      return;
    }
    this.secondBarStarted = true;
    this.awaitingSecondBar = false;
    this.bar = 2;
    this.maxHp = this.firstBarMax * 2;
    this.hp = this.maxHp;
    const nextBarIndex = this.config.phases.findIndex((phase) => phase.bar === 2);
    if (nextBarIndex >= 0) {
      this.phaseIndex = nextBarIndex;
    }
    this.invulnUntil = this.scene.time.now + 900;
    this.clearTint();
    this.setAlpha(1);
    this.setAngle(0);
    this.setVisible(true);
    this.glitch.setVisible(true);
    this.host.floatText(this.x, this.y - 150, '血条展开：×2', COLORS.neon);
  }

  private beginDeath(): void {
    if (this.dead) {
      return;
    }
    this.dead = true;
    this.awaitingSecondBar = false;
    this.staggerUntil = 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.glitch.destroy();
    this.host.onDefeated();
  }

  setStagger(durationMs: number): void {
    if (this.dead || this.awaitingSecondBar) {
      return;
    }
    this.staggerUntil = this.scene.time.now + durationMs;
    this.setVelocity(0, 0);
    this.setTint(COLORS.neon);
    this.scene.time.delayedCall(durationMs, () => {
      if (this.active && !this.dead) {
        this.clearTint();
      }
    });
    this.host.onStaggered();
    audio.play('stagger');
  }

  setInvulnerable(durationMs: number): void {
    this.invulnUntil = this.scene.time.now + durationMs;
  }

  setPresentationVisible(visible: boolean): void {
    this.setVisible(visible);
    this.glitch.setVisible(visible);
  }

  isStaggered(time: number): boolean {
    return !this.dead && time < this.staggerUntil;
  }

  isDead(): boolean {
    return this.dead;
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getFirstBarMax(): number {
    return this.firstBarMax;
  }

  getBar(): 1 | 2 {
    return this.bar;
  }

  getTotalBars(): number {
    return this.hasSecondBar() ? 2 : 1;
  }

  isAwaitingSecondBar(): boolean {
    return this.awaitingSecondBar;
  }

  getPhaseConfig(): BossPhase {
    return this.config.phases[this.phaseIndex] ?? this.config.phases[0] ?? {
      phase: 1,
      fromHpPct: 1,
      attackIntervalMs: 2000,
      parryQuestionId: 'parry_yaoyao',
      attackPool: ['aimed_shots'],
      staggerMs: BOSS.staggerMs,
      label: '常规发布',
    };
  }

  getPhaseNumber(): number {
    return this.getPhaseConfig().phase;
  }

  getPhaseIndex(): number {
    return this.phaseIndex;
  }

  getMaxPhases(): number {
    return this.config.phases.length;
  }

  getSpellStartX(): number {
    return this.x;
  }

  destroyBoss(): void {
    if (this.glitch.active) {
      this.glitch.destroy();
    }
    this.destroy();
  }
}