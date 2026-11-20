import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH, WORLD } from './config/balance';
import { COLORS } from './config/theme';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelScene } from './scenes/LevelScene';
import { BossScene } from './scenes/BossScene';
import { ResultScene } from './scenes/ResultScene';
import { CreditsScene } from './scenes/CreditsScene';
import { AuditionScene } from './scenes/AuditionScene';
import { audio } from './systems/AudioSystem';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: COLORS.coal,
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: WORLD.gravityY },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, LevelScene, BossScene, ResultScene, CreditsScene, AuditionScene],
};

interface DebugWindow extends Window {
  __RACCOON_GAME__?: Phaser.Game;
  __RACCOON_AUDIO__?: typeof audio;
}

const game = new Phaser.Game(config);
if (import.meta.env.DEV) {
  (window as DebugWindow).__RACCOON_GAME__ = game;
  (window as DebugWindow).__RACCOON_AUDIO__ = audio;
}