import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import type { RunState } from '../types/game';

const RUN_KEY = 'run';

export function createRunState(): RunState {
  return {
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    meme: 0,
    streak: 0,
    cards: [],
    doorPassed: false,
    startedAt: Date.now(),
    stats: {
      correct: 0,
      wrong: 0,
      timeouts: 0,
      parries: 0,
      cardsCollected: 0,
      enemiesDefeated: 0,
    },
  };
}

export function getRunState(scene: Phaser.Scene): RunState {
  const stored = scene.registry.get(RUN_KEY) as RunState | undefined;
  if (stored && typeof stored.hp === 'number' && Array.isArray(stored.cards)) {
    return stored;
  }
  const run = createRunState();
  scene.registry.set(RUN_KEY, run);
  return run;
}

export function setRunState(scene: Phaser.Scene, run: RunState): void {
  scene.registry.set(RUN_KEY, run);
}

export function resetRunState(scene: Phaser.Scene): RunState {
  const run = createRunState();
  scene.registry.set(RUN_KEY, run);
  return run;
}

export function elapsedMs(run: RunState): number {
  return Math.max(0, Date.now() - run.startedAt);
}