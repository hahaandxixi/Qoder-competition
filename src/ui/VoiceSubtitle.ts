import Phaser from 'phaser';
import { speechBubble } from '../art/uiKit';
import { GAME_WIDTH } from '../config/balance';
import { COLORS } from '../config/theme';
import type { VoiceLine, VoicePresenter } from '../systems/VoiceSystem';

export function createVoicePresenter(scene: Phaser.Scene): VoicePresenter {
  let bubble: Phaser.GameObjects.Container | null = null;

  const hide = (immediate: boolean): void => {
    const current = bubble;
    bubble = null;
    if (!current || !current.active) {
      return;
    }
    scene.tweens.killTweensOf(current);
    if (immediate) {
      current.destroy(true);
      return;
    }
    scene.tweens.add({
      targets: current,
      alpha: 0,
      duration: 120,
      ease: 'Sine.easeIn',
      onComplete: () => current.destroy(true),
    });
  };

  return {
    show(line: VoiceLine, durationMs: number): void {
      hide(true);
      const camera = scene.cameras.main;
      const x = Phaser.Math.Clamp(line.x, camera.scrollX + 210, camera.scrollX + GAME_WIDTH - 210);
      const y = Phaser.Math.Clamp(line.y - 86, 120, 570);
      bubble = speechBubble(scene, x, y, `${line.speaker}：${line.text}`, {
        maxWidth: 390,
        fontSize: 15,
        color: line.color ?? COLORS.warning,
        tail: 'center',
      });
      bubble.setDepth(180);
      bubble.setAlpha(0);
      scene.tweens.add({
        targets: bubble,
        alpha: 1,
        duration: 120,
        ease: 'Sine.easeOut',
      });
      scene.tweens.add({
        targets: bubble,
        alpha: 0,
        delay: Math.max(360, durationMs - 180),
        duration: 160,
        ease: 'Sine.easeIn',
      });
    },
    hide(): void {
      hide(false);
    },
  };
}