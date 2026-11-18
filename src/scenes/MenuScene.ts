import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0e16);

    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, 960);
      const y = Phaser.Math.Between(0, 300);
      this.add.rectangle(x, y, 2, 2, 0x2a3550).setAlpha(Phaser.Math.FloatBetween(0.2, 0.7));
    }
    this.add
      .rectangle(480, 470, 960, 140, 0x141b2a)
      .setStrokeStyle(2, 0x22304a);

    this.add
      .text(480, 140, '浣熊火箭：无名氏危机', {
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        fontSize: '46px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(480, 192, '原型 v0.1 · 跑图段 + 梗弹反假 Boss', {
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        fontSize: '16px',
        color: '#9aa9c6',
      })
      .setOrigin(0.5);

    const lines = [
      'A / D 移动    空格 跳跃（可二段）    J 射击    K 冲刺    E 交互',
      '',
      '梗弹反：Boss 出招喊话时，2 秒内按 1 / 2 / 3 选对被偷走的梗',
      '答对 = 硬直反噬 + 获得梗卡；答错 = 吃伤害',
      '',
      '名字门：靠近按 E，四选一认出梗即可开锁',
    ];
    this.add
      .text(480, 280, lines.join('\n'), {
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        fontSize: '16px',
        color: '#cfd8ea',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(480, 420, '按 Enter 开始', {
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        fontSize: '24px',
        color: '#8ef0b0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('LevelScene'));
  }
}