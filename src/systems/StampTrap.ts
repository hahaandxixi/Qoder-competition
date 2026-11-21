import Phaser from 'phaser';
import { TRAP } from '../config/balance';
import { COLORS, CSS, FONTS } from '../config/theme';
import { STRINGS } from '../data';
import { addHotTag, pixelBurst } from '../art/uiKit';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { audio } from './AudioSystem';

export interface StampTrapOptions {
  x: number;
  groundY: number;
  mode: 'demo' | 'live';
  player: () => Player;
  enemies: () => Enemy[];
  canTrigger: () => boolean;
  onTrigger?: () => void;
  onPlayerHit?: () => void;
  onSupply?: () => void;
  onEnemyCrush?: (enemy: Enemy) => void;
}

type TrapState = 'idle' | 'warning' | 'impact' | 'lifting' | 'spent';

export class StampTrap {
  private readonly scene: Phaser.Scene;
  private readonly options: StampTrapOptions;
  private readonly root: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Container;
  private readonly plate: Phaser.GameObjects.Container;
  private readonly sign: Phaser.GameObjects.Container;
  private readonly floorMarks: Phaser.GameObjects.Rectangle[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly baseY: number;
  private readonly impactY: number;
  private state: TrapState = 'idle';
  private demoStarted = false;
  private plateLatched = false;
  private supplyCollected = false;
  private supply: Phaser.GameObjects.Container | null = null;
  private demoBox: Phaser.GameObjects.Container | null = null;
  private shadowTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, options: StampTrapOptions) {
    this.scene = scene;
    this.options = options;
    this.baseY = options.groundY - 320;
    this.impactY = options.groundY - 38;

    this.buildFloorMarks();
    this.shadow = this.buildShadow();
    this.plate = this.buildPlate();
    this.root = this.buildStamp();
    this.sign = addHotTag(
      scene,
      options.x - 118,
      options.groundY - 282,
      STRINGS.level.stampDemoName,
      COLORS.warning,
      options.mode === 'demo' ? -0.04 : 0.02,
    );
    this.sign.setDepth(16);
    this.sign.setScale(0.82);
    if (options.mode === 'live') {
      this.supply = this.buildSupply();
    }
    if (options.mode === 'demo') {
      const hint = scene.add.text(118, 108, STRINGS.level.stampDemoHint, {
        fontFamily: FONTS.mono,
        fontSize: '10px',
        color: CSS.paperDim,
      });
      hint.setOrigin(0.5);
      hint.setAlpha(0.72);
      this.sign.add(hint);
    }
  }

