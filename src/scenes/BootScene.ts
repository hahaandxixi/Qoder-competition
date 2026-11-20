import Phaser from 'phaser';
import { createAllTextures } from '../art/textures';
import { glitchText, makeTape } from '../art/uiKit';
import { COLORS, CSS, FONTS } from '../config/theme';
import { STRINGS } from '../data';
import { audio } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    audio.init(SaveSystem.getMuted());
    audio.setMusic('menu');
    createAllTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.coal);

    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 1);
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle(COLORS.paper, 0.08);
    for (let i = 0; i < 32; i += 1) {
      g.fillRect(0, i * 24, 1280, 1);
    }
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(300, 280, 680, 5);
    g.fillStyle(COLORS.warning, 0.8);
    g.fillRect(300, 285, 260, 3);

    glitchText(this, 640, 330, '正在装配火箭……', {
      fontFamily: FONTS.display,
      fontSize: '44px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    const hint = this.add.text(640, 390, STRINGS.misc.loadingHint, {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.paperDim,
    });
    hint.setOrigin(0.5);
    const tape = makeTape(this, 640, 260, 280, 30, COLORS.warning);
    tape.setRotation(-0.03);
    const stampText = this.add.text(1150, 650, 'BOOT // 404', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paperDim,
    });
    stampText.setOrigin(1);
    stampText.setAlpha(0.6);

    const bar = this.add.graphics();
    bar.fillStyle(COLORS.coalFaint, 1);
    bar.fillRect(440, 440, 400, 14);
    bar.lineStyle(2, COLORS.paperDim, 0.6);
    bar.strokeRect(440, 440, 400, 14);
    const fill = this.add.graphics();
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 420,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        fill.clear();
        fill.fillStyle(COLORS.neon, 0.9);
        fill.fillRect(443, 443, 394 * value, 8);
      },
    });

    this.cameras.main.fadeIn(160, 23, 19, 16);
    const track = new URLSearchParams(window.location.search).get('track');
    this.time.delayedCall(520, () => {
      if (track) {
        this.scene.start('Audition', { track });
      } else {
        this.scene.start('Menu');
      }
    });
  }
}