import Phaser from 'phaser';
import { TRAP } from '../config/balance';
import { COLORS, CSS, FONTS } from '../config/theme';
import { STRINGS } from '../data';
import { addHotTag } from '../art/uiKit';
import type { Player } from '../entities/Player';
import { audio } from './AudioSystem';

export interface ReturnParcelTrapOptions {
  spawnX: number;
  chuteX: number;
  pathY: number;
  groundY: number;
  triggerX: number;
  demoTriggerX: number;
  player: () => Player;
  canTrigger: () => boolean;
  onPlayerHit: () => number;
  onToast: (text: string, tone: 'paper' | 'rust' | 'neon') => void;
  onDemoStart: () => void;
  onDemoEnd: () => void;
}

type ParcelKind = 'outbound' | 'return';
type TrapState = 'idle' | 'warning' | 'outbound' | 'rewind' | 'return' | 'cooldown' | 'demo';

export class ReturnParcelTrap {
  private readonly scene: Phaser.Scene;
  private readonly options: ReturnParcelTrapOptions;
  private readonly chute: Phaser.GameObjects.Container;
  private readonly outlet: Phaser.GameObjects.Container;
  private readonly guide: Phaser.GameObjects.Container;
  private readonly sign: Phaser.GameObjects.Container;
  private readonly safeMark: Phaser.GameObjects.Container;
  private readonly triggerPad: Phaser.GameObjects.Container;
  private readonly chuteLight: Phaser.GameObjects.Arc;
  private readonly outletLight: Phaser.GameObjects.Arc;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private activeParcel: Phaser.GameObjects.Container | null = null;
  private activeTween: Phaser.Tweens.Tween | null = null;
  private activeKind: ParcelKind | null = null;
  private activePractice = false;
  private parcelHit = false;
  private demoDone = false;
  private demoActive = false;
  private triggerLatched = false;
  private realHintShown = false;
  private state: TrapState = 'idle';
  private stateUntil = 0;

  constructor(scene: Phaser.Scene, options: ReturnParcelTrapOptions) {
    this.scene = scene;
    this.options = options;
    this.guide = this.buildGuide();
    this.chute = this.buildChute();
    this.chuteLight = this.chute.getByName('light') as Phaser.GameObjects.Arc;
    this.outlet = this.buildOutlet();
    this.outletLight = this.outlet.getByName('light') as Phaser.GameObjects.Arc;
    this.sign = this.buildSign();
    this.safeMark = this.buildSafeMark();
    this.triggerPad = this.buildTriggerPad();
  }

  update(time: number): void {
    if (this.state === 'cooldown') {
      if (time >= this.stateUntil) {
        this.state = 'idle';
        this.chuteLight.setFillStyle(COLORS.neon, 0.9);
        this.outletLight.setFillStyle(COLORS.warning, 0.8);
      }
      return;
    }

    if (this.state !== 'idle') {
      this.checkParcelHit();
      return;
    }

    if (!this.options.canTrigger()) {
      return;
    }

    const player = this.options.player();
    if (player.isDead()) {
      return;
    }

    if (!this.demoDone) {
      if (player.x >= this.options.demoTriggerX - 18 && player.y > this.options.groundY - 110) {
        this.startDemo();
      }
      return;
    }

    if (this.triggerLatched) {
      if (player.x > this.options.triggerX + 28 || player.x < this.options.triggerX - 48) {
        this.triggerLatched = false;
      }
      return;
    }

    if (player.x >= this.options.triggerX - 8 && player.y > this.options.groundY - 110) {
      this.triggerLatched = true;
      this.startRealCycle();
    }
  }

  reset(): void {
    this.timers.splice(0).forEach((timer) => timer.remove(false));
    this.stopParcel();
    if (this.demoActive) {
      this.demoActive = false;
      this.options.onDemoEnd();
    }
    this.state = 'idle';
    this.triggerLatched = false;
    this.chuteLight.setFillStyle(COLORS.neon, 0.9);
    this.outletLight.setFillStyle(COLORS.warning, 0.8);
    this.triggerPad.setAlpha(1).setScale(1);
  }

