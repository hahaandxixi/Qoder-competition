import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelScene } from './scenes/LevelScene';
import { BossScene } from './scenes/BossScene';
import { QuizScene } from './scenes/QuizScene';
import { ResultScene } from './scenes/ResultScene';
import { AuditionScene } from './scenes/AuditionScene';
import { music } from './systems/MusicManager';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#0a0e16',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 1800 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, LevelScene, BossScene, QuizScene, ResultScene, AuditionScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
(window as unknown as { __music: typeof music }).__music = music;