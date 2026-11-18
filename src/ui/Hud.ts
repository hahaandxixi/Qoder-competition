import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, UI } from '../config/balance';
import { COLORS, CSS, FONTS } from '../config/theme';
import { STRINGS } from '../data';
import type { CardDef } from '../types/game';
import type { ActiveEffect } from '../systems/CardSystem';
import { audio } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { isTouchDevice } from './TouchControls';

export interface HudConfig {
  bossMode: boolean;
  onUseCard: (index: number) => void;
}

const CARD_KEYS = ['Z', 'X', 'C'];

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpValue!: Phaser.GameObjects.Text;
  private memeBar!: Phaser.GameObjects.Graphics;
  private memeValue!: Phaser.GameObjects.Text;
  private memeTitle!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private readonly cardsLayer: Phaser.GameObjects.Container;
  private readonly cardsTitle: Phaser.GameObjects.Text;
  private readonly hintRoot: Phaser.GameObjects.Container;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly hintBg: Phaser.GameObjects.Graphics;
  private readonly activeTexts: Phaser.GameObjects.Text[];
  private readonly bossRoot: Phaser.GameObjects.Container;
  private readonly bossBar: Phaser.GameObjects.Graphics;
  private readonly bossValue: Phaser.GameObjects.Text;
  private readonly bossName: Phaser.GameObjects.Text;
  private readonly bossPhase: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private readonly onUseCard: (index: number) => void;
  private toastRoot: Phaser.GameObjects.Container | null = null;
  private toastTween: Phaser.Tweens.Tween | null = null;
  private lastHint = '';
  private cleanups: Array<() => void> = [];

  constructor(scene: Phaser.Scene, config: HudConfig) {
    this.scene = scene;
    this.onUseCard = config.onUseCard;
    this.root = scene.add.container(0, 0);
    this.root.setScrollFactor(0);
    this.root.setDepth(UI.hudDepth);

    this.buildPlayerPanel();
    this.buildMemePanel(config.bossMode);
    this.buildMuteButton();

    const useCards = isTouchDevice() ? '点击梗卡使用' : STRINGS.hud.useCards;
    this.cardsTitle = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 112, `${STRINGS.hud.cardsLabel} · ${useCards}`, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paperDim,
    });
    this.cardsTitle.setOrigin(0.5, 0);
    this.root.add(this.cardsTitle);
    this.cardsLayer = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 72);
    this.root.add(this.cardsLayer);

    this.hintBg = scene.add.graphics();
    this.hintText = scene.add.text(0, 0, '', {
      fontFamily: FONTS.body,
      fontSize: '18px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    this.hintText.setOrigin(0.5);
    this.hintRoot = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 190, [this.hintBg, this.hintText]);
    this.hintRoot.setVisible(false);
    this.root.add(this.hintRoot);

    this.activeTexts = [];
    for (let i = 0; i < 3; i += 1) {
      const text = scene.add.text(GAME_WIDTH / 2 - 190 + i * 190, GAME_HEIGHT - 148, '', {
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: CSS.neon,
        fontStyle: 'bold',
      });
      text.setOrigin(0.5, 0);
      text.setVisible(false);
      this.activeTexts.push(text);
      this.root.add(text);
    }

    this.bossRoot = scene.add.container(0, 0);
    this.bossRoot.setVisible(false);
    this.root.add(this.bossRoot);
    const bossPanel = scene.add.graphics();
    bossPanel.fillStyle(COLORS.coal, 0.84);
    bossPanel.fillRect(392, 18, 536, 74);
    bossPanel.lineStyle(2, COLORS.paperDim, 0.65);
    bossPanel.strokeRect(392, 18, 536, 74);
    bossPanel.fillStyle(COLORS.rust, 0.9);
    bossPanel.fillRect(392, 18, 8, 74);
    this.bossRoot.add(bossPanel);
    this.bossName = scene.add.text(414, 26, '', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    this.bossPhase = scene.add.text(904, 30, '', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.warning,
    });
    this.bossPhase.setOrigin(1, 0);
    this.bossValue = scene.add.text(904, 52, '', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.paperDim,
    });
    this.bossValue.setOrigin(1, 0);
    this.bossBar = scene.add.graphics();
    this.bossRoot.add([this.bossName, this.bossPhase, this.bossValue, this.bossBar]);

    this.bindKeys();
    scene.events.once('shutdown', () => this.dispose());
  }

  private buildPlayerPanel(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.82);
    g.fillRect(24, 20, 344, 74);
    g.lineStyle(2, COLORS.paperDim, 0.72);
    g.strokeRect(24, 20, 344, 74);
    g.fillStyle(COLORS.warning, 0.92);
    g.fillRect(24, 20, 7, 74);
    g.fillStyle(COLORS.paper, 0.25);
    g.fillRect(338, 32, 3, 50);
    this.root.add(g);

    const label = this.scene.add.text(44, 28, STRINGS.hud.hpLabel, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.warning,
      fontStyle: 'bold',
    });
    this.hpValue = this.scene.add.text(44, 42, '100 / 100', {
      fontFamily: FONTS.mono,
      fontSize: '19px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    this.hpBar = this.scene.add.graphics();
    this.root.add([label, this.hpValue, this.hpBar]);
    this.updatePlayer(100, 100);
  }

  private buildMemePanel(bossMode: boolean): void {
    const y = bossMode ? 104 : 24;
    const x = GAME_WIDTH / 2 - 220;
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.8);
    g.fillRect(x, y, 440, 58);
    g.lineStyle(2, COLORS.paperDim, 0.55);
    g.strokeRect(x, y, 440, 58);
    g.fillStyle(COLORS.neon, 0.8);
    g.fillRect(x, y, 5, 58);
    this.root.add(g);
    this.memeTitle = this.scene.add.text(GAME_WIDTH / 2, y + 7, STRINGS.hud.memeLabel, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paperDim,
    });
    this.memeTitle.setOrigin(0.5, 0);
    this.memeValue = this.scene.add.text(x + 430, y + 7, '0%', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.warning,
      fontStyle: 'bold',
    });
    this.memeValue.setOrigin(1, 0);
    this.memeBar = this.scene.add.graphics();
    this.streakText = this.scene.add.text(x + 6, y + 40, '', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.neon,
    });
    this.root.add([this.memeTitle, this.memeValue, this.memeBar, this.streakText]);
    this.updateMeme(0, false, 0);
  }

  private buildMuteButton(): void {
    const x = GAME_WIDTH - 152;
    const y = 20;
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.82);
    g.fillRect(x, y, 128, 50);
    g.lineStyle(2, COLORS.paperDim, 0.55);
    g.strokeRect(x, y, 128, 50);
    this.root.add(g);
    this.muteText = this.scene.add.text(x + 64, y + 25, '', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    this.muteText.setOrigin(0.5);
    const zone = this.scene.add.zone(x + 64, y + 25, 128, 50).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    zone.on('pointerup', () => {
      this.toggleMute();
    });
    this.root.add([this.muteText, zone]);
    this.refreshMute();
  }

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }
    const bindings: Array<[string, () => void]> = [
      ['keydown-Z', () => this.onUseCard(0)],
      ['keydown-X', () => this.onUseCard(1)],
      ['keydown-C', () => this.onUseCard(2)],
      ['keydown-M', () => this.toggleMute()],
    ];
    bindings.forEach(([event, handler]) => {
      keyboard.on(event, handler);
      this.cleanups.push(() => keyboard.off(event, handler));
    });
  }

  private toggleMute(): void {
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    SaveSystem.setMuted(muted);
    this.refreshMute();
    audio.play('select');
  }

  private refreshMute(): void {
    this.muteText.setText(audio.isMuted() ? STRINGS.menu.muteOff : STRINGS.menu.muteOn);
    this.muteText.setColor(audio.isMuted() ? CSS.paperDim : CSS.neon);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  updatePlayer(hp: number, maxHp: number): void {
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.hpValue.setText(`${Math.max(0, Math.ceil(hp))} / ${maxHp}`);
    this.hpValue.setColor(ratio <= 0.3 ? CSS.rust : CSS.paper);
    this.hpBar.clear();
    drawSegmentBar(this.hpBar, 150, 52, 198, 14, ratio, ratio <= 0.3 ? COLORS.rust : COLORS.warning, 18);
    this.hpBar.fillStyle(COLORS.coal, 0.9);
    this.hpBar.fillRect(150 + 198 * ratio - 1, 48, 2, 22);
  }

  updateMeme(value: number, burstActive: boolean, streak: number): void {
    const ratio = Phaser.Math.Clamp(value / 100, 0, 1);
    this.memeBar.clear();
    drawSegmentBar(this.memeBar, GAME_WIDTH / 2 - 210, 52, 420, 13, ratio, burstActive ? COLORS.neon : COLORS.rust, 28);
    this.memeValue.setText(`${Math.round(value)}%`);
    this.memeValue.setColor(burstActive ? CSS.neon : CSS.warning);
    if (burstActive) {
      this.memeTitle.setText(`${STRINGS.hud.burst} · 双倍伤害`);
      this.memeTitle.setColor(CSS.neon);
      this.memeTitle.setAlpha(0.7 + Math.sin(this.scene.time.now / 100) * 0.3);
    } else {
      this.memeTitle.setText(STRINGS.hud.memeLabel);
      this.memeTitle.setColor(CSS.paperDim);
      this.memeTitle.setAlpha(1);
    }
    this.streakText.setText(streak > 1 ? `连对 ×${streak} · 倍率累积中` : '');
  }

  updateCards(cards: CardDef[]): void {
    this.cardsLayer.removeAll(true);
    const positions = [-132, 0, 132];
    for (let i = 0; i < 3; i += 1) {
      const card = cards[i];
      const container = this.scene.add.container(positions[i] ?? 0, 0);
      const g = this.scene.add.graphics();
      if (card) {
        const color = parseInt(card.color.replace('#', ''), 16);
        g.fillStyle(COLORS.coal, 0.86);
        g.fillRect(-58, -27, 116, 54);
        g.lineStyle(2, COLORS.paper, 0.88);
        g.strokeRect(-58, -27, 116, 54);
        g.fillStyle(color, 0.95);
        g.fillRect(-58, -27, 8, 54);
        g.fillStyle(COLORS.paper, 0.2);
        g.fillRect(-46, -20, 96, 2);
        const name = this.scene.add.text(-40, -17, card.name, {
          fontFamily: FONTS.body,
          fontSize: '19px',
          color: CSS.paper,
          fontStyle: 'bold',
        });
        const key = this.scene.add.text(48, -20, CARD_KEYS[i] ?? '', {
          fontFamily: FONTS.mono,
          fontSize: '12px',
          color: CSS.warning,
          fontStyle: 'bold',
        });
        key.setOrigin(1, 0);
        const stampText = this.scene.add.text(-40, 6, card.stamp, {
          fontFamily: FONTS.mono,
          fontSize: '10px',
          color: CSS.paperDim,
        });
        container.add([g, name, key, stampText]);
        const zone = this.scene.add.zone(0, 0, 116, 54).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        zone.on('pointerup', () => this.onUseCard(i));
        zone.on('pointerover', () => {
          g.lineStyle(2, color, 1);
          g.strokeRect(-58, -27, 116, 54);
        });
        zone.on('pointerout', () => {
          g.lineStyle(2, COLORS.paper, 0.88);
          g.strokeRect(-58, -27, 116, 54);
        });
        container.add(zone);
        container.setRotation((i - 1) * 0.015);
      } else {
        g.lineStyle(2, COLORS.paperDim, 0.32);
        g.strokeRect(-58, -27, 116, 54);
        g.fillStyle(COLORS.coal, 0.45);
        g.fillRect(-58, -27, 116, 54);
        const empty = this.scene.add.text(0, 0, STRINGS.hud.emptySlot, {
          fontFamily: FONTS.mono,
          fontSize: '12px',
          color: CSS.paperDim,
        });
        empty.setOrigin(0.5);
        empty.setAlpha(0.55);
        container.add([g, empty]);
      }
      this.cardsLayer.add(container);
    }
  }

  updateActiveEffects(effects: ActiveEffect[]): void {
    this.activeTexts.forEach((text, index) => {
      const effect = effects[index];
      if (!effect) {
        text.setVisible(false);
        return;
      }
      const seconds = (effect.remainingMs / 1000).toFixed(1);
      text.setText(`[${effect.label}] ${seconds}s`);
      text.setVisible(true);
      text.setAlpha(effect.remainingMs < 1200 ? 0.55 + Math.sin(this.scene.time.now / 70) * 0.35 : 1);
    });
  }

  setHint(text: string | null): void {
    if (!text) {
      this.lastHint = '';
      this.hintRoot.setVisible(false);
      return;
    }
    if (text === this.lastHint && this.hintRoot.visible) {
      return;
    }
    this.lastHint = text;
    this.hintText.setText(text);
    const width = this.hintText.width + 96;
    this.hintBg.clear();
    this.hintBg.fillStyle(COLORS.coal, 0.9);
    this.hintBg.fillRect(-width / 2, -20, width, 40);
    this.hintBg.lineStyle(2, COLORS.warning, 0.8);
    this.hintBg.strokeRect(-width / 2, -20, width, 40);
    this.hintBg.fillStyle(COLORS.warning, 1);
    this.hintBg.fillRect(-width / 2 + 10, -12, 24, 24);
    this.hintText.setX(12);
    const key = this.scene.add.text(-width / 2 + 22, 0, 'E', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    key.setOrigin(0.5);
    const existing = this.hintRoot.getAll().filter((obj) => obj !== this.hintBg && obj !== this.hintText);
    existing.forEach((obj) => obj.destroy());
    this.hintRoot.add(key);
    this.hintRoot.setVisible(true);
  }

  toast(text: string, tone: 'paper' | 'rust' | 'neon' = 'paper'): void {
    this.toastTween?.stop();
    this.toastRoot?.destroy(true);
    const color = tone === 'rust' ? COLORS.rust : tone === 'neon' ? COLORS.neon : COLORS.warning;
    const root = this.scene.add.container(GAME_WIDTH / 2, 434);
    root.setScrollFactor(0);
    root.setDepth(UI.overlayDepth - 1);
    const label = this.scene.add.text(0, 0, text, {
      fontFamily: FONTS.body,
      fontSize: '19px',
      color: CSS.paper,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 880 },
    });
    label.setOrigin(0.5);
    const width = Math.min(960, label.width + 70);
    const height = label.height + 28;
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.92);
    g.fillRect(-width / 2, -height / 2, width, height);
    g.lineStyle(2, color, 0.9);
    g.strokeRect(-width / 2, -height / 2, width, height);
    g.fillStyle(color, 1);
    g.fillRect(-width / 2, -height / 2, 8, height);
    g.fillStyle(COLORS.paper, 0.14);
    g.fillRect(-width / 2 + 20, height / 2 - 8, width - 40, 2);
    root.add([g, label]);
    root.setAlpha(0);
    root.setRotation(-0.01);
    this.toastRoot = root;
    this.scene.tweens.add({ targets: root, alpha: 1, y: 424, duration: 130, ease: 'Sine.easeOut' });
    this.toastTween = this.scene.tweens.add({
      targets: root,
      alpha: 0,
      delay: 1350,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        root.destroy(true);
        if (this.toastRoot === root) {
          this.toastRoot = null;
        }
      },
    });
  }

  updateBoss(name: string, title: string, hp: number, maxHp: number, phase: number, totalPhases: number): void {
    this.bossRoot.setVisible(true);
    this.bossName.setText(`${name} · ${title}`);
    this.bossPhase.setText(`${STRINGS.hud.phase} ${phase}/${totalPhases}`);
    this.bossValue.setText(`${STRINGS.hud.bossHp} ${Math.max(0, Math.ceil(hp))} / ${maxHp}`);
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.bossBar.clear();
    drawSegmentBar(this.bossBar, 414, 68, 490, 12, ratio, COLORS.rust, 24);
  }

  dispose(): void {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.toastTween?.stop();
    this.toastRoot?.destroy(true);
    this.toastRoot = null;
  }
}

function drawSegmentBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  color: number,
  segments: number,
): void {
  g.fillStyle(COLORS.coal, 0.9);
  g.fillRect(x, y, width, height);
  const gap = 2;
  const segmentWidth = (width - gap * (segments - 1)) / segments;
  const filledSegments = Math.round(ratio * segments);
  for (let i = 0; i < segments; i += 1) {
    if (i < filledSegments) {
      g.fillStyle(color, 1);
    } else {
      g.fillStyle(COLORS.coalFaint, 0.8);
    }
    g.fillRect(x + i * (segmentWidth + gap), y, segmentWidth, height);
  }
  g.lineStyle(1, COLORS.paper, 0.15);
  g.strokeRect(x, y, width, height);
}