import Phaser from 'phaser';
import { addFloatingLine, addScanlines, glitchText, halfReceipt, paperButton, paperPanel, stamp } from '../art/uiKit';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS, getCard } from '../data';
import type { BestRecord, ResultPayload, RunState } from '../types/game';
import { audio } from '../systems/AudioSystem';
import { beginAct2, resetRunState } from '../systems/RunState';
import { SaveSystem, formatDuration } from '../systems/SaveSystem';

interface ResultSceneData {
  payload?: ResultPayload;
  record?: boolean;
  fromCredits?: boolean;
  showStats?: boolean;
}

const FALLBACK_PAYLOAD: ResultPayload = {
  act: 1,
  victory: false,
  timeMs: 0,
  stats: {
    correct: 0,
    wrong: 0,
    timeouts: 0,
    parries: 0,
    cardsCollected: 0,
    enemiesDefeated: 0,
  },
  cards: [],
  reason: '',
};

export class ResultScene extends Phaser.Scene {
  private payload: ResultPayload = FALLBACK_PAYLOAD;
  private shouldRecord = false;
  private best: BestRecord = {
    cleared: false,
    act1Cleared: false,
    act2Cleared: false,
    bestTimeMs: 0,
    bestCorrect: 0,
    runs: 0,
  };
  private isNewBest = false;
  private finalEnding = false;
  private forceStats = false;
  private cleanups: Array<() => void> = [];

  constructor() {
    super('Result');
  }

  init(data: ResultSceneData): void {
    const stored = this.registry.get('lastResult') as ResultPayload | undefined;
    this.payload = data.payload ?? stored ?? FALLBACK_PAYLOAD;
    this.shouldRecord = data.record === true && data.payload !== undefined;
    if (data.payload) {
      this.registry.set('lastResult', data.payload);
    }
    this.isNewBest = false;
    this.finalEnding = false;
    this.forceStats = data.showStats === true;
  }

  create(): void {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    audio.setMusic('result');
    audio.play(this.payload.victory ? 'victory' : 'defeat');

    if (this.shouldRecord) {
      const recorded = SaveSystem.recordRun(this.payload);
      this.best = recorded.best;
      this.isNewBest = recorded.isNewBest;
    } else {
      this.best = SaveSystem.getBest();
    }

    this.finalEnding =
      !this.forceStats &&
      this.payload.victory &&
      this.payload.act === 2 &&
      this.payload.temporary !== true &&
      this.best.act1Cleared &&
      this.best.act2Cleared;

    this.cameras.main.fadeIn(240, 23, 19, 16);
    this.buildBackground();
    if (this.finalEnding) {
      this.buildFinalEnding();
    } else {
      this.buildContent();
      this.bindKeyboard();
    }

    addScanlines(this, 420);
    this.events.once('shutdown', () => {
      this.cleanups.forEach((cleanup) => cleanup());
      this.cleanups = [];
    });
  }