  update(): void {
    if (this.options.mode === 'demo') {
      if (
        !this.demoStarted &&
        !this.options.player().isDead() &&
        Math.abs(this.options.player().x - this.options.x) < TRAP.stampDemoTriggerRadius
      ) {
        this.startDemo();
      }
      return;
    }

    if (this.state !== 'idle' || !this.options.canTrigger()) {
      return;
    }
    const player = this.options.player();
    if (player.isDead()) {
      return;
    }
    const plate = new Phaser.Geom.Rectangle(
      this.options.x - TRAP.stampPlateWidth / 2,
      this.options.groundY - 100,
      TRAP.stampPlateWidth,
      104,
    );
    const onPlate =
      player.y > this.options.groundY - 100 &&
      Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), plate);
    if (this.plateLatched) {
      if (!onPlate) {
        this.plateLatched = false;
      }
      return;
    }
    if (onPlate) {
      this.plateLatched = true;
      this.trigger();
    }
  }

  reset(): void {
    this.timers.splice(0).forEach((timer) => timer.remove(false));
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.shadow);
    this.scene.tweens.killTweensOf(this.plate);
    if (this.supply) {
      this.scene.tweens.killTweensOf(this.supply);
    }
    if (this.demoBox) {
      this.scene.tweens.killTweensOf(this.demoBox);
      this.demoBox.destroy(true);
      this.demoBox = null;
    }
    this.shadowTween?.stop();
    this.shadowTween = null;
    this.root.setY(this.baseY);
    this.shadow.setAlpha(0).setScale(0.45, 1);
    this.plate.setAlpha(1).setScale(1);
    this.plateLatched = false;
    this.state = this.options.mode === 'demo' ? 'spent' : 'idle';
    if (this.options.mode === 'demo') {
      this.demoStarted = true;
    }
  }

  destroy(): void {
    this.timers.splice(0).forEach((timer) => timer.remove(false));
    this.shadowTween?.stop();
    this.root.destroy(true);
    this.shadow.destroy(true);
    this.plate.destroy(true);
    this.sign.destroy(true);
    this.floorMarks.forEach((mark) => mark.destroy());
    this.supply?.destroy(true);
    this.demoBox?.destroy(true);
  }

  private trigger(): void {
    if (this.state !== 'idle') {
      return;
    }
    this.state = 'warning';
    audio.play('stampClick');
    this.flashPlate();
    this.options.onTrigger?.();
    this.collectSupply();
    this.shadow.setAlpha(0.2).setScale(0.45, 1);
    this.shadowTween = this.scene.tweens.add({
      targets: this.shadow,
      alpha: 0.95,
      scaleX: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.schedule(TRAP.stampDelayMs - TRAP.stampDropMs, () => this.startDrop());
    this.schedule(TRAP.stampDelayMs, () => this.impact());
  }

  private startDemo(): void {
    this.demoStarted = true;
    const box = this.scene.add.container(this.options.x - 190, this.options.groundY - 30);
    box.setDepth(15);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.paperDim, 1);
    g.fillRect(-28, -28, 56, 54);
    g.fillStyle(COLORS.warning, 0.85);
    g.fillRect(-4, -28, 8, 54);
    g.lineStyle(2, COLORS.coal, 0.85);
    g.strokeRect(-28, -28, 56, 54);
    box.add(g);
    const label = this.scene.add.text(0, 0, '空箱', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    box.add(label);
    this.demoBox = box;
    audio.play('signScrape');
    this.scene.tweens.add({
      targets: box,
      x: this.options.x,
      duration: 720,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!box.active) {
          return;
        }
        this.state = 'idle';
        this.trigger();
      },
    });
  }

  private startDrop(): void {
    this.scene.tweens.add({
      targets: this.root,
      y: this.impactY,
      duration: TRAP.stampDropMs,
      ease: 'Cubic.easeIn',
    });
  }

  private impact(): void {
    if (this.state !== 'warning') {
      return;
    }
    this.state = 'impact';
    audio.play('stampThud');
    this.scene.cameras.main.shake(170, 0.011);
    pixelBurst(this.scene, this.options.x, this.options.groundY - 10, COLORS.rust, 14, 1.3);
    this.shadow.setAlpha(1).setScale(1.06, 1);
    if (this.options.mode === 'live') {
      this.resolveHit();
    }
    if (this.demoBox) {
      this.scene.tweens.add({
        targets: this.demoBox,
        scaleY: 0.12,
        x: this.options.x + 140,
        alpha: 0,
        duration: 520,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.demoBox?.destroy(true);
          this.demoBox = null;
        },
      });
    }
    this.schedule(TRAP.stampLiftDelayMs, () => this.lift());
  }

  private resolveHit(): void {
    const shadow = new Phaser.Geom.Rectangle(
      this.options.x - TRAP.stampShadowWidth / 2,
      this.options.groundY - 70,
      TRAP.stampShadowWidth,
      72,
    );
    const player = this.options.player();
    if (!player.isDead() && Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), shadow)) {
      this.options.onPlayerHit?.();
    }
    for (const enemy of this.options.enemies()) {
      if (!enemy.active || !enemy.isAlive()) {
        continue;
      }
      if (Phaser.Geom.Intersects.RectangleToRectangle(enemy.getBounds(), shadow)) {
        this.options.onEnemyCrush?.(enemy);
      }
    }
  }

  private lift(): void {
    if (this.state === 'spent') {
      return;
    }
    this.state = 'lifting';
    this.scene.tweens.add({
      targets: this.shadow,
      alpha: 0,
      scaleX: 0.45,
      duration: 240,
      ease: 'Sine.easeIn',
    });
    this.scene.tweens.add({
      targets: this.root,
      y: this.baseY,
      duration: TRAP.stampLiftMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.root.setY(this.baseY);
        this.state = this.options.mode === 'demo' ? 'spent' : 'idle';
        this.plate.setAlpha(1).setScale(1);
        if (this.options.mode === 'demo' && this.supply) {
          this.supply.destroy(true);
          this.supply = null;
        }
      },
    });
  }

  private collectSupply(): void {
    if (this.options.mode !== 'live' || this.supplyCollected || !this.supply) {
      return;
    }
    this.supplyCollected = true;
    this.options.onSupply?.();
    const supply = this.supply;
    this.scene.tweens.add({
      targets: supply,
      x: this.options.player().x,
      y: this.options.player().y - 18,
      alpha: 0,
      scale: 0.4,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => supply.destroy(true),
    });
    this.supply = null;
  }

  private flashPlate(): void {
    this.plate.setAlpha(1);
    this.scene.tweens.add({
      targets: this.plate,
      alpha: 0.45,
      duration: 120,
      yoyo: true,
      repeat: 2,
    });
  }

  private buildFloorMarks(): void {
    const offsets = [-62, -34, -6, 24, 52];
    offsets.forEach((offset, index) => {
      const mark = this.scene.add.rectangle(
        this.options.x + offset,
        this.options.groundY - 3,
        54 + (index % 2) * 6,
        22,
        0x000000,
        0,
      );
      mark.setStrokeStyle(3, COLORS.rust, 0.5);
      mark.setAngle(-0.12 + index * 0.05);
      mark.setDepth(9);
      this.floorMarks.push(mark);
    });
  }

  private buildShadow(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.x, this.options.groundY - 7);
    root.setDepth(8);
    root.setAlpha(0);
    root.setScale(0.45, 1);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.rust, 0.28);
    g.fillRect(-TRAP.stampShadowWidth / 2, -10, TRAP.stampShadowWidth, 20);
    g.lineStyle(2, COLORS.rust, 0.8);
    g.strokeRect(-TRAP.stampShadowWidth / 2, -10, TRAP.stampShadowWidth, 20);
    const label = this.scene.add.text(0, 0, STRINGS.level.stampMark, {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setAngle(-0.06);
    root.add([g, label]);
    return root;
  }

  private buildPlate(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.x, this.options.groundY - 4);
    root.setDepth(10);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.56);
    g.fillRect(-TRAP.stampPlateWidth / 2, -7, TRAP.stampPlateWidth, 14);
    g.lineStyle(2, COLORS.warning, 0.9);
    g.strokeRect(-TRAP.stampPlateWidth / 2, -7, TRAP.stampPlateWidth, 14);
    g.fillStyle(COLORS.warning, 0.9);
    for (let x = -34; x <= 34; x += 17) {
      g.fillTriangle(x - 5, 2, x + 5, 2, x, -4);
    }
    const label = this.scene.add.text(0, -20, this.options.mode === 'demo' ? '空箱压板' : '补给压板', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.warning,
    });
    label.setOrigin(0.5);
    root.add([g, label]);
    return root;
  }

  private buildStamp(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.x, this.baseY);
    root.setDepth(17);
    const g = this.scene.add.graphics();
    g.lineStyle(3, COLORS.coal, 0.9);
    g.lineBetween(0, -190, 0, -64);
    g.lineStyle(1, COLORS.paperDim, 0.55);
    g.lineBetween(-4, -190, -4, -64);
    g.fillStyle(COLORS.coal, 0.98);
    g.fillRoundedRect(-62, -64, 124, 30, 7);
    g.fillStyle(COLORS.rust, 1);
    g.fillRoundedRect(-72, -36, 144, 72, 4);
    g.lineStyle(3, COLORS.coal, 0.95);
    g.strokeRoundedRect(-72, -36, 144, 72, 4);
    g.fillStyle(COLORS.paper, 0.2);
    g.fillRect(-64, -28, 128, 4);
    const face = this.scene.add.text(0, 10, STRINGS.level.stampMark, {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    face.setOrigin(0.5);
    face.setAngle(-0.06);
    const tag = this.scene.add.text(0, -108, 'EXPRESS // 已签收', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    tag.setOrigin(0.5);
    tag.setAlpha(0.75);
    root.add([g, face, tag]);
    return root;
  }

  private buildSupply(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.x + 34, this.options.groundY - 32);
    root.setDepth(15);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.paperDim, 1);
    g.fillRect(-22, -22, 44, 40);
    g.fillStyle(COLORS.warning, 0.95);
    g.fillRect(-4, -22, 8, 40);
    g.lineStyle(2, COLORS.coal, 0.85);
    g.strokeRect(-22, -22, 44, 40);
    g.fillStyle(COLORS.neon, 0.22);
    g.fillCircle(0, -2, 28);
    const label = this.scene.add.text(0, -2, '补给', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    root.add([g, label]);
    this.scene.tweens.add({
      targets: root,
      y: root.y - 5,
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return root;
  }

  private schedule(delay: number, callback: () => void): void {
    const timer = this.scene.time.delayedCall(delay, () => {
      const index = this.timers.indexOf(timer);
      if (index >= 0) {
        this.timers.splice(index, 1);
      }
      callback();
    });
    this.timers.push(timer);
  }
}