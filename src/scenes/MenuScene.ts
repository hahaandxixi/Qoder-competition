import Phaser from 'phaser';
import { addHotTag, addScanlines, glitchText, makeTape, paperButton, paperPanel, stamp } from '../art/uiKit';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS } from '../data';
import { audio } from '../systems/AudioSystem';
import { resetRunState } from '../systems/RunState';
import { SaveSystem, formatDuration } from '../systems/SaveSystem';

export class MenuScene extends Phaser.Scene {
  private starting = false;
  private muteText: Phaser.GameObjects.Text | null = null;
  private cleanups: Array<() => void> = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    this.starting = false;
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    audio.setMusic('menu');
    this.cameras.main.fadeIn(220, 23, 19, 16);

    this.buildBackdrop();
    this.buildFilePanel();
    this.buildPhotoPanel();
    this.buildMuteButton();
    this.buildFooter();
    this.refreshMute();

    const keyboard = this.input.keyboard;
    if (keyboard) {
      const onEnter = () => this.startGame();
      const onSpace = () => this.startGame();
      const unlock = () => audio.unlock();
      keyboard.on('keydown-ENTER', onEnter);
      keyboard.on('keydown-SPACE', onSpace);
      keyboard.once('keydown', unlock);
      this.cleanups.push(() => keyboard.off('keydown-ENTER', onEnter));
      this.cleanups.push(() => keyboard.off('keydown-SPACE', onSpace));
    }
    this.input.once('pointerdown', () => audio.unlock());
    this.events.once('shutdown', () => {
      this.cleanups.forEach((cleanup) => cleanup());
      this.cleanups = [];
    });