  destroy(): void {
    this.timers.splice(0).forEach((timer) => timer.remove(false));
    this.stopParcel();
    this.guide.destroy();
    this.chute.destroy(true);
    this.outlet.destroy(true);
    this.sign.destroy(true);
    this.safeMark.destroy(true);
    this.triggerPad.destroy(true);
  }

  private startDemo(): void {
    if (this.demoActive || this.demoDone) {
      return;
    }
    this.demoActive = true;
    this.state = 'demo';
    this.options.onDemoStart();
    this.options.onToast(STRINGS.act2.returnDemo, 'paper');
    audio.play('select');
    this.outletLight.setFillStyle(COLORS.neon, 1);
    this.launchParcel('outbound', true);
  }

  private startRealCycle(): void {
    if (this.state !== 'idle' || !this.demoDone) {
      return;
    }
    this.state = 'warning';
    this.triggerPad.setAlpha(0.45).setScale(0.96);
    audio.play('stampClick');
    this.scene.tweens.add({
      targets: this.triggerPad,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
    if (!this.realHintShown) {
      this.realHintShown = true;
      this.options.onToast(STRINGS.act2.returnTrigger, 'paper');
    }
    this.outletLight.setFillStyle(COLORS.rust, 1);
    this.schedule(TRAP.returnLaunchDelayMs, () => {
      if (this.state !== 'warning') {
        return;
      }
      this.state = 'outbound';
      this.launchParcel('outbound', false);
    });
  }

  private launchParcel(kind: ParcelKind, practice: boolean): void {
    this.stopParcel();
    this.activeKind = kind;
    this.activePractice = practice;
    this.parcelHit = false;
    const startX = kind === 'outbound' ? this.options.spawnX : this.options.chuteX;
    const endX = kind === 'outbound' ? this.options.chuteX : this.options.spawnX;
    const duration = practice
      ? kind === 'outbound'
        ? TRAP.returnDemoOutboundMs
        : TRAP.returnDemoReturnMs
      : kind === 'outbound'
        ? TRAP.returnOutboundMs
        : TRAP.returnReturnMs;
    const parcel = this.makeParcel(kind, practice);
    parcel.setPosition(startX, this.options.pathY);
    this.activeParcel = parcel;
    audio.play('parcelWhoosh');
    this.activeTween = this.scene.tweens.add({
      targets: parcel,
      x: endX,
      duration,
      ease: 'Linear',
      onComplete: () => {
        if (this.activeParcel !== parcel) {
          return;
        }
        this.stopParcel();
        this.onParcelArrived(kind, practice);
      },
    });
  }

  private onParcelArrived(kind: ParcelKind, practice: boolean): void {
    if (practice) {
      if (kind === 'outbound') {
        this.chuteLight.setFillStyle(COLORS.rust, 1);
        audio.play('rewind');
        this.schedule(TRAP.returnDemoRewindMs, () => {
          this.state = 'demo';
          this.launchParcel('return', true);
        });
        return;
      }
      this.demoActive = false;
      this.demoDone = true;
      this.state = 'idle';
      this.chuteLight.setFillStyle(COLORS.neon, 0.9);
      this.outletLight.setFillStyle(COLORS.warning, 0.8);
      this.options.onDemoEnd();
      this.options.onToast(STRINGS.act2.returnReady, 'paper');
      return;
    }

    if (kind === 'outbound') {
      this.state = 'rewind';
      this.chuteLight.setFillStyle(COLORS.rust, 1);
      audio.play('rewind');
      this.schedule(TRAP.returnRewindMs, () => {
        if (this.state !== 'rewind') {
          return;
        }
        this.state = 'return';
        this.chuteLight.setFillStyle(COLORS.warning, 1);
        this.launchParcel('return', false);
        this.options.onToast(STRINGS.act2.returnLock, 'rust');
      });
      return;
    }

    this.state = 'cooldown';
    this.stateUntil = this.scene.time.now + TRAP.returnCooldownMs;
    this.chuteLight.setFillStyle(COLORS.neon, 0.9);
    this.outletLight.setFillStyle(COLORS.warning, 0.8);
    if (!this.parcelHit) {
      this.options.onToast(STRINGS.act2.returnSafe, 'neon');
    }
  }

  private checkParcelHit(): void {
    const parcel = this.activeParcel;
    if (!parcel || this.parcelHit || this.activePractice) {
      return;
    }
    if (this.activeKind !== 'outbound' && this.activeKind !== 'return') {
      return;
    }
    const player = this.options.player();
    if (player.isDead()) {
      return;
    }
    const hitbox = new Phaser.Geom.Rectangle(parcel.x - 30, parcel.y - 18, 60, 44);
    if (!Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), hitbox)) {
      return;
    }
    this.parcelHit = true;
    const actual = this.options.onPlayerHit();
    audio.play('canClink');
    const hitText =
      this.activeKind === 'outbound' ? STRINGS.act2.returnOutboundHit : STRINGS.act2.returnHit;
    this.options.onToast(actual > 0 ? hitText : STRINGS.act2.returnSafe, actual > 0 ? 'rust' : 'neon');
    this.stopParcel();
    this.state = 'cooldown';
    this.stateUntil = this.scene.time.now + TRAP.returnCooldownMs;
    this.chuteLight.setFillStyle(COLORS.neon, 0.9);
    this.outletLight.setFillStyle(COLORS.warning, 0.8);
  }

