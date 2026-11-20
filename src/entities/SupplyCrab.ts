import Phaser from 'phaser';
import { COLORS, TEX } from '../config/theme';
import { audio } from '../systems/AudioSystem';
import type { Player } from './Player';

export interface SupplyCrabHost {
  getPlayer: () => Player;
  onDefeated: (crab: SupplyCrab) => void;
  floatText: (x: number, y: number, text: string, color?: number) => void;
  burstAt: (x: number, y: number, color: number, count: number) => void;
}

type CrabState = 'patrol' | 'windup' | 'lunge' | 'cooldown';

export class SupplyCrab extends Phaser.Physics.Arcade.Sprite {
  private readonly host: SupplyCrabHost;
  private readonly homeX: number;
  private direction: 1 | -1 = -1;
  private mode: CrabState = 'patrol';
  private stateUntil = 0;
  private nextAttackAt = 0;
  private hp = 42;
  private alive = true;
  private readonly hpBar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, host: SupplyCrabHost) {
    super(scene, x, y, TEX.crab);
    this.host = host;
    this.homeX = x;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(21);
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(38, 26);
    body.setOffset(8, 9);
    body.setMaxVelocity(500, 1000);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(27);
    this.hpBar.setVisible(false);
  }

  tick(time: number): void {
    if (!this.alive) {
      return;
    }
    const player = this.host.getPlayer();
    if (!player.active || player.isDead()) {
      this.setVelocityX(0);
      return;
    }
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);

    if (this.mode === 'patrol') {
      if (Math.abs(dx) < 260 && dy < 100 && time >= this.nextAttackAt) {
        this.mode = 'windup';
        this.stateUntil = time + 430;
        this.setVelocityX(0);
        this.setFlipX(dx > 0);
        this.setTint(COLORS.warning);
        this.host.floatText(this.x, this.y - 46, '罐盖掀了！', COLORS.warning);
        this.host.burstAt(this.x, this.y - 18, COLORS.warning, 3);
        audio.play('canClink');
        return;
      }
      if (this.x > this.homeX + 110) {
        this.direction = -1;
      } else if (this.x < this.homeX - 110) {
        this.direction = 1;
      }
      this.setVelocityX(this.direction * 62);
      this.setFlipX(this.direction > 0);
      return;
    }

    if (this.mode === 'windup') {
      if (time >= this.stateUntil) {
        const lunge = (player.x >= this.x ? 1 : -1) as 1 | -1;
        this.mode = 'lunge';
        this.stateUntil = time + 230;
        this.setVelocityX(lunge * 320);
        this.setFlipX(lunge > 0);
        this.clearTint();
      }
      return;
    }

    if (this.mode === 'lunge') {
      if (time >= this.stateUntil) {
        this.mode = 'cooldown';
        this.stateUntil = time + 1100;
        this.nextAttackAt = this.stateUntil;
        this.setVelocityX(0);
      }
      return;
    }

    this.setVelocityX(0);
    if (time >= this.stateUntil) {
      this.mode = 'patrol';
    }
  }

  takeHit(damage: number, fromX: number): void {
    if (!this.alive) {
      return;
    }
    this.hp -= damage;
    this.hpBar.setVisible(true);
    this.setTintFill(COLORS.white);
    this.scene.time.delayedCall(60, () => {
      if (this.active && this.alive) {
        this.clearTint();
      }
    });
    this.setVelocityX(fromX < this.x ? 80 : -80);
    audio.play('enemyHit');
    this.host.burstAt(this.x, this.y - 8, COLORS.warning, 4);
    if (this.mode === 'windup') {
      this.mode = 'cooldown';
      this.stateUntil = this.scene.time.now + 500;
      this.nextAttackAt = this.stateUntil;
      this.clearTint();
      this.host.floatText(this.x, this.y - 42, '打断了！', COLORS.neon);
    }
    if (this.hp <= 0) {
      this.die();
      return;
    }
    this.drawHpBar();
  }

  getContactDamage(): number {
    if (!this.alive) {
      return 0;
    }
    return this.mode === 'lunge' ? 12 : 8;
  }

  isAlive(): boolean {
    return this.alive;
  }

  private die(): void {
    this.alive = false;
    this.hpBar.destroy();
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    audio.play('enemyDown');
    this.host.burstAt(this.x, this.y - 8, COLORS.rust, 10);
    this.scene.tweens.add({
      targets: this,
      angle: this.direction * 150,
      y: this.y + 18,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.host.onDefeated(this);
        this.destroy();
      },
    });
  }

  private drawHpBar(): void {
    if (!this.alive) {
      return;
    }
    this.hpBar.setPosition(this.x - 20, this.y - 42);
    this.hpBar.clear();
    this.hpBar.fillStyle(COLORS.coal, 0.9);
    this.hpBar.fillRect(0, 0, 40, 5);
    this.hpBar.fillStyle(COLORS.warning, 1);
    this.hpBar.fillRect(1, 1, 38 * Phaser.Math.Clamp(this.hp / 42, 0, 1), 3);
  }
}
