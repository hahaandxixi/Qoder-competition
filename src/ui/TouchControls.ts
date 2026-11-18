import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, UI } from '../config/balance';
import { COLORS, CSS, FONTS } from '../config/theme';

export interface TouchTarget {
  setTouchMove: (direction: -1 | 0 | 1) => void;
  setTouchShoot: (pressed: boolean) => void;
  requestJump: () => void;
  requestDash: () => void;
}

export interface TouchControlsOptions {
  onInteract?: () => void;
}

interface TouchButton {
  root: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
}

export function isTouchDevice(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('touch') === '1') {
      return true;
    }
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}

export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly target: TouchTarget;
  private readonly root: Phaser.GameObjects.Container;
  private readonly buttons: TouchButton[] = [];
  private enabled = true;
  private readonly onShutdown: () => void;

  constructor(scene: Phaser.Scene, target: TouchTarget, options: TouchControlsOptions = {}) {
    this.scene = scene;
    this.target = target;
    this.root = scene.add.container(0, 0);
    this.root.setScrollFactor(0);
    this.root.setDepth(UI.touchDepth);
    scene.input.addPointer(3);

    this.makeHoldButton(88, GAME_HEIGHT - 76, 88, 88, '◀', '左', (pressed) => {
      this.target.setTouchMove(pressed ? -1 : 0);
    });
    this.makeHoldButton(190, GAME_HEIGHT - 76, 88, 88, '▶', '右', (pressed) => {
      this.target.setTouchMove(pressed ? 1 : 0);
    });
    this.makeHoldButton(1042, GAME_HEIGHT - 70, 96, 88, '打', '射击', (pressed) => {
      this.target.setTouchShoot(pressed);
    });
    this.makeTapButton(1160, GAME_HEIGHT - 72, 108, 92, '跳', () => this.target.requestJump());
    this.makeTapButton(1164, GAME_HEIGHT - 174, 96, 74, '冲', () => this.target.requestDash());
    if (options.onInteract) {
      this.makeTapButton(908, GAME_HEIGHT - 76, 92, 88, 'E', () => options.onInteract?.(), '交互');
    }

    const hint = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, '左侧移动 · 右侧射击 / 跳跃 / 冲刺 / 交互 · 答题与梗卡直接点击', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    hint.setOrigin(0.5, 1);
    hint.setAlpha(0.55);
    this.root.add(hint);

    this.onShutdown = () => {
      this.buttons.forEach((button) => button.root.destroy(true));
    };
    scene.events.once('shutdown', this.onShutdown);
  }

  private makeHoldButton(
    x: number,
    y: number,
    w: number,
    h: number,
    glyph: string,
    caption: string,
    onChange: (pressed: boolean) => void,
  ): TouchButton {
    const { root, zone, press, release } = this.makeBase(x, y, w, h, glyph, caption);
    let activePointer: number | null = null;

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || activePointer !== null) {
        return;
      }
      activePointer = pointer.id;
      press();
      onChange(true);
    });

    const releaseHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== activePointer) {
        return;
      }
      activePointer = null;
      release();
      onChange(false);
    };
    zone.on('pointerup', releaseHandler);
    zone.on('pointerout', releaseHandler);
    zone.on('pointercancel', releaseHandler);

    this.root.add(root);
    this.buttons.push({ root, zone });
    return { root, zone };
  }

  private makeTapButton(
    x: number,
    y: number,
    w: number,
    h: number,
    glyph: string,
    onTap: () => void,
    caption = '',
  ): TouchButton {
    const { root, zone, press, release } = this.makeBase(x, y, w, h, glyph, caption, false);
    zone.on('pointerdown', () => {
      if (!this.enabled) {
        return;
      }
      press();
      onTap();
    });
    zone.on('pointerup', release);
    zone.on('pointerout', release);
    zone.on('pointercancel', release);
    this.root.add(root);
    const button = { root, zone };
    this.buttons.push(button);
    return button;
  }

  private makeBase(
    x: number,
    y: number,
    w: number,
    h: number,
    glyph: string,
    caption: string,
    tape = true,
  ): {
    root: Phaser.GameObjects.Container;
    zone: Phaser.GameObjects.Zone;
    press: () => void;
    release: () => void;
  } {
    const root = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.64);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(3, COLORS.paperDim, 0.7);
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle(COLORS.warning, 0.7);
    g.fillRect(-w / 2, -h / 2, 6, h);
    if (tape) {
      g.fillStyle(COLORS.warning, 0.28);
      g.fillRect(-w / 2 + 12, -h / 2 - 4, 30, 8);
    }
    const label = this.scene.add.text(0, caption ? -4 : 2, glyph, {
      fontFamily: FONTS.body,
      fontSize: `${Math.round(h * 0.34)}px`,
      color: CSS.paper,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    const sub = this.scene.add.text(0, h / 2 - 15, caption, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    sub.setOrigin(0.5);
    const zone = this.scene.add.zone(0, 0, w + 16, h + 16).setInteractive().setScrollFactor(0);
    root.add([g, label, sub, zone]);

    const press = () => {
      if (!this.enabled) {
        return;
      }
      this.scene.tweens.add({ targets: root, scale: 0.94, duration: 60 });
      g.clear();
      g.fillStyle(COLORS.coal, 0.8);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(3, COLORS.neon, 0.95);
      g.strokeRect(-w / 2, -h / 2, w, h);
      g.fillStyle(COLORS.neon, 0.9);
      g.fillRect(-w / 2, -h / 2, 6, h);
    };
    const release = () => {
      this.scene.tweens.add({ targets: root, scale: 1, duration: 80 });
      g.clear();
      g.fillStyle(COLORS.coal, 0.64);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(3, COLORS.paperDim, 0.7);
      g.strokeRect(-w / 2, -h / 2, w, h);
      g.fillStyle(COLORS.warning, 0.7);
      g.fillRect(-w / 2, -h / 2, 6, h);
      if (tape) {
        g.fillStyle(COLORS.warning, 0.28);
        g.fillRect(-w / 2 + 12, -h / 2 - 4, 30, 8);
      }
    };
    return { root, zone, press, release };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.root.setAlpha(enabled ? 1 : 0.35);
    if (!enabled) {
      this.target.setTouchMove(0);
      this.target.setTouchShoot(false);
    }
  }

  dispose(): void {
    this.target.setTouchMove(0);
    this.target.setTouchShoot(false);
    this.scene.events.off('shutdown', this.onShutdown);
    this.root.destroy(true);
  }
}