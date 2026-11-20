import Phaser from 'phaser';
import { CARD, GAME_HEIGHT, GAME_WIDTH, UI } from '../config/balance';
import { COLORS, CSS, FONTS } from '../config/theme';
import { CARDS, STRINGS, shuffle } from '../data';
import type { CardDef } from '../types/game';
import type { CardSystem } from '../systems/CardSystem';
import { glitchText, paperPanel, stamp } from '../art/uiKit';
import { audio } from '../systems/AudioSystem';

export interface CardPickOverlayConfig {
  cards: CardSystem;
  slotsUsed: number;
  onClose: () => void;
}

/** 荒野岛补给签收：三选一，点击或数字键，选择后立即放进卡槽。 */
export class CardPickOverlay {
  private readonly scene: Phaser.Scene;
  private readonly config: CardPickOverlayConfig;
  private readonly root: Phaser.GameObjects.Container;
  private readonly options: CardDef[];
  private readonly cleanupKeys: Array<() => void> = [];
  private choosing = false;
  private closed = false;

  constructor(scene: Phaser.Scene, config: CardPickOverlayConfig) {
    this.scene = scene;
    this.config = config;
    this.options = shuffle(CARDS).slice(0, 3);
    this.root = scene.add.container(0, 0);
    this.root.setScrollFactor(0);
    this.root.setDepth(UI.overlayDepth + 20);
    this.build();
    this.bindKeys();
    scene.events.once('shutdown', () => this.cleanupOnly());
  }

  private build(): void {
    const dim = this.scene.add.graphics();
    dim.fillStyle(COLORS.coal, 0.72);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.root.add(dim);
    this.root.add(
      paperPanel(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 980, 500, {
        fill: COLORS.paper,
        jitter: 5,
      }),
    );

    const label = this.scene.add.text(GAME_WIDTH / 2 - 454, 126, 'ISLAND SUPPLY // 签收单', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
    });
    label.setAlpha(0.55);
    const title = glitchText(this.scene, GAME_WIDTH / 2, 150, STRINGS.door.rewardTitle, {
      fontFamily: FONTS.display,
      fontSize: '34px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    const sub = this.scene.add.text(GAME_WIDTH / 2, 182, '荒哥的备用补给，签一张带走。', {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: CSS.coal,
    });
    sub.setOrigin(0.5);
    sub.setAlpha(0.7);
    this.root.add([label, title, sub]);

    const centers = [430, 640, 850];
    this.options.forEach((card, index) => {
      this.root.add(this.makeCard(card, centers[index] ?? 640, 380, index));
    });

    const hint = this.scene.add.text(
      GAME_WIDTH / 2,
      568,
      '数字键 1 / 2 / 3 选择 · 点击卡片签收 · 卡槽最多 3 张',
      {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS.coal,
      },
    );
    hint.setOrigin(0.5);
    hint.setAlpha(0.6);
    this.root.add(hint);

    if (this.config.slotsUsed >= CARD.maxSlots) {
      const warning = this.scene.add.text(GAME_WIDTH / 2, 596, STRINGS.door.rewardFull, {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: CSS.rust,
      });
      warning.setOrigin(0.5);
      warning.setAlpha(0.75);
      this.root.add(warning);
    }
  }

  private makeCard(
    card: CardDef,
    x: number,
    y: number,
    index: number,
  ): Phaser.GameObjects.Container {
    const root = this.scene.add.container(x, y);
    const accentColor = Phaser.Display.Color.HexStringToColor(card.color);
    const accent = accentColor.color;
    const bright = accentColor.red * 0.299 + accentColor.green * 0.587 + accentColor.blue * 0.114 > 160;
    const nameColor = bright ? CSS.coal : CSS.paper;
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.coal, 0.3);
    g.fillRect(-86, -136, 180, 288);
    g.fillStyle(COLORS.paper, 1);
    g.fillRect(-90, -140, 180, 284);
    g.lineStyle(3, COLORS.coal, 0.9);
    g.strokeRect(-90, -140, 180, 284);
    g.fillStyle(accent, 0.92);
    g.fillRect(-90, -140, 180, 58);
    g.fillStyle(COLORS.coal, 0.22);
    for (let line = 0; line < 5; line += 1) {
      g.fillRect(-70, 36 + line * 15, 140 - line * 12, 2);
    }
    root.add(g);

    const name = this.scene.add.text(0, -102, card.name, {
      fontFamily: FONTS.display,
      fontSize: '25px',
      color: nameColor,
      fontStyle: 'bold',
    });
    name.setOrigin(0.5);
    const desc = this.scene.add.text(0, -10, card.desc, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.coal,
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: 154 },
    });
    desc.setOrigin(0.5);
    const quote = this.scene.add.text(0, 92, `“${card.quote}”`, {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: CSS.coal,
      align: 'center',
      wordWrap: { width: 150 },
    });
    quote.setOrigin(0.5);
    quote.setAlpha(0.62);
    const mark = stamp(this.scene, 48, 116, card.stamp, {
      color: COLORS.rust,
      fontSize: 13,
      angle: -0.12,
      alpha: 0.75,
    });
    const key = this.scene.add.text(-74, -126, String(index + 1), {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.paper,
      fontStyle: 'bold',
      backgroundColor: CSS.coal,
      padding: { x: 6, y: 2 },
    });
    key.setOrigin(0.5);
    root.add([name, desc, quote, mark, key]);

    const zone = this.scene.add.zone(x, y, 190, 290);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (!this.choosing) {
        root.setScale(1.04);
      }
    });
    zone.on('pointerout', () => root.setScale(1));
    zone.on('pointerdown', () => this.choose(index));
    this.root.add(zone);
    return root;
  }

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }
    const bindings: Array<[string, () => void]> = [
      ['keydown-ONE', () => this.choose(0)],
      ['keydown-TWO', () => this.choose(1)],
      ['keydown-THREE', () => this.choose(2)],
    ];
    bindings.forEach(([event, handler]) => {
      keyboard.on(event, handler);
      this.cleanupKeys.push(() => keyboard.off(event, handler));
    });
  }

  private choose(index: number): void {
    if (this.choosing || this.closed) {
      return;
    }
    const card = this.options[index];
    if (!card) {
      return;
    }
    this.choosing = true;
    audio.play('select');
    this.config.cards.acquire(card.id);
    this.scene.cameras.main.flash(90, 232, 178, 58, false);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 240,
      delay: 160,
      onComplete: () => this.close(),
    });
  }

  private close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cleanupOnly();
    this.root.destroy(true);
    this.config.onClose();
  }

  private cleanupOnly(): void {
    this.cleanupKeys.forEach((cleanup) => cleanup());
    this.cleanupKeys.length = 0;
  }
}
