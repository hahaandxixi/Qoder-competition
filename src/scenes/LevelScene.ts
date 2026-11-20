import Phaser from 'phaser';
import {
  CARD,
  COMBAT,
  ENEMY,
  GAME_HEIGHT,
  GAME_WIDTH,
  HAZARD,
  MEME,
  PLAYER,
  QUIZ,
  UI,
  WORLD,
} from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { CARDS, STRINGS, getQuestion, shuffle } from '../data';
import type { CardDef, ResultPayload, RunState } from '../types/game';
import {
  addFloatingLine,
  addHotTag,
  addScanlines,
  damagePopup,
  glitchText,
  makeTape,
  paperPanel,
  pixelBurst,
  stamp,
} from '../art/uiKit';
import { Player, type PlayerCallbacks } from '../entities/Player';
import { Enemy, type EnemyHost } from '../entities/Enemy';
import { Ally } from '../entities/Ally';
import { Hud } from '../ui/Hud';
import { QuizOverlay } from '../ui/QuizOverlay';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { CardSystem, type CardHost } from '../systems/CardSystem';
import { MemeMeter } from '../systems/MemeMeter';
import { QuizSystem } from '../systems/QuizSystem';
import { elapsedMs, getRunState } from '../systems/RunState';
import { audio } from '../systems/AudioSystem';

const GROUND_SEGMENTS: Array<[number, number]> = [
  [0, 1200],
  [1370, 1030],
  [2560, 1140],
  [3840, 1060],
  [5050, 1550],
];

const PLATFORMS: Array<[number, number, number, number]> = [
  [380, 542, 170, 26],
  [720, 468, 190, 26],
  [1030, 546, 140, 24],
  [1220, 470, 160, 26],
  [1530, 500, 210, 26],
  [1880, 426, 170, 26],
  [2180, 520, 230, 26],
  [2410, 458, 180, 26],
  [2720, 520, 190, 26],
  [3000, 438, 210, 26],
  [3330, 540, 170, 26],
  [3650, 476, 180, 26],
  [4010, 548, 130, 24],
  [4200, 470, 180, 26],
  [4740, 520, 200, 26],
  [4980, 470, 160, 26],
  [5250, 520, 190, 26],
  [5580, 438, 200, 26],
  [5880, 350, 160, 24],
  [5950, 528, 190, 26],
];

const DOOR_X = 4440;
const EXIT_X = 6340;
const CHECKPOINT_X = 4600;

export class LevelScene extends Phaser.Scene {
  private run!: RunState;
  private player!: Player;
  private hud!: Hud;
  private touch: TouchControls | null = null;
  private meme!: MemeMeter;
  private cards!: CardSystem;
  private readonly quizSystem = new QuizSystem();
  private quizOverlay: QuizOverlay | null = null;
  private readonly solids: Phaser.GameObjects.Rectangle[] = [];
  private readonly hazards: Phaser.GameObjects.Rectangle[] = [];
  private readonly enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private ally: Ally | null = null;
  private midLayer!: Phaser.GameObjects.TileSprite;
  private eKey: Phaser.Input.Keyboard.Key | null = null;
  private doorVisual: Phaser.GameObjects.Container | null = null;
  private doorLight: Phaser.GameObjects.Arc | null = null;
  private doorScreenCode: Phaser.GameObjects.Text | null = null;
  private doorScreenHint: Phaser.GameObjects.Text | null = null;
  private doorBlock: Phaser.GameObjects.Rectangle | null = null;
  private doorCollider: Phaser.Physics.Arcade.Collider | null = null;
  private gate2Window: Phaser.GameObjects.Container | null = null;
  private gate2Paper: Phaser.GameObjects.Graphics | null = null;
  private gate2ReelA: Phaser.GameObjects.Container | null = null;
  private gate2ReelB: Phaser.GameObjects.Container | null = null;
  private gate2Block: Phaser.GameObjects.Rectangle | null = null;
  private gate2Collider: Phaser.Physics.Arcade.Collider | null = null;
  private rewardRoot: Phaser.GameObjects.Container | null = null;
  private rewardCleanups: Array<() => void> = [];
  private rewardOpen = false;
  private quizOpen = false;
  private gate1Passed = false;
  private gate2Passed = false;
  private gate2Far = false;
  private gateAnimating = false;
  private nearDoor = false;
  private nearExit = false;
  private respawning = false;
  private finished = false;
  private transitioning = false;
  private spawnPoint = { x: 150, y: 560 };
  private pendingReason = '网络热度归零';
  private lastRunDust = 0;
  private cardsChangedHandler: (() => void) | null = null;
  private selectingReward = false;

  constructor() {
    super('Level');
  }