  private buildBackground(): void {
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.payload.act === 2 ? TEX.islandSky : TEX.stageBg)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const shade = this.add.graphics();
    shade.fillStyle(COLORS.coal, this.payload.victory ? 0.32 : 0.62);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (this.payload.victory) {
      shade.fillStyle(COLORS.warning, 0.07);
      shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      for (let i = 0; i < 22; i += 1) {
        const piece = this.add.image(
          Phaser.Math.Between(20, 1260),
          Phaser.Math.Between(-40, 260),
          TEX.spark,
        );
        piece.setTint(i % 3 === 0 ? COLORS.neon : i % 3 === 1 ? COLORS.warning : COLORS.paper);
        piece.setScale(Phaser.Math.FloatBetween(0.6, 1.6));
        this.tweens.add({
          targets: piece,
          y: Phaser.Math.Between(500, 760),
          x: piece.x + Phaser.Math.Between(-80, 80),
          angle: Phaser.Math.Between(-300, 300),
          alpha: 0,
          duration: Phaser.Math.Between(2600, 5200),
          delay: Phaser.Math.Between(0, 1200),
          repeat: -1,
          onRepeat: () => {
            piece.setPosition(Phaser.Math.Between(20, 1260), Phaser.Math.Between(-80, 100));
            piece.setAlpha(1);
          },
        });
      }
    } else {
      const glitch = this.add.graphics();
      glitch.setDepth(2);
      for (let i = 0; i < 9; i += 1) {
        glitch.fillStyle(i % 2 === 0 ? COLORS.rust : COLORS.neon, 0.15);
        glitch.fillRect(
          Phaser.Math.Between(0, 1100),
          Phaser.Math.Between(60, 680),
          Phaser.Math.Between(40, 220),
          Phaser.Math.Between(2, 7),
        );
      }
    }
    const vignette = this.add.graphics();
    vignette.fillStyle(COLORS.coal, 0.28);
    vignette.fillRect(0, 0, GAME_WIDTH, 80);
    vignette.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);
  }

  private buildContent(): void {
    const victory = this.payload.victory;
    const act2 = this.payload.act === 2;
    const eyebrowText = victory
      ? act2
        ? this.payload.temporary
          ? STRINGS.result.act2TempEyebrow
          : STRINGS.result.act2VictoryEyebrow
        : STRINGS.result.victoryEyebrow
      : STRINGS.result.failEyebrow;
    const titleText = victory
      ? act2
        ? this.payload.temporary
          ? STRINGS.result.act2TempTitle
          : STRINGS.result.act2VictoryTitle
        : STRINGS.result.victoryTitle
      : act2
        ? STRINGS.result.act2FailTitle
        : STRINGS.result.failTitle;
    const subtitleText = victory
      ? act2
        ? this.payload.temporary
          ? STRINGS.result.act2TempSub
          : STRINGS.result.act2VictorySub
        : STRINGS.result.victorySub
      : act2
        ? STRINGS.result.act2FailSub
        : STRINGS.result.failSub;
    const headerBand = this.add.graphics();
    headerBand.setDepth(2);
    headerBand.fillStyle(COLORS.coal, 0.78);
    headerBand.fillRect(0, 26, GAME_WIDTH, 158);
    headerBand.fillStyle(victory ? COLORS.neon : COLORS.rust, 0.7);
    headerBand.fillRect(0, 26, GAME_WIDTH, 2);
    headerBand.fillStyle(COLORS.warning, 0.35);
    for (let i = 0; i < 6; i += 1) {
      headerBand.fillRect(110 + i * 183, 176 + (i % 3) * 3, 60 + (i % 4) * 26, 1);
    }

    const eyebrow = this.add.text(GAME_WIDTH / 2, 40, eyebrowText, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: victory ? CSS.neon : CSS.rust,
      fontStyle: 'bold',
    });
    eyebrow.setOrigin(0.5);
    eyebrow.setDepth(3);

    const title = glitchText(
      this,
      GAME_WIDTH / 2,
      92,
      titleText,
      {
        fontFamily: FONTS.display,
        fontSize: victory ? '54px' : '44px',
        color: CSS.paper,
        fontStyle: 'bold',
      },
    );
    title.setDepth(3);

    const subtitle = this.add.text(
      GAME_WIDTH / 2,
      146,
      subtitleText,
      {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: CSS.paper,
        align: 'center',
        wordWrap: { width: 900 },
      },
    );
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0.88);
    subtitle.setDepth(3);

    if (!victory && this.payload.reason) {
      const reason = this.add.text(GAME_WIDTH / 2, 172, `记录原因：${this.payload.reason}`, {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS.warning,
      });
      reason.setOrigin(0.5);
      reason.setAlpha(0.8);
      reason.setDepth(3);
    }

    if (victory && !act2) {
      const half = halfReceipt(this, 1038, 106, {
        width: 210,
        height: 78,
        label: STRINGS.boss.cinematic.halfReceipt,
        angle: -0.08,
      });
      half.setDepth(4);
      half.setAlpha(0);
      this.tweens.add({ targets: half, alpha: 1, y: 112, delay: 260, duration: 420, ease: 'Back.easeOut' });
    }

    const panel = paperPanel(this, GAME_WIDTH / 2, 382, 930, 360, {
      fill: COLORS.paper,
      title: `TASK RECEIPT // ${victory ? 'PASS' : 'VOID'}`,
      jitter: 5,
    });
    panel.setRotation(-0.0015);

    const stats: Array<[string, string]> = [
      [STRINGS.result.statsTime, formatDuration(this.payload.timeMs)],
      [STRINGS.result.statsCorrect, String(this.payload.stats.correct)],
      [STRINGS.result.statsWrong, String(this.payload.stats.wrong)],
      [STRINGS.result.statsTimeout, String(this.payload.stats.timeouts)],
      [STRINGS.result.statsParry, String(this.payload.stats.parries)],
      [STRINGS.result.statsCards, String(this.payload.stats.cardsCollected)],
      [STRINGS.result.statsKills, String(this.payload.stats.enemiesDefeated)],
    ];
    stats.forEach(([label, value], index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 330 + column * 200;
      const y = 300 + row * 92;
      const labelText = this.add.text(x, y, label, {
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: CSS.coal,
      });
      labelText.setOrigin(0.5);
      labelText.setAlpha(0.6);
      const valueText = this.add.text(x, y + 20, value, {
        fontFamily: FONTS.display,
        fontSize: '28px',
        color: CSS.coal,
        fontStyle: 'bold',
      });
      valueText.setOrigin(0.5);
      const underline = this.add.graphics();
      underline.lineStyle(1, COLORS.rust, 0.32);
      underline.lineBetween(x - 58, y + 52, x + 58, y + 52);
    });

    const cardNames = this.payload.cards
      .map((id) => getCard(id)?.name)
      .filter((name): name is string => Boolean(name));
    const cardsLine = this.add.text(
      GAME_WIDTH / 2,
      492,
      `${STRINGS.result.statsCards}：${cardNames.length > 0 ? cardNames.join(' / ') : '未签收'}`,
      {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: CSS.coal,
        align: 'center',
        wordWrap: { width: 800 },
      },
    );
    cardsLine.setOrigin(0.5);
    cardsLine.setAlpha(0.75);

    const bestLine = this.best.cleared
      ? `${STRINGS.result.bestRecord}：${formatDuration(this.best.bestTimeMs)} · 答对 ${this.best.bestCorrect}`
      : `${STRINGS.result.bestRecord}：暂无通关记录`;
    const best = this.add.text(GAME_WIDTH / 2, 526, bestLine, {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
    });
    best.setOrigin(0.5);
    best.setAlpha(0.55);

    const mark = stamp(this, 976, 250, victory ? '通过' : '作废', {
      color: victory ? COLORS.rust : COLORS.rust,
      fontSize: 34,
      angle: victory ? -0.1 : 0.08,
      alpha: 0.82,
    });
    mark.setDepth(4);
    if (this.isNewBest) {
      const newBest = stamp(this, 1010, 172, STRINGS.result.newBest, {
        color: COLORS.rust,
        fontSize: 18,
        angle: 0.06,
        alpha: 0.9,
      });
      newBest.setDepth(4);
    }

    const showNext = victory && !act2;
    const retryLabel = act2 && victory ? STRINGS.result.retryAct2 : STRINGS.result.retry;
    const retry = paperButton(
      this,
      showNext ? 280 : 400,
      610,
      showNext ? 230 : 300,
      58,
      retryLabel,
      () => this.retry(),
      {
        fill: COLORS.coal,
        textColor: CSS.paper,
        accent: COLORS.warning,
        fontSize: 19,
      },
    );
    retry.root.setRotation(-0.004);

    if (showNext) {
      const next = paperButton(
        this,
        538,
        610,
        250,
        58,
        STRINGS.result.act1Next,
        () => this.nextAct(),
        {
          fill: COLORS.rust,
          textColor: CSS.paper,
          accent: COLORS.warning,
          fontSize: 19,
        },
      );
      next.root.setRotation(0.003);
      paperButton(
        this,
        790,
        610,
        180,
        58,
        STRINGS.result.menu,
        () => this.toMenu(),
        {
          fill: COLORS.paperDim,
          textColor: CSS.coal,
          accent: COLORS.rust,
          fontSize: 18,
        },
      );
      const credits = paperButton(
        this,
        1038,
        610,
        210,
        58,
        STRINGS.result.credits,
        () => this.toCredits(),
        {
          fill: COLORS.paperDim,
          textColor: CSS.coal,
          accent: COLORS.rust,
          fontSize: 18,
        },
      );
      credits.root.setRotation(0.004);
    } else {
      paperButton(
        this,
        712,
        610,
        210,
        58,
        STRINGS.result.menu,
        () => this.toMenu(),
        {
          fill: COLORS.paperDim,
          textColor: CSS.coal,
          accent: COLORS.rust,
          fontSize: 18,
        },
      );
      const credits = paperButton(
        this,
        952,
        610,
        230,
        58,
        STRINGS.result.credits,
        () => this.toCredits(),
        {
          fill: COLORS.paperDim,
          textColor: CSS.coal,
          accent: COLORS.rust,
          fontSize: 18,
        },
      );
      credits.root.setRotation(0.004);
    }

    const footer = this.add.text(GAME_WIDTH / 2, 704, '人物与公司均为虚构玩梗形象 · 美术与音频自制或程序化生成', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    footer.setOrigin(0.5, 1);
    footer.setAlpha(0.58);
  }

  /** 两幕通关：结算机打印最后一张过期件，扫码后只留下阿浣的回答。 */
  private buildFinalEnding(): void {
    audio.setMusic('result');
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.coal, 0.78);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setDepth(2);
    const glow = this.add.ellipse(GAME_WIDTH / 2, 380, 880, 420, COLORS.warning, 0.07);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(2);

    const props = this.add.container(0, 0);
    props.setDepth(3);

    const machine = this.add.container(GAME_WIDTH / 2, 114);
    const mg = this.add.graphics();
    mg.fillStyle(COLORS.coal, 0.98);
    mg.fillRect(-244, -50, 488, 100);
    mg.lineStyle(3, COLORS.warning, 0.7);
    mg.strokeRect(-244, -50, 488, 100);
    mg.fillStyle(COLORS.rust, 0.8);
    mg.fillRect(-244, -50, 488, 10);
    mg.fillStyle(COLORS.coalSoft, 1);
    mg.fillRect(-214, -24, 290, 48);
    mg.lineStyle(2, COLORS.paperDim, 0.45);
    mg.strokeRect(-214, -24, 290, 48);
    mg.fillStyle(COLORS.paperDim, 0.65);
    mg.fillRect(-196, -18, 254, 4);
    mg.fillStyle(COLORS.neon, 0.9);
    mg.fillCircle(202, -2, 6);
    mg.fillStyle(COLORS.warning, 0.85);
    mg.fillRect(154, 22, 96, 6);
    machine.add(mg);
    const machineLabel = this.add.text(0, 34, STRINGS.result.finalMachine, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    machineLabel.setOrigin(0.5);
    machine.add(machineLabel);
    props.add(machine);

    const strip = this.add.container(GAME_WIDTH / 2, 312);
    const sg = this.add.graphics();
    sg.fillStyle(COLORS.coal, 0.3);
    sg.fillRect(-258, -104, 516, 216);
    sg.fillStyle(COLORS.paper, 1);
    sg.fillRect(-264, -112, 516, 216);
    sg.lineStyle(3, COLORS.rust, 0.85);
    sg.strokeRect(-264, -112, 516, 216);
    sg.fillStyle(COLORS.warning, 0.82);
    sg.fillRect(-264, -112, 516, 10);
    sg.fillStyle(COLORS.coal, 0.22);
    for (let y = -80; y < 78; y += 26) {
      sg.fillRect(-238, y, 462, 1);
    }
    sg.fillStyle(COLORS.coal, 0.55);
    for (let i = 0; i < 24; i += 1) {
      sg.fillRect(-238 + i * 12, 74, 3 + (i % 3), 14);
    }
    strip.add(sg);
    const stripTitle = this.add.text(0, -86, 'TASK RECEIPT // OVERDUE', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    stripTitle.setOrigin(0.5);
    const question = this.add.text(0, -8, STRINGS.result.finalQuestion, {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: CSS.coal,
      fontStyle: 'bold',
      align: 'center',
    });
    question.setOrigin(0.5);
    const stripSub = this.add.text(0, 38, '404 // 待派件', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.rust,
    });
    stripSub.setOrigin(0.5);
    stripSub.setAlpha(0.8);
    strip.add([stripTitle, question, stripSub]);
    strip.setAlpha(0);
    strip.setScale(1, 0.06);
    props.add(strip);
    this.time.delayedCall(180, () => {
      audio.play('paper');
      this.tweens.add({ targets: strip, alpha: 1, scaleY: 1, duration: 620, ease: 'Back.easeOut' });
    });

    const raccoon = this.add.image(302, 556, TEX.raccoon);
    raccoon.setScale(0.88);
    raccoon.setDepth(3);
    const stack = this.add.container(392, 520);
    const stackG = this.add.graphics();
    for (let i = 0; i < 3; i += 1) {
      stackG.fillStyle(COLORS.paper, 0.92 - i * 0.1);
      stackG.fillRect(-78 + i * 6, -44 + i * 8, 146, 86);
      stackG.lineStyle(2, COLORS.rust, 0.5);
      stackG.strokeRect(-78 + i * 6, -44 + i * 8, 146, 86);
      stackG.fillStyle(COLORS.coal, 0.28);
      stackG.fillRect(-62 + i * 6, -22 + i * 8, 104, 2);
      stackG.fillRect(-62 + i * 6, -8 + i * 8, 84, 2);
    }
    stack.add(stackG);
    stack.setDepth(4);

    const scanner = this.add.graphics();
    scanner.fillStyle(COLORS.coal, 0.95);
    scanner.fillRect(390, 540, 20, 12);
    scanner.fillStyle(COLORS.neon, 1);
    scanner.fillRect(405, 543, 4, 6);
    scanner.setDepth(5);

    this.time.delayedCall(1180, () => {
      audio.play('scan');
      const beam = this.add.graphics();
      beam.setDepth(5);
      beam.lineStyle(2, COLORS.neon, 0.8);
      beam.lineBetween(408, 546, GAME_WIDTH / 2 - 60, 260);
      beam.setAlpha(0);
      this.tweens.add({ targets: beam, alpha: 0.9, duration: 110, yoyo: true, hold: 240, onComplete: () => beam.destroy() });
      const flash = this.add.circle(GAME_WIDTH / 2 - 60, 260, 12, COLORS.neon, 0.35);
      flash.setDepth(5);
      this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
      addFloatingLine(this, GAME_WIDTH / 2 - 40, 238, STRINGS.result.finalScan, COLORS.neon, 26, 900);
    });

    const answer = this.add.text(GAME_WIDTH / 2, 356, STRINGS.result.finalAnswer, {
      fontFamily: FONTS.display,
      fontSize: '48px',
      color: CSS.paper,
      fontStyle: 'bold',
      align: 'center',
    });
    answer.setOrigin(0.5);
    answer.setDepth(6);
    answer.setAlpha(0);

    this.time.delayedCall(2100, () => {
      audio.setMusic('none');
      this.tweens.add({ targets: [props, raccoon, stack, scanner], alpha: 0, duration: 480, ease: 'Sine.easeIn' });
      this.tweens.add({ targets: answer, alpha: 1, duration: 640, ease: 'Sine.easeOut' });
    });

    this.time.delayedCall(3200, () => {
      const stats = paperButton(this, 492, 592, 300, 56, STRINGS.result.finalStats, () => this.showFinalStats(), {
        fill: COLORS.rust,
        textColor: CSS.paper,
        accent: COLORS.warning,
        fontSize: 18,
      });
      stats.root.setDepth(7);
      stats.root.setAlpha(0);
      this.tweens.add({ targets: stats.root, alpha: 1, duration: 260 });
      const menu = paperButton(this, 800, 592, 240, 56, STRINGS.result.finalMenu, () => this.toMenu(), {
        fill: COLORS.coal,
        textColor: CSS.paper,
        accent: COLORS.warning,
        fontSize: 18,
      });
      menu.root.setDepth(7);
      menu.root.setAlpha(0);
      this.tweens.add({ targets: menu.root, alpha: 1, duration: 260 });
      this.bindFinalKeyboard();
    });
  }

  private showFinalStats(): void {
    audio.play('select');
    this.cameras.main.fadeOut(180, 23, 19, 16);
    this.time.delayedCall(200, () => {
      this.scene.restart({ payload: this.payload, record: false, showStats: true });
    });
  }

  private bindFinalKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }
    const onEnter = () => this.showFinalStats();
    const onEsc = () => this.toMenu();
    keyboard.on('keydown-ENTER', onEnter);
    keyboard.on('keydown-ESC', onEsc);
    this.cleanups.push(() => keyboard.off('keydown-ENTER', onEnter));
    this.cleanups.push(() => keyboard.off('keydown-ESC', onEsc));
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }
    const onEnter = () => this.onPrimary();
    const onEsc = () => this.toMenu();
    keyboard.on('keydown-ENTER', onEnter);
    keyboard.on('keydown-ESC', onEsc);
    this.cleanups.push(() => keyboard.off('keydown-ENTER', onEnter));
    this.cleanups.push(() => keyboard.off('keydown-ESC', onEsc));
  }

  private onPrimary(): void {
    if (this.payload.victory && this.payload.act === 1) {
      this.nextAct();
      return;
    }
    this.retry();
  }

  private retry(): void {
    audio.unlock();
    audio.play('select');
    const run = this.registry.get('run') as RunState | undefined;
    const act = this.payload.act === 2 ? 2 : 1;

    if (act === 2) {
      if (!this.payload.victory && run?.act2Door2Passed === true) {
        audio.setMusic('boss');
        this.cameras.main.fadeOut(220, 23, 19, 16);
        this.time.delayedCall(240, () => this.scene.start('WastelandBoss'));
        return;
      }
      beginAct2(this);
      this.registry.remove('act2IntroSeen');
      audio.setMusic('level');
      this.cameras.main.fadeOut(220, 23, 19, 16);
      this.time.delayedCall(240, () => this.scene.start('Island'));
      return;
    }

    const retryBoss = !this.payload.victory && run?.door2Passed === true;
    audio.setMusic(retryBoss ? 'boss' : 'level');
    if (!retryBoss) {
      resetRunState(this);
    }
    this.cameras.main.fadeOut(220, 23, 19, 16);
    this.time.delayedCall(240, () => this.scene.start(retryBoss ? 'Boss' : 'Level'));
  }

  private nextAct(): void {
    audio.unlock();
    audio.play('select');
    beginAct2(this);
    this.registry.remove('act2IntroSeen');
    audio.setMusic('level');
    this.cameras.main.fadeOut(320, 23, 19, 16);
    this.time.delayedCall(340, () => this.scene.start('Island'));
  }

  private toMenu(): void {
    audio.play('select');
    audio.setMusic('menu');
    this.scene.start('Menu');
  }

  private toCredits(): void {
    audio.play('select');
    this.scene.start('Credits', { returnTo: 'Result' });
  }
}