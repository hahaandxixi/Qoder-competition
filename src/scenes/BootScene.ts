import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.makeTextures();
    this.scene.start('MenuScene');
  }

  private makeTextures(): void {
    const g = this.add.graphics();

    // raccoon hero (26x26)
    g.fillStyle(0x8d939e).fillRoundedRect(3, 9, 16, 13, 4);
    g.fillStyle(0x4b5058).fillRect(21, 6, 5, 11);
    g.fillStyle(0x6f7580).fillRect(21, 6, 5, 3);
    g.fillStyle(0xb9bec7).fillRoundedRect(6, 2, 12, 10, 4);
    g.fillStyle(0x2a2d33).fillRect(6, 5, 12, 3);
    g.fillStyle(0xffffff).fillRect(8, 5, 2, 2);
    g.fillStyle(0xffffff).fillRect(14, 5, 2, 2);
    g.fillStyle(0x2a2d33).fillRect(11, 9, 3, 2);
    g.fillStyle(0xff7b00).fillRect(1, 10, 3, 9);
    g.fillStyle(0xffd166).fillRect(0, 15, 2, 3);
    g.generateTexture('raccoon', 26, 26);
    g.clear();

    // ground tile (64x32)
    g.fillStyle(0x1c2433).fillRect(0, 0, 64, 32);
    g.fillStyle(0x2f3d55).fillRect(0, 0, 64, 5);
    g.fillStyle(0x151b27).fillRect(6, 12, 8, 4);
    g.fillStyle(0x151b27).fillRect(34, 20, 10, 4);
    g.generateTexture('ground', 64, 32);
    g.clear();

    // platform (96x18)
    g.fillStyle(0x232e42).fillRect(0, 0, 96, 18);
    g.fillStyle(0x3a4a66).fillRect(0, 0, 96, 4);
    g.fillStyle(0x161e2c).fillRect(10, 9, 12, 4);
    g.fillStyle(0x161e2c).fillRect(56, 9, 12, 4);
    g.generateTexture('platform', 96, 18);
    g.clear();

    // opossum enemy (24x18)
    g.fillStyle(0xa4a9b2).fillRoundedRect(2, 4, 16, 12, 4);
    g.fillStyle(0xd9dde3).fillRoundedRect(12, 2, 10, 8, 3);
    g.fillStyle(0xf0a6c0).fillRect(20, 5, 3, 2);
    g.fillStyle(0x2a2d33).fillRect(15, 4, 2, 2);
    g.generateTexture('opossum', 24, 18);
    g.clear();

    // lobster bot (22x20)
    g.fillStyle(0xc0392b).fillRoundedRect(3, 4, 14, 13, 4);
    g.fillStyle(0xe74c3c).fillRect(1, 2, 5, 5);
    g.fillStyle(0xe74c3c).fillRect(16, 2, 5, 5);
    g.fillStyle(0xffd166).fillRect(7, 8, 2, 2);
    g.fillStyle(0xffd166).fillRect(11, 8, 2, 2);
    g.generateTexture('lobster', 22, 20);
    g.clear();

    // abstract boss figure (72x88), deliberately no facial features
    g.fillStyle(0x5a1f2e).fillRoundedRect(6, 28, 60, 56, 8);
    g.fillStyle(0x3d1420).fillRect(14, 34, 44, 8);
    g.fillStyle(0xd8c3a5).fillRoundedRect(24, 6, 24, 22, 6);
    g.fillStyle(0x7a2438).fillRect(33, 34, 6, 26);
    g.fillStyle(0xf4d58d).fillRect(9, 46, 8, 4);
    g.fillStyle(0xf4d58d).fillRect(55, 46, 8, 4);
    g.generateTexture('boss', 72, 88);
    g.clear();

    // meme gate (44x60)
    g.fillStyle(0x3a2a12).fillRect(0, 0, 44, 60);
    g.lineStyle(3, 0xffd166);
    g.strokeRect(1.5, 1.5, 41, 57);
    g.fillStyle(0xffd166).fillCircle(22, 24, 9);
    g.fillStyle(0x3a2a12).fillCircle(22, 24, 5);
    g.fillStyle(0xffd166).fillRect(20, 28, 4, 14);
    g.generateTexture('gate', 44, 60);
    g.clear();

    // bullet (8x4)
    g.fillStyle(0xffd166).fillRoundedRect(0, 0, 8, 4, 2);
    g.fillStyle(0xfff3d0).fillRect(4, 0, 4, 4);
    g.generateTexture('bullet', 8, 4);
    g.clear();

    // spark (4x4)
    g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
    g.generateTexture('spark', 4, 4);
    g.destroy();
  }
}