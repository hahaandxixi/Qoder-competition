import Phaser from 'phaser';
import { CARD } from '../config/balance';
import { COLORS, TEX } from '../config/theme';
import type { Player } from './Player';

export class Ally extends Phaser.GameObjects.Image {
  private readonly player: Player;
  private expiresAt: number;
  private readonly nextShot: () => boolean;
  private readonly fire: (x: number, y: number) => void;
  private nextShotAt = 0;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    durationMs: number,
    hasTarget: () => boolean,
    fire: (x: number, y: number) => void,
  ) {
    super(scene, player.x - 44, player.y - 64, TEX.ally);
    this.player = player;
    this.expiresAt = scene.time.now + durationMs;
    this.nextShot = hasTarget;
    this.fire = fire;
    scene.add.existing(this);
    this.setDepth(25);
    this.setTint(COLORS.paper);
    this.scene.tweens.add({
      targets: this,
      scale: { from: 0.4, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  tick(time: number): void {
    const targetX = this.player.x - 44;
    const targetY = this.player.y - 64 + Math.sin(time / 220) * 5;
    this.x = Phaser.Math.Linear(this.x, targetX, 0.1);
    this.y = Phaser.Math.Linear(this.y, targetY, 0.12);
    this.setFlipX(this.player.x < this.x);
    if (time >= this.expiresAt) {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        y: this.y - 20,
        duration: 220,
        onComplete: () => this.destroy(),
      });
      this.expiresAt = Number.POSITIVE_INFINITY;
      return;
    }
    if (time >= this.nextShotAt && this.nextShot()) {
      this.nextShotAt = time + CARD.allyShotCooldownMs;
      this.fire(this.x, this.y);
    }
  }
}