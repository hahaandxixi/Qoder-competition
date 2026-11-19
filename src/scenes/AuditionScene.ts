import Phaser from 'phaser';
import { music } from '../systems/MusicManager';

const FONT = '"Microsoft YaHei", system-ui, sans-serif';

type AuditionTrack = 'menu' | 'level' | 'boss' | 'victory';

interface AuditionItem {
  key: number;
  label: string;
  run: () => void;
}

export class AuditionScene extends Phaser.Scene {
  private startTrack: AuditionTrack = 'victory';
  private currentText!: Phaser.GameObjects.Text;
  private started = false;
  private items: AuditionItem[] = [];

  constructor() {
    super('AuditionScene');
  }

  init(data: { track?: string } | undefined): void {
    const t = data?.track;
    if (t === 'menu' || t === 'level' || t === 'boss' || t === 'victory') {
      this.startTrack = t;
    }
  }

  create(): void {
    this.started = false;
    this.cameras.main.setBackgroundColor(0x0a0e16);
    this.add
      .text(480, 66, '音乐试听室', {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(480, 108, '点击页面或按任意键启动音频 · 数字键切换 · B 静音', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#9aa9c6',
      })
      .setOrigin(0.5);

    this.items = [
      { key: 1, label: '菜单氛围《冷雨废土》', run: () => music.play('menu') },
      { key: 2, label: '跑图《紫电走廊》（含残血张力层）', run: () => music.play('level') },
      { key: 3, label: 'Boss《发布会暴走》', run: () => music.play('boss') },
      { key: 4, label: '胜利雷鬼 Jam《归名雷鬼》', run: () => music.play('victory') },
      { key: 5, label: '口琴式胜利乐句 fanfare', run: () => music.fanfare() },
      { key: 6, label: '受击心跳 5 秒（叠加在当前音乐上）', run: () => music.heartbeat(5000) },
    ];

    this.items.forEach((item, i) => {
      const y = 172 + i * 50;
      const rect = this.add
        .rectangle(480, y, 580, 40, 0x1c2740)
        .setStrokeStyle(1.5, 0x33456b)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(480, y, `${item.key}. ${item.label}`, {
          fontFamily: FONT,
          fontSize: '17px',
          color: '#cfd8ea',
        })
        .setOrigin(0.5);
      rect.on('pointerdown', () => this.playItem(item));
    });

    this.currentText = this.add
      .text(480, 492, '点击页面或按任意键开始试听', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#8ef0b0',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.begin(this.startTrack));
    this.input.keyboard?.once('keydown', () => this.begin(this.startTrack));
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = Number.parseInt(ev.key, 10);
      const item = this.items.find((it) => it.key === n);
      if (item) this.playItem(item);
    });
  }

  private begin(track: AuditionTrack): void {
    if (this.started) return;
    this.started = true;
    music.init();
    music.play(track);
    this.currentText.setText('正在播放：' + this.trackLabel(track));
  }

  private playItem(item: AuditionItem): void {
    this.begin(this.startTrack);
    item.run();
    this.currentText.setText('正在播放：' + item.label);
  }

  private trackLabel(track: AuditionTrack): string {
    switch (track) {
      case 'menu':
        return '菜单氛围《冷雨废土》';
      case 'level':
        return '跑图《紫电走廊》';
      case 'boss':
        return 'Boss《发布会暴走》';
      case 'victory':
        return '胜利雷鬼 Jam《归名雷鬼》';
    }
  }
}