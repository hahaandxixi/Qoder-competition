import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, QUIZ, UI } from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS } from '../data';
import type { QuestionSlip, QuizResult } from '../types/game';
import type { PreparedQuiz } from '../systems/QuizSystem';
import { audio } from '../systems/AudioSystem';
import { glitchText, makeTape, paperPanel, stamp } from '../art/uiKit';

export interface QuizOverlayConfig {
  mode: 'parry' | 'door';
  prepared: PreparedQuiz;
  windowMs: number;
  onResolve: (result: QuizResult) => void;
  onClose: () => void;
}

type OptionState = 'idle' | 'correct' | 'wrong' | 'dim';

interface OptionView {
  container: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
  setState: (state: OptionState) => void;
}

const KEY_EVENTS = ['keydown-ONE', 'keydown-TWO', 'keydown-THREE', 'keydown-FOUR'];

export class QuizOverlay {
  private readonly scene: Phaser.Scene;
  private readonly config: QuizOverlayConfig;
  private readonly root: Phaser.GameObjects.Container;
  private timerBar!: Phaser.GameObjects.Graphics;
  private secondsText!: Phaser.GameObjects.Text;
  private readonly optionViews: OptionView[] = [];
  private readonly keyboardCleanup: Array<() => void> = [];
  private elapsedMs = 0;
  private resolved = false;
  private closed = false;
  private lastTickSecond = -1;
  /** 计时从“选项清晰可读且输入已生效”开始：淡入完成后才起表。 */
  private armed = false;

