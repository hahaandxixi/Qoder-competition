import Phaser from 'phaser';
import { addScanlines, glitchText, paperButton, paperPanel, stamp } from '../art/uiKit';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS } from '../data';
import { audio } from '../systems/AudioSystem';

interface CreditsData {
  returnTo?: string;
}

export class CreditsScene extends Phaser.Scene {
  private returnTo: 'Menu' | 'Result' = 'Menu';
  private cleanups: Array<() => void> = [];

  constructor() {
    super('Credits');
  }

  init(data: CreditsData): void {
    this.returnTo = data.returnTo === 'Result' ? 'Result' : 'Menu';
  }

  create(): void {
    audio.setMusic('menu');
    this.cameras.main.fadeIn(200, 23, 19, 16);
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.skyFar).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const shade = this.add.graphics();
    shade.fillStyle(COLORS.coal, 0.7);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const panel = paperPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 1160, 648, {
      fill: COLORS.paper,
      title: 'ARCHIVE // CREDITS & DECLARATION',
      jitter: 6,
    });
    panel.setRotation(-0.0012);

    const title = glitchText(this, GAME_WIDTH / 2, 84, STRINGS.credits.title, {
      fontFamily: FONTS.display,
      fontSize: '40px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    title.setDepth(2);
    const subtitle = this.add.text(GAME_WIDTH / 2, 116, STRINGS.credits.subtitle, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: CSS.coal,
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0.68);

    this.section(120, 158, STRINGS.credits.fictionalTitle, STRINGS.credits.fictional, 470);
    this.section(120, 306, STRINGS.credits.legalTitle, STRINGS.credits.legal, 470);
    this.section(120, 486, STRINGS.credits.teamTitle, STRINGS.credits.team.join('\n'), 470);

    this.sectionTitle(690, 158, STRINGS.credits.assetsTitle);
    const assetText = this.add.text(690, 188, STRINGS.credits.assets.map((item) => `· ${item}`).join('\n\n'), {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.coal,
      lineSpacing: 5,
      wordWrap: { width: 390 },
    });
    assetText.setAlpha(0.84);

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.coal, 0.25);
    divider.lineBetween(664, 170, 664, 560);
    divider.lineBetween(104, 286, 590, 286);
    divider.lineBetween(104, 466, 590, 466);

    stamp(this, 1100, 150, 'SELF MADE', {
      color: COLORS.rust,
      fontSize: 17,
      angle: -0.08,
      alpha: 0.66,
    });
    stamp(this, 1076, 520, 'NO CDN', {
      color: COLORS.rust,
      fontSize: 20,
      angle: 0.06,
      alpha: 0.55,
    });
    const licence = this.add.text(690, 532, 'Phaser 3 · MIT\nVite · MIT\nTypeScript · Apache-2.0', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
      lineSpacing: 4,
    });
    licence.setAlpha(0.55);

    const back = paperButton(
      this,
      GAME_WIDTH / 2,
      660,
      250,
      50,
      STRINGS.credits.back,
      () => this.goBack(),
      {
        fill: COLORS.coal,
        textColor: CSS.paper,
        accent: COLORS.warning,
        fontSize: 20,
      },
    );
    back.root.setRotation(0.002);

    const footer = this.add.text(GAME_WIDTH / 2, 704, '本页声明与比赛作品帖中的原创与合规声明一致。', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    footer.setOrigin(0.5, 1);
    footer.setAlpha(0.55);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      const onEsc = () => this.goBack();
      const onEnter = () => this.goBack();
      keyboard.on('keydown-ESC', onEsc);
      keyboard.on('keydown-ENTER', onEnter);
      this.cleanups.push(() => keyboard.off('keydown-ESC', onEsc));
      this.cleanups.push(() => keyboard.off('keydown-ENTER', onEnter));
    }
    this.input.once('pointerdown', () => audio.unlock());
    this.events.once('shutdown', () => {
      this.cleanups.forEach((cleanup) => cleanup());
      this.cleanups = [];
    });

    addScanlines(this, 420);
  }

  private sectionTitle(x: number, y: number, title: string): void {
    const label = this.add.text(x, y, title, {
      fontFamily: FONTS.display,
      fontSize: '19px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    const line = this.add.graphics();
    line.lineStyle(2, COLORS.rust, 0.45);
    line.lineBetween(x, y + 26, x + label.width + 18, y + 26);
  }

  private section(x: number, y: number, title: string, body: string, width: number): void {
    this.sectionTitle(x, y, title);
    const text = this.add.text(x, y + 34, body, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.coal,
      lineSpacing: 6,
      wordWrap: { width },
    });
    text.setAlpha(0.84);
  }

  private goBack(): void {
    audio.play('select');
    if (this.returnTo === 'Result') {
      this.scene.start('Result', { fromCredits: true });
    } else {
      this.scene.start('Menu');
    }
  }
}