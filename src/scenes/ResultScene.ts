import Phaser from 'phaser';
import { music } from '../systems/MusicManager';

const FONT = '"Microsoft YaHei", system-ui, sans-serif';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data: { win?: boolean }): void {
    const win = !!data?.win;
    this.cameras.main.setBackgroundColor(win ? 0x0d1a12 : 0x1a0d0d);
    if (win) {
      music.setDuck(false);
      music.setTension(false);
      music.fanfare();
      this.time.delayedCall(1600, () => music.play('victory'));
    } else {
      music.stop();
    }

    this.add
      .text(480, 190, win ? '通关！梗力全开' : '你被无名氏拿捏了', {
        fontFamily: FONT,
        fontSize: '42px',
        color: win ? '#8ef0b0' : '#ff9c9c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(480, 260, win ? '梗被夺回，世界的名字又亮了一点。' : '再试一次，认梗就是力量。', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#cfd8ea',
      })
      .setOrigin(0.5);
    this.add
      .text(480, 370, '按 R 重新开始    按 M 回主菜单', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-R', () => this.scene.start('LevelScene'));
    this.input.keyboard?.once('keydown-M', () => this.scene.start('MenuScene'));
  }
}