  create(): void {
    this.quizOpen = false;
    this.rewardOpen = false;
    this.respawning = false;
    this.finished = false;
    this.transitioning = false;
    this.selectingReward = false;
    this.ally = null;
    this.quizOverlay = null;
    this.doorVisual = null;
    this.doorLight = null;
    this.doorScreenCode = null;
    this.doorScreenHint = null;
    this.doorBlock = null;
    this.doorCollider = null;
    this.gate2Window = null;
    this.gate2Paper = null;
    this.gate2ReelA = null;
    this.gate2ReelB = null;
    this.gate2Block = null;
    this.gate2Collider = null;
    this.rewardRoot = null;
    this.rewardCleanups = [];
    this.gateAnimating = false;
    this.gate2Far = false;
    this.solids.length = 0;
    this.hazards.length = 0;
    this.enemies.length = 0;
    this.cardsChangedHandler = null;
    this.lastRunDust = 0;

    this.run = getRunState(this);
    this.run.act = 1;
    if (this.run.hp <= 0) {
      this.run.hp = PLAYER.maxHp;
    }
    this.gate1Passed = this.run.door1Passed;
    this.gate2Passed = this.run.door2Passed;
    this.spawnPoint = this.gate2Passed
      ? { x: 6180, y: 560 }
      : this.gate1Passed
        ? { x: CHECKPOINT_X, y: 560 }
        : { x: 150, y: 560 };
    this.pendingReason = '网络热度归零';

    this.physics.world.setBounds(0, 0, WORLD.levelWidth, 1000);
    this.cameras.main.setBounds(0, 0, WORLD.levelWidth, GAME_HEIGHT);
    this.cameras.main.fadeIn(260, 23, 19, 16);
    audio.resetSceneMix();
    audio.setMusic('level');

    this.buildBackground();
    this.buildGeometry();
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.run.hp, this.makePlayerCallbacks());
    this.meme = new MemeMeter(this.run);
    this.initGroups();
    this.spawnEnemies();
    this.setupCollisions();
    this.buildGateBlocks();
    this.setupHud();
    this.setupTouch();
    this.setupCamera();
    this.eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E) ?? null;

    this.showIntro();
    addScanlines(this, 90);
    this.events.once('shutdown', () => this.cleanupScene());
  }

  override update(time: number, delta: number): void {
    if (!this.player) {
      return;
    }
    this.midLayer.tilePositionX = this.cameras.main.scrollX * 0.32;

    if (!this.finished) {
      this.player.tick(time, delta);
      this.quizOverlay?.update(delta);

      if (!this.quizOpen && !this.rewardOpen) {
        this.enemies.forEach((enemy) => enemy.tick(time));
      }
      this.tickAlly(time);
      this.cleanupProjectiles(time);
      this.updateRunDust(time);
      this.updateInteractions();

      if (!this.respawning && !this.transitioning && this.player.y > WORLD.fallDamageY) {
        this.handleFall();
      }

      this.hud.updatePlayer(this.player.getHp(), this.player.getMaxHp());
      audio.setTension(this.player.getHp() <= this.player.getMaxHp() * PLAYER.lowHpRatio);
      this.hud.updateMeme(this.meme.getValue(), this.meme.isBurstActive(), this.meme.getStreak());
      this.cards.update(delta);
      this.hud.updateActiveEffects(this.cards.getActiveEffects());
      this.meme.update(delta);
      this.run.hp = this.player.getHp();
      this.meme.sync(this.run);
      this.run.cards = [...this.run.cards];
    }
  }

  private makePlayerCallbacks(): PlayerCallbacks {
    return {
      fireShot: (x, y, facing) => this.firePlayerShot(x, y, facing),
      dashTrail: (x, y) => this.spawnDashDust(x, y),
      jumped: (doubleJump) => this.spawnJumpDust(doubleJump),
      damaged: (amount, hp) => {
        this.run.hp = hp;
        this.cameras.main.shake(110, COMBAT.cameraShakeLight);
        this.cameras.main.flash(70, 120, 30, 22, false);
        damagePopup(this, this.player.x, this.player.y - 62, `-${amount}`, COLORS.rust, 30);
      },
      died: () => this.handleDeath(),
      shieldBroke: () => {
        this.hud.toast(STRINGS.toasts.shieldBreak, 'neon');
        pixelBurst(this, this.player.x, this.player.y, COLORS.neon, 10, 1.2);
        this.cameras.main.flash(90, 75, 227, 200, false);
      },
    };
  }

  private buildBackground(): void {
    this.add.image(0, 0, TEX.skyFar).setOrigin(0).setScrollFactor(0).setDepth(-30);
    this.midLayer = this.add.tileSprite(0, 280, GAME_WIDTH, 440, TEX.skyMid);
    this.midLayer.setOrigin(0);
    this.midLayer.setScrollFactor(0);
    this.midLayer.setDepth(-20);
    this.midLayer.setAlpha(0.72);

    for (let i = 0; i < 16; i += 1) {
      const dust = this.add.image(
        Phaser.Math.Between(100, WORLD.levelWidth - 100),
        Phaser.Math.Between(180, 600),
        TEX.dust,
      );
      dust.setDepth(-10);
      dust.setAlpha(Phaser.Math.FloatBetween(0.08, 0.2));
      dust.setTint(i % 3 === 0 ? COLORS.warning : COLORS.paper);
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(40, 160),
        y: dust.y - Phaser.Math.Between(20, 70),
        duration: Phaser.Math.Between(6000, 12000),
        repeat: -1,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private buildGeometry(): void {
    GROUND_SEGMENTS.forEach(([x, width], index) => {
      this.drawGround(x, width, index);
    });

    PLATFORMS.forEach(([x, y, w, h], index) => {
      this.drawPlatform(x, y, w, h, index);
    });

    this.drawPitMarkers();
    this.drawHazard(960);
    this.drawHazard(3930);
    this.drawHazard(5150);
    this.drawDoor();
    this.drawExit();
    this.drawTutorialSigns();
    this.drawCheckpointSign();
  }

  private drawGround(x: number, width: number, index: number): void {
    const y = 636;
    const height = 84;
    const centerX = x + width / 2;
    this.addSolid(centerX, y + height / 2, width, height);

    const g = this.add.graphics();
    g.setDepth(10);
    g.fillStyle(COLORS.coalSoft, 1);
    g.fillRect(x, y, width, height);
    g.fillStyle(0x4a3a29, 1);
    g.fillRect(x, y, width, 24);
    g.fillStyle(COLORS.paperDark, 0.9);
    g.fillRect(x, y, width, 5);
    g.fillStyle(COLORS.rust, 0.7);
    g.fillRect(x, y + 5, width, 3);
    g.lineStyle(1, COLORS.coal, 0.7);
    for (let sx = x + 60; sx < x + width; sx += 120) {
      g.lineBetween(sx, y + 24, sx, y + height);
    }
    g.fillStyle(COLORS.coal, 0.35);
    for (let sx = x + 20; sx < x + width; sx += 240) {
      g.fillRect(sx, y + 38, 110, 3);
      g.fillRect(sx, y + 48, 74, 2);
    }
    g.fillStyle(COLORS.warning, 0.5);
    g.fillRect(x + 24, y + 10, Math.min(120, width - 48), 5);
    g.fillStyle(COLORS.paper, 0.18);
    g.fillRect(x, y + height - 8, width, 2);
    g.fillStyle(COLORS.coal, 0.35);
    for (let sx = x; sx < x + width; sx += 46) {
      g.fillTriangle(sx, y + height, sx + 18, y + height, sx + 8, y + height - 18);
    }

    const label = this.add.text(x + 26, y + 58, `分拣线 A-${String(index + 1).padStart(2, '0')} // 轻拿轻放`, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    label.setAlpha(0.5);
    label.setDepth(11);
  }

  private drawPlatform(x: number, y: number, w: number, h: number, index: number): void {
    this.addSolid(x + w / 2, y + h / 2, w, h);
    const g = this.add.graphics();
    g.setDepth(10);
    g.fillStyle(COLORS.coal, 0.4);
    g.fillRect(x + 6, y + h - 2, w, 8);
    g.fillStyle(0x6a5138, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x85694a, 1);
    g.fillRect(x + 4, y + 4, w - 8, 4);
    g.lineStyle(2, COLORS.coal, 0.9);
    g.strokeRect(x, y, w, h);
    g.fillStyle(COLORS.paperDark, 0.8);
    g.fillRect(x, y, w, 4);
    g.fillStyle(COLORS.warning, 0.55);
    g.fillRect(x + 8, y + 9, Math.min(46, w - 16), 4);
    g.fillStyle(COLORS.paper, 0.4);
    g.fillRect(x + w - 34, y + 9, 22, 3);
    g.lineStyle(1, COLORS.coal, 0.25);
    for (let sx = x + 18; sx < x + w - 6; sx += 38) {
      g.lineBetween(sx, y + 4, sx - 10, y + h - 3);
    }
    if (index % 3 === 0) {
      const tape = this.add.graphics();
      tape.fillStyle(COLORS.warning, 0.38);
      tape.fillRect(x + w / 2 - 26, y - 3, 54, 9);
      tape.setDepth(11);
    }
    if (index % 4 === 0) {
      const label = this.add.text(x + 10, y - 16, 'FRAGILE / 易碎梗', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS.coal,
      });
      label.setAlpha(0.5);
      label.setDepth(11);
    }
  }

  private addSolid(centerX: number, centerY: number, width: number, height: number): void {
    const rect = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.solids.push(rect);
  }

  private drawPitMarkers(): void {
    const gaps: Array<[number, number]> = [
      [1200, 1370],
      [2400, 2560],
      [3700, 3840],
      [4900, 5050],
    ];
    gaps.forEach(([start, end]) => {
      [start - 6, end + 6].forEach((x, index) => {
        const g = this.add.graphics();
        g.setDepth(14);
        g.fillStyle(COLORS.coal, 1);
        g.fillRect(x - 3, 626, 6, 62);
        g.fillStyle(COLORS.warning, 1);
        g.fillRect(x - 14, 582, 28, 46);
        g.fillStyle(COLORS.coal, 0.9);
        for (let i = 0; i < 3; i += 1) {
          g.fillTriangle(x - 14, 592 + i * 12, x + 14, 586 + i * 12, x + 14, 596 + i * 12);
        }
        const tag = this.add.text(x, 570, index === 0 ? '分拣缺口' : '→ 别掉', {
          fontFamily: FONTS.mono,
          fontSize: '9px',
          color: CSS.coal,
        });
        tag.setOrigin(0.5);
        tag.setDepth(15);
        tag.setAlpha(0.7);
      });
    });
  }

  private drawHazard(x: number): void {
    const g = this.add.graphics();
    g.setDepth(14);
    g.fillStyle(COLORS.warning, 0.72);
    g.fillRect(x - 42, 620, 84, 16);
    g.fillStyle(COLORS.coal, 0.8);
    for (let i = -35; i < 40; i += 16) {
      g.fillTriangle(x + i, 636, x + i + 8, 620, x + i + 14, 636);
    }
    g.fillStyle(COLORS.neon, 0.9);
    g.fillTriangle(x - 30, 620, x - 18, 588, x - 8, 620);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillTriangle(x - 8, 620, x + 8, 574, x + 20, 620);
    g.fillStyle(COLORS.warning, 0.9);
    g.fillTriangle(x + 18, 620, x + 28, 592, x + 38, 620);
    g.lineStyle(1, COLORS.coal, 0.8);
    g.strokeTriangle(x - 8, 620, x + 8, 574, x + 20, 620);
    const tag = this.add.text(x, 558, 'GLITCH', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    tag.setOrigin(0.5);
    tag.setDepth(15);

    const zone = this.add.rectangle(x, 620, 64, 30, 0x000000, 0);
    this.physics.add.existing(zone, true);
    this.hazards.push(zone);
  }

  private drawDoor(): void {
    const container = this.add.container(DOOR_X, 470);
    container.setDepth(15);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.8);
    g.fillRect(-90, -166, 180, 332);
    g.fillStyle(0x4b4a44, 1);
    g.fillRect(-78, -156, 156, 312);
    g.fillStyle(0x2c2924, 1);
    g.fillRect(-64, -140, 128, 286);
    g.lineStyle(3, COLORS.paperDark, 0.7);
    g.strokeRect(-78, -156, 156, 312);
    g.fillStyle(COLORS.warning, 0.8);
    g.fillRect(-64, -22, 128, 18);
    g.fillStyle(COLORS.coal, 0.9);
    for (let i = -56; i < 64; i += 24) {
      g.fillTriangle(i, -4, i + 12, -22, i + 22, -4);
    }
    g.fillStyle(COLORS.paper, 0.85);
    g.fillRect(-48, -132, 96, 86);
    g.lineStyle(2, COLORS.coal, 1);
    g.strokeRect(-48, -132, 96, 86);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(-48, -132, 96, 14);
    g.fillStyle(COLORS.coal, 0.3);
    for (let row = 0; row < 4; row += 1) {
      g.fillRect(-38, -108 + row * 14, 74, 3);
    }
    g.fillStyle(COLORS.coal, 0.25);
    for (let row = 0; row < 5; row += 1) {
      g.fillRect(-38, 22 + row * 12, 60 - row * 6, 2);
    }
    g.fillStyle(COLORS.warning, 0.9);
    g.fillCircle(44, 116, 8);
    g.fillStyle(COLORS.coal, 1);
    g.fillCircle(44, 116, 4);
    container.add(g);

    const screenTitle = this.add.text(0, -114, '404 收发室', {
      fontFamily: FONTS.display,
      fontSize: '14px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    screenTitle.setOrigin(0.5);
    const screenCode = this.add.text(0, -91, '代签人：＿＿', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    screenCode.setOrigin(0.5);
    const screenHint = this.add.text(0, -71, STRINGS.door.screenMissing, {
      fontFamily: FONTS.mono,
      fontSize: '7px',
      color: CSS.rust,
      align: 'center',
      wordWrap: { width: 88 },
    });
    screenHint.setOrigin(0.5);
    screenHint.setAlpha(0.9);
    const lockText = this.add.text(0, 76, 'MAILROOM // SIGN HERE', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    lockText.setOrigin(0.5);
    const light = this.add.circle(44, -150, 7, COLORS.rust);
    light.setStrokeStyle(2, COLORS.coal, 1);
    container.add([screenTitle, screenCode, screenHint, lockText, light]);
    this.doorVisual = container;
    this.doorLight = light;
    this.doorScreenCode = screenCode;
    this.doorScreenHint = screenHint;

    const parcel = this.add.container(DOOR_X - 152, 594);
    parcel.setDepth(14);
    const parcelG = this.add.graphics();
    parcelG.fillStyle(COLORS.paperDim, 1);
    parcelG.fillRect(-42, -46, 84, 46);
    parcelG.fillStyle(COLORS.paper, 1);
    parcelG.fillTriangle(-42, -46, 0, -64, 42, -46);
    parcelG.lineStyle(2, COLORS.coal, 0.8);
    parcelG.strokeRect(-42, -46, 84, 46);
    parcelG.lineBetween(-42, -46, 0, -64);
    parcelG.lineBetween(42, -46, 0, -64);
    parcelG.fillStyle(COLORS.rust, 0.9);
    parcelG.fillRect(-32, -30, 64, 8);
    parcelG.fillStyle(COLORS.warning, 0.85);
    parcelG.fillRect(-4, -46, 8, 46);
    const parcelLabel = this.add.text(0, -18, '灭霸', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    parcelLabel.setOrigin(0.5);
    parcel.add([parcelG, parcelLabel]);

    const sign = addHotTag(this, DOOR_X, 268, '收发室 · 代签查验', COLORS.warning, -0.02);
    sign.setDepth(16);
    const wire = this.add.graphics();
    wire.lineStyle(2, COLORS.coal, 0.5);
    wire.lineBetween(DOOR_X - 80, 300, DOOR_X - 80, 636);
    wire.lineBetween(DOOR_X + 80, 300, DOOR_X + 80, 636);
    wire.setDepth(12);
  }

  private buildGateBlocks(): void {
    if (this.gate1Passed || !this.doorVisual) {
      this.doorLight?.setFillStyle(COLORS.neon, 1);
      this.doorVisual?.setAlpha(0.55);
    } else {
      const block = this.add.rectangle(DOOR_X, 470, 104, 336, 0x000000, 0);
      this.physics.add.existing(block, true);
      this.doorBlock = block;
      this.doorCollider = this.physics.add.collider(this.player, block);
    }

    if (this.gate2Passed) {
      this.setGate2OpenVisual();
    } else {
      const block = this.add.rectangle(EXIT_X, 470, 118, 336, 0x000000, 0);
      this.physics.add.existing(block, true);
      this.gate2Block = block;
      this.gate2Collider = this.physics.add.collider(this.player, block);
    }
  }

  private drawExit(): void {
    const frame = this.add.container(EXIT_X, 470);
    frame.setDepth(12);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.96);
    g.fillRect(-150, -200, 300, 366);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(-150, -200, 300, 14);
    g.fillStyle(COLORS.warning, 0.8);
    g.fillRect(-150, -186, 300, 4);
    g.fillStyle(COLORS.coalSoft, 1);
    g.fillRect(-112, -150, 224, 316);
    g.fillStyle(COLORS.neon, 0.1);
    g.fillRect(-98, -136, 196, 302);
    g.lineStyle(3, COLORS.paperDark, 0.6);
    g.strokeRect(-112, -150, 224, 316);
    g.lineStyle(1, COLORS.paper, 0.16);
    for (let y = -120; y < 160; y += 18) {
      g.lineBetween(-96, y, 96, y);
    }
    g.fillStyle(COLORS.warning, 0.85);
    g.fillRect(-112, -38, 224, 10);
    const title = this.add.text(0, -182, '发布会大厦', {
      fontFamily: FONTS.display,
      fontSize: '25px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const sub = this.add.text(0, -156, 'TOP FLOOR · 灭霸', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.warning,
    });
    sub.setOrigin(0.5);
    frame.add([g, title, sub]);

    const rail = this.add.graphics();
    rail.setDepth(11);
    rail.lineStyle(4, COLORS.coal, 0.8);
    rail.lineBetween(EXIT_X - 330, 602, EXIT_X + 280, 602);
    rail.lineStyle(2, COLORS.warning, 0.5);
    rail.lineBetween(EXIT_X - 330, 598, EXIT_X + 280, 598);
    for (let x = EXIT_X - 310; x < EXIT_X + 280; x += 42) {
      rail.lineStyle(1, COLORS.paperDim, 0.3);
      rail.lineBetween(x, 596, x + 12, 608);
    }

    const counter = this.add.graphics();
    counter.setDepth(13);
    counter.fillStyle(COLORS.coal, 0.95);
    counter.fillRect(EXIT_X - 356, 606, 136, 30);
    counter.fillStyle(COLORS.rust, 0.75);
    counter.fillRect(EXIT_X - 356, 606, 136, 5);
    counter.lineStyle(2, COLORS.paperDim, 0.45);
    counter.strokeRect(EXIT_X - 356, 606, 136, 30);
    const counterLabel = this.add.text(EXIT_X - 288, 620, '双轴磁带机', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paper,
    });
    counterLabel.setOrigin(0.5);
    counterLabel.setDepth(14);

    this.gate2ReelA = this.makeTapeReel(EXIT_X - 326, 588);
    this.gate2ReelB = this.makeTapeReel(EXIT_X - 268, 588);
    this.gate2Paper = this.add.graphics();
    this.gate2Paper.setDepth(13);

    const win = this.add.container(EXIT_X, 470);
    win.setDepth(14);
    const wg = this.add.graphics();
    wg.fillStyle(COLORS.coal, 0.35);
    wg.fillRect(-102, -146, 204, 316);
    wg.fillStyle(COLORS.paperDim, 1);
    wg.fillRect(-98, -142, 196, 300);
    wg.lineStyle(3, COLORS.coal, 0.9);
    wg.strokeRect(-98, -142, 196, 300);
    wg.fillStyle(COLORS.warning, 0.95);
    wg.fillRect(-98, -142, 196, 18);
    wg.fillStyle(COLORS.coal, 0.75);
    for (let y = -104; y < 130; y += 20) {
      wg.fillRect(-84, y, 168, 2);
    }
    wg.fillStyle(COLORS.rust, 0.92);
    wg.fillRect(-84, 48, 168, 64);
    wg.lineStyle(2, COLORS.warning, 0.8);
    wg.strokeRect(-84, 48, 168, 64);
    wg.fillStyle(COLORS.paper, 0.9);
    wg.fillCircle(54, 122, 10);
    wg.fillStyle(COLORS.coal, 1);
    wg.fillCircle(54, 122, 4);
    const winLabel = this.add.text(0, -124, '取件窗口 · 365', {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    winLabel.setOrigin(0.5);
    const winSub = this.add.text(0, 80, '凭包裹签收联领取', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paper,
    });
    winSub.setOrigin(0.5);
    const winCode = this.add.text(0, -90, 'PICKUP 404', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    winCode.setOrigin(0.5);
    win.add([wg, winLabel, winSub, winCode]);

    const logistics = this.add.container(134, -44);
    const lg = this.add.graphics();
    lg.fillStyle(COLORS.coal, 0.24);
    lg.fillRect(-57, -41, 120, 88);
    lg.fillStyle(COLORS.paper, 0.97);
    lg.fillRect(-60, -44, 120, 88);
    lg.lineStyle(2, COLORS.rust, 0.85);
    lg.strokeRect(-60, -44, 120, 88);
    lg.fillStyle(COLORS.warning, 0.9);
    lg.fillRect(-60, -44, 120, 8);
    lg.fillStyle(COLORS.coal, 0.28);
    lg.fillRect(-48, 28, 96, 1);
    const logisticsTitle = this.add.text(0, -28, STRINGS.level.gate2LogisticsTitle, {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    logisticsTitle.setOrigin(0.5);
    const logisticsLine1 = this.add.text(0, -4, STRINGS.level.gate2LogisticsLine1, {
      fontFamily: FONTS.body,
      fontSize: '10px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    logisticsLine1.setOrigin(0.5);
    const logisticsLine2 = this.add.text(0, 16, STRINGS.level.gate2LogisticsLine2, {
      fontFamily: FONTS.body,
      fontSize: '12px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    logisticsLine2.setOrigin(0.5);
    const logisticsTape = makeTape(this, 24, -48, 44, 12, COLORS.warning);
    logisticsTape.setRotation(0.16);
    logistics.add([lg, logisticsTitle, logisticsLine1, logisticsLine2, logisticsTape]);
    logistics.setRotation(0.06);
    win.add(logistics);
    this.gate2Window = win;
    this.drawGate2Paper();

    if (!this.gate2Passed) {
      const tag = addHotTag(this, EXIT_X, 238, '取件窗口 · 按 E 按铃', COLORS.warning, 0.03);
      tag.setDepth(16);
    }
  }

  private makeTapeReel(x: number, y: number): Phaser.GameObjects.Container {
    const root = this.add.container(x, y);
    root.setDepth(14);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 1);
    g.fillCircle(0, 0, 19);
    g.fillStyle(COLORS.paperDim, 0.9);
    g.fillCircle(0, 0, 15);
    g.fillStyle(COLORS.coal, 0.9);
    g.fillCircle(0, 0, 6);
    g.lineStyle(2, COLORS.rust, 0.9);
    g.lineBetween(-13, 0, 13, 0);
    g.lineBetween(0, -13, 0, 13);
    root.add(g);
    return root;
  }

  private drawGate2Paper(): void {
    if (!this.gate2Paper || !this.gate2Window) {
      return;
    }
    const startX = EXIT_X - 268;
    const endX = this.gate2Window.x;
    const g = this.gate2Paper;
    g.clear();
    g.lineStyle(3, COLORS.paper, 0.9);
    g.beginPath();
    g.moveTo(startX, 596);
    const span = Math.max(12, endX - startX);
    const folds = Math.max(2, Math.round(span / 42));
    for (let i = 1; i <= folds; i += 1) {
      const t = i / folds;
      const x = startX + span * t;
      const y = 596 + (i % 2 === 0 ? -5 : 5);
      g.lineTo(x, y);
    }
    g.strokePath();
    g.lineStyle(1, COLORS.coal, 0.4);
    g.beginPath();
    g.moveTo(startX, 598);
    for (let i = 1; i <= folds; i += 1) {
      const t = i / folds;
      g.lineTo(startX + span * t, 598 + (i % 2 === 0 ? -5 : 5));
    }
    g.strokePath();
  }

  private setGate2OpenVisual(): void {
    this.gate2Window?.setPosition(EXIT_X, 470).setScale(1).setAlpha(0.12);
    this.gate2Paper?.clear();
    const glow = this.add.graphics();
    glow.setDepth(15);
    glow.fillStyle(COLORS.neon, 0.18);
    glow.fillRect(EXIT_X - 96, 340, 192, 286);
    glow.lineStyle(4, COLORS.neon, 0.85);
    glow.strokeRect(EXIT_X - 96, 340, 192, 286);
    const label = this.add.text(EXIT_X, 480, '发布会入口', {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: CSS.neon,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setDepth(16);
    const tag = addHotTag(this, EXIT_X, 238, '取件成功 · 按 E 进入', COLORS.neon, 0.03);
    tag.setDepth(16);
  }

  private drawTutorialSigns(): void {
    this.addWorldSign(290, 462, 280, 110, '操作面单', [
      STRINGS.level.tutorialMove,
      STRINGS.level.tutorialCombat,
      STRINGS.level.tutorialDoor,
    ]);
    this.addWorldSign(3540, 470, 250, 90, '售货机维修中', ['“检测到弱者饮料需求。”', '——机器也很无奈']);
    const sign = addHotTag(this, 4220, 566, '收发室 →', COLORS.paperDim, -0.025);
    sign.setDepth(16);
    const topSign = addHotTag(this, 6080, 552, '取件窗口 →', COLORS.paperDim, 0.02);
    topSign.setDepth(16);
  }

  private addWorldSign(x: number, y: number, w: number, h: number, title: string, lines: string[]): void {
    const post = this.add.graphics();
    post.setDepth(11);
    post.fillStyle(COLORS.coal, 0.85);
    post.fillRect(x - 3, y + h / 2, 6, 636 - y - h / 2);
    const panel = paperPanel(this, x, y, w, h, {
      fill: COLORS.paper,
      title,
      barcode: false,
      staples: false,
      jitter: 3,
    });
    panel.setDepth(12);
    const body = this.add.text(x - w / 2 + 20, y - h / 2 + 50, lines.join('\n'), {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
      lineSpacing: 6,
      wordWrap: { width: w - 42 },
    });
    body.setDepth(13);
    body.setAlpha(0.8);
  }

  private drawCheckpointSign(): void {
    const g = this.add.graphics();
    g.setDepth(11);
    g.fillStyle(COLORS.coal, 1);
    g.fillRect(CHECKPOINT_X - 2, 566, 4, 70);
    g.fillStyle(COLORS.warning, 1);
    g.fillRect(CHECKPOINT_X - 28, 548, 56, 24);
    g.fillStyle(COLORS.coal, 0.9);
    g.fillRect(CHECKPOINT_X - 20, 554, 40, 3);
    g.fillRect(CHECKPOINT_X - 20, 560, 28, 3);
    const label = this.add.text(CHECKPOINT_X, 536, '临时签收点', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paper,
    });
    label.setOrigin(0.5);
    label.setDepth(12);
    label.setAlpha(0.7);
  }

  private initGroups(): void {
    this.enemyGroup = this.physics.add.group();
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.enemyBullets = this.physics.add.group({ allowGravity: false });
  }

  private spawnEnemies(): void {
    const host = this.makeEnemyHost();
    const placements: Array<[Enemy['kind'], number, number]> = [
      ['opossum', 780, 600],
      ['opossum', 1700, 600],
      ['lobster', 2295, 490],
      ['opossum', 2820, 600],
      ['lobster', 3110, 408],
      ['opossum', 4070, 600],
      ['lobster', 5300, 490],
      ['opossum', 5680, 600],
    ];
    placements.forEach(([kind, x, y]) => {
      const enemy = new Enemy(this, x, y, kind, host);
      this.enemyGroup.add(enemy);
      this.enemies.push(enemy);
    });
  }

  private makeEnemyHost(): EnemyHost {
    return {
      getPlayer: () => this.player,
      fireEnemyProjectile: (x, y) => this.spawnEnemyProjectile(x, y),
      onEnemyDefeated: (enemy) => {
        this.run.stats.enemiesDefeated += 1;
        this.meme.addSmall(MEME.enemyKill);
        const index = this.enemies.indexOf(enemy);
        if (index >= 0) {
          this.enemies.splice(index, 1);
        }
      },
      floatText: (x, y, text, color) => addFloatingLine(this, x, y, text, color ?? COLORS.warning, 16),
      burstAt: (x, y, color, count) => pixelBurst(this, x, y, color, count),
    };
  }

  private projectileFrom(
    group: Phaser.Physics.Arcade.Group,
    objectA: unknown,
    objectB: unknown,
  ): Phaser.Physics.Arcade.Image | null {
    const a = objectA as Phaser.GameObjects.GameObject;
    const b = objectB as Phaser.GameObjects.GameObject;
    const target = group.contains(a) ? a : group.contains(b) ? b : null;
    return target as Phaser.Physics.Arcade.Image | null;
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.enemyGroup, this.solids);
    this.physics.add.collider(this.bullets, this.solids, (a, b) => {
      this.projectileFrom(this.bullets, a, b)?.destroy();
    });
    this.physics.add.collider(this.enemyBullets, this.solids, (a, b) => {
      const bullet = this.projectileFrom(this.enemyBullets, a, b);
      if (bullet?.active) {
        pixelBurst(this, bullet.x, bullet.y, COLORS.rust, 2, 0.5);
        bullet.destroy();
      }
    });
    this.physics.add.overlap(this.player, this.hazards, (_, hazardObj) => {
      if (this.finished || this.player.isDead()) {
        return;
      }
      const hazard = hazardObj as Phaser.GameObjects.Rectangle;
      const actual = this.player.takeDamage(HAZARD.damage, hazard.x);
      if (actual > 0) {
        this.cameras.main.shake(100, COMBAT.cameraShakeLight);
      }
    });
    this.physics.add.overlap(this.player, this.enemyGroup, (_, enemyObj) => {
      const enemy = enemyObj as Enemy;
      if (!enemy.active || !enemy.isAlive() || this.finished) {
        return;
      }
      const actual = this.player.takeDamage(enemy.getContactDamage(), enemy.x);
      if (actual > 0) {
        pixelBurst(this, this.player.x, this.player.y, COLORS.rust, 5);
      }
    });
    this.physics.add.overlap(this.bullets, this.enemyGroup, (bulletObj, enemyObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      const enemy = enemyObj as Enemy;
      if (!bullet.active || !enemy.active || !enemy.isAlive()) {
        return;
      }
      const damage = Number(bullet.getData('damage') ?? PLAYER.bulletDamage);
      enemy.takeHit(damage, bullet.x);
      bullet.destroy();
    });
    this.physics.add.overlap(this.player, this.enemyBullets, (_, bulletObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      if (!bullet.active || this.finished) {
        return;
      }
      const damage = Number(bullet.getData('damage') ?? ENEMY.turretDamage);
      this.player.takeDamage(damage, bullet.x);
      bullet.destroy();
    });
  }

  private setupHud(): void {
    this.cards = new CardSystem(this, this.makeCardHost(), this.run);
    this.hud = new Hud(this, {
      bossMode: false,
      onUseCard: (index) => {
        if (this.quizOpen || this.rewardOpen || this.finished || this.transitioning) {
          return;
        }
        this.cards.useSlot(index);
      },
    });
    this.hud.updateCards(this.cards.getCards());
    this.hud.updateMeme(this.meme.getValue(), this.meme.isBurstActive(), this.meme.getStreak());
    this.cardsChangedHandler = () => {
      if (this.hud) {
        this.hud.updateCards(this.cards.getCards());
      }
    };
    this.events.on('cards-changed', this.cardsChangedHandler);
  }

  private makeCardHost(): CardHost {
    return {
      healFull: () => {
        this.player.healFull();
        this.run.hp = this.player.getHp();
      },
      grantShield: (durationMs) => this.player.grantShield(durationMs),
      grantAttackSpeed: (multiplier, durationMs) => this.player.grantAttackSpeed(multiplier, durationMs),
      grantDashFree: (durationMs) => this.player.grantDashFree(durationMs),
      grantMoveSpeed: (multiplier, durationMs) => this.player.grantMoveSpeed(multiplier, durationMs),
      freezeBoss: () => {
        this.hud.toast(STRINGS.toasts.noBoss, 'rust');
        return false;
      },
      screenClear: () => this.doScreenClear(),
      summonAlly: (durationMs) => this.summonAlly(durationMs),
      toast: (text, tone) => this.hud.toast(text, tone),
    };
  }

  private setupTouch(): void {
    if (isTouchDevice()) {
      this.touch = new TouchControls(this, this.player, { onInteract: () => this.tryInteract() });
    }
  }

  private setupCamera(): void {
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(300, 130);
    this.cameras.main.setZoom(1);
  }

  private showIntro(): void {
    const root = this.add.container(GAME_WIDTH / 2, 232);
    root.setScrollFactor(0);
    root.setDepth(450);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.9);
    g.fillRect(-330, -58, 660, 116);
    g.lineStyle(2, COLORS.warning, 0.7);
    g.strokeRect(-330, -58, 660, 116);
    g.fillStyle(COLORS.rust, 0.95);
    g.fillRect(-330, -58, 8, 116);
    const title = this.add.text(0, -18, '第一幕 · 发布会大厦', {
      fontFamily: FONTS.display,
      fontSize: '26px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const sub = this.add.text(0, 20, '名字被偷走了，纸单还留着原字。先过一次名字门。', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.paperDim,
    });
    sub.setOrigin(0.5);
    const tape = makeTape(this, 0, -58, 160, 18, COLORS.warning);
    tape.setRotation(-0.03);
    root.add([g, title, sub, tape]);
    this.tweens.add({
      targets: root,
      alpha: 0,
      y: 92,
      delay: 1850,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => root.destroy(true),
    });
  }

  private updateInteractions(): void {
    const player = this.player;
    this.nearDoor = !this.gate1Passed && Math.abs(player.x - DOOR_X) < 155;
    this.nearExit = Math.abs(player.x - EXIT_X) < 195;

    if (this.quizOpen || this.rewardOpen || this.gateAnimating) {
      this.hud.setHint(null);
      return;
    }
    if (this.nearDoor) {
      const prompt = STRINGS.level.gate1Prompt;
      this.hud.setHint(this.touch ? prompt.replace('按 E', '点「交互」') : prompt);
    } else if (this.nearExit) {
      let prompt: string;
      if (!this.gate1Passed) {
        prompt = STRINGS.level.gate1Locked;
      } else if (!this.gate2Passed) {
        prompt = this.gate2Far ? STRINGS.level.gate2FarPrompt : STRINGS.level.gate2Prompt;
      } else {
        prompt = STRINGS.level.exitPrompt;
      }
      this.hud.setHint(this.touch ? prompt.replace('按 E', '点「交互」') : prompt);
    } else {
      this.hud.setHint(null);
    }

    if (this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.tryInteract();
    }
  }

  private tryInteract(): void {
    if (this.quizOpen || this.rewardOpen || this.finished || this.transitioning || this.gateAnimating) {
      return;
    }
    if (this.nearDoor && !this.gate1Passed) {
      this.startGate1Sequence();
    } else if (this.nearExit) {
      if (!this.gate1Passed) {
        this.hud.toast(STRINGS.level.gate1Locked, 'rust');
        return;
      }
      if (!this.gate2Passed) {
        if (this.gate2Far) {
          this.rewindGate2ToNear();
        } else {
          this.startGate2Intro();
        }
        return;
      }
      this.tryEnterBoss();
    }
  }

  private firePlayerShot(x: number, y: number, facing: 1 | -1): void {
    const damage = PLAYER.bulletDamage * this.meme.getDamageMultiplier();
    for (let i = 0; i < PLAYER.pelletsPerShot; i += 1) {
      const spread = Phaser.Math.DegToRad((i - (PLAYER.pelletsPerShot - 1) / 2) * PLAYER.spreadDeg);
      const bullet = this.bullets.create(x, y, TEX.bullet) as Phaser.Physics.Arcade.Image;
      bullet.setDepth(22);
      bullet.setFlipX(facing === -1);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setSize(14, 4);
      bullet.setVelocity(Math.cos(spread) * PLAYER.bulletSpeed * facing, Math.sin(spread) * PLAYER.bulletSpeed * facing);
      bullet.setData('damage', damage);
      bullet.setData('expireAt', this.time.now + PLAYER.bulletLifeMs);
    }
  }

  private spawnEnemyProjectile(x: number, y: number): void {
    if (this.player.isDead()) {
      return;
    }
    const bullet = this.enemyBullets.create(x, y, TEX.orb) as Phaser.Physics.Arcade.Image;
    bullet.setDepth(21);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(14, 14);
    const angle = Math.atan2(this.player.y - y, this.player.x - x);
    bullet.setVelocity(
      Math.cos(angle) * ENEMY.turretProjectileSpeed,
      Math.sin(angle) * ENEMY.turretProjectileSpeed,
    );
    bullet.setData('damage', ENEMY.turretDamage);
    bullet.setData('expireAt', this.time.now + 4000);
    bullet.setData('spin', Phaser.Math.FloatBetween(-4, 4));
  }

  private fireAllyShot(x: number, y: number): void {
    const target = this.enemies.find((enemy) => enemy.active && enemy.isAlive());
    if (!target) {
      return;
    }
    const bullet = this.bullets.create(x, y, TEX.bulletAlly) as Phaser.Physics.Arcade.Image;
    bullet.setDepth(22);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(10, 4);
    const angle = Math.atan2(target.y - y, target.x - x);
    bullet.setVelocity(Math.cos(angle) * 760, Math.sin(angle) * 760);
    bullet.setData('damage', CARD.allyDamage);
    bullet.setData('expireAt', this.time.now + 1200);
  }

  private tickAlly(time: number): void {
    if (this.ally && this.ally.active) {
      this.ally.tick(time);
    } else {
      this.ally = null;
    }
  }

  private summonAlly(durationMs: number): boolean {
    if (this.ally && this.ally.active) {
      this.ally.destroy();
    }
    this.ally = new Ally(
      this,
      this.player,
      durationMs,
      () => this.enemies.some((enemy) => enemy.active && enemy.isAlive()),
      (x, y) => this.fireAllyShot(x, y),
    );
    return true;
  }

  private doScreenClear(): number {
    let cleared = 0;
    this.enemyBullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        bullet.destroy();
        cleared += 1;
      }
    });
    this.enemies.forEach((enemy) => {
      if (enemy.active && enemy.isAlive()) {
        enemy.takeHit(CARD.screenClearDamage, enemy.x);
      }
    });
    this.cameras.main.flash(160, 75, 227, 200, false);
    return cleared;
  }

  private cleanupProjectiles(time: number): void {
    this.bullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) {
        return;
      }
      const expire = Number(bullet.getData('expireAt') ?? 0);
      if (time > expire || bullet.x < this.cameras.main.scrollX - 200 || bullet.x > this.cameras.main.scrollX + GAME_WIDTH + 200) {
        bullet.destroy();
      }
    });
    this.enemyBullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) {
        return;
      }
      const expire = Number(bullet.getData('expireAt') ?? 0);
      bullet.setAngle(bullet.angle + Number(bullet.getData('spin') ?? 2));
      if (time > expire || bullet.y > 820) {
        bullet.destroy();
      }
    });
  }

  private updateRunDust(time: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded && Math.abs(body.velocity.x) > 80 && time - this.lastRunDust > 150) {
      this.lastRunDust = time;
      const dust = this.add.image(this.player.x - this.player.getFacing() * 18, this.player.y + 32, TEX.dust);
      dust.setDepth(18);
      dust.setTint(COLORS.paperDim);
      dust.setAlpha(0.45);
      this.tweens.add({
        targets: dust,
        x: dust.x - this.player.getFacing() * 20,
        y: dust.y - 10,
        alpha: 0,
        duration: 300,
        onComplete: () => dust.destroy(),
      });
    }
  }

  private spawnDashDust(x: number, y: number): void {
    const image = this.add.image(x, y, TEX.dust);
    image.setDepth(19);
    image.setTint(COLORS.neon);
    image.setAlpha(0.55);
    image.setScale(1.4);
    this.tweens.add({
      targets: image,
      alpha: 0,
      scale: 0.4,
      duration: 220,
      onComplete: () => image.destroy(),
    });
  }

  private spawnJumpDust(doubleJump: boolean): void {
    const color = doubleJump ? COLORS.neon : COLORS.paperDim;
    pixelBurst(this, this.player.x, this.player.y + 30, color, doubleJump ? 7 : 4, 0.6);
  }

  private beginGateLock(): void {
    this.gateAnimating = true;
    this.quizOpen = true;
    this.player.setControlEnabled(false);
    this.player.setVelocity(0, 0);
    this.touch?.setEnabled(false);
    this.hud.setHint(null);
    this.enemies.forEach((enemy) => enemy.setVelocityX(0));
    this.enemyBullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      bullet.destroy();
    });
  }

  private releaseGateControls(): void {
    this.player.setControlEnabled(true);
    this.touch?.setEnabled(true);
    this.gateAnimating = false;
  }

  private startGate1Sequence(): void {
    if (this.quizOpen || this.rewardOpen || this.gate1Passed || this.finished || this.gateAnimating) {
      return;
    }
    this.beginGateLock();
    audio.play('bell');
    this.hud.toast(STRINGS.door.receiptJamming, 'paper');

    [160, 380].forEach((delay) => {
      this.time.delayedCall(delay, () => {
        audio.play('printerJam');
        if (this.doorVisual) {
          this.tweens.add({
            targets: this.doorVisual,
            x: DOOR_X + 4,
            duration: 55,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
          });
        }
      });
    });

    const receipt = this.makeWorldReceipt('door_daiqian', DOOR_X, 402, 248, 136);
    receipt.setScale(1, 0.06);
    receipt.setAlpha(0);
    receipt.setDepth(18);
    this.time.delayedCall(540, () => {
      audio.play('paper');
      this.tweens.add({
        targets: receipt,
        alpha: 1,
        scaleY: 1,
        duration: 620,
        ease: 'Back.easeOut',
      });
    });
    this.time.delayedCall(2040, () => {
      receipt.destroy(true);
      this.gateAnimating = false;
      this.openGateQuiz(1);
    });
  }

  private playGate1ScannerSequence(): void {
    const screenCode = this.doorScreenCode;
    const screenHint = this.doorScreenHint;
    const scanReceipt = this.makeWorldReceipt('door_daiqian', DOOR_X - 36, 410, 218, 120);
    scanReceipt.setDepth(19);
    scanReceipt.setScale(0.86);
    scanReceipt.setAngle(-0.04);

    const scannerX = this.player.x + 18;
    const scannerY = this.player.y + 4;
    const scanner = this.add.graphics();
    scanner.fillStyle(COLORS.coal, 0.95);
    scanner.fillRect(scannerX - 8, scannerY - 5, 16, 10);
    scanner.fillStyle(COLORS.warning, 0.9);
    scanner.fillRect(scannerX - 5, scannerY - 3, 6, 3);
    scanner.fillStyle(COLORS.neon, 1);
    scanner.fillRect(scannerX + 5, scannerY - 3, 3, 6);
    scanner.setDepth(27);
    this.tweens.add({ targets: scanner, alpha: 0, delay: 900, duration: 260, onComplete: () => scanner.destroy() });
    const beam = this.add.graphics();
    beam.setDepth(26);
    beam.lineStyle(3, COLORS.neon, 0.9);
    beam.lineBetween(scannerX, scannerY, scanReceipt.x - 24, scanReceipt.y + 8);
    beam.setAlpha(0);
    this.tweens.add({ targets: beam, alpha: 0.95, duration: 120, yoyo: true, hold: 220, onComplete: () => beam.destroy() });

    this.tweens.add({
      targets: scanReceipt,
      x: this.player.x + 58,
      y: this.player.y - 34,
      scale: 0.38,
      angle: 0.06,
      duration: 520,
      ease: 'Cubic.easeInOut',
    });

    this.time.delayedCall(360, () => {
      audio.play('scan');
      addFloatingLine(this, scannerX + 12, scannerY - 28, '滴。', COLORS.neon, 24, 900);
      screenCode?.setText('代签人：灭建国');
      screenCode?.setColor(CSS.neon);
      screenHint?.setText(STRINGS.door.screenRestored);
      screenHint?.setColor(CSS.neon);
      this.cameras.main.flash(80, 75, 227, 200, false);
      this.hud.toast(STRINGS.door.scanRestore, 'neon');
    });

    this.time.delayedCall(1350, () => {
      this.openGate1Visual();
      this.hud.toast(STRINGS.door.receiptTail, 'neon');
      this.tweens.add({
        targets: scanReceipt,
        x: this.player.x + 8,
        y: this.player.y + 6,
        scale: 0.28,
        alpha: 0.18,
        duration: 560,
        ease: 'Cubic.easeIn',
        onComplete: () => scanReceipt.destroy(true),
      });
      this.tweens.add({ targets: this.player, angle: { from: 0, to: -9 }, duration: 160, yoyo: true, repeat: 1 });
      this.time.delayedCall(720, () => {
        this.gateAnimating = false;
        this.showCardReward();
      });
    });
  }

  private startGate2Intro(): void {
    if (this.quizOpen || this.rewardOpen || this.finished || this.gateAnimating || this.gate2Passed) {
      return;
    }
    this.beginGateLock();
    this.gate2Far = false;
    audio.play('bell');
    this.hud.toast(STRINGS.door.windowTape, 'paper');
    const targetX = EXIT_X + 250;
    const ticket = this.makeWorldReceipt('door_daodai', EXIT_X - 168, 500, 276, 122);
    ticket.setDepth(18);
    ticket.setAlpha(0);
    ticket.setScale(0.7);
    this.tweens.add({ targets: ticket, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(260, () => {
      if (!this.gateAnimating || this.gate2Passed || !this.gate2Window) {
        ticket.destroy(true);
        return;
      }
      audio.play('rewind');
      if (this.gate2ReelA && this.gate2ReelB) {
        this.tweens.add({ targets: [this.gate2ReelA, this.gate2ReelB], angle: '+=1400', duration: 760, ease: 'Cubic.easeIn' });
      }
      this.tweens.add({
        targets: this.gate2Window,
        x: targetX,
        scale: 0.7,
        duration: 780,
        ease: 'Cubic.easeIn',
        onUpdate: () => this.drawGate2Paper(),
        onComplete: () => {
          this.gate2Far = true;
          ticket.destroy(true);
          this.hud.toast(STRINGS.door.windowFar, 'rust');
          this.gateAnimating = false;
          this.openGateQuiz(2);
        },
      });
    });
  }

  private rewindGate2ToNear(): void {
    if (this.quizOpen || this.rewardOpen || this.finished || this.gateAnimating || this.gate2Passed) {
      return;
    }
    this.beginGateLock();
    audio.play('rewind');
    this.hud.toast(STRINGS.door.windowRewind, 'neon');
    if (this.gate2ReelA && this.gate2ReelB) {
      this.tweens.add({ targets: [this.gate2ReelA, this.gate2ReelB], angle: '-=920', duration: 700, ease: 'Sine.easeInOut' });
    }
    this.time.delayedCall(700, () => {
      this.dragGate2WindowToNear(() => {
        this.gate2Far = false;
        this.gateAnimating = false;
        this.openGateQuiz(2);
      });
    });
  }

  private dragGate2WindowToNear(onComplete: () => void): void {
    const win = this.gate2Window;
    if (!win) {
      onComplete();
      return;
    }
    audio.play('paper');
    this.tweens.add({
      targets: win,
      x: EXIT_X,
      scale: 1,
      duration: 850,
      ease: 'Cubic.easeInOut',
      onUpdate: () => this.drawGate2Paper(),
      onComplete,
    });
  }

  private openGateQuiz(gate: 1 | 2): void {
    this.quizOpen = true;
    const prepared = this.quizSystem.prepareDoor(gate === 1 ? 'door_daiqian' : 'door_daodai');
    let solved = false;
    let failReason: 'wrong' | 'timeout' | null = null;

    this.quizOverlay = new QuizOverlay(this, {
      mode: 'door',
      prepared,
      windowMs: QUIZ.doorWindowMs,
      onResolve: (result) => {
        if (result.correct) {
          solved = true;
          this.run.stats.correct += 1;
          this.quizSystem.markDoorUsed(prepared.question.id);
          const memeResult = this.meme.addCorrect(MEME.doorCorrect);
          if (memeResult.burstStarted) {
            audio.play('burst');
            this.hud.toast(STRINGS.toasts.burst, 'neon');
          }
        } else {
          if (result.timedOut) {
            this.run.stats.timeouts += 1;
            failReason = 'timeout';
          } else {
            this.run.stats.wrong += 1;
            failReason = 'wrong';
          }
          this.meme.registerWrong();
          this.hud.toast(STRINGS.quiz.memoryLost, 'rust');
        }
      },
      onClose: () => {
        this.quizOverlay = null;
        this.quizOpen = false;
        if (solved) {
          if (gate === 1) {
            this.finishGate1();
          } else {
            this.finishGate2();
          }
          return;
        }
        this.releaseGateControls();
        this.hud.toast(
          failReason === 'timeout' ? STRINGS.door.timeout : STRINGS.door.wrong,
          'rust',
        );
      },
    });
  }

  private finishGate1(): void {
    this.gate1Passed = true;
    this.run.door1Passed = true;
    this.spawnPoint = { x: CHECKPOINT_X, y: 560 };
    this.player.heal(Math.round(PLAYER.maxHp * 0.3));
    this.run.hp = this.player.getHp();
    this.gateAnimating = true;
    this.playGate1ScannerSequence();
  }

  private finishGate2(): void {
    this.gate2Passed = true;
    this.run.door2Passed = true;
    this.spawnPoint = { x: 6180, y: 560 };
    this.player.heal(Math.round(PLAYER.maxHp * 0.3));
    this.run.hp = this.player.getHp();
    this.gateAnimating = true;
    audio.play('rewind');
    this.hud.toast(STRINGS.door.windowRewind, 'neon');
    if (this.gate2ReelA && this.gate2ReelB) {
      this.tweens.add({ targets: [this.gate2ReelA, this.gate2ReelB], angle: '-=920', duration: 700, ease: 'Sine.easeInOut' });
    }
    this.time.delayedCall(700, () => {
      const finish = () => {
        this.gate2Far = false;
        this.audioBellAndOpen();
      };
      if (this.gate2Far) {
        this.dragGate2WindowToNear(finish);
      } else {
        finish();
      }
    });
  }

  private audioBellAndOpen(): void {
    audio.play('bell');
    this.cameras.main.flash(160, 75, 227, 200, false);
    this.cameras.main.shake(120, 0.006);
    if (this.gate2Collider) {
      this.gate2Collider.destroy();
      this.gate2Collider = null;
    }
    if (this.gate2Block) {
      this.gate2Block.destroy();
      this.gate2Block = null;
    }
    this.setGate2OpenVisual();
    this.hud.toast(STRINGS.door.windowDone, 'neon');
    this.time.delayedCall(1000, () => {
      this.gateAnimating = false;
      this.showCardReward();
    });
  }

  private openGate1Visual(): void {
    if (this.doorCollider) {
      this.doorCollider.destroy();
      this.doorCollider = null;
    }
    if (this.doorBlock) {
      this.doorBlock.destroy();
      this.doorBlock = null;
    }
    this.doorLight?.setFillStyle(COLORS.neon, 1);
    audio.play('stampThud');
    this.cameras.main.flash(160, 75, 227, 200, false);
    pixelBurst(this, DOOR_X, 420, COLORS.neon, 14, 1.4);
    if (this.doorVisual) {
      this.tweens.add({
        targets: this.doorVisual,
        alpha: 0.55,
        angle: 0.018,
        duration: 420,
        ease: 'Sine.easeOut',
      });
    }
    const valid = stamp(this, DOOR_X, 470, STRINGS.door.receiptValid, {
      color: COLORS.neon,
      fontSize: 26,
      angle: -0.12,
      alpha: 0.86,
    });
    valid.setDepth(17);
    pixelBurst(this, this.player.x - 20, this.player.y + 24, COLORS.warning, 7, 0.8);
  }

  private makeWorldReceipt(
    questionId: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Phaser.GameObjects.Container {
    const question = getQuestion(questionId);
    const root = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.28);
    g.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
    g.fillStyle(COLORS.paper, 1);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(2, COLORS.rust, 0.9);
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle(COLORS.warning, 0.9);
    g.fillRect(-w / 2, -h / 2, w, 6);
    g.fillStyle(COLORS.coal, 0.25);
    for (let i = 0; i < 4; i += 1) {
      g.fillRect(-w / 2 + 14, -h / 2 + 18 + i * 18, w - 28, 1);
    }
    const title = this.add.text(0, -h / 2 + 22, question?.slip?.title ?? '取件小票', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const lines = question?.slip?.lines ?? [];
    const body = this.add.text(0, 8, lines.join('\n'), {
      fontFamily: FONTS.body,
      fontSize: '15px',
      color: CSS.coal,
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: 5,
    });
    body.setOrigin(0.5);
    root.add([g, title, body]);
    return root;
  }

  private showCardReward(): void {
    if (this.rewardOpen) {
      return;
    }
    this.rewardOpen = true;
    this.selectingReward = false;
    this.hud.setHint(null);
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);

    const options = shuffle(CARDS).slice(0, 3);
    const root = this.add.container(0, 0);
    root.setScrollFactor(0);
    root.setDepth(UI.overlayDepth + 20);
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.coal, 0.7);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    root.add(dim);
    const panel = paperPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 980, 500, {
      fill: COLORS.paper,
      jitter: 5,
    });
    root.add(panel);
    const supplyLabel = this.add.text(GAME_WIDTH / 2 - 454, 126, 'STRONG SUPPLY // 签收单', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
    });
    supplyLabel.setAlpha(0.55);
    root.add(supplyLabel);
    const title = glitchText(this, GAME_WIDTH / 2, 148, STRINGS.door.rewardTitle, {
      fontFamily: FONTS.display,
      fontSize: '34px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    root.add(title);
    const sub = this.add.text(GAME_WIDTH / 2, 180, STRINGS.door.rewardSubtitle, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: CSS.coal,
    });
    sub.setOrigin(0.5);
    sub.setAlpha(0.7);
    root.add(sub);

    const centers = [430, 640, 850];
    const cardContainers: Phaser.GameObjects.Container[] = [];
    options.forEach((card, index) => {
      const container = this.makeRewardCard(card, centers[index] ?? 640, 380, index, root, options, cardContainers);
      cardContainers.push(container);
    });

    const hint = this.add.text(GAME_WIDTH / 2, 566, '数字键 1 / 2 / 3 选择 · 点击卡片签收 · 卡槽最多 3 张', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.coal,
    });
    hint.setOrigin(0.5);
    hint.setAlpha(0.6);
    root.add(hint);
    if (this.run.cards.length >= CARD.maxSlots) {
      const warning = this.add.text(GAME_WIDTH / 2, 594, STRINGS.door.rewardFull, {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: CSS.rust,
      });
      warning.setOrigin(0.5);
      warning.setAlpha(0.75);
      root.add(warning);
    }
    this.rewardRoot = root;

    const choose = (index: number) => this.chooseReward(options, index, cardContainers);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      const bindings: Array<[string, () => void]> = [
        ['keydown-ONE', () => choose(0)],
        ['keydown-TWO', () => choose(1)],
        ['keydown-THREE', () => choose(2)],
      ];
      bindings.forEach(([event, handler]) => {
        keyboard.on(event, handler);
        this.rewardCleanups.push(() => keyboard.off(event, handler));
      });
    }
    this.events.once('shutdown', () => this.cleanupReward());
  }

  private makeRewardCard(
    card: CardDef,
    x: number,
    y: number,
    index: number,
    root: Phaser.GameObjects.Container,
    options: CardDef[],
    allContainers: Phaser.GameObjects.Container[],
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const color = parseInt(card.color.replace('#', ''), 16);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.3);
    g.fillRect(-96 + 5, -166 + 7, 192, 332);
    g.fillStyle(COLORS.coalSoft, 1);
    g.fillRect(-96, -166, 192, 332);
    g.lineStyle(3, COLORS.paper, 0.9);
    g.strokeRect(-96, -166, 192, 332);
    g.fillStyle(color, 0.95);
    g.fillRect(-96, -166, 192, 22);
    g.fillStyle(COLORS.paper, 0.16);
    g.fillRect(-76, -126, 152, 3);
    g.fillStyle(COLORS.coal, 0.6);
    g.fillRect(-76, 66, 152, 40);
    g.lineStyle(2, COLORS.warning, 0.7);
    g.strokeRect(-76, 66, 152, 40);
    const keyLabel = this.add.text(0, -155, `[ ${index + 1} ]`, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    keyLabel.setOrigin(0.5);
    const name = this.add.text(0, -94, card.name, {
      fontFamily: FONTS.display,
      fontSize: '26px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    name.setOrigin(0.5);
    const desc = this.add.text(0, -30, card.desc, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.paper,
      align: 'center',
      lineSpacing: 6,
      wordWrap: { width: 152 },
    });
    desc.setOrigin(0.5, 0.5);
    const quote = this.add.text(0, 87, card.quote, {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: CSS.warning,
      align: 'center',
      wordWrap: { width: 134 },
    });
    quote.setOrigin(0.5);
    const cardStamp = stamp(this, 0, 128, card.stamp, {
      color: COLORS.rust,
      fontSize: 13,
      angle: -0.06,
      alpha: 0.7,
    });
    const zone = this.add.zone(0, 0, 192, 332).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    zone.on('pointerover', () => {
      if (!this.selectingReward) {
        container.setScale(1.025);
        g.lineStyle(3, COLORS.neon, 1);
        g.strokeRect(-96, -166, 192, 332);
      }
    });
    zone.on('pointerout', () => {
      if (!this.selectingReward) {
        container.setScale(1);
        g.lineStyle(3, COLORS.paper, 0.9);
        g.strokeRect(-96, -166, 192, 332);
      }
    });
    zone.on('pointerup', () => {
      if (!this.selectingReward) {
        this.chooseReward(options, index, allContainers);
      }
    });
    container.add([g, keyLabel, name, desc, quote, cardStamp, zone]);
    container.setRotation((index - 1) * 0.012);
    root.add(container);
    return container;
  }

  private chooseReward(
    options: CardDef[],
    index: number,
    containers: Phaser.GameObjects.Container[],
  ): void {
    if (!this.rewardOpen || this.selectingReward) {
      return;
    }
    this.selectingReward = true;
    this.rewardCleanups.forEach((cleanup) => cleanup());
    this.rewardCleanups = [];

    const chosen = options[index];
    if (!chosen) {
      this.selectingReward = false;
      return;
    }
    const container = containers[index];
    if (container) {
      this.tweens.add({
        targets: container,
        scale: 1.08,
        alpha: 0.6,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    }
    this.cards.acquire(chosen.id);
    this.player.heal(Math.round(PLAYER.maxHp * 0.3));
    this.run.hp = this.player.getHp();
    audio.play('card');
    pixelBurst(this, GAME_WIDTH / 2, 380, COLORS.warning, 12, 1.2);
    const accepted = stamp(this, GAME_WIDTH / 2, 540, '签收成功', {
      color: COLORS.rust,
      fontSize: 30,
      angle: -0.08,
      alpha: 0.9,
    });
    this.rewardRoot?.add(accepted);
    accepted.setDepth(4);
    this.time.delayedCall(360, () => {
      this.closeReward();
      this.hud.toast(STRINGS.door.rewardHeal, 'paper');
      this.time.delayedCall(1000, () => this.hud.toast(chosen.quote, 'neon'));
    });
  }

  private closeReward(): void {
    this.rewardCleanups.forEach((cleanup) => cleanup());
    this.rewardCleanups = [];
    if (this.rewardRoot) {
      this.rewardRoot.destroy(true);
      this.rewardRoot = null;
    }
    this.rewardOpen = false;
    this.selectingReward = false;
    if (!this.finished && !this.transitioning) {
      this.player.setControlEnabled(true);
      this.touch?.setEnabled(true);
    }
  }

  private cleanupReward(): void {
    this.rewardCleanups.forEach((cleanup) => cleanup());
    this.rewardCleanups = [];
  }

  private tryEnterBoss(): void {
    if (this.transitioning || this.finished) {
      return;
    }
    if (!this.gate1Passed) {
      this.hud.toast(STRINGS.level.gate1Locked, 'rust');
      return;
    }
    if (!this.gate2Passed) {
      this.hud.toast(STRINGS.level.bossLocked, 'rust');
      return;
    }
    this.transitioning = true;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.hud.setHint(null);
    this.run.hp = this.player.getHp();
    this.meme.sync(this.run);
    this.run.cards = [...this.run.cards];
    audio.play('door');
    this.cameras.main.flash(180, 232, 178, 58, false);
    this.cameras.main.fadeOut(420, 23, 19, 16);
    this.time.delayedCall(440, () => {
      this.scene.start('Boss');
    });
  }

  private handleFall(): void {
    if (this.respawning || this.finished) {
      return;
    }
    this.respawning = true;
    this.pendingReason = STRINGS.level.pitFall;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.hud.toast(STRINGS.level.pitFall, 'rust');
    this.player.takeDamage(PLAYER.fallRespawnDamage);
    if (this.finished) {
      return;
    }
    this.cameras.main.fadeOut(160, 23, 19, 16);
    this.time.delayedCall(230, () => {
      if (this.finished) {
        return;
      }
      this.player.applyRespawn(this.spawnPoint.x, this.spawnPoint.y, WORLD.respawnInvulnMs);
      this.cameras.main.fadeIn(200, 23, 19, 16);
      this.player.setControlEnabled(true);
      this.touch?.setEnabled(true);
      this.respawning = false;
      this.pendingReason = '网络热度归零';
    });
  }

  private handleDeath(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.hud.setHint(null);
    audio.play('defeat');
    this.cameras.main.shake(240, 0.015);
    this.cameras.main.flash(180, 168, 58, 34, false);
    const marker = glitchText(this, this.player.x, this.player.y - 96, STRINGS.misc.died, {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    marker.setDepth(150);
    this.tweens.add({ targets: marker, alpha: 0, y: marker.y - 30, delay: 900, duration: 400 });
    this.time.delayedCall(1500, () => this.goResult(this.pendingReason));
  }

  private goResult(reason: string): void {
    this.run.hp = Math.max(0, this.player.getHp());
    this.meme.sync(this.run);
    const payload: ResultPayload = {
      act: 1,
      victory: false,
      timeMs: elapsedMs(this.run),
      stats: { ...this.run.stats },
      cards: [...this.run.cards],
      reason,
    };
    audio.setMusic('result');
    this.cameras.main.fadeOut(260, 23, 19, 16);
    this.time.delayedCall(280, () => {
      this.scene.start('Result', { payload, record: true });
    });
  }

  private cleanupScene(): void {
    if (this.cardsChangedHandler) {
      this.events.off('cards-changed', this.cardsChangedHandler);
      this.cardsChangedHandler = null;
    }
    this.rewardCleanups.forEach((cleanup) => cleanup());
    this.rewardCleanups = [];
    this.quizOverlay = null;
  }
}