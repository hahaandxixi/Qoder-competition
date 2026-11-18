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
  onDefeated: () => void;
}

export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly config: BossConfig;
  private readonly host: BossHost;
  private readonly maxHp: number;
  private hp: number;
  private phaseIndex = 0;
  private staggerUntil = 0;
  private invulnUntil = 0;
  private dead = false;
  private lastHitSoundAt = 0;
  private readonly glitch: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, host: BossHost) {
    super(scene, x, y, TEX.boss);
    this.config = BOSS_ZHEN;
    this.host = host;
    this.maxHp = this.config.hp;
    this.hp = this.maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(24);
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(112, 176);
    body.setOffset(34, 30);
    body.setMaxVelocity(1000, 1000);

    this.glitch = scene.add.image(x + 8, y - 4, TEX.bossGlitch);
    this.glitch.setDepth(23);
    this.glitch.setAlpha(0.55);
    this.glitch.setTint(COLORS.neon);
  }

  tick(time: number): void {
    if (!this.active) {
      return;
    }
    if (!this.dead) {
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
    if (this.dead || now < this.invulnUntil) {
      return 0;
    }
    const actual = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - actual);
    this.setTintFill(0xfff7e4);
    this.scene.time.delayedCall(60, () => {
      if (this.active && !this.dead) {
        this.clearTint();
      }
    });
    this.host.burstAt(this.x, this.y - 20, COLORS.warning, 5);
    if (now - this.lastHitSoundAt > 90) {
      this.lastHitSoundAt = now;
      audio.play('hitBoss');
    }

    const previousPhase = this.phaseIndex;
    while (this.phaseIndex < this.config.phases.length - 1) {
      const next = this.config.phases[this.phaseIndex + 1];
      if (next && this.hp / this.maxHp <= next.fromHpPct) {
        this.phaseIndex += 1;
      } else {
        break;
      }
    }
    if (this.phaseIndex !== previousPhase && this.hp > 0) {
      this.host.onPhaseReached(this.getPhaseConfig());
    }

    if (this.hp <= 0) {
      this.beginDeath();
    }
    return actual;
  }

  private beginDeath(): void {
    if (this.dead) {
      return;
    }
    this.dead = true;
    this.staggerUntil = 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.glitch.destroy();
    this.host.onDefeated();
  }

  setStagger(durationMs: number): void {
    if (this.dead) {
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