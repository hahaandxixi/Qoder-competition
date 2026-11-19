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
    act: 1,
    door1Passed: false,
    door2Passed: false,
    act2Door1Passed: false,
    act2Door2Passed: false,
    act2BridgeCheckpoint: false,
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

/** 第一幕结算进入荒野岛：保留卡组与统计，重置本幕生命、梗浓度和门状态。 */
export function beginAct2(scene: Phaser.Scene): RunState {
  const run = getRunState(scene);
  const continuingAct2 = run.act === 2;
  run.act = 2;
  run.hp = PLAYER.maxHp;
  run.meme = 0;
  run.streak = 0;
  run.act2Door1Passed = false;
  run.act2Door2Passed = false;
  if (!continuingAct2) {
    run.act2BridgeCheckpoint = false;
  }
  return run;
}

export function getRunState(scene: Phaser.Scene): RunState {
  const stored = scene.registry.get(RUN_KEY) as RunState | undefined;
  if (stored && typeof stored.hp === 'number' && Array.isArray(stored.cards)) {
    stored.act = stored.act === 2 ? 2 : 1;
    stored.act2Door1Passed = stored.act2Door1Passed === true;
    stored.act2Door2Passed = stored.act2Door2Passed === true;
    stored.act2BridgeCheckpoint = stored.act2BridgeCheckpoint === true;
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