  private stopParcel(): void {
    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween = null;
    }
    if (this.activeParcel) {
      this.activeParcel.destroy(true);
      this.activeParcel = null;
    }
    this.activeKind = null;
    this.activePractice = false;
  }

  private makeParcel(kind: ParcelKind, practice: boolean): Phaser.GameObjects.Container {
    const root = this.scene.add.container(0, 0);
    root.setDepth(46);
    root.setAlpha(practice ? 0.56 : 1);
    const g = this.scene.add.graphics();
    const color = kind === 'outbound' ? COLORS.paperDim : COLORS.rust;
    const width = kind === 'outbound' ? 54 : 62;
    const height = kind === 'outbound' ? 34 : 48;
    g.fillStyle(COLORS.coal, 0.45);
    g.fillRect(-width / 2 + 3, -height / 2 + 4, width, height);
    g.fillStyle(color, practice ? 0.5 : 0.96);
    g.fillRect(-width / 2, -height / 2, width, height);
    g.lineStyle(2, practice ? COLORS.neon : COLORS.coal, practice ? 0.9 : 0.9);
    g.strokeRect(-width / 2, -height / 2, width, height);
    g.fillStyle(practice ? COLORS.neon : COLORS.warning, 0.9);
    g.fillRect(-width / 2, -height / 2 + 5, 5, height - 10);
    if (kind === 'return') {
      g.fillStyle(COLORS.paper, 0.95);
      g.fillRect(-22, -16, 44, 18);
      g.lineStyle(1, COLORS.coal, 0.8);
      g.strokeRect(-22, -16, 44, 18);
    }
    const label = this.scene.add.text(
      0,
      1,
      practice ? '练习' : kind === 'outbound' ? STRINGS.act2.returnOutbound : STRINGS.act2.returnParcel,
      {
        fontFamily: FONTS.mono,
        fontSize: kind === 'return' ? '12px' : '10px',
        color: practice ? CSS.neon : CSS.coal,
        fontStyle: 'bold',
      },
    );
    label.setOrigin(0.5);
    root.add([g, label]);
    return root;
  }

  private buildGuide(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(0, 0);
    root.setDepth(6);
    const g = this.scene.add.graphics();
    const start = this.options.spawnX;
    const end = this.options.chuteX;
    g.lineStyle(1, COLORS.warning, 0.28);
    for (let x = start; x < end; x += 28) {
      g.lineBetween(x, this.options.pathY, x + 14, this.options.pathY);
    }
    g.lineStyle(1, COLORS.rust, 0.24);
    for (let x = start; x < end; x += 28) {
      g.lineBetween(x, this.options.pathY + 8, x + 14, this.options.pathY + 8);
    }
    const mid = (start + end) / 2;
    const right = this.scene.add.text(mid, this.options.pathY - 28, '去程 →', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.warning,
    });
    right.setOrigin(0.5);
    right.setAlpha(0.65);
    const left = this.scene.add.text(mid, this.options.pathY + 28, '← 退件', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.rust,
    });
    left.setOrigin(0.5);
    left.setAlpha(0.65);
    root.add([g, right, left]);
    return root;
  }

  private buildChute(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.chuteX, this.options.pathY);
    root.setDepth(16);
    const g = this.scene.add.graphics();
    g.lineStyle(4, COLORS.coal, 0.9);
    g.lineBetween(28, 34, 28, this.options.groundY - this.options.pathY);
    g.fillStyle(COLORS.coal, 0.96);
    g.fillRect(-32, -36, 64, 72);
    g.lineStyle(3, COLORS.paperDark, 0.8);
    g.strokeRect(-32, -36, 64, 72);
    g.fillStyle(COLORS.rust, 0.95);
    g.fillRect(-32, -36, 64, 8);
    g.fillStyle(0x2b2924, 1);
    g.fillRect(-24, -26, 48, 52);
    g.lineStyle(2, COLORS.warning, 0.7);
    g.strokeRect(-24, -26, 48, 52);
    const arrow = this.scene.add.text(0, 0, '←', {
      fontFamily: FONTS.display,
      fontSize: '34px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    arrow.setOrigin(0.5);
    const label = this.scene.add.text(0, 54, '回收口', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    label.setOrigin(0.5);
    const light = this.scene.add.circle(-22, -16, 5, COLORS.neon, 0.95);
    light.setName('light');
    light.setStrokeStyle(2, COLORS.coal, 1);
    root.add([g, arrow, label, light]);
    return root;
  }

  private buildOutlet(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.spawnX, this.options.pathY);
    root.setDepth(16);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.92);
    g.fillRect(-22, -20, 44, 40);
    g.lineStyle(2, COLORS.paperDark, 0.7);
    g.strokeRect(-22, -20, 44, 40);
    g.fillStyle(COLORS.rust, 0.8);
    g.fillRect(-22, -20, 44, 5);
    const arrow = this.scene.add.text(0, 0, '→', {
      fontFamily: FONTS.display,
      fontSize: '24px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    arrow.setOrigin(0.5);
    const light = this.scene.add.circle(0, -28, 5, COLORS.warning, 0.8);
    light.setName('light');
    light.setStrokeStyle(2, COLORS.coal, 1);
    const label = this.scene.add.text(0, 34, '出件口', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    label.setOrigin(0.5);
    root.add([g, arrow, light, label]);
    return root;
  }

  private buildSign(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.chuteX - 74, this.options.groundY - 172);
    root.setDepth(16);
    root.setAngle(0.035);
    const g = this.scene.add.graphics();
    const points = [
      new Phaser.Geom.Point(-84, -32),
      new Phaser.Geom.Point(58, -32),
      new Phaser.Geom.Point(84, -6),
      new Phaser.Geom.Point(84, 32),
      new Phaser.Geom.Point(-84, 32),
    ];
    g.fillStyle(COLORS.paperDim, 0.96);
    g.fillPoints(points, true);
    g.lineStyle(2, COLORS.coal, 0.8);
    g.strokePoints(points, true);
    g.fillStyle(COLORS.coal, 0.9);
    g.fillTriangle(58, -32, 84, -6, 58, -6);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(-84, -32, 168, 7);
    const text = this.scene.add.text(-4, -4, STRINGS.act2.returnSign, {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    const arrow = this.scene.add.text(-72, -2, '←', {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    arrow.setOrigin(0.5);
    root.add([g, text, arrow]);
    return root;
  }

  private buildSafeMark(): Phaser.GameObjects.Container {
    const mark = addHotTag(this.scene, this.options.demoTriggerX, this.options.groundY - 54, '练习观察位', COLORS.neon, -0.02);
    mark.setDepth(16);
    mark.setScale(0.72);
    return mark;
  }

  private buildTriggerPad(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(this.options.triggerX, this.options.groundY - 4);
    root.setDepth(10);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.6);
    g.fillRect(-48, -8, 96, 16);
    g.lineStyle(2, COLORS.rust, 0.9);
    g.strokeRect(-48, -8, 96, 16);
    g.fillStyle(COLORS.warning, 0.9);
    for (let x = -32; x <= 32; x += 16) {
      g.fillTriangle(x - 5, 3, x + 5, 3, x, -3);
    }
    const label = this.scene.add.text(0, -22, '退件压板', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.warning,
    });
    label.setOrigin(0.5);
    root.add([g, label]);
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