  constructor(scene: Phaser.Scene, config: QuizOverlayConfig) {
    this.scene = scene;
    this.config = config;
    this.root = scene.add.container(0, 0);
    this.root.setScrollFactor(0);
    this.root.setDepth(UI.overlayDepth);
    this.root.setAlpha(0);

    if (config.mode === 'parry') {
      const built = this.buildParry();
      this.timerBar = built.timerBar;
      this.secondsText = built.secondsText;
    } else {
      const built = this.buildDoor();
      this.timerBar = built.timerBar;
      this.secondsText = built.secondsText;
    }

    this.bindKeyboard();
    scene.tweens.add({
      targets: this.root,
      alpha: 1,
      duration: 130,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.armed = true;
      },
    });
    scene.events.once('shutdown', () => this.cleanupOnly());
    this.updateTimer(this.config.windowMs);
  }

  private buildParry(): { timerBar: Phaser.GameObjects.Graphics; secondsText: Phaser.GameObjects.Text } {
    const band = this.scene.add.graphics();
    band.fillStyle(COLORS.coal, 0.975);
    band.fillPoints(
      [
        new Phaser.Geom.Point(0, 0),
        new Phaser.Geom.Point(GAME_WIDTH, 0),
        new Phaser.Geom.Point(GAME_WIDTH, 396),
        new Phaser.Geom.Point(1120, 406),
        new Phaser.Geom.Point(980, 398),
        new Phaser.Geom.Point(820, 410),
        new Phaser.Geom.Point(660, 396),
        new Phaser.Geom.Point(500, 408),
        new Phaser.Geom.Point(330, 397),
        new Phaser.Geom.Point(170, 407),
        new Phaser.Geom.Point(0, 396),
      ],
      true,
    );
    band.fillStyle(COLORS.rust, 0.95);
    band.fillRect(0, 0, GAME_WIDTH, 5);
    band.fillStyle(COLORS.warning, 0.85);
    band.fillRect(0, 5, 380, 2);
    this.root.add(band);

    const eyebrow = this.scene.add.text(32, 16, STRINGS.quiz.parryEyebrow, {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.warning,
      fontStyle: 'bold',
    });
    this.root.add(eyebrow);

    const live = this.scene.add.text(GAME_WIDTH - 32, 16, 'LIVE · 热搜 #404', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.neon,
      fontStyle: 'bold',
    });
    live.setOrigin(1, 0);
    this.root.add(live);

    const promptBg = this.scene.add.graphics();
    const slip = this.config.prepared.question.slip;
    const promptWidth = slip ? 860 : 1150;
    promptBg.fillStyle(COLORS.paper, 0.96);
    promptBg.fillRect(-promptWidth / 2, -25, promptWidth, 50);
    promptBg.lineStyle(2, COLORS.warning, 0.8);
    promptBg.strokeRect(-promptWidth / 2, -25, promptWidth, 50);
    promptBg.fillStyle(COLORS.rust, 1);
    promptBg.fillRect(-promptWidth / 2, -25, 7, 50);
    const promptText = this.scene.add.text(0, 0, this.config.prepared.question.prompt, {
      fontFamily: FONTS.body,
      fontSize: '22px',
      color: CSS.coal,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: promptWidth - 60 },
    });
    promptText.setOrigin(0.5);
    const prompt = this.scene.add.container(GAME_WIDTH / 2 - (slip ? 130 : 0), 78, [promptBg, promptText]);
    prompt.setRotation(-0.002);
    this.root.add(prompt);

    if (slip) {
      const flashback = this.makeSlipPanel(GAME_WIDTH - 152, 96, 208, 116, slip, {
        border: COLORS.warning,
        dense: true,
      });
      flashback.setRotation(0.045);
      this.root.add(flashback);
    }

    const timerLabel = this.scene.add.text(32, 107, STRINGS.quiz.timerLabel, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paperDim,
    });
    this.root.add(timerLabel);
    this.timerBar = this.scene.add.graphics();
    this.root.add(this.timerBar);
    this.secondsText = this.scene.add.text(GAME_WIDTH - 32, 104, '', {
      fontFamily: FONTS.mono,
      fontSize: '17px',
      color: CSS.warning,
      fontStyle: 'bold',
    });
    this.secondsText.setOrigin(1, 0);
    this.root.add(this.secondsText);

    const avatars = [TEX.avatarA, TEX.avatarB, TEX.avatarC];
    this.config.prepared.options.forEach((option, index) => {
      const y = 158 + index * 66;
      const view = this.createParryOption(option, index, y, avatars[index % avatars.length] ?? TEX.avatarA);
      this.optionViews.push(view);
      this.root.add(view.container);
    });

    const hint = this.scene.add.text(GAME_WIDTH / 2, 331, STRINGS.quiz.keyHint, {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.paperDim,
    });
    hint.setOrigin(0.5, 0);
    this.root.add(hint);

    return { timerBar: this.timerBar, secondsText: this.secondsText };
  }

  private createParryOption(
    option: string,
    index: number,
    y: number,
    avatar: string,
  ): OptionView {
    const width = 1120;
    const height = 56;
    const container = this.scene.add.container(GAME_WIDTH / 2, y);
    const bg = this.scene.add.graphics();
    const keyBox = this.scene.add.graphics();
    const keyLabel = this.scene.add.text(-521, 0, String(index + 1), {
      fontFamily: FONTS.mono,
      fontSize: '19px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    keyLabel.setOrigin(0.5);
    const avatarImage = this.scene.add.image(-476, 0, avatar);
    avatarImage.setDisplaySize(36, 36);
    const commenter = STRINGS.commenters[index % STRINGS.commenters.length] ?? '路人';
    const username = this.scene.add.text(-446, -18, `${commenter} · 刚刚`, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.coal,
    });
    username.setAlpha(0.62);
    const label = this.scene.add.text(-446, 4, option, {
      fontFamily: FONTS.body,
      fontSize: '22px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    label.setOrigin(0, 0.5);
    const rightHint = this.scene.add.text(537, 0, STRINGS.quiz.commentLabel, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.coal,
    });
    rightHint.setOrigin(1, 0.5);
    rightHint.setAlpha(0.45);

    const draw = (state: OptionState) => {
      bg.clear();
      keyBox.clear();
      const fill = state === 'correct' ? 0xe9dfc8 : state === 'wrong' ? 0xd8b0a0 : COLORS.paper;
      const border = state === 'correct' ? COLORS.neon : state === 'wrong' ? COLORS.rust : COLORS.coal;
      bg.fillStyle(COLORS.coal, 0.9);
      bg.fillRect(-width / 2 + 5, -height / 2 + 6, width, height);
      bg.fillStyle(fill, 1);
      bg.fillRect(-width / 2, -height / 2, width, height);
      bg.lineStyle(state === 'correct' ? 4 : 2, border, 1);
      bg.strokeRect(-width / 2, -height / 2, width, height);
      bg.fillStyle(state === 'correct' ? COLORS.neon : state === 'wrong' ? COLORS.rust : COLORS.warning, 1);
      bg.fillRect(-width / 2, -height / 2, 7, height);
      keyBox.fillStyle(COLORS.coal, 0.92);
      keyBox.fillRect(-543, -17, 44, 34);
      keyBox.lineStyle(1, COLORS.paper, 0.4);
      keyBox.strokeRect(-543, -17, 44, 34);
      keyLabel.setColor(CSS.paper);
      label.setColor(state === 'wrong' ? CSS.rust : CSS.coal);
      username.setColor(CSS.coal);
      rightHint.setColor(CSS.coal);
      container.setAlpha(state === 'dim' ? 0.38 : 1);
    };
    draw('idle');

    const zone = this.scene.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    zone.on('pointerover', () => {
      if (!this.resolved) {
        container.setScale(1.006);
        bg.lineStyle(2, COLORS.neon, 1);
        bg.strokeRect(-width / 2, -height / 2, width, height);
      }
    });
    zone.on('pointerout', () => {
      if (!this.resolved) {
        container.setScale(1);
        draw('idle');
      }
    });
    zone.on('pointerup', () => this.choose(index));

    container.add([bg, keyBox, keyLabel, avatarImage, username, label, rightHint, zone]);
    container.setRotation((index % 2 === 0 ? 1 : -1) * 0.002);
    return {
      container,
      zone,
      setState: (state: OptionState) => {
        draw(state);
        if (state !== 'idle') {
          container.setScale(1);
          zone.disableInteractive();
        }
      },
    };
  }

  private buildDoor(): { timerBar: Phaser.GameObjects.Graphics; secondsText: Phaser.GameObjects.Text } {
    const dim = this.scene.add.graphics();
    dim.fillStyle(COLORS.coal, 0.66);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.root.add(dim);

    const panel = paperPanel(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 900, 600, {
      fill: COLORS.paper,
      jitter: 5,
    });
    panel.setRotation(-0.004);
    this.root.add(panel);

    const eyebrow = this.scene.add.text(GAME_WIDTH / 2 - 400, 94, STRINGS.door.eyebrow, {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    this.root.add(eyebrow);
    const gateCode = this.scene.add.text(GAME_WIDTH / 2 + 400, 94, 'NAME GATE // FORM 404', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
    });
    gateCode.setOrigin(1, 0);
    gateCode.setAlpha(0.5);
    this.root.add(gateCode);

    const slip = this.config.prepared.question.slip;
    const titleY = slip ? 124 : 140;
    const subtitleY = slip ? 154 : 172;
    const promptY = slip ? 262 : 232;
    const optionStartY = slip ? 324 : 292;
    const optionStepY = slip ? 62 : 62;

    const title = glitchText(this.scene, GAME_WIDTH / 2, titleY, STRINGS.door.title, {
      fontSize: '38px',
      fontStyle: 'bold',
      color: CSS.coal,
    });
    this.root.add(title);

    const subtitle = this.scene.add.text(GAME_WIDTH / 2, subtitleY, STRINGS.door.subtitle, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: CSS.coal,
      align: 'center',
      wordWrap: { width: 780 },
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0.7);
    this.root.add(subtitle);

    if (slip) {
      const ticket = this.makeSlipPanel(GAME_WIDTH / 2, 194, 760, 56, slip, {
        border: COLORS.rust,
        horizontal: true,
      });
      ticket.setRotation(-0.004);
      this.root.add(ticket);
    }

    const promptBg = this.scene.add.graphics();
    promptBg.fillStyle(COLORS.coal, 0.92);
    promptBg.fillRect(-390, -38, 780, 76);
    promptBg.lineStyle(2, COLORS.rust, 0.8);
    promptBg.strokeRect(-390, -38, 780, 76);
    const promptText = this.scene.add.text(0, 0, this.config.prepared.question.prompt, {
      fontFamily: FONTS.body,
      fontSize: '22px',
      color: CSS.paper,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 740 },
    });
    promptText.setOrigin(0.5);
    const prompt = this.scene.add.container(GAME_WIDTH / 2, promptY, [promptBg, promptText]);
    this.root.add(prompt);

    this.config.prepared.options.forEach((option, index) => {
      const y = optionStartY + index * optionStepY;
      const view = this.createDoorOption(option, index, y);
      this.optionViews.push(view);
      this.root.add(view.container);
    });

    const timerLabel = this.scene.add.text(GAME_WIDTH / 2 - 390, 578, STRINGS.quiz.timerLabel, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    this.root.add(timerLabel);
    this.timerBar = this.scene.add.graphics();
    this.root.add(this.timerBar);
    this.secondsText = this.scene.add.text(GAME_WIDTH / 2 + 390, 574, '', {
      fontFamily: FONTS.mono,
      fontSize: '17px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    this.secondsText.setOrigin(1, 0);
    this.root.add(this.secondsText);

    const tape = makeTape(this.scene, GAME_WIDTH / 2 + 290, 88, 150, 26, COLORS.rust);
    tape.setRotation(0.07);
    this.root.add(tape);
    const gateStamp = stamp(this.scene, GAME_WIDTH / 2 + 386, 650, '404', {
      color: COLORS.rust,
      fontSize: 22,
      angle: -0.12,
      alpha: 0.6,
    });
    this.root.add(gateStamp);
    const hint = this.scene.add.text(GAME_WIDTH / 2, 626, '数字键 1 / 2 / 3 / 4 作答 · 点击选项也可', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
    });
    hint.setOrigin(0.5);
    hint.setAlpha(0.6);
    this.root.add(hint);

    return { timerBar: this.timerBar, secondsText: this.secondsText };
  }

  private createDoorOption(option: string, index: number, y: number): OptionView {
    const width = 780;
    const height = 58;
    const container = this.scene.add.container(GAME_WIDTH / 2, y);
    const bg = this.scene.add.graphics();
    const keyBox = this.scene.add.graphics();
    keyBox.fillStyle(COLORS.coal, 0.9);
    keyBox.fillRect(-372, -18, 36, 36);
    keyBox.lineStyle(1, COLORS.warning, 0.8);
    keyBox.strokeRect(-372, -18, 36, 36);
    const keyLabel = this.scene.add.text(-354, 0, String(index + 1), {
      fontFamily: FONTS.mono,
      fontSize: '19px',
      color: CSS.warning,
      fontStyle: 'bold',
    });
    keyLabel.setOrigin(0.5);
    const label = this.scene.add.text(-320, 0, option, {
      fontFamily: FONTS.body,
      fontSize: '22px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    label.setOrigin(0, 0.5);
    const arrow = this.scene.add.text(360, 0, '→', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: CSS.warning,
    });
    arrow.setOrigin(1, 0.5);

    const draw = (state: OptionState) => {
      bg.clear();
      const fill = state === 'correct' ? 0x2d4c43 : state === 'wrong' ? 0x5b2a20 : COLORS.coal;
      const border = state === 'correct' ? COLORS.neon : state === 'wrong' ? COLORS.rust : COLORS.coalSoft;
      bg.fillStyle(COLORS.coal, 0.35);
      bg.fillRect(-width / 2 + 4, -height / 2 + 5, width, height);
      bg.fillStyle(fill, 0.96);
      bg.fillRect(-width / 2, -height / 2, width, height);
      bg.lineStyle(state === 'correct' ? 3 : 2, border, state === 'idle' ? 0.7 : 1);
      bg.strokeRect(-width / 2, -height / 2, width, height);
      bg.fillStyle(state === 'correct' ? COLORS.neon : state === 'wrong' ? COLORS.rust : COLORS.warning, 1);
      bg.fillRect(-width / 2, -height / 2, 6, height);
      label.setColor(state === 'wrong' ? '#f0b3a2' : CSS.paper);
      container.setAlpha(state === 'dim' ? 0.36 : 1);
    };
    draw('idle');

    const zone = this.scene.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    zone.on('pointerover', () => {
      if (this.resolved) {
        return;
      }
      bg.lineStyle(2, COLORS.neon, 0.9);
      bg.strokeRect(-width / 2, -height / 2, width, height);
      container.setScale(1.006);
    });
    zone.on('pointerout', () => {
      if (!this.resolved) {
        container.setScale(1);
        draw('idle');
      }
    });
    zone.on('pointerup', () => this.choose(index));

    container.add([bg, keyBox, keyLabel, label, arrow, zone]);
    return {
      container,
      zone,
      setState: (state: OptionState) => {
        draw(state);
        if (state !== 'idle') {
          container.setScale(1);
          zone.disableInteractive();
        }
      },
    };
  }

  /**
   * 作答期间常驻的小票/面单：门模式横排展示三项，弹反模式竖排闪回。
   * 纯原创绘制，数据来自 questions.json 的 slip 字段。
   */
  private makeSlipPanel(
    x: number,
    y: number,
    w: number,
    h: number,
    slip: QuestionSlip,
    opts: { border: number; horizontal?: boolean; dense?: boolean },
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.coal, 0.4);
    bg.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
    bg.fillStyle(COLORS.paper, 0.97);
    bg.fillRect(-w / 2, -h / 2, w, h);
    bg.lineStyle(2, opts.border, 0.85);
    bg.strokeRect(-w / 2, -h / 2, w, h);
    bg.fillStyle(opts.border, 1);
    bg.fillRect(-w / 2, -h / 2, 6, h);
    // 撕纸边：底边锯齿
    bg.fillStyle(COLORS.paper, 0.97);
    for (let i = 0; i < w; i += 14) {
      bg.fillTriangle(-w / 2 + i, h / 2, -w / 2 + i + 14, h / 2, -w / 2 + i + 7, h / 2 + 5);
    }
    container.add(bg);

    if (opts.horizontal) {
      const label = this.scene.add.text(0, -h / 2 + 12, slip.title, {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS.rust,
        fontStyle: 'bold',
      });
      label.setOrigin(0.5);
      const fields = this.scene.add.text(0, 6, slip.lines.join('　　'), {
        fontFamily: FONTS.body,
        fontSize: '18px',
        color: CSS.coal,
        fontStyle: 'bold',
        align: 'center',
      });
      fields.setOrigin(0.5);
      container.add([label, fields]);
    } else {
      const label = this.scene.add.text(0, -h / 2 + 14, slip.title, {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS.rust,
        fontStyle: 'bold',
      });
      label.setOrigin(0.5);
      container.add(label);
      slip.lines.forEach((line, index) => {
        const text = this.scene.add.text(0, -h / 2 + 34 + index * (opts.dense ? 26 : 24), line, {
          fontFamily: FONTS.body,
          fontSize: opts.dense ? '15px' : '14px',
          color: CSS.coal,
          fontStyle: 'bold',
        });
        text.setOrigin(0.5);
        container.add(text);
      });
    }
    return container;
  }

  private bindKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }
    const count = Math.min(this.config.prepared.options.length, 4);
    for (let i = 0; i < count; i += 1) {
      const event = KEY_EVENTS[i];
      if (!event) {
        continue;
      }
      const handler = () => this.choose(i);
      keyboard.on(event, handler);
      this.keyboardCleanup.push(() => keyboard.off(event, handler));
    }
  }

  private choose(index: number): void {
    if (this.resolved) {
      return;
    }
    const option = this.config.prepared.options[index];
    if (option === undefined) {
      return;
    }
    this.resolve(option, index);
  }

  private resolve(chosen: string | null, chosenIndex: number | null): void {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.keyboardCleanup.forEach((cleanup) => cleanup());
    this.keyboardCleanup.length = 0;

    const timedOut = chosen === null;
    const correct = !timedOut && chosen === this.config.prepared.question.answer;
    const result: QuizResult = {
      correct,
      timedOut,
      chosen,
      answer: this.config.prepared.question.answer,
    };

    this.optionViews.forEach((view, index) => {
      if (index === this.config.prepared.answerIndex) {
        view.setState('correct');
      } else if (chosenIndex !== null && index === chosenIndex) {
        view.setState('wrong');
      } else {
        view.setState('dim');
      }
    });

    const stampText = correct
      ? this.config.prepared.question.correctStamp ??
        (this.config.mode === 'door' ? STRINGS.door.openStamp : STRINGS.quiz.correctStamp)
      : timedOut
        ? STRINGS.quiz.timeoutStamp
        : STRINGS.quiz.wrongStamp;
    // 弹反模式的判定章放在中线右侧偏上，避开 Boss 额头的反击印章（约 x930, y408）。
    const mark = stamp(
      this.scene,
      this.config.mode === 'parry' ? GAME_WIDTH / 2 + 170 : GAME_WIDTH / 2 + 280,
      this.config.mode === 'parry' ? 356 : 554,
      stampText,
      {
        color: correct ? COLORS.neon : COLORS.rust,
        fontSize: this.config.mode === 'parry' ? 24 : 26,
        angle: correct ? -0.05 : 0.07,
        alpha: 0.95,
      },
    );
    this.root.add(mark);
    mark.setScale(1.8);
    this.scene.tweens.add({ targets: mark, scale: 1, duration: 170, ease: 'Back.easeOut' });

    const resultText = this.scene.add.text(
      GAME_WIDTH / 2 - 160,
      this.config.mode === 'parry' ? 370 : 554,
      `${STRINGS.quiz.answerWas}：${this.config.prepared.question.answer}`,
      {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: correct ? CSS.neon : CSS.warning,
        fontStyle: 'bold',
        backgroundColor: CSS.coal,
        padding: { x: 10, y: 4 },
      },
    );
    resultText.setOrigin(0.5);
    this.root.add(resultText);

    if (correct) {
      audio.play(this.config.mode === 'door' ? 'door' : 'parry');
    } else {
      audio.play('fail');
    }

    this.config.onResolve(result);
    const revealMs = this.config.mode === 'door' ? 1350 : QUIZ.parryRevealMs;
    this.scene.time.delayedCall(revealMs, () => this.close());
  }

  update(deltaMs: number): void {
    if (this.resolved || this.closed || !this.armed) {
      return;
    }
    this.elapsedMs += deltaMs;
    const remaining = Math.max(0, this.config.windowMs - this.elapsedMs);
    this.updateTimer(remaining);

    const second = Math.ceil(remaining / 1000);
    if (remaining > 0 && second !== this.lastTickSecond && second <= 3) {
      this.lastTickSecond = second;
      audio.play('tick');
    }
    if (remaining <= 0) {
      this.resolve(null, null);
    }
  }

  private updateTimer(remainingMs: number): void {
    const ratio = this.config.windowMs > 0 ? Math.max(0, Math.min(1, remainingMs / this.config.windowMs)) : 0;
    const isParry = this.config.mode === 'parry';
    const x = isParry ? 32 : GAME_WIDTH / 2 - 390;
    const y = isParry ? 112 : 597;
    const width = isParry ? GAME_WIDTH - 156 : 780;
    this.timerBar.clear();
    this.timerBar.fillStyle(COLORS.coal, 0.9);
    this.timerBar.fillRect(x, y, width, 12);
    const color = isParry
      ? ratio < 0.3
        ? COLORS.rust
        : COLORS.warning
      : ratio < 0.25
        ? COLORS.rust
        : COLORS.coal;
    this.timerBar.fillStyle(color, 1);
    this.timerBar.fillRect(x, y, width * ratio, 12);
    this.timerBar.lineStyle(1, COLORS.paper, isParry ? 0.3 : 0.18);
    for (let i = 1; i < 10; i += 1) {
      this.timerBar.lineBetween(x + (width / 10) * i, y, x + (width / 10) * i, y + 12);
    }
    this.timerBar.strokeRect(x, y, width, 12);
    this.secondsText.setText(`${(remainingMs / 1000).toFixed(1)}s`);
    this.secondsText.setColor(
      ratio < 0.3 ? CSS.rust : this.config.mode === 'parry' ? CSS.warning : CSS.coal,
    );
  }

  isResolved(): boolean {
    return this.resolved;
  }

  cancel(): void {
    if (this.closed) {
      return;
    }
    this.resolved = true;
    this.closed = true;
    this.cleanupOnly();
    this.root.destroy(true);
    this.config.onClose();
  }

  private close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cleanupOnly();
    this.root.destroy(true);
    this.config.onClose();
  }

  private cleanupOnly(): void {
    this.keyboardCleanup.forEach((cleanup) => cleanup());
    this.keyboardCleanup.length = 0;
  }
}