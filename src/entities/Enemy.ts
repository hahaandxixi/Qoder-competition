import Phaser from 'phaser';
import { ENEMY } from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS } from '../data';
import { audio } from '../systems/AudioSystem';
import type { Player } from './Player';

export type EnemyKind = 'opossum' | 'lobster';

export interface EnemyHost {
  getPlayer: () => Player;
  fireEnemyProjectile: (x: number, y: number) => void;
  onEnemyDefeated: (enemy: Enemy) => void;
  floatText: (x: number, y: number, text: string, color?: number) => void;
  burstAt: (x: number, y: number, color: number, count: number) => void;
}

type EnemyState = 'patrol' | 'windup' | 'lunge' | 'cooldown' | 'idle';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  private readonly host: EnemyHost;
  private readonly homeX: number;
  private readonly bodyWidth: number;
  private readonly patrolRange: number;
  private maxHp: number;
  private hp: number;
  private direction: 1 | -1 = -1;
  private aiState: EnemyState = 'patrol';
  private stateUntil = 0;
  private nextAttackAt = 0;
  private alive = true;
  private hasTaunted = false;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private hpBarVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, host: EnemyHost) {
    super(scene, x, y, kind === 'opossum' ? TEX.opossum : TEX.lobster);
    this.kind = kind;
    this.host = host;
    this.homeX = x;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.setCollideWorldBounds(true);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (kind === 'opossum') {
      this.maxHp = ENEMY.opossumHp;
      this.hp = this.maxHp;
      this.bodyWidth = 34;
      this.patrolRange = 120;
      body.setSize(34, 38);
      body.setOffset(10, 16);
      this.setFlipX(true);
    } else {
      this.maxHp = ENEMY.turretHp;
      this.hp = this.maxHp;
      this.bodyWidth = 42;
      this.patrolRange = 0;
      body.setSize(42, 36);
      body.setOffset(9, 15);
      this.aiState = 'idle';
    }
    body.setMaxVelocity(600, 1200);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(28);
    this.hpBar.setVisible(false);
  }

  tick(time: number): void {
    if (!this.alive) {
      return;
    }
    const player = this.host.getPlayer();
    const playerAlive = player.active && !player.isDead();
    if (!playerAlive) {
      if (this.kind === 'opossum' && this.aiState !== 'idle') {
        this.setVelocityX(0);
      }
      this.drawHpBar();
      return;
    }

    if (this.kind === 'opossum') {
      this.tickOpossum(time, player);
    } else {
      this.tickLobster(time, player);
    }
    this.drawHpBar();
  }

  private tickOpossum(time: number, player: Player): void {
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const inRange = Math.abs(dx) < ENEMY.opossumAggroRange && dy < 90;

    if (this.aiState === 'patrol') {
      if (inRange && time >= this.nextAttackAt) {
        this.aiState = 'windup';
        this.stateUntil = time + 310;
        this.setVelocityX(0);
        this.setFlipX(dx > 0);
        this.setTint(COLORS.warning);
        this.host.floatText(this.x, this.y - 58, STRINGS.enemy.opossumTaunt, COLORS.warning);
        this.host.burstAt(this.x, this.y - 20, COLORS.warning, 2);
        return;
      }
      if (this.x > this.homeX + this.patrolRange) {
        this.direction = -1;
      } else if (this.x < this.homeX - this.patrolRange) {
        this.direction = 1;
      }
      this.setVelocityX(this.direction * ENEMY.opossumSpeed);
      this.setFlipX(this.direction > 0);
      return;
    }

    if (this.aiState === 'windup') {
      if (time >= this.stateUntil) {
        this.aiState = 'lunge';
        this.stateUntil = time + ENEMY.opossumLungeMs;
        const lungeDirection = dx >= 0 ? 1 : -1;
        this.setVelocityX(lungeDirection * ENEMY.opossumLungeSpeed);
        this.setFlipX(lungeDirection < 0 ? false : true);
        this.clearTint();
      }
      return;
    }

    if (this.aiState === 'lunge') {
      if (time >= this.stateUntil) {
        this.aiState = 'cooldown';
        this.stateUntil = time + ENEMY.opossumCooldownMs;
        this.nextAttackAt = this.stateUntil;
        this.setVelocityX(0);
      }
      return;
    }

    if (this.aiState === 'cooldown') {
      this.setVelocityX(0);
      if (time >= this.stateUntil) {
        this.aiState = 'patrol';
      }
    }
  }

  private tickLobster(time: number, player: Player): void {
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    if (Math.abs(dx) > ENEMY.turretRange || dy > 220) {
      return;
    }
    if (!this.hasTaunted) {
      this.hasTaunted = true;
      this.host.floatText(this.x, this.y - 52, STRINGS.enemy.lobsterTaunt, COLORS.neon);
    }
    if (time >= this.nextAttackAt) {
      this.nextAttackAt = time + ENEMY.turretFireCooldownMs;
      this.host.fireEnemyProjectile(this.x + (dx > 0 ? 22 : -22), this.y - 10);
      this.setTintFill(COLORS.warning);
      this.scene.time.delayedCall(80, () => {
        if (this.active) {
          this.clearTint();
        }
      });
      audio.play('shoot');
    }
  }

  takeHit(damage: number, fromX: number): void {
    if (!this.alive) {
      return;
    }
    this.hp -= damage;
    this.hpBarVisible = true;
    this.setTintFill(0xfff7e4);
    this.scene.time.delayedCall(60, () => {
      if (this.active && this.alive) {
        this.clearTint();
      }
    });
    const direction = fromX < this.x ? 1 : -1;
    this.setVelocityX(direction * 90);
    audio.play('enemyHit');
    this.host.burstAt(this.x, this.y - 8, COLORS.warning, 5);
    if (this.hp <= 0) {
      this.die();
      return;
    }
    if (this.kind === 'opossum') {
      this.aiState = 'cooldown';
      this.stateUntil = this.scene.time.now + 400;
      this.nextAttackAt = this.stateUntil;
    }
  }

  private die(): void {
    this.alive = false;
    this.hpBar.destroy();
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    audio.play('enemyDown');
    this.host.burstAt(this.x, this.y - 8, COLORS.rust, 12);
    this.host.floatText(this.x, this.y - 40, STRINGS.enemy.hitLabel, COLORS.rust);
    this.scene.tweens.add({
      targets: this,
      angle: this.direction * 160,
      y: this.y + 18,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.host.onEnemyDefeated(this);
        this.destroy();
      },
    });
  }

  getContactDamage(): number {
    if (!this.alive) {
      return 0;
    }
    return this.aiState === 'lunge' ? ENEMY.opossumDamage : ENEMY.contactDamage;
  }

  isAlive(): boolean {
    return this.alive;
  }

  private drawHpBar(): void {
    if (!this.hpBarVisible || !this.alive) {
      this.hpBar.setVisible(false);
      return;
    }
    this.hpBar.setVisible(true);
    this.hpBar.setPosition(this.x - this.bodyWidth / 2, this.y - 48);
    this.hpBar.clear();
    this.hpBar.fillStyle(COLORS.coal, 0.9);
    this.hpBar.fillRect(0, 0, this.bodyWidth, 6);
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.hpBar.fillStyle(ratio > 0.45 ? COLORS.warning : COLORS.rust, 1);
    this.hpBar.fillRect(1, 1, (this.bodyWidth - 2) * ratio, 4);
    const tag = this.kind === 'opossum' ? STRINGS.enemy.opossumName : STRINGS.enemy.lobsterName;
    this.hpBar.lineStyle(1, COLORS.paper, 0.25);
    this.hpBar.strokeRect(0, 0, this.bodyWidth, 6);
    this.hpBar.fillStyle(COLORS.warning, 0.8);
    this.hpBar.fillRect(0, -8, Math.min(tag.length * 9, this.bodyWidth), 2);
  }
}

export function makeEnemyLabel(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Text {
  const label = scene.add.text(x, y, text, {
    fontFamily: FONTS.mono,
    fontSize: '10px',
    color: CSS.paperDim,
  });
  label.setOrigin(0.5);
  label.setAlpha(0.65);
  label.setDepth(26);
  return label;
}