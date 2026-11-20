import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/balance';
import { audio, isTrackName, type TrackName } from '../systems/AudioSystem';

interface AuditionItem {
  key: number;
  label: string;
  run: () => void;
}

const FONT = 'system-ui, "Microsoft YaHei", sans-serif';

export class AuditionScene extends Phaser.Scene {
  private startTrack: TrackName = 'victory';
  private currentText!: Phaser.GameObjects.Text;
  private started = false;
  private items: AuditionItem[] = [];

  constructor() {
    super('Audition');
  }

  init(data: { track?: string } | undefined): void {
    if (isTrackName(data?.track)) {
      this.startTrack = data.track;
    }
  }

  create(): void {
    this.started = false;
    this.cameras.main.setBackgroundColor(0x171310);
    this.add
      .text(GAME_WIDTH / 2, 78, '音乐试听室', {
        fontFamily: FONT,
        fontSize: '38px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 124, '点击页面或按任意键启动音频 · 数字键切换 · B 静音', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#9aa9c6',
      })
      .setOrigin(0.5);

    this.items = [
      { key: 1, label: '菜单氛围《冷雨废土》', run: () => audio.setMusic('menu') },
      { key: 2, label: '跑图《紫电走廊》（含残血张力层）', run: () => audio.setMusic('level') },
      { key: 3, label: 'Boss《发布会暴走》', run: () => audio.setMusic('boss') },
      { key: 4, label: '胜利雷鬼 Jam《归名雷鬼》', run: () => audio.setResult(true) },
      { key: 5, label: '口琴式胜利乐句 fanfare', run: () => audio.fanfare() },
      { key: 6, label: '受击心跳 5 秒（叠加在当前音乐上）', run: () => audio.heartbeat(5000) },
    ];

    this.items.forEach((item, i) => {
      const y = 200 + i * 62;
      const rect = this.add
        .rectangle(GAME_WIDTH / 2, y, 660, 46, 0x1c2740)
        .setStrokeStyle(1.5, 0x33456b)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(GAME_WIDTH / 2, y, `${item.key}. ${item.label}`, {
          fontFamily: FONT,
          fontSize: '19px',
          color: '#cfd8ea',
        })
        .setOrigin(0.5);
      rect.on('pointerdown', () => this.playItem(item));
    });

    this.currentText = this.add
      .text(GAME_WIDTH / 2, 646, '点击页面或按任意键开始试听', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#8ef0b0',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.begin());
    this.input.keyboard?.once('keydown', () => this.begin());
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'b' || ev.key === 'B') {
        audio.setMuted(!audio.isMuted());
        this.currentText.setText(audio.isMuted() ? '已静音（按 B 恢复）' : '已恢复声音');
        return;
      }
      const n = Number.parseInt(ev.key, 10);
      const item = this.items.find((it) => it.key === n);
      if (item) {
        this.playItem(item);
      }
    });
  }

  private begin(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    audio.unlock();
    if (this.startTrack === 'victory') {
      audio.setResult(true);
    } else {
      audio.setMusic(this.startTrack);
    }
    this.currentText.setText('正在播放：' + this.trackLabel(this.startTrack));
  }

  private playItem(item: AuditionItem): void {
    this.begin();
    audio.unlock();
    item.run();
    this.currentText.setText('正在播放：' + item.label);
  }

  private trackLabel(track: TrackName): string {
    switch (track) {
      case 'menu':
        return '菜单氛围《冷雨废土》';
      case 'level':
        return '跑图《紫电走廊》';
      case 'boss':
        return 'Boss《发布会暴走》';
      case 'victory':
        return '胜利雷鬼 Jam《归名雷鬼》';
      default:
        return '';
    }
  }
}