import Phaser from 'phaser';
import { COLORS, CSS, FONTS } from '../config/theme';

export interface ViewfinderOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: number;
  label?: string;
  depth?: number;
}

/** 地面取景框：四角合拢 + 快门闪光。颜色之外还靠框角形状和收拢动作提示时机。 */
export class Viewfinder {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly width: number;
  private readonly height: number;
  private readonly color: number;
  private progress = 0;
  private closing = false;
  private closed = false;
  private destroyed = false;
  private closeTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, options: ViewfinderOptions) {
    this.scene = scene;
    this.width = options.width;
    this.height = options.height;
    this.color = options.color ?? COLORS.warning;
    this.root = scene.add.container(options.x, options.y);
    this.root.setDepth(options.depth ?? 70);
    this.frame = scene.add.graphics();
    this.root.add(this.frame);
    this.label = scene.add.text(0, -this.height / 2 - 22, options.label ?? '取景框 · 快门预警', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
      fontStyle: 'bold',
      backgroundColor: CSS.warning,
      padding: { x: 8, y: 3 },
    });
    this.label.setOrigin(0.5);
    this.root.add(this.label);
    this.draw();
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.root.x, y: this.root.y };
  }

  /** progress 0 = 大框，1 = 收拢完成。 */
  setProgress(progress: number): void {
    if (this.destroyed) {
      return;
    }
    this.progress = Phaser.Math.Clamp(progress, 0, 1);
    this.draw();
  }

  close(durationMs: number, onComplete?: () => void): void {
    if (this.closing || this.destroyed) {
      return;
    }
    this.closing = true;
    this.closeTween = this.scene.tweens.addCounter({
      from: this.progress,
      to: 1,
      duration: durationMs,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => {
        this.setProgress(tween.getValue() ?? 1);
      },
      onComplete: () => {
        if (this.destroyed) {
          return;
        }
        this.closed = true;
        this.closing = false;
        this.closeTween = null;
        this.flash();
        onComplete?.();
      },
    });
  }

  contains(x: number, y: number): boolean {
    const scale = 1 - this.progress * 0.48;
    const halfW = (this.width * scale) / 2;
    const halfH = (this.height * scale) / 2;
    return Math.abs(x - this.root.x) <= halfW && Math.abs(y - this.root.y) <= halfH;
  }

  isClosed(): boolean {
    return this.closed;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.closeTween?.stop();
    this.closeTween = null;
    this.root.destroy(true);
  }

  private draw(): void {
    if (this.destroyed) {
      return;
    }
    const scale = 1 - this.progress * 0.48;
    const w = this.width * scale;
    const h = this.height * scale;
    const left = -w / 2;
    const top = -h / 2;
    const right = w / 2;
    const bottom = h / 2;
    const corner = Math.min(34, w * 0.22);
    const g = this.frame;
    g.clear();
    g.fillStyle(COLORS.coal, 0.16 + this.progress * 0.12);
    g.fillRect(left, top, w, h);
    g.lineStyle(2, this.color, 0.45 + this.progress * 0.4);
    g.strokeRect(left, top, w, h);
    g.lineStyle(1, this.color, 0.28);
    g.lineBetween(0, top, 0, bottom);
    g.lineBetween(left, 0, right, 0);
    g.fillStyle(this.color, 0.9);
    for (let x = left + 12; x < right - 4; x += 24) {
      g.fillRect(x, top - 2, 9, 4);
      g.fillRect(x, bottom - 2, 9, 4);
    }
    for (let y = top + 12; y < bottom - 4; y += 24) {
      g.fillRect(left - 2, y, 4, 9);
      g.fillRect(right - 2, y, 4, 9);
    }
    g.lineStyle(5, this.color, 1);
    g.lineBetween(left, top, left + corner, top);
    g.lineBetween(left, top, left, top + corner);
    g.lineBetween(right, top, right - corner, top);
    g.lineBetween(right, top, right, top + corner);
    g.lineBetween(left, bottom, left + corner, bottom);
    g.lineBetween(left, bottom, left, bottom - corner);
    g.lineBetween(right, bottom, right - corner, bottom);
    g.lineBetween(right, bottom, right, bottom - corner);
    g.fillStyle(COLORS.coal, 0.92);
    g.fillRect(-22, -12, 44, 24);
    g.lineStyle(2, this.color, 0.95);
    g.strokeRect(-22, -12, 44, 24);
    g.fillStyle(this.color, 1);
    g.fillCircle(0, 0, 4);
    this.label.setText(this.progress >= 1 ? '取景完成 · 快门' : '取景框 · 四角合拢');
  }

  private flash(): void {
    const flash = this.scene.add.rectangle(this.root.x, this.root.y, this.width * 0.7, this.height * 0.8, COLORS.white, 0.72);
    flash.setDepth(this.root.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy(),
    });
  }
}
