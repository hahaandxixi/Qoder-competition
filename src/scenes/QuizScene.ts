import Phaser from 'phaser';
import type { QuizData } from '../types';

const FONT = '"Microsoft YaHei", system-ui, sans-serif';

export class QuizScene extends Phaser.Scene {
  private quizData!: QuizData;
  private resolved = false;
  private buttons: Phaser.GameObjects.Rectangle[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private timerFill?: Phaser.GameObjects.Rectangle;
  private timerStart = 0;
  private timerTotal = 0;

  constructor() {
    super('QuizScene');
  }

  init(data: QuizData): void {
    this.quizData = data;
  }

  create(): void {
    const data = this.quizData;
    if (!data?.question) {
      this.scene.stop();
      return;
    }
    this.resolved = false;
    this.buttons = [];
    this.optionTexts = [];
    const { question } = data;
    const parry = data.mode === 'parry';

    this.add.rectangle(480, 270, 960, 540, 0x000000, 0.66).setInteractive();
    this.add
      .rectangle(480, 285, 700, 430, 0x101827, 0.97)
      .setStrokeStyle(2, parry ? 0xff7b55 : 0xffd166);

    this.add
      .text(480, 100, parry ? '梗弹反！认出招式里的梗' : '名字门 · 认梗开锁', {
        fontFamily: FONT,
        fontSize: '24px',
        color: parry ? '#ff9f7a' : '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    let promptY = 150;
    if (parry && question.bossLine) {
      this.add
        .text(480, promptY, `Boss：「${question.bossLine}」`, {
          fontFamily: FONT,
          fontSize: '18px',
          color: '#ffd9a0',
        })
        .setOrigin(0.5);
      promptY += 38;
    }
    this.add
      .text(480, promptY, question.prompt, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e8eefc',
        align: 'center',
        wordWrap: { width: 620 },
      })
      .setOrigin(0.5, 0);

    const startY = 252;
    const spacing = 50;
    question.options.forEach((opt, i) => {
      const btn = this.add
        .rectangle(480, startY + i * spacing, 560, 40, 0x1c2740)
        .setStrokeStyle(1.5, 0x33456b)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(480, startY + i * spacing, `${i + 1}. ${opt}`, {
          fontFamily: FONT,
          fontSize: '18px',
          color: '#cfd8ea',
        })
        .setOrigin(0.5);
      btn.on('pointerover', () => {
        if (!this.resolved) btn.setFillStyle(0x27385c);
      });
      btn.on('pointerout', () => btn.setFillStyle(0x1c2740));
      btn.on('pointerdown', () => this.choose(i));
      this.buttons.push(btn);
    });

    this.hintText = this.add
      .text(480, 446, parry ? '答对完美弹反，答错吃伤害' : '答错会给提示，可重试', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#9aa9c6',
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = Number.parseInt(ev.key, 10);
      if (n >= 1 && n <= question.options.length) this.choose(n - 1);
    });

    if (parry) {
      const limit = data.timeLimitMs ?? 2000;
      this.timerStart = this.time.now;
      this.timerTotal = limit;
      this.add.rectangle(480, 468, 600, 8, 0x22304a);
      this.timerFill = this.add.rectangle(180, 468, 600, 8, 0xff7b55).setOrigin(0, 0.5);
      this.time.delayedCall(limit, () => this.resolve(false, '超时！梗力不足'));
    }
  }

  update(): void {
    if (this.timerFill && this.timerTotal > 0) {
      const remain = Math.max(0, this.timerTotal - (this.time.now - this.timerStart));
      this.timerFill.width = 600 * (remain / this.timerTotal);
    }
  }

  private choose(index: number): void {
    if (this.resolved) return;
    const { question, mode } = this.quizData;
    const ok = question.options[index] === question.answer;
    if (mode === 'gate') {
      if (ok) {
        this.buttons[index]?.setStrokeStyle(2, 0x63d68b).setFillStyle(0x173a26);
        this.resolve(true, '认对了！');
      } else {
        this.buttons[index]?.setStrokeStyle(2, 0xd9534f).setFillStyle(0x3a1a1a);
        this.hintText.setText(`提示：${question.hint}`);
        this.cameras.main.shake(80, 0.003);
      }
      return;
    }
    if (ok) this.buttons[index]?.setStrokeStyle(2, 0x63d68b).setFillStyle(0x173a26);
    else this.buttons[index]?.setStrokeStyle(2, 0xd9534f).setFillStyle(0x3a1a1a);
    this.resolve(ok, ok ? '完美弹反！' : '梗力不足！');
  }

  private resolve(ok: boolean, msg = ''): void {
    if (this.resolved) return;
    this.resolved = true;
    if (msg) this.hintText.setText(msg);
    this.buttons.forEach((b) => b.disableInteractive());
    this.time.delayedCall(520, () => {
      this.quizData.onDone(ok);
      this.scene.stop();
    });
  }
}