import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import { COLORS, TEX } from '../config/theme';
import { audio } from '../systems/AudioSystem';
import type { TouchTarget } from '../ui/TouchControls';

export interface PlayerCallbacks {
  fireShot: (x: number, y: number, facing: 1 | -1) => void;
  dashTrail: (x: number, y: number) => void;
  jumped: (doubleJump: boolean) => void;
  damaged: (amount: number, hp: number) => void;
  died: () => void;
  shieldBroke: () => void;
}

interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key | null;
  right: Phaser.Input.Keyboard.Key | null;
  arrowLeft: Phaser.Input.Keyboard.Key | null;
  arrowRight: Phaser.Input.Keyboard.Key | null;
  jumps: Array<Phaser.Input.Keyboard.Key | null>;
  shoot: Phaser.Input.Keyboard.Key | null;
  dash: Phaser.Input.Keyboard.Key | null;
  shift: Phaser.Input.Keyboard.Key | null;
}

export class Player extends Phaser.Physics.Arcade.Sprite implements TouchTarget {
  private readonly callbacks: PlayerCallbacks;
  private readonly keys: PlayerKeys;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bubble: Phaser.GameObjects.Image;
  private hp: number;
  private readonly maxHp: number;
  private facing: 1 | -1 = 1;
  private controlEnabled = true;
  private dead = false;
  private touchMove: -1 | 0 | 1 = 0;
  private touchShoot = false;
  private jumpBufferedUntil = 0;
  private coyoteUntil = 0;
  private jumpsUsed = 0;
  private jumpCutFromKeyboard = false;
  private nextShotAt = 0;
  private nextDashAt = 0;
  private dashEndsAt = 0;
  private dashRequested = false;
  private dashing = false;
  private lastDashTrailAt = 0;
  private invulnUntil = 0;
  private shieldUntil = 0;
  private shieldCharges = 0;
  private attackSpeedUntil = 0;
  private attackSpeedValue = 1;
  private moveSpeedUntil = 0;
  private moveSpeedValue = 1;
  private dashFreeUntil = 0;
  private muzzle: Phaser.GameObjects.Image | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialHp: number,
    callbacks: PlayerCallbacks,
  ) {
    super(scene, x, y, TEX.raccoon);
    this.callbacks = callbacks;
    this.maxHp = PLAYER.maxHp;
    this.hp = Phaser.Math.Clamp(initialHp, 1, this.maxHp);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5);
    this.setScale(0.33);
    this.setDepth(30);
    this.setCollideWorldBounds(true);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(72, 150);
    body.setOffset(48, 60);
    body.setMaxVelocity(1200, 1400);
    body.setDrag(0, 0);

    this.shadow = scene.add.ellipse(x, y + 34, 52, 12, COLORS.coal, 0.32);
    this.shadow.setDepth(25);
    this.bubble = scene.add.image(x, y, 'tex-flare');
    this.bubble.setTint(COLORS.neon);
    this.bubble.setDisplaySize(118, 118);
    this.bubble.setAlpha(0);
    this.bubble.setDepth(29);

    const keyboard = scene.input.keyboard;
    this.keys = {
      left: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A) : null,
      right: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D) : null,
      arrowLeft: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT) : null,
      arrowRight: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT) : null,
      jumps: keyboard
        ? [
            keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
          ]
        : [],
      shoot: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J) : null,
      dash: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K) : null,
      shift: keyboard ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT) : null,
    };
  }

  tick(time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) {
      return;
    }
    if (this.dead) {
      this.setVelocityX(0);
      return;
    }

    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.coyoteUntil = time + PLAYER.coyoteMs;
      this.jumpsUsed = 0;
    }

    this.readKeyboardRequests();
    this.tryConsumeJump(time, grounded);
    this.tryConsumeDash(time);

    if (this.dashing) {
      this.updateDash(time);
    } else {
      this.updateMovement(delta, grounded);
      this.updateShooting(time);
    }

    this.updateFeel(time, grounded);
    this.updateBubble();
    this.shadow.setPosition(this.x, this.y + (this.dashing ? 38 : 34));
    this.shadow.setScale(this.dashing ? 0.82 : 1, this.dashing ? 0.8 : 1);
  }

  private readKeyboardRequests(): void {
    if (!this.controlEnabled) {
      return;
    }
    const jumpDown = this.keys.jumps.some((key) => key !== null && Phaser.Input.Keyboard.JustDown(key));
    if (jumpDown) {
      this.queueJump(true);
    }
    const dashKey = this.keys.dash;
    const shiftKey = this.keys.shift;
    const dashDown =
      (dashKey !== null && Phaser.Input.Keyboard.JustDown(dashKey)) ||
      (shiftKey !== null && Phaser.Input.Keyboard.JustDown(shiftKey));
    if (dashDown) {
      this.requestDash();
    }
  }

  private tryConsumeJump(time: number, grounded: boolean): void {
    if (!this.controlEnabled || this.jumpBufferedUntil <= time) {
      return;
    }
    const canGroundJump = grounded || this.coyoteUntil > time;
    if (canGroundJump) {
      this.jumpsUsed = 1;
      this.coyoteUntil = 0;
      this.setVelocityY(PLAYER.jumpVelocity);
      this.jumpBufferedUntil = 0;
      this.jumpCutFromKeyboard = this.isKeyboardJumpHeld();
      audio.play('jump');
      this.callbacks.jumped(false);
      return;
    }
    if (this.jumpsUsed < 2) {
      this.jumpsUsed = 2;
      this.jumpBufferedUntil = 0;
      this.setVelocityY(PLAYER.doubleJumpVelocity);
      this.jumpCutFromKeyboard = this.isKeyboardJumpHeld();
      audio.play('doubleJump');
      this.callbacks.jumped(true);
    }
  }

  private tryConsumeDash(time: number): void {
    if (!this.dashRequested) {
      return;
    }
    this.dashRequested = false;
    if (!this.controlEnabled || this.dashing) {
      return;
    }
    const dashFree = this.isDashFree(time);
    if (!dashFree && time < this.nextDashAt) {
      return;
    }
    this.dashing = true;
    this.dashEndsAt = time + PLAYER.dashDurationMs;
    this.lastDashTrailAt = 0;
    this.nextDashAt = time + PLAYER.dashCooldownMs;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.setVelocity(this.facing * PLAYER.dashSpeed, 0);
    this.invulnUntil = Math.max(this.invulnUntil, time + PLAYER.dashDurationMs + PLAYER.dashInvulnMs);
    audio.play('dash');
    this.callbacks.dashTrail(this.x - this.facing * 16, this.y + 8);
  }

  private updateDash(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setVelocity(this.facing * PLAYER.dashSpeed, 0);
    if (time - this.lastDashTrailAt > 42) {
      this.lastDashTrailAt = time;
      this.callbacks.dashTrail(this.x - this.facing * 18, this.y + Phaser.Math.Between(-12, 24));
    }
    if (time >= this.dashEndsAt) {
      this.dashing = false;
      body.setAllowGravity(true);
      this.setVelocityX(this.facing * PLAYER.moveSpeed * 0.55);
    }
  }

  private updateMovement(delta: number, grounded: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const left = this.keys.left?.isDown === true || this.keys.arrowLeft?.isDown === true;
    const right = this.keys.right?.isDown === true || this.keys.arrowRight?.isDown === true;
    const keyDirection = (right ? 1 : 0) - (left ? 1 : 0);
    const direction = keyDirection !== 0 ? keyDirection : this.touchMove;
    const target = this.controlEnabled ? direction * PLAYER.moveSpeed * this.getMoveMultiplier() : 0;
    const smoothing = 1 - Math.exp(-(grounded ? 22 : 12) * (delta / 1000));
    this.setVelocityX(Phaser.Math.Linear(body.velocity.x, target, smoothing));
    if (direction !== 0 && this.controlEnabled) {
      this.facing = direction > 0 ? 1 : -1;
      this.setFlipX(this.facing === -1);
    }
    const jumpHeld = this.keys.jumps.some((key) => key?.isDown === true);
    if (
      !this.dashing &&
      this.jumpCutFromKeyboard &&
      !jumpHeld &&
      body.velocity.y < -250
    ) {
      this.setVelocityY(-250);
      this.jumpCutFromKeyboard = false;
    }
  }

  private updateShooting(time: number): void {
    if (!this.controlEnabled) {
      return;
    }
    const shootHeld = this.keys.shoot?.isDown === true || this.touchShoot;
    if (!shootHeld || time < this.nextShotAt) {
      return;
    }
    this.nextShotAt = time + PLAYER.shootCooldownMs / this.getAttackMultiplier();
    audio.play('shoot');
    this.callbacks.fireShot(this.x + this.facing * 27, this.y - 12, this.facing);
    this.spawnMuzzle();
  }

  private updateFeel(time: number, grounded: boolean): void {
    if (this.dashing) {
      this.setAngle(this.facing * 7);
    } else if (!grounded) {
      this.setAngle(Phaser.Math.Clamp(this.facing * (this.body as Phaser.Physics.Arcade.Body).velocity.x / 90, -8, 8));
    } else {
      const body = this.body as Phaser.Physics.Arcade.Body;
      this.setAngle(Phaser.Math.Clamp(body.velocity.x / 130, -3, 3));
    }

    if (time < this.invulnUntil) {
      this.setAlpha(0.55 + Math.sin(time / 42) * 0.3);
    } else {
      this.setAlpha(1);
    }

    if (this.shieldUntil > 0 && time > this.shieldUntil) {
      this.shieldUntil = 0;
      this.shieldCharges = 0;
    }
  }

  private updateBubble(): void {
    const active = this.shieldCharges > 0 && this.scene.time.now < this.shieldUntil;
    this.bubble.setPosition(this.x, this.y);
    this.bubble.setVisible(active);
    if (active) {
      this.bubble.setAlpha(0.3 + Math.sin(this.scene.time.now / 130) * 0.08);
      this.bubble.setAngle(this.bubble.angle + 0.6);
    }
  }

  private isKeyboardJumpHeld(): boolean {
    return this.keys.jumps.some((key) => key?.isDown === true);
  }

  private queueJump(fromKeyboard: boolean): void {
    if (!this.controlEnabled || this.dead) {
      return;
    }
    this.jumpBufferedUntil = this.scene.time.now + PLAYER.jumpBufferMs;
    this.jumpCutFromKeyboard = fromKeyboard;
  }

  requestJump(): void {
    this.queueJump(false);
  }

  requestDash(): void {
    if (!this.controlEnabled || this.dead) {
      return;
    }
    this.dashRequested = true;
  }

  setTouchMove(direction: -1 | 0 | 1): void {
    this.touchMove = direction;
  }

  setTouchShoot(pressed: boolean): void {
    this.touchShoot = pressed;
  }

  setControlEnabled(enabled: boolean): void {
    this.controlEnabled = enabled;
    if (!enabled) {
      this.touchMove = 0;
      this.touchShoot = false;
      this.dashRequested = false;
    }
  }

  takeDamage(amount: number, sourceX?: number, ignoreInvuln = false): number {
    const now = this.scene.time.now;
    if (this.dead || (now < this.invulnUntil && !ignoreInvuln)) {
      return 0;
    }
    if (this.shieldCharges > 0 && now < this.shieldUntil) {
      this.shieldCharges = 0;
      this.shieldUntil = 0;
      this.invulnUntil = now + 650;
      this.setTint(COLORS.neon);
      this.scene.time.delayedCall(180, () => {
        if (this.active) {
          this.clearTint();
        }
      });
      this.callbacks.shieldBroke();
      audio.play('card');
      return 0;
    }

    const actual = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - actual);
    this.invulnUntil = now + PLAYER.invulnMs;
    this.setTintFill(0xfff7e4);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    const direction = sourceX !== undefined ? (this.x < sourceX ? -1 : 1) : -this.facing;
    this.setVelocity(direction * PLAYER.knockbackX, PLAYER.knockbackY);
    audio.play('hurt');
    this.callbacks.damaged(actual, this.hp);

    if (this.hp <= 0) {
      this.dead = true;
      this.setVelocity(0, 0);
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      this.setTint(COLORS.rust);
      this.callbacks.died();
    }
    return actual;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  healFull(): void {
    this.hp = this.maxHp;
  }

  grantShield(durationMs: number): void {
    this.shieldUntil = this.scene.time.now + durationMs;
    this.shieldCharges = 1;
  }

  grantAttackSpeed(multiplier: number, durationMs: number): void {
    this.attackSpeedUntil = this.scene.time.now + durationMs;
    this.attackSpeedValue = Math.max(this.getAttackMultiplier(), multiplier);
  }

  grantMoveSpeed(multiplier: number, durationMs: number): void {
    this.moveSpeedUntil = this.scene.time.now + durationMs;
    this.moveSpeedValue = Math.max(this.getMoveMultiplier(), multiplier);
  }

  grantDashFree(durationMs: number): void {
    this.dashFreeUntil = this.scene.time.now + durationMs;
  }

  isDashFree(time: number): boolean {
    return time < this.dashFreeUntil;
  }

  getAttackMultiplier(): number {
    return this.scene.time.now < this.attackSpeedUntil ? this.attackSpeedValue : 1;
  }

  getMoveMultiplier(): number {
    return this.scene.time.now < this.moveSpeedUntil ? this.moveSpeedValue : 1;
  }

  applyRespawn(x: number, y: number, invulnMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(true);
    this.dashing = false;
    this.dead = false;
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.setAlpha(1);
    this.clearTint();
    this.invulnUntil = this.scene.time.now + invulnMs;
  }

  getHp(): number {
    return this.hp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  isDead(): boolean {
    return this.dead;
  }

  getFacing(): 1 | -1 {
    return this.facing;
  }

  private spawnMuzzle(): void {
    if (this.muzzle?.active) {
      this.muzzle.destroy();
    }
    const image = this.scene.add.image(this.x + this.facing * 30, this.y - 12, 'tex-flare');
    image.setDepth(36);
    image.setDisplaySize(46, 30);
    image.setTint(COLORS.warning);
    image.setFlipX(this.facing === -1);
    this.muzzle = image;
    this.scene.tweens.add({
      targets: image,
      alpha: 0,
      scale: 1.5,
      duration: 90,
      onComplete: () => image.destroy(),
    });
  }
}