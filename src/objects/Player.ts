import Phaser from 'phaser';
import type { CardKind } from '../types';

interface Keys {
  A: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  SPACE: Phaser.Input.Keyboard.Key;
  J: Phaser.Input.Keyboard.Key;
  K: Phaser.Input.Keyboard.Key;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  maxHp = 100;
  hp = 100;
  facing: 1 | -1 = 1;

  private keys: Keys;
  private onShoot: (x: number, y: number, dir: number, dmg: number) => void;
  private invulnUntil = 0;
  private lastGroundedAt = -9999;
  private jumpBufferedUntil = -9999;
  private jumpsUsed = 0;
  private dashReadyAt = 0;
  private nextShotAt = 0;
  private speedUntil = 0;
  private damageUntil = 0;
  private hurtTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onShoot: (x: number, y: number, dir: number, dmg: number) => void,
  ) {
    super(scene, x, y, 'raccoon');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.onShoot = onShoot;
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 20).setOffset(4, 4);
    this.keys = scene.input.keyboard!.addKeys({
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      J: Phaser.Input.Keyboard.KeyCodes.J,
      K: Phaser.Input.Keyboard.KeyCodes.K,
    }) as unknown as Keys;
  }

  update(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.jumpsUsed = 0;
      this.lastGroundedAt = time;
    }

    const maxSpeed = 270 * (time < this.speedUntil ? 1.45 : 1);
    const dir = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const accel = grounded ? 2400 : 1550;
    if (dir !== 0) {
      this.facing = dir > 0 ? 1 : -1;
      body.setAccelerationX(dir * accel);
      body.setDragX(0);
    } else {
      body.setAccelerationX(0);
      body.setDragX(1900);
    }
    body.setMaxVelocity(maxSpeed, 1250);
    this.setFlipX(this.facing < 0);

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.jumpBufferedUntil = time + 120;
    }
    if (this.jumpBufferedUntil > time) {
      if (grounded || time - this.lastGroundedAt < 110) {
        if (this.jumpsUsed === 0) {
          body.setVelocityY(-640);
          this.jumpsUsed = 1;
          this.jumpBufferedUntil = -9999;
        }
      } else if (this.jumpsUsed < 2) {
        body.setVelocityY(-560);
        this.jumpsUsed = 2;
        this.jumpBufferedUntil = -9999;
      }
    }
    if (!this.keys.SPACE.isDown && body.velocity.y < -260) {
      body.setVelocityY(-260);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.K) && time > this.dashReadyAt) {
      this.dashReadyAt = time + 850;
      body.setVelocityX(this.facing * 560);
      this.invulnUntil = Math.max(this.invulnUntil, time + 320);
    }

    if (this.keys.J.isDown && time > this.nextShotAt) {
      this.nextShotAt = time + 140;
      const dmg = time < this.damageUntil ? 24 : 12;
      this.onShoot(this.x + this.facing * 14, this.y, this.facing, dmg);
    }
  }

  hurt(amount: number, fromX: number): void {
    const time = this.scene.time.now;
    if (time < this.invulnUntil || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + 900;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(this.x < fromX ? -260 : 260, -240);
    this.scene.cameras.main.shake(120, 0.004);
    this.hurtTween?.stop();
    this.setAlpha(0.35);
    this.hurtTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 120,
      yoyo: true,
      repeat: 4,
    });
  }

  applyCard(kind: CardKind): void {
    const time = this.scene.time.now;
    if (kind === 'heal') this.hp = this.maxHp;
    if (kind === 'damage') this.damageUntil = time + 6000;
    if (kind === 'speed') this.speedUntil = time + 6000;
  }

  respawnAt(x: number, y: number): void {
    this.setPosition(x, y);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }
}