    addScanlines(this, 420);
    this.addGlitchTimer();
  }

  private buildBackdrop(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.skyFar).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const mid = this.add.tileSprite(0, 280, GAME_WIDTH, 440, TEX.skyMid);
    mid.setOrigin(0);
    mid.setAlpha(0.55);
    const shade = this.add.graphics();
    shade.fillStyle(COLORS.coal, 0.34);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    shade.fillStyle(COLORS.rust, 0.08);
    shade.fillRect(0, 0, 640, GAME_HEIGHT);

    for (let i = 0; i < 12; i += 1) {
      const dust = this.add.image(Phaser.Math.Between(20, 1260), Phaser.Math.Between(80, 680), TEX.dust);
      dust.setAlpha(Phaser.Math.FloatBetween(0.08, 0.24));
      dust.setScale(Phaser.Math.FloatBetween(0.5, 1.4));
      dust.setTint(i % 3 === 0 ? COLORS.warning : COLORS.paper);
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-30, 30),
        y: dust.y - Phaser.Math.Between(20, 70),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 2500),
        onRepeat: () => {
          dust.setPosition(Phaser.Math.Between(20, 1260), Phaser.Math.Between(300, 690));
          dust.setAlpha(Phaser.Math.FloatBetween(0.08, 0.24));
        },
      });
    }
  }

  private buildFilePanel(): void {
    const panel = paperPanel(this, 350, 355, 620, 640, {
      fill: COLORS.paper,
      jitter: 6,
    });
    panel.setRotation(-0.0015);

    const eyebrow = this.add.text(84, 68, STRINGS.menu.eyebrow, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    this.add.existing(eyebrow);

    glitchText(this, 78, 120, STRINGS.menu.title, {
      fontFamily: FONTS.display,
      fontSize: '66px',
      color: CSS.coal,
      fontStyle: 'bold',
    }, 0);

    const underline = this.add.graphics();
    underline.lineStyle(3, COLORS.rust, 0.8);
    underline.beginPath();
    underline.moveTo(82, 166);
    underline.lineTo(200, 162);
    underline.lineTo(320, 168);
    underline.lineTo(430, 161);
    underline.lineTo(520, 167);
    underline.strokePath();
    underline.lineStyle(1, COLORS.rust, 0.45);
    underline.beginPath();
    underline.moveTo(90, 173);
    underline.lineTo(210, 169);
    underline.lineTo(330, 175);
    underline.lineTo(460, 169);
    underline.strokePath();

    const tape = makeTape(this, 344, 211, 500, 46, COLORS.warning);
    tape.setRotation(-0.018);
    const subtitle = this.add.text(344, 211, STRINGS.menu.subtitle, {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    subtitle.setOrigin(0.5);
    subtitle.setRotation(-0.018);

    const tagline = this.add.text(84, 248, STRINGS.menu.tagline, {
      fontFamily: FONTS.body,
      fontSize: '16px',
      color: CSS.coal,
      lineSpacing: 7,
      wordWrap: { width: 500 },
    });
    tagline.setAlpha(0.82);

    const startButton = paperButton(this, 340, 338, 440, 78, STRINGS.menu.start, () => this.startGame(), {
      fill: COLORS.coal,
      textColor: CSS.paper,
      accent: COLORS.warning,
      fontSize: 32,
    });
    startButton.root.setRotation(-0.006);
    const startHint = this.add.text(340, 386, STRINGS.menu.startHint, {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.paperDim,
    });
    startHint.setOrigin(0.5);
    startHint.setY(399);
    startHint.setColor(CSS.rust);

    const creditsButton = paperButton(
      this,
      340,
      448,
      440,
      54,
      STRINGS.menu.credits,
      () => this.openCredits(),
      {
        fill: COLORS.paperDim,
        textColor: CSS.coal,
        accent: COLORS.rust,
        fontSize: 20,
      },
    );
    creditsButton.root.setRotation(0.003);

    this.add.text(84, 512, STRINGS.menu.controlsTitle, {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    const leftControls = STRINGS.menu.controls.slice(0, 3).join('\n');
    const rightControls = STRINGS.menu.controls.slice(3).join('\n');
    const left = this.add.text(84, 540, leftControls, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.coal,
      lineSpacing: 10,
    });
    const right = this.add.text(340, 540, rightControls, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.coal,
      lineSpacing: 10,
    });
    left.setAlpha(0.78);
    right.setAlpha(0.78);

    const warning = this.add.text(84, 628, '※ 本题库与梗卡均已独立配置，可替换审查。', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: CSS.coal,
    });
    warning.setAlpha(0.52);

    addHotTag(this, 694, 86, '热 · 名字失窃', COLORS.warning, 0.045);
  }

  private buildPhotoPanel(): void {
    const panel = paperPanel(this, 960, 340, 400, 500, {
      fill: COLORS.paperDim,
      title: 'SUBJECT PHOTO // 阿浣',
      jitter: 5,
    });
    panel.setRotation(0.004);

    const photo = this.add.graphics();
    photo.fillStyle(COLORS.coal, 0.93);
    photo.fillRect(800, 142, 320, 286);
    photo.fillStyle(COLORS.paper, 0.07);
    for (let y = 150; y < 424; y += 8) {
      photo.fillRect(804, y, 312, 1);
    }
    photo.fillStyle(COLORS.warning, 0.16);
    photo.fillCircle(960, 284, 104);
    const image = this.add.image(960, 292, TEX.raccoon);
    image.setScale(1.22);
    image.setRotation(0.02);
    this.add.ellipse(960, 386, 200, 24, COLORS.coal, 0.55);

    const name = this.add.text(960, 452, '阿浣 / 无名快递员', {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    name.setOrigin(0.5);
    const desc = this.add.text(960, 480, '背着废铁火箭，逢梗必反。', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.coal,
    });
    desc.setOrigin(0.5);
    desc.setAlpha(0.7);

    stamp(this, 1090, 120, '档案 404', {
      color: COLORS.rust,
      fontSize: 22,
      angle: -0.12,
      alpha: 0.72,
    });
    stamp(this, 838, 522, '虚构人物', {
      color: COLORS.rust,
      fontSize: 17,
      angle: 0.07,
      alpha: 0.6,
    });

    const best = SaveSystem.getBest();
    paperPanel(this, 960, 636, 400, 66, {
      fill: COLORS.paper,
      tape: false,
      staples: false,
      barcode: false,
      holes: false,
      jitter: 3,
    });
    const bestText = best.cleared
      ? `${STRINGS.menu.best}：${formatDuration(best.bestTimeMs)} · 答对 ${best.bestCorrect} · ${best.runs} 次签收`
      : `${STRINGS.menu.best}：${STRINGS.menu.noRecord}`;
    const bestLabel = this.add.text(960, 636, bestText, {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
      align: 'center',
      wordWrap: { width: 360 },
    });
    bestLabel.setOrigin(0.5);
  }

  private buildMuteButton(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.78);
    g.fillRect(1112, 34, 136, 40);
    g.lineStyle(2, COLORS.paperDim, 0.6);
    g.strokeRect(1112, 34, 136, 40);
    this.muteText = this.add.text(1180, 54, '', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    this.muteText.setOrigin(0.5);
    const zone = this.add.zone(1180, 54, 136, 40).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      audio.unlock();
      const muted = !audio.isMuted();
      audio.setMuted(muted);
      SaveSystem.setMuted(muted);
      this.refreshMute();
      audio.play('select');
    });
    this.refreshMute();
  }

  private refreshMute(): void {
    if (!this.muteText) {
      return;
    }
    this.muteText.setText(audio.isMuted() ? STRINGS.menu.muteOff : STRINGS.menu.muteOn);
    this.muteText.setColor(audio.isMuted() ? CSS.paperDim : CSS.neon);
  }

  private buildFooter(): void {
    const footer = this.add.text(GAME_WIDTH / 2, 706, STRINGS.menu.footer, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    footer.setOrigin(0.5, 1);
    footer.setAlpha(0.55);
  }

  private addGlitchTimer(): void {
    this.time.addEvent({
      delay: 3800,
      loop: true,
      callback: () => {
        if (!this.scene.isActive()) {
          return;
        }
        const glitch = this.add.graphics();
        glitch.setDepth(410);
        glitch.fillStyle(Math.random() > 0.5 ? COLORS.rust : COLORS.neon, 0.28);
        const y = Phaser.Math.Between(100, 300);
        glitch.fillRect(Phaser.Math.Between(40, 560), y, Phaser.Math.Between(70, 280), Phaser.Math.Between(2, 6));
        glitch.fillStyle(COLORS.paper, 0.16);
        glitch.fillRect(Phaser.Math.Between(100, 700), y + 9, Phaser.Math.Between(30, 130), 2);
        this.tweens.add({
          targets: glitch,
          alpha: 0,
          duration: 180,
          onComplete: () => glitch.destroy(),
        });
      },
    });
  }

  private startGame(): void {
    if (this.starting) {
      return;
    }
    this.starting = true;
    audio.unlock();
    audio.play('select');
    audio.setMusic('level');
    resetRunState(this);
    this.registry.remove('bossIntroSeen');
    this.input.enabled = false;
    this.cameras.main.fadeOut(260, 23, 19, 16);
    this.time.delayedCall(280, () => this.scene.start('Level'));
  }

  private openCredits(): void {
    if (this.starting) {
      return;
    }
    audio.unlock();
    audio.play('select');
    this.scene.start('Credits', { returnTo: 'Menu' });
  }
}