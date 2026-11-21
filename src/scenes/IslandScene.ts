import Phaser from 'phaser';
import {
  CARD,
  COMBAT,
  GAME_HEIGHT,
  GAME_WIDTH,
  MEME,
  PLAYER,
  QUIZ,
  TRAP,
  WORLD,
} from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS } from '../data';
import type { ResultPayload, RunState } from '../types/game';
import {
  addFloatingLine,
  addHotTag,
  addScanlines,
  damagePopup,
  glitchText,
  makeTape,
  pixelBurst,
  stamp,
} from '../art/uiKit';
import { Player, type PlayerCallbacks } from '../entities/Player';
import { SupplyCrab, type SupplyCrabHost } from '../entities/SupplyCrab';
import { Ally } from '../entities/Ally';
import { Hud } from '../ui/Hud';
import { QuizOverlay } from '../ui/QuizOverlay';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { CardPickOverlay } from '../ui/CardPickOverlay';
import { Viewfinder } from '../ui/Viewfinder';
import { CardSystem, type CardHost } from '../systems/CardSystem';
import { MemeMeter } from '../systems/MemeMeter';
import { QuizSystem } from '../systems/QuizSystem';
import { elapsedMs, getRunState } from '../systems/RunState';
import { audio } from '../systems/AudioSystem';
import { ReturnParcelTrap } from '../systems/ReturnParcelTrap';
import { voice, type VoicePresenter } from '../systems/VoiceSystem';
import { createVoicePresenter } from '../ui/VoiceSubtitle';

const ISLAND_WIDTH = 4300;
const GROUND_Y = 636;
const GROUND_SEGMENTS: Array<[number, number]> = [
  [0, 1280],
  [1520, 330],
  [2130, 2170],
];
const PLATFORMS: Array<[number, number, number, number]> = [
  [420, 520, 170, 26],
  [760, 456, 180, 26],
  [1560, 430, 180, 26],
  [2290, 512, 210, 26],
  [2480, 380, 180, 26],
  [3520, 500, 200, 26],
  [3820, 444, 170, 26],
];
const GATE1_X = 1760;
const CHECKPOINT_X = 2260;
const GATE2_X = 2860;
const CHECKPOINT2_X = 3360;
const SHELF_X = 3060;
const EXIT_X = 4070;
const BRIDGE_X = 1990;
const BRIDGE_WIDTH = 280;
const MISSILE_GAP_START = 1280;
const MISSILE_GAP_END = 1520;
const MISSILE_LAUNCH_X = 1600;
const MISSILE_Y = 530;
const BRIDGE_CHECKPOINT_X = 1080;
const RETURN_TRAP_SPAWN_X = 2280;
const RETURN_TRAP_CHUTE_X = 2760;
const RETURN_TRAP_PATH_Y = 560;
const RETURN_TRAP_TRIGGER_X = 2520;
const RETURN_TRAP_DEMO_X = 2340;

export class IslandScene extends Phaser.Scene {
  private run!: RunState;
  private player!: Player;
  private hud!: Hud;
  private touch: TouchControls | null = null;
  private meme!: MemeMeter;
  private cards!: CardSystem;
  private ally: Ally | null = null;
  private readonly quizSystem = new QuizSystem();
  private quizOverlay: QuizOverlay | null = null;
  private readonly solids: Phaser.GameObjects.Rectangle[] = [];
  private readonly crabs: SupplyCrab[] = [];
  private crabGroup!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private midLayer!: Phaser.GameObjects.TileSprite;
  private eKey: Phaser.Input.Keyboard.Key | null = null;
  private gate1Light: Phaser.GameObjects.Arc | null = null;
  private bridgeVisual: Phaser.GameObjects.Container | null = null;
  private bridgeBarrier: Phaser.GameObjects.Rectangle | null = null;
  private bridgeCollider: Phaser.Physics.Arcade.Collider | null = null;
  private gate2Light: Phaser.GameObjects.Arc | null = null;
  private gate2Shelf: Phaser.GameObjects.Container | null = null;
  private gate2Rope: Phaser.GameObjects.Graphics | null = null;
  private gate2Bucket: Phaser.GameObjects.Container | null = null;
  private gate2BucketFill: Phaser.GameObjects.Graphics | null = null;
  private gate2BucketLabel: Phaser.GameObjects.Text | null = null;
  private gate2Barrier: Phaser.GameObjects.Rectangle | null = null;
  private gate2Collider: Phaser.Physics.Arcade.Collider | null = null;
  private gate2Epoch = 0;
  private tutorialCrate: Phaser.GameObjects.Container | null = null;
  private tutorialDrone: Phaser.GameObjects.Image | null = null;
  private viewfinder: Viewfinder | null = null;
  private missileLauncher: Phaser.GameObjects.Container | null = null;
  private missileDrone: Phaser.GameObjects.Image | null = null;
  private missileLight: Phaser.GameObjects.Arc | null = null;
  private missileGuide: Phaser.GameObjects.Graphics | null = null;
  private activeMissile: Phaser.GameObjects.Image | null = null;
  private missileUsed = false;
  private missileWarning = false;
  private missileEpoch = 0;
  private missileTutorialDone = false;
  private missileTutorialActive = false;
  private bridgeCheckpointToasted = false;
  private gate1Passed = false;
  private gate1DemoDone = false;
  private gate2Passed = false;
  private gate2DemoDone = false;
  private quizOpen = false;
  private rewardOpen = false;
  private gateAnimating = false;
  private nearGate1 = false;
  private nearGate2 = false;
  private nearExit = false;
  private respawning = false;
  private finished = false;
  private transitioning = false;
  private tutorialStarted = false;
  private tutorialEpoch = 0;
  private checkpointToasted = false;
  private checkpoint2Toasted = false;
  private spawnPoint = { x: 150, y: 560 };
  private pendingReason = STRINGS.act2.deathReason;
  private cardsChangedHandler: (() => void) | null = null;
  private returnTrap: ReturnParcelTrap | null = null;
  private voicePresenter: VoicePresenter | null = null;

  constructor() {
    super('Island');
  }

  create(): void {
    this.quizOpen = false;
    this.rewardOpen = false;
    this.gateAnimating = false;
    this.respawning = false;
    this.finished = false;
    this.transitioning = false;
    this.gate1DemoDone = false;
    this.gate2DemoDone = false;
    this.tutorialStarted = false;
    this.tutorialEpoch = 0;
    this.checkpointToasted = false;
    this.checkpoint2Toasted = false;
    this.ally = null;
    this.quizOverlay = null;
    this.gate1Light = null;
    this.bridgeVisual = null;
    this.bridgeBarrier = null;
    this.bridgeCollider = null;
    this.gate2Light = null;
    this.gate2Shelf = null;
    this.gate2Rope = null;
    this.gate2Bucket = null;
    this.gate2BucketFill = null;
    this.gate2BucketLabel = null;
    this.gate2Barrier = null;
    this.gate2Collider = null;
    this.gate2Epoch = 0;
    this.tutorialCrate = null;
    this.tutorialDrone = null;
    this.viewfinder = null;
    this.missileLauncher = null;
    this.missileDrone = null;
    this.missileLight = null;
    this.missileGuide = null;
    this.activeMissile = null;
    this.missileUsed = false;
    this.missileWarning = false;
    this.missileEpoch = 0;
    this.missileTutorialActive = false;
    this.bridgeCheckpointToasted = false;
    this.cardsChangedHandler = null;
    this.returnTrap = null;
    this.voicePresenter = null;
    this.solids.length = 0;
    this.crabs.length = 0;

    this.run = getRunState(this);
    this.run.act = 2;
    if (this.run.hp <= 0) {
      this.run.hp = PLAYER.maxHp;
    }
    this.missileTutorialDone = this.run.act2BridgeCheckpoint === true;
    this.gate1Passed = this.run.act2Door1Passed;
    this.gate2Passed = this.run.act2Door2Passed;
    this.spawnPoint = this.gate2Passed
      ? { x: CHECKPOINT2_X, y: 560 }
      : this.gate1Passed
        ? { x: CHECKPOINT_X, y: 560 }
        : this.run.act2BridgeCheckpoint
          ? { x: BRIDGE_CHECKPOINT_X, y: 560 }
          : { x: 150, y: 560 };
    this.pendingReason = STRINGS.act2.deathReason;

    this.physics.world.setBounds(0, 0, ISLAND_WIDTH, 1000);
    this.cameras.main.setBounds(0, 0, ISLAND_WIDTH, GAME_HEIGHT);
    this.cameras.main.fadeIn(260, 23, 19, 16);
    audio.resetSceneMix();
    audio.setMusic('level');
    voice.stopAll();
    voice.resetOneShots();
    voice.preloadAll();
    this.voicePresenter = createVoicePresenter(this);
    voice.setPresenter(this.voicePresenter);

    this.buildBackground();
    this.buildGeometry();
    this.buildLandingSet();
    this.buildTutorialSet();
    this.buildMissileSet();
    this.buildGate1Set();
    this.buildCheckpoint(BRIDGE_CHECKPOINT_X, '断桥前');
    this.buildCheckpoint();
    this.buildChalkGag();
    this.buildGate2Set();
    this.buildCheckpoint(CHECKPOINT2_X, '滑轮营地');
    this.buildExitSet();

    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.run.hp, this.makePlayerCallbacks());
    this.meme = new MemeMeter(this.run);
    this.initGroups();
    this.spawnCrabs();
    this.setupReturnTrap();
    this.setupCollisions();
    this.setupHud();
    this.setupTouch();
    this.setupCamera();
    this.eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E) ?? null;

    if (!this.gate1Passed) {
      this.showIntro();
      this.time.delayedCall(2600, () => this.startTutorial());
    }
    addScanlines(this, 90);
    this.events.once('shutdown', () => this.cleanupScene());
  }

  override update(time: number, delta: number): void {
    if (!this.player) {
      return;
    }
    this.midLayer.tilePositionX = this.cameras.main.scrollX * 0.32;
    if (this.finished) {
      return;
    }
    this.player.tick(time, delta);
    this.quizOverlay?.update(delta);
    if (!this.quizOpen && !this.rewardOpen && !this.gateAnimating) {
      this.crabs.forEach((crab) => crab.tick(time));
    }
    this.tickAlly(time);
    this.cleanupProjectiles(time);
    this.updateInteractions();
    this.updateBridgeCheckpoint();
    this.maybeStartMissileTutorial();
    this.tickMissileChallenge();
    this.returnTrap?.update(time);

    if (!this.respawning && !this.transitioning && this.player.y > WORLD.fallDamageY) {
      this.handleFall();
    }
    if (this.gate1Passed && !this.checkpointToasted && this.player.x > CHECKPOINT_X - 40) {
      this.checkpointToasted = true;
      this.hud.toast(STRINGS.act2.checkpoint, 'paper');
    }
    if (this.gate2Passed && !this.checkpoint2Toasted && this.player.x > CHECKPOINT2_X - 40) {
      this.checkpoint2Toasted = true;
      this.hud.toast(STRINGS.act2.checkpoint2, 'paper');
    }

    this.hud.updatePlayer(this.player.getHp(), this.player.getMaxHp());
    this.hud.updateMeme(this.meme.getValue(), this.meme.isBurstActive(), this.meme.getStreak());
    this.cards.update(delta);
    this.hud.updateActiveEffects(this.cards.getActiveEffects());
    this.meme.update(delta);
    this.run.hp = this.player.getHp();
    this.meme.sync(this.run);
    this.run.cards = [...this.run.cards];
  }

  private makePlayerCallbacks(): PlayerCallbacks {
    return {
      fireShot: (x, y, facing) => this.firePlayerShot(x, y, facing),
      dashTrail: (x, y) => this.spawnDashDust(x, y),
      jumped: (doubleJump) => {
        pixelBurst(this, this.player.x, this.player.y + 30, doubleJump ? COLORS.neon : COLORS.paperDim, doubleJump ? 7 : 4, 0.6);
      },
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
    const sky = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.islandSky);
    sky.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    sky.setScrollFactor(0);
    sky.setDepth(-30);
    this.midLayer = this.add.tileSprite(0, 270, GAME_WIDTH, 420, TEX.islandMid);
    this.midLayer.setOrigin(0);
    this.midLayer.setScrollFactor(0);
    this.midLayer.setDepth(-20);
    this.midLayer.setAlpha(0.72);

    for (let i = 0; i < 12; i += 1) {
      const fog = this.add.ellipse(
        Phaser.Math.Between(0, ISLAND_WIDTH),
        Phaser.Math.Between(300, 500),
        Phaser.Math.Between(220, 520),
        Phaser.Math.Between(26, 60),
        COLORS.paperDim,
        Phaser.Math.FloatBetween(0.04, 0.1),
      );
      fog.setDepth(-14);
      this.tweens.add({
        targets: fog,
        x: fog.x + Phaser.Math.Between(120, 280),
        alpha: 0,
        duration: Phaser.Math.Between(6000, 11000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
        onRepeat: () => {
          fog.setPosition(Phaser.Math.Between(-200, ISLAND_WIDTH - 200), Phaser.Math.Between(300, 500));
          fog.setAlpha(Phaser.Math.FloatBetween(0.04, 0.1));
        },
      });
    }

    for (let i = 0; i < 20; i += 1) {
      const wind = this.add.image(
        Phaser.Math.Between(80, ISLAND_WIDTH - 80),
        Phaser.Math.Between(160, 560),
        TEX.dust,
      );
      wind.setDepth(-8);
      wind.setTint(i % 3 === 0 ? COLORS.warning : COLORS.paper);
      wind.setAlpha(Phaser.Math.FloatBetween(0.06, 0.16));
      this.tweens.add({
        targets: wind,
        x: wind.x + Phaser.Math.Between(120, 240),
        y: wind.y - Phaser.Math.Between(20, 60),
        alpha: 0,
        duration: Phaser.Math.Between(2800, 6200),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        onRepeat: () => {
          wind.setPosition(Phaser.Math.Between(40, ISLAND_WIDTH - 200), Phaser.Math.Between(180, 580));
          wind.setAlpha(Phaser.Math.FloatBetween(0.06, 0.16));
        },
      });
    }

    const backlight = this.add.graphics();
    backlight.setDepth(-12);
    backlight.setScrollFactor(0);
    backlight.fillStyle(COLORS.warning, 0.05);
    backlight.fillTriangle(890, 90, 1280, 0, 1280, 480);
    backlight.fillStyle(COLORS.paper, 0.04);
    backlight.fillTriangle(760, 130, 1220, 0, 1220, 300);
  }

  private buildGeometry(): void {
    GROUND_SEGMENTS.forEach(([x, width], index) => this.drawGround(x, width, index));
    PLATFORMS.forEach(([x, y, w, h], index) => this.drawPlatform(x, y, w, h, index));
    this.drawBrokenBridge();
    this.drawPitMarkers();
  }

  private drawGround(x: number, width: number, index: number): void {
    this.addSolid(x + width / 2, GROUND_Y + 42, width, 84);
    const g = this.add.graphics();
    g.setDepth(10);
    g.fillStyle(0x2b322a, 1);
    g.fillRect(x, GROUND_Y, width, 84);
    g.fillStyle(0x59614b, 0.95);
    g.fillRect(x, GROUND_Y, width, 16);
    g.fillStyle(0x7c8562, 0.8);
    g.fillRect(x, GROUND_Y, width, 5);
    g.fillStyle(COLORS.coal, 0.65);
    for (let sx = x + 26; sx < x + width; sx += 96) {
      g.fillRect(sx, GROUND_Y + 20, 46 + (sx % 3) * 18, 3);
      g.fillRect(sx + 12, GROUND_Y + 34, 26, 2);
    }
    g.fillStyle(0x3d463b, 0.9);
    for (let sx = x + 14; sx < x + width; sx += 120) {
      g.fillTriangle(sx, GROUND_Y + 84, sx + 24, GROUND_Y + 62, sx + 48, GROUND_Y + 84);
    }
    g.fillStyle(0x87907a, 0.4);
    for (let sx = x + 56; sx < x + width; sx += 160) {
      g.fillCircle(sx, GROUND_Y + 50, 3);
      g.fillCircle(sx + 10, GROUND_Y + 54, 2);
    }
    g.fillStyle(COLORS.warning, 0.6);
    g.fillRect(x, GROUND_Y + 7, Math.min(width, 110), 3);
    const label = this.add.text(x + 24, GROUND_Y + 62, `潮线 C-${String(index + 1).padStart(2, '0')} // 请勿背对海风`, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.paperDim,
    });
    label.setAlpha(0.45);
    label.setDepth(11);
  }

  private drawPlatform(x: number, y: number, w: number, h: number, index: number): void {
    this.addSolid(x + w / 2, y + h / 2, w, h);
    const g = this.add.graphics();
    g.setDepth(10);
    g.fillStyle(COLORS.coal, 0.32);
    g.fillRect(x + 6, y + h - 2, w, 7);
    g.fillStyle(0x5a4d3a, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x7a6a4f, 1);
    g.fillRect(x + 3, y + 3, w - 6, 4);
    g.lineStyle(2, COLORS.coal, 0.85);
    g.strokeRect(x, y, w, h);
    g.fillStyle(COLORS.paperDark, 0.8);
    g.fillRect(x, y, w, 3);
    g.lineStyle(1, COLORS.coal, 0.3);
    for (let sx = x + 20; sx < x + w - 6; sx += 42) {
      g.lineBetween(sx, y + 5, sx - 12, y + h - 2);
    }
    if (index % 2 === 0) {
      const rope = this.add.graphics();
      rope.setDepth(11);
      rope.lineStyle(2, COLORS.warning, 0.4);
      rope.lineBetween(x + 12, y - 2, x + w - 14, y + 2);
    }
  }

  private addSolid(centerX: number, centerY: number, width: number, height: number): void {
    const rect = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.solids.push(rect);
  }

  private drawBrokenBridge(): void {
    const bridgeSolid = this.add.rectangle(BRIDGE_X, GROUND_Y + 12, BRIDGE_WIDTH, 24, 0x000000, 0);
    this.physics.add.existing(bridgeSolid, true);
    this.solids.push(bridgeSolid);

    const root = this.add.container(BRIDGE_X, GROUND_Y);
    root.setDepth(12);
    const g = this.add.graphics();
    g.lineStyle(3, COLORS.coal, 0.9);
    g.beginPath();
    g.moveTo(-BRIDGE_WIDTH / 2, -42);
    g.lineTo(BRIDGE_WIDTH / 2, -18);
    g.strokePath();
    g.lineStyle(2, COLORS.paperDark, 0.75);
    g.beginPath();
    g.moveTo(-BRIDGE_WIDTH / 2, -26);
    g.lineTo(BRIDGE_WIDTH / 2, -8);
    g.strokePath();
    for (let x = -BRIDGE_WIDTH / 2 + 10; x < BRIDGE_WIDTH / 2; x += 26) {
      g.fillStyle(x % 52 === 0 ? 0x7a6a4f : 0x5a4d3a, 1);
      g.fillRect(x, -6 + Math.sin(x / 28) * 3, 24, 8);
    }
    g.fillStyle(COLORS.warning, 0.8);
    g.fillRect(-BRIDGE_WIDTH / 2 - 4, -50, 8, 52);
    g.fillRect(BRIDGE_WIDTH / 2 - 4, -50, 8, 52);
    root.add(g);
    this.bridgeVisual = root;
    if (this.gate1Passed) {
      root.setAlpha(1);
      root.setAngle(0);
    } else {
      root.setAlpha(0.18);
      root.setAngle(-0.12);
    }

    if (!this.gate1Passed) {
      const barrier = this.add.rectangle(1840, 470, 40, 336, 0x000000, 0);
      this.physics.add.existing(barrier, true);
      this.bridgeBarrier = barrier;
      const blockade = this.add.graphics();
      blockade.setDepth(14);
      blockade.fillStyle(COLORS.coal, 0.9);
      blockade.fillRect(1826, 540, 8, 96);
      blockade.fillRect(1858, 540, 8, 96);
      blockade.fillStyle(COLORS.warning, 0.75);
      for (let y = 548; y < 630; y += 16) {
        blockade.fillTriangle(1818, y + 14, 1840, y, 1862, y + 14);
      }
      const stop = addHotTag(this, 1842, 516, '缆绳未收回', COLORS.warning, 0.02);
      stop.setDepth(15);
      stop.setScale(0.8);
    }
  }

  private drawPitMarkers(): void {
    [1846, 2134].forEach((x, index) => {
      const g = this.add.graphics();
      g.setDepth(15);
      g.fillStyle(COLORS.coal, 1);
      g.fillRect(x - 3, GROUND_Y - 8, 6, 58);
      g.fillStyle(COLORS.warning, 1);
      g.fillRect(x - 12, GROUND_Y - 54, 24, 40);
      g.fillStyle(COLORS.coal, 0.9);
      for (let i = 0; i < 3; i += 1) {
        g.fillTriangle(x - 12, GROUND_Y - 44 + i * 11, x + 12, GROUND_Y - 50 + i * 11, x + 12, GROUND_Y - 40 + i * 11);
      }
      const tag = this.add.text(x, GROUND_Y - 70, index === 0 ? '断桥' : '→ 别掉', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS.coal,
      });
      tag.setOrigin(0.5);
      tag.setDepth(16);
      tag.setAlpha(0.8);
    });
  }

  private buildLandingSet(): void {
    const lid = this.add.container(160, 606);
    lid.setDepth(13);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.28);
    g.fillEllipse(0, 26, 220, 22);
    g.fillStyle(0x8a7351, 1);
    g.fillRect(-104, -12, 208, 28);
    g.fillStyle(0xa58b63, 1);
    g.fillRect(-104, -12, 208, 7);
    g.fillStyle(0x6e5a3f, 1);
    g.fillRect(-104, 12, 208, 4);
    g.fillStyle(COLORS.paper, 0.82);
    g.fillRect(-62, -36, 124, 24);
    g.lineStyle(2, COLORS.coal, 0.7);
    g.strokeRect(-62, -36, 124, 24);
    lid.add(g);
    const label = this.add.text(0, -24, '已 签 收', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setAngle(-0.04);
    lid.add(label);
    const mark = stamp(this, 128, 596, '荒野岛', {
      color: COLORS.rust,
      fontSize: 16,
      angle: 0.08,
      alpha: 0.72,
    });
    mark.setDepth(14);

    const tarp = this.add.container(320, 286);
    tarp.setDepth(3);
    const tg = this.add.graphics();
    tg.fillStyle(0x4b5642, 0.82);
    tg.fillPoints(
      [
        new Phaser.Geom.Point(-86, -22),
        new Phaser.Geom.Point(58, -46),
        new Phaser.Geom.Point(96, 12),
        new Phaser.Geom.Point(62, 6),
        new Phaser.Geom.Point(34, 46),
        new Phaser.Geom.Point(4, 14),
        new Phaser.Geom.Point(-28, 34),
        new Phaser.Geom.Point(-48, -2),
      ],
      true,
    );
    tg.lineStyle(2, COLORS.paper, 0.3);
    tg.strokePoints(
      [
        new Phaser.Geom.Point(-86, -22),
        new Phaser.Geom.Point(58, -46),
        new Phaser.Geom.Point(96, 12),
        new Phaser.Geom.Point(62, 6),
        new Phaser.Geom.Point(34, 46),
        new Phaser.Geom.Point(4, 14),
        new Phaser.Geom.Point(-28, 34),
        new Phaser.Geom.Point(-48, -2),
      ],
      true,
    );
    tg.lineStyle(2, COLORS.coal, 0.5);
    tg.lineBetween(-60, -30, -120, -120);
    tg.lineBetween(58, -46, 90, -138);
    tarp.add(tg);
    const tape = makeTape(this, 30, -6, 90, 16, COLORS.warning);
    tape.setRotation(-0.2);
    tarp.add(tape);

    const sign = this.add.container(540, 236);
    sign.setDepth(3);
    const sg = this.add.graphics();
    sg.lineStyle(2, COLORS.coalFaint, 0.7);
    sg.lineBetween(-70, -70, 66, -16);
    sg.lineBetween(70, -70, -66, -16);
    sg.fillStyle(COLORS.paperDim, 0.95);
    sg.fillRect(-82, -22, 164, 52);
    sg.lineStyle(2, COLORS.coal, 0.75);
    sg.strokeRect(-82, -22, 164, 52);
    sg.fillStyle(COLORS.rust, 0.75);
    sg.fillRect(-82, -22, 164, 5);
    sign.add(sg);
    const signText = this.add.text(0, 4, '唯一退路', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    signText.setOrigin(0.5);
    sign.add(signText);
    sign.setAngle(0.12);
  }

  private buildTutorialSet(): void {
    const crate = this.add.container(900, 602);
    crate.setDepth(13);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.3);
    g.fillEllipse(0, 30, 142, 18);
    g.fillStyle(0x8a7351, 1);
    g.fillRect(-66, -44, 132, 70);
    g.fillStyle(0xa58b63, 1);
    g.fillRect(-66, -44, 132, 8);
    g.fillStyle(0x6e5a3f, 1);
    g.fillRect(-66, 20, 132, 6);
    g.lineStyle(3, COLORS.coal, 0.8);
    g.strokeRect(-66, -44, 132, 70);
    g.fillStyle(COLORS.warning, 0.78);
    g.fillRect(-14, -44, 28, 70);
    g.fillStyle(COLORS.paper, 0.9);
    g.fillRect(-48, -24, 74, 30);
    g.lineStyle(1, COLORS.rust, 0.9);
    g.strokeRect(-48, -24, 74, 30);
    crate.add(g);
    const label = this.add.text(-11, -9, '空箱', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    crate.add(label);
    this.tutorialCrate = crate;

    const tree = this.add.graphics();
    tree.setDepth(2);
    tree.fillStyle(0x3d463b, 0.9);
    tree.fillRect(1060, 180, 22, 456);
    tree.fillStyle(0x2b322a, 0.9);
    tree.fillRect(1060, 180, 7, 456);
    tree.lineStyle(9, 0x3d463b, 0.85);
    tree.lineBetween(1072, 256, 970, 212);
    tree.lineBetween(1072, 300, 1188, 246);
    tree.lineBetween(1080, 214, 1138, 168);
    tree.lineStyle(4, 0x59614b, 0.7);
    tree.lineBetween(970, 212, 914, 228);
    tree.lineBetween(1138, 168, 1204, 150);
    const snagged = this.add.container(964, 218);
    snagged.setDepth(3);
    const cg = this.add.graphics();
    cg.fillStyle(0x8a7351, 0.9);
    cg.fillRect(-32, -24, 64, 40);
    cg.lineStyle(2, COLORS.coal, 0.8);
    cg.strokeRect(-32, -24, 64, 40);
    cg.fillStyle(COLORS.warning, 0.75);
    cg.fillRect(-4, -24, 8, 40);
    cg.lineStyle(2, COLORS.coal, 0.55);
    cg.lineBetween(-32, -4, 32, -4);
    snagged.add(cg);
    snagged.setAngle(-0.22);
    const snagLabel = this.add.text(0, -36, '补给已挂树', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    snagLabel.setOrigin(0.5);
    snagged.add(snagLabel);

    const drone = this.add.image(1180, 326, TEX.drone);
    drone.setDepth(45);
    drone.setScale(1.5);
    this.tutorialDrone = drone;
    this.tweens.add({
      targets: drone,
      y: 314,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const sign = addHotTag(this, 900, 462, 'LOOK // 先看框', COLORS.warning, -0.02);
    sign.setDepth(16);
  }

  private buildMissileSet(): void {
    const root = this.add.container(MISSILE_LAUNCH_X, GROUND_Y);
    root.setDepth(14);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.3);
    g.fillEllipse(0, 2, 126, 16);
    g.fillStyle(COLORS.coal, 0.85);
    g.fillRect(-8, -104, 16, 104);
    g.fillStyle(0x4d554c, 1);
    g.fillRect(-84, -118, 84, 24);
    g.lineStyle(2, COLORS.coal, 0.9);
    g.strokeRect(-84, -118, 84, 24);
    g.fillStyle(COLORS.warning, 0.75);
    for (let x = -78; x < -10; x += 20) {
      g.fillRect(x, -112, 10, 5);
    }
    g.fillStyle(COLORS.rust, 0.95);
    g.fillRect(-84, -118, 6, 24);
    g.fillStyle(COLORS.paper, 0.7);
    g.fillRect(-48, -100, 34, 3);
    root.add(g);
    const label = this.add.text(-46, -138, '发射口 · 固定高度', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    label.setOrigin(0.5);
    label.setAlpha(0.72);
    root.add(label);

    const light = this.add.circle(-42, -126, 6, COLORS.coalFaint, 0.8);
    light.setStrokeStyle(2, COLORS.coal, 1);
    light.setDepth(16);
    root.add(light);
    this.missileLight = light;

    const drone = this.add.image(-42, -184, TEX.drone);
    drone.setScale(1.15);
    drone.setDepth(15);
    root.add(drone);
    this.missileDrone = drone;
    this.tweens.add({
      targets: drone,
      y: -174,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.missileLauncher = root;

    const guide = this.add.graphics();
    guide.setDepth(6);
    guide.lineStyle(1, COLORS.warning, 0.28);
    for (let x = MISSILE_GAP_START; x < MISSILE_LAUNCH_X - 64; x += 28) {
      guide.lineBetween(x, MISSILE_Y, x + 14, MISSILE_Y);
    }
    guide.lineStyle(1, COLORS.paperDim, 0.35);
    guide.lineBetween(MISSILE_GAP_START, MISSILE_Y - 16, MISSILE_GAP_START, MISSILE_Y + 16);
    this.missileGuide = guide;

    const planks = this.add.graphics();
    planks.setDepth(13);
    planks.fillStyle(0x5a4d3a, 1);
    planks.fillRect(MISSILE_GAP_START - 44, GROUND_Y - 8, 40, 8);
    planks.fillStyle(0x7a6a4f, 1);
    planks.fillRect(MISSILE_GAP_START - 8, GROUND_Y - 10, 8, 10);
    planks.lineStyle(2, COLORS.warning, 0.8);
    planks.strokeRect(MISSILE_GAP_START - 44, GROUND_Y - 8, 40, 8);
    const loose = addHotTag(this, MISSILE_GAP_START - 24, GROUND_Y - 62, '松动桥板', COLORS.warning, 0.04);
    loose.setDepth(16);
    loose.setScale(0.82);
    const landing = addHotTag(this, MISSILE_GAP_END + 34, GROUND_Y - 38, '落点', COLORS.neon, -0.03);
    landing.setDepth(16);
    landing.setScale(0.72);
    landing.setAlpha(0.7);
    if (this.gate1Passed) {
      root.setAlpha(0.5);
      guide.setAlpha(0.15);
      light.setFillStyle(COLORS.coalFaint, 0.8);
    }
  }

  private updateBridgeCheckpoint(): void {
    if (this.gate1Passed || this.run.act2BridgeCheckpoint) {
      return;
    }
    if (this.player.x < BRIDGE_CHECKPOINT_X + 24 || this.player.x >= MISSILE_GAP_START) {
      return;
    }
    this.run.act2BridgeCheckpoint = true;
    this.spawnPoint = { x: BRIDGE_CHECKPOINT_X, y: 560 };
    if (!this.bridgeCheckpointToasted) {
      this.bridgeCheckpointToasted = true;
      this.hud.toast(STRINGS.act2.bridgeCheckpoint, 'paper');
    }
  }

  private maybeStartMissileTutorial(): void {
    if (
      this.gate1Passed ||
      this.finished ||
      this.missileTutorialDone ||
      this.missileTutorialActive ||
      this.quizOpen ||
      this.rewardOpen ||
      !this.run.act2BridgeCheckpoint ||
      this.player.x < BRIDGE_CHECKPOINT_X + 40 ||
      this.player.x > MISSILE_GAP_START - 48 ||
      this.player.y < 580
    ) {
      return;
    }
    this.missileTutorialDone = true;
    this.missileTutorialActive = true;
    this.gateAnimating = true;
    this.player.setControlEnabled(false);
    this.player.setVelocity(0, 0);
    this.touch?.setEnabled(false);
    this.hud.setHint(null);
    this.missileLight?.setFillStyle(COLORS.rust, 1);
    this.missileDrone?.setTint(COLORS.rust);
    audio.play('missileLock');
    this.hud.toast(STRINGS.act2.missileTutorial, 'paper');
    this.time.delayedCall(700, () => {
      if (this.finished) {
        return;
      }
      this.launchMissile(true);
    });
    this.time.delayedCall(2150, () => {
      this.missileTutorialActive = false;
      this.gateAnimating = false;
      this.missileDrone?.clearTint();
      if (!this.gate1Passed) {
        this.missileLight?.setFillStyle(COLORS.warning, 0.85);
      }
      if (this.finished) {
        return;
      }
      this.hud.toast(STRINGS.act2.bridgePrompt, 'paper');
      this.player.setControlEnabled(true);
      this.touch?.setEnabled(true);
    });
  }

  private tickMissileChallenge(): void {
    if (this.gate1Passed || this.finished || this.missileTutorialActive) {
      return;
    }
    if (
      !this.missileUsed &&
      !this.missileWarning &&
      !this.quizOpen &&
      !this.gateAnimating &&
      this.player.x >= MISSILE_GAP_START - 48 &&
      this.player.x <= MISSILE_GAP_START + 12 &&
      this.player.y > 545
    ) {
      this.startMissileWarning();
    }
    const missile = this.activeMissile;
    if (!missile || !missile.active) {
      return;
    }
    const bounds = missile.getBounds();
    const playerBounds = this.player.getBounds();
    if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, playerBounds)) {
      const hitX = missile.x;
      missile.destroy();
      this.activeMissile = null;
      this.missileWarning = false;
      this.missileLight?.setFillStyle(COLORS.warning, 0.85);
      this.cameras.main.shake(160, 0.012);
      pixelBurst(this, hitX, MISSILE_Y, COLORS.warning, 12, 1.4);
      audio.play('gearToss');
      if (this.player.takeDamage(24, hitX) > 0) {
        this.hud.toast(STRINGS.act2.missileHit, 'rust');
      }
    }
  }

  private startMissileWarning(): void {
    this.missileWarning = true;
    this.missileEpoch += 1;
    const epoch = this.missileEpoch;
    this.missileLight?.setFillStyle(COLORS.rust, 1);
    this.missileDrone?.setTint(COLORS.rust);
    audio.play('missileLock');
    addFloatingLine(this, MISSILE_GAP_START + 118, 476, STRINGS.act2.missileLock, COLORS.warning, 15, 1500);
    this.cameras.main.shake(80, 0.003);
    this.time.delayedCall(650, () => {
      if (epoch !== this.missileEpoch || this.finished || this.gate1Passed) {
        return;
      }
      this.launchMissile(false);
    });
  }

  private launchMissile(tutorial: boolean): void {
    if (!tutorial) {
      this.missileUsed = true;
    }
    audio.play('missileLaunch');
    const missile = this.add.image(MISSILE_LAUNCH_X - 76, MISSILE_Y, TEX.missile);
    missile.setDepth(46);
    missile.setScale(1.35);
    missile.setFlipX(true);
    if (!tutorial) {
      this.activeMissile = missile;
    }
    const trail = this.time.addEvent({
      delay: 55,
      loop: true,
      callback: () => {
        if (!missile.active) {
          return;
        }
        const spark = this.add.image(missile.x + 30, MISSILE_Y + Phaser.Math.Between(-3, 3), TEX.spark);
        spark.setTint(COLORS.warning);
        spark.setDepth(45);
        spark.setAlpha(0.8);
        this.tweens.add({ targets: spark, alpha: 0, scale: 0.3, duration: 180, onComplete: () => spark.destroy() });
      },
    });
    this.tweens.add({
      targets: missile,
      x: -120,
      duration: 3600,
      ease: 'Linear',
      onComplete: () => {
        trail.remove(false);
        missile.destroy();
        if (!tutorial) {
          this.activeMissile = null;
          this.missileWarning = false;
          this.missileLight?.setFillStyle(COLORS.warning, 0.85);
        }
      },
    });
  }

  private resetMissileChallenge(): void {
    this.missileEpoch += 1;
    if (this.activeMissile) {
      this.activeMissile.destroy();
      this.activeMissile = null;
    }
    this.missileUsed = false;
    this.missileWarning = false;
    this.missileDrone?.clearTint();
    if (!this.gate1Passed) {
      this.missileLight?.setFillStyle(COLORS.warning, 0.85);
    }
  }

  private buildGate1Set(): void {
    const post = this.add.container(GATE1_X, 468);
    post.setDepth(14);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.8);
    g.fillRect(-8, -166, 16, 322);
    g.fillRect(-72, -166, 144, 12);
    g.fillStyle(0x5a4d3a, 1);
    g.fillRect(-68, 140, 136, 16);
    g.fillStyle(COLORS.paper, 0.95);
    g.fillRect(-54, -136, 108, 74);
    g.lineStyle(2, COLORS.coal, 0.8);
    g.strokeRect(-54, -136, 108, 74);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(-54, -136, 108, 12);
    g.fillStyle(COLORS.coal, 0.35);
    g.fillRect(-40, -110, 80, 4);
    g.fillRect(-40, -98, 62, 3);
    g.fillRect(-40, -88, 74, 3);
    post.add(g);
    const title = this.add.text(0, -120, '逃 生 闸 机', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const code = this.add.text(0, -82, '唯一退路', {
      fontFamily: FONTS.display,
      fontSize: '19px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    code.setOrigin(0.5);
    const light = this.add.circle(54, -154, 7, this.gate1Passed ? COLORS.neon : COLORS.rust);
    light.setStrokeStyle(2, COLORS.coal, 1);
    post.add([title, code, light]);
    this.gate1Light = light;

    const reel = this.add.graphics();
    reel.setDepth(11);
    reel.lineStyle(3, COLORS.paperDark, 0.7);
    reel.strokeCircle(1660, 552, 20);
    reel.lineStyle(1, COLORS.coal, 0.5);
    reel.strokeCircle(1660, 552, 10);
    reel.lineStyle(2, COLORS.warning, 0.55);
    reel.beginPath();
    reel.moveTo(1660, 552);
    reel.lineTo(1780, 520);
    reel.lineTo(1910, 582);
    reel.strokePath();
    const tag = addHotTag(this, GATE1_X, 300, '荒哥的逃生演示', COLORS.warning, 0.025);
    tag.setDepth(16);
    if (this.gate1Passed) {
      post.setAlpha(0.62);
      tag.setAlpha(0.45);
    }
  }

  private buildGate2Set(): void {
    const post = this.add.container(GATE2_X, 468);
    post.setDepth(14);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.8);
    g.fillRect(-8, -166, 16, 322);
    g.fillRect(-72, -166, 144, 12);
    g.fillStyle(0x5a4d3a, 1);
    g.fillRect(-68, 140, 136, 16);
    g.fillStyle(COLORS.paper, 0.95);
    g.fillRect(-58, -138, 116, 82);
    g.lineStyle(2, COLORS.coal, 0.8);
    g.strokeRect(-58, -138, 116, 82);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(-58, -138, 116, 12);
    g.fillStyle(COLORS.coal, 0.35);
    g.fillRect(-42, -110, 84, 4);
    g.fillRect(-42, -98, 60, 3);
    g.fillRect(-42, -86, 76, 3);
    post.add(g);
    const title = this.add.text(0, -122, '雨 棚 货 架', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const code = this.add.text(0, -78, '这是好事呀', {
      fontFamily: FONTS.display,
      fontSize: '17px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    code.setOrigin(0.5);
    const light = this.add.circle(56, -156, 7, this.gate2Passed ? COLORS.neon : COLORS.rust);
    light.setStrokeStyle(2, COLORS.coal, 1);
    post.add([title, code, light]);
    this.gate2Light = light;
    if (this.gate2Passed) {
      post.setAlpha(0.62);
    }

    const canopy = this.add.graphics();
    canopy.setDepth(4);
    canopy.fillStyle(0x4b5642, 0.9);
    canopy.fillRect(2840, 270, 226, 18);
    canopy.fillStyle(0x59614b, 0.9);
    canopy.fillRect(2840, 270, 226, 5);
    canopy.lineStyle(2, COLORS.coal, 0.7);
    canopy.strokeRect(2840, 270, 226, 18);
    canopy.lineStyle(2, COLORS.paperDark, 0.55);
    canopy.lineBetween(2860, 270, 2860, 236);
    canopy.lineBetween(3038, 270, 3038, 236);
    canopy.fillStyle(COLORS.coal, 0.35);
    canopy.fillRect(2904, 272, 22, 14);
    const canopyTag = addHotTag(this, 2860, 224, '这是好事呀', COLORS.warning, -0.025);
    canopyTag.setDepth(16);

    const droplet = this.add.graphics();
    droplet.setDepth(5);
    droplet.fillStyle(COLORS.neon, 0.75);
    droplet.fillCircle(2922, 296, 4);
    droplet.fillRect(2920, 292, 4, 8);
    droplet.fillStyle(COLORS.neon, 0.45);
    droplet.fillCircle(2952, 296, 3);

    const pulley = this.add.graphics();
    pulley.setDepth(6);
    pulley.lineStyle(3, COLORS.coal, 0.85);
    pulley.strokeCircle(2992, 306, 18);
    pulley.lineStyle(1, COLORS.warning, 0.8);
    pulley.strokeCircle(2992, 306, 9);
    pulley.lineBetween(2992, 288, 2992, 246);

    const bucket = this.add.container(2952, this.gate2Passed ? 574 : 560);
    bucket.setDepth(15);
    this.gate2Bucket = bucket;
    const bucketBody = this.add.graphics();
    bucketBody.fillStyle(0x5a4d3a, 1);
    bucketBody.fillRect(-24, -30, 48, 54);
    bucketBody.fillStyle(0x7a6a4f, 1);
    bucketBody.fillRect(-24, -30, 48, 6);
    bucketBody.lineStyle(2, COLORS.coal, 0.8);
    bucketBody.strokeRect(-24, -30, 48, 54);
    bucketBody.fillStyle(COLORS.warning, 0.55);
    bucketBody.fillRect(-20, -4, 40, 3);
    bucket.add(bucketBody);
    const fill = this.add.graphics();
    bucket.add(fill);
    this.gate2BucketFill = fill;
    const bucketLabel = this.add.text(0, 6, this.gate2Passed ? '满桶' : '空桶', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    bucketLabel.setOrigin(0.5);
    bucket.add(bucketLabel);
    this.gate2BucketLabel = bucketLabel;

    const rope = this.add.graphics();
    rope.setDepth(14);
    this.gate2Rope = rope;

    const shelf = this.add.container(SHELF_X, 636);
    shelf.setDepth(15);
    const sg = this.add.graphics();
    sg.fillStyle(COLORS.coal, 0.32);
    sg.fillRect(-62, -8, 130, 12);
    sg.fillStyle(0x5a4d3a, 1);
    sg.fillRect(-52, -250, 12, 250);
    sg.fillRect(42, -250, 12, 250);
    sg.fillStyle(0x7a6a4f, 1);
    for (let i = 0; i < 3; i += 1) {
      const y = -62 - i * 74;
      sg.fillRect(-52, y, 106, 12);
      sg.fillStyle(COLORS.coal, 0.4);
      sg.fillRect(-48, y + 12, 98, 3);
      sg.fillStyle(0x7a6a4f, 1);
    }
    sg.fillStyle(COLORS.paper, 0.9);
    sg.fillRect(-40, -216, 34, 24);
    sg.fillRect(2, -216, 30, 24);
    sg.fillStyle(COLORS.rust, 0.8);
    sg.fillRect(-40, -216, 34, 4);
    sg.fillRect(2, -216, 30, 4);
    sg.lineStyle(2, COLORS.warning, 0.65);
    sg.strokeRect(-52, -250, 106, 250);
    sg.fillStyle(COLORS.warning, 0.7);
    sg.fillRect(-52, -138, 106, 4);
    shelf.add(sg);
    if (this.gate2Passed) {
      shelf.setY(396);
    }
    this.gate2Shelf = shelf;
    this.drawGate2Water(this.gate2Passed ? 1 : 0.12, this.gate2Passed ? 1 : 0);
    this.drawGate2Rope();

    if (!this.gate2Passed) {
      const barrier = this.add.rectangle(SHELF_X, 511, 118, 250, 0x000000, 0);
      this.physics.add.existing(barrier, true);
      this.gate2Barrier = barrier;
    }

    for (let i = 0; i < 3; i += 1) {
      const drop = this.add.image(2906 + i * 34, 320, TEX.spark);
      drop.setTint(COLORS.neon);
      drop.setDepth(5);
      drop.setScale(0.35, 0.7);
      drop.setAlpha(0.5);
      this.tweens.add({
        targets: drop,
        y: 542,
        alpha: 0,
        duration: 900,
        delay: i * 500,
        repeat: -1,
        onRepeat: () => {
          drop.setPosition(2906 + i * 34, 320);
          drop.setAlpha(0.5);
        },
      });
    }
  }

  private drawGate2Water(ratio: number, dropBottom: number): void {
    const fill = this.gate2BucketFill;
    if (!fill) {
      return;
    }
    const height = 36 * Phaser.Math.Clamp(ratio, 0, 1);
    fill.clear();
    fill.fillStyle(COLORS.neon, 0.5);
    fill.fillRect(-20, 20 - height + dropBottom, 40, height);
    fill.fillStyle(COLORS.neon, 0.7);
    fill.fillRect(-20, 20 - height + dropBottom, 40, 2);
  }

  private drawGate2Rope(): void {
    const rope = this.gate2Rope;
    const shelf = this.gate2Shelf;
    const bucket = this.gate2Bucket;
    if (!rope || !shelf || !bucket) {
      return;
    }
    const bucketTop = bucket.y - 26;
    rope.clear();
    rope.lineStyle(2, COLORS.coal, 0.6);
    rope.lineBetween(2952, bucketTop, 2992, 306);
    rope.lineBetween(2992, 306, SHELF_X - 46, shelf.y - 250);
    rope.lineStyle(1, COLORS.warning, 0.55);
    rope.lineBetween(2952, bucketTop - 2, 2992, 304);
    rope.lineBetween(2992, 304, SHELF_X - 46, shelf.y - 248);
  }

  /** 「画地为牢」：荒哥留下的圈已经拦不住横着走的螃蟹。 */
  private buildChalkGag(): void {
    const x = 2612;
    const g = this.add.graphics();
    g.setDepth(12);
    g.lineStyle(5, COLORS.paper, 0.78);
    g.strokeEllipse(x, GROUND_Y - 10, 150, 34);
    g.lineStyle(2, COLORS.paperDim, 0.62);
    g.strokeEllipse(x, GROUND_Y - 10, 124, 24);
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      g.fillStyle(COLORS.paper, 0.62);
      g.fillRect(x + Math.cos(angle) * 72 - 3, GROUND_Y - 11 + Math.sin(angle) * 16, 6, 3);
    }
    g.lineStyle(2, COLORS.paperDim, 0.5);
    for (let i = 0; i < 5; i += 1) {
      g.lineBetween(x + 54 + i * 12, GROUND_Y - 6, x + 62 + i * 12, GROUND_Y - 3);
    }
    addHotTag(this, x + 68, 518, STRINGS.act2.chalkSign, COLORS.paperDim, -0.04).setDepth(12);
    const note = this.add.text(x + 68, 548, STRINGS.act2.chalkNote, {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    note.setOrigin(0.5);
    note.setAlpha(0.7);
    note.setDepth(12);

    const crab = this.add.image(x - 16, GROUND_Y - 17, TEX.crab);
    crab.setDepth(14);
    crab.setScale(0.92);
    crab.setAlpha(0.95);
    this.tweens.add({
      targets: crab,
      x: x + 62,
      duration: 2600,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: crab,
          y: crab.y - 2,
          duration: 640,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  private buildCheckpoint(x = CHECKPOINT_X, labelText = '临时营地'): void {
    const root = this.add.container(x, 574);
    root.setDepth(13);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.22);
    g.fillEllipse(0, 54, 150, 18);
    g.lineStyle(3, COLORS.coal, 0.8);
    g.lineBetween(40, 50, 40, -74);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillTriangle(40, -74, 96, -58, 40, -42);
    g.fillStyle(COLORS.paper, 0.9);
    g.fillRect(-56, 22, 70, 30);
    g.lineStyle(2, COLORS.coal, 0.7);
    g.strokeRect(-56, 22, 70, 30);
    root.add(g);
    const label = this.add.text(-21, 37, labelText, {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    root.add(label);
  }

  private buildExitSet(): void {
    const root = this.add.container(EXIT_X, 500);
    root.setDepth(13);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.9);
    g.fillRect(-96, -138, 192, 274);
    g.fillStyle(0x4d554c, 1);
    g.fillRect(-82, -124, 164, 246);
    g.fillStyle(COLORS.coal, 0.92);
    g.fillRect(-58, -100, 116, 192);
    g.fillStyle(COLORS.warning, 0.75);
    g.fillRect(-58, 56, 116, 12);
    g.fillStyle(COLORS.paper, 0.9);
    g.fillRect(-46, -88, 92, 42);
    g.lineStyle(2, COLORS.rust, 0.8);
    g.strokeRect(-46, -88, 92, 42);
    root.add(g);
    const title = this.add.text(0, -70, '拍 摄 区', {
      fontFamily: FONTS.display,
      fontSize: '15px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const sub = this.add.text(0, -48, '荒哥正在机位', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.coal,
    });
    sub.setOrigin(0.5);
    root.add([title, sub]);

    const drone = this.add.image(EXIT_X + 120, 322, TEX.drone);
    drone.setDepth(40);
    drone.setScale(1.3);
    this.tweens.add({
      targets: drone,
      y: 308,
      angle: 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const tag = addHotTag(this, EXIT_X, 334, 'TAKE 02 // 镜头已就位', COLORS.neon, 0.03);
    tag.setDepth(16);
  }

  private showIntro(): void {
    const root = this.add.container(GAME_WIDTH / 2, 222);
    root.setScrollFactor(0);
    root.setDepth(450);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.9);
    g.fillRect(-340, -60, 680, 120);
    g.lineStyle(2, COLORS.warning, 0.7);
    g.strokeRect(-340, -60, 680, 120);
    g.fillStyle(COLORS.rust, 0.95);
    g.fillRect(-340, -60, 8, 120);
    const title = this.add.text(0, -20, STRINGS.act2.introTitle, {
      fontFamily: FONTS.display,
      fontSize: '27px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    const sub = this.add.text(0, 20, STRINGS.act2.introSub, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: CSS.paperDim,
    });
    sub.setOrigin(0.5);
    const tape = makeTape(this, 0, -60, 160, 18, COLORS.warning);
    tape.setRotation(-0.03);
    root.add([g, title, sub, tape]);
    this.tweens.add({
      targets: root,
      alpha: 0,
      y: 92,
      delay: 1900,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => root.destroy(true),
    });
  }

  private startTutorial(): void {
    if (this.finished || this.tutorialStarted || this.gate1Passed) {
      return;
    }
    this.tutorialStarted = true;
    const epoch = this.tutorialEpoch + 1;
    this.tutorialEpoch = epoch;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.hud.toast(STRINGS.act2.tutorialCrate, 'paper');

    const drone = this.tutorialDrone;
    if (drone) {
      this.tweens.add({
        targets: drone,
        x: 954,
        y: 350,
        duration: 700,
        ease: 'Sine.easeInOut',
      });
    }
    const frame = new Viewfinder(this, {
      x: 900,
      y: 602,
      width: 176,
      height: 108,
      color: COLORS.warning,
      label: STRINGS.act2.tutorialCrateLabel,
      depth: 70,
    });
    this.viewfinder = frame;
    audio.play('droneFocus');
    this.time.delayedCall(620, () => {
      if (epoch !== this.tutorialEpoch || this.finished) {
        return;
      }
      frame.close(1250, () => {
        if (epoch !== this.tutorialEpoch || this.finished) {
          return;
        }
        audio.play('shutter');
        this.time.delayedCall(160, () => {
          if (epoch !== this.tutorialEpoch || this.finished) {
            return;
          }
          this.dropNetAt(900, 602, false);
          if (this.tutorialCrate) {
            this.tweens.add({
              targets: this.tutorialCrate,
              angle: { from: 0, to: 3 },
              x: '+=6',
              duration: 90,
              yoyo: true,
              repeat: 2,
            });
          }
          this.hud.toast('补给网只罩住空箱。', 'neon');
        });
      });
    });

    this.time.delayedCall(2350, () => {
      if (epoch !== this.tutorialEpoch || this.finished) {
        return;
      }
      frame.destroy();
      this.viewfinder = null;
      this.player.setControlEnabled(true);
      this.touch?.setEnabled(true);
      this.hud.toast(STRINGS.act2.tutorialPlayer, 'paper');
      this.startPlayerTrackDemo(epoch);
    });
  }

  private startPlayerTrackDemo(epoch: number): void {
    const frame = new Viewfinder(this, {
      x: this.player.x,
      y: this.player.y + 18,
      width: 196,
      height: 132,
      color: COLORS.warning,
      label: STRINGS.act2.tutorialPlayerLabel,
      depth: 70,
    });
    this.viewfinder = frame;
    if (this.tutorialDrone) {
      this.tweens.add({
        targets: this.tutorialDrone,
        x: this.player.x + 74,
        y: this.player.y - 210,
        duration: 520,
        ease: 'Sine.easeInOut',
      });
    }
    const card = this.add.image(this.player.x + 12, this.player.y + 10, TEX.cardIcon);
    card.setDepth(72);
    card.setScale(0.9);
    card.setAlpha(0);
    card.setAngle(-0.08);
    this.tweens.add({
      targets: card,
      alpha: 1,
      y: card.y - 10,
      scale: 1.15,
      duration: 220,
      yoyo: true,
      hold: 460,
      onComplete: () => card.destroy(),
    });
    voice.speak({
      clip: 'droneCheck',
      speaker: STRINGS.act2.droneName,
      text: STRINGS.act2.droneCheck,
      ownerId: 'drone-tutorial',
      x: this.player.x + 20,
      y: this.player.y - 100,
      color: COLORS.warning,
      priority: 2,
      dedupeKey: 'drone-check:act2',
    });
    audio.play('droneFocus');
    this.time.delayedCall(620, () => {
      if (epoch !== this.tutorialEpoch || this.finished) {
        return;
      }
      frame.close(1700, () => {
        if (epoch !== this.tutorialEpoch || this.finished) {
          return;
        }
        audio.play('shutter');
        const caught = frame.contains(this.player.x, this.player.y);
        if (caught) {
          this.hud.toast(STRINGS.act2.tutorialHit, 'rust');
          this.dropNetAt(this.player.x, this.player.y + 18, true);
          this.player.setControlEnabled(false);
          this.touch?.setEnabled(false);
          this.time.delayedCall(850, () => {
            if (this.finished) {
              return;
            }
            this.player.setControlEnabled(!this.quizOpen && !this.rewardOpen && !this.gateAnimating);
            this.touch?.setEnabled(!this.quizOpen && !this.rewardOpen && !this.gateAnimating);
          });
        } else {
          this.hud.toast(STRINGS.act2.tutorialDodge, 'neon');
          addFloatingLine(this, this.player.x, this.player.y - 78, '躲开了', COLORS.neon, 20);
        }
        this.time.delayedCall(700, () => {
          if (epoch !== this.tutorialEpoch) {
            return;
          }
          frame.destroy();
          if (this.viewfinder === frame) {
            this.viewfinder = null;
          }
        });
      });
    });
  }

  private dropNetAt(x: number, y: number, onPlayer: boolean): void {
    const net = this.add.container(x, y - 190);
    net.setDepth(76);
    const g = this.add.graphics();
    g.lineStyle(2, COLORS.paper, 0.9);
    const w = onPlayer ? 150 : 172;
    const h = onPlayer ? 110 : 118;
    g.strokeRect(-w / 2, -h / 2, w, h);
    for (let gx = -w / 2 + 16; gx < w / 2; gx += 22) {
      g.lineBetween(gx, -h / 2, gx, h / 2);
    }
    for (let gy = -h / 2 + 16; gy < h / 2; gy += 22) {
      g.lineBetween(-w / 2, gy, w / 2, gy);
    }
    g.fillStyle(COLORS.warning, 0.9);
    g.fillCircle(-w / 2, -h / 2, 4);
    g.fillCircle(w / 2, -h / 2, 4);
    g.fillCircle(-w / 2, h / 2, 4);
    g.fillCircle(w / 2, h / 2, 4);
    net.add(g);
    audio.play('netDrop');
    this.tweens.add({
      targets: net,
      y,
      alpha: { from: 1, to: 1 },
      duration: 220,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(90, 0.004);
        pixelBurst(this, x, y, COLORS.warning, 6, 0.7);
        this.tweens.add({
          targets: net,
          alpha: 0,
          delay: 720,
          duration: 260,
          onComplete: () => net.destroy(true),
        });
      },
    });
  }

  private initGroups(): void {
    this.crabGroup = this.physics.add.group();
    this.bullets = this.physics.add.group({ allowGravity: false });
  }

  private spawnCrabs(): void {
    const host = this.makeCrabHost();
    const placements: Array<[number, number]> = [
      [3200, 598],
    ];
    placements.forEach(([x, y]) => {
      const crab = new SupplyCrab(this, x, y, host);
      this.crabGroup.add(crab);
      this.crabs.push(crab);
    });
  }

  private setupReturnTrap(): void {
    this.returnTrap = new ReturnParcelTrap(this, {
      spawnX: RETURN_TRAP_SPAWN_X,
      chuteX: RETURN_TRAP_CHUTE_X,
      pathY: RETURN_TRAP_PATH_Y,
      groundY: GROUND_Y,
      triggerX: RETURN_TRAP_TRIGGER_X,
      demoTriggerX: RETURN_TRAP_DEMO_X,
      player: () => this.player,
      canTrigger: () =>
        this.gate1Passed &&
        !this.finished &&
        !this.transitioning &&
        !this.quizOpen &&
        !this.rewardOpen &&
        !this.gateAnimating &&
        !this.missileTutorialActive,
      onPlayerHit: () => {
        const actual = this.player.takeDamage(TRAP.returnParcelDamage, RETURN_TRAP_CHUTE_X);
        if (actual > 0) {
          this.cameras.main.shake(140, COMBAT.cameraShakeLight);
        }
        return actual;
      },
      onToast: (text, tone) => this.hud.toast(text, tone),
      onDemoStart: () => {
        this.player.setControlEnabled(false);
        this.touch?.setEnabled(false);
        this.hud.setHint(null);
      },
      onDemoEnd: () => {
        if (this.finished) {
          return;
        }
        this.player.setControlEnabled(!this.quizOpen && !this.rewardOpen && !this.gateAnimating);
        this.touch?.setEnabled(!this.quizOpen && !this.rewardOpen && !this.gateAnimating);
      },
    });
  }

  private makeCrabHost(): SupplyCrabHost {
    return {
      getPlayer: () => this.player,
      onDefeated: (crab) => {
        this.run.stats.enemiesDefeated += 1;
        this.meme.addSmall(MEME.enemyKill);
        const index = this.crabs.indexOf(crab);
        if (index >= 0) {
          this.crabs.splice(index, 1);
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
    if (this.bridgeBarrier) {
      this.bridgeCollider = this.physics.add.collider(this.player, this.bridgeBarrier);
    }
    if (this.gate2Barrier) {
      this.gate2Collider = this.physics.add.collider(this.player, this.gate2Barrier);
    }
    this.physics.add.collider(this.crabGroup, this.solids);
    this.physics.add.collider(this.bullets, this.solids, (a, b) => {
      this.projectileFrom(this.bullets, a, b)?.destroy();
    });
    this.physics.add.overlap(this.player, this.crabGroup, (_, crabObj) => {
      const crab = crabObj as unknown as SupplyCrab;
      if (!crab.active || !crab.isAlive() || this.finished) {
        return;
      }
      const actual = this.player.takeDamage(crab.getContactDamage(), crab.x);
      if (actual > 0) {
        pixelBurst(this, this.player.x, this.player.y, COLORS.rust, 5);
      }
    });
    this.physics.add.overlap(this.bullets, this.crabGroup, (bulletObj, crabObj) => {
      const bullet = bulletObj as unknown as Phaser.Physics.Arcade.Image;
      const crab = crabObj as unknown as SupplyCrab;
      if (!bullet.active || !crab.active || !crab.isAlive()) {
        return;
      }
      const damage = Number(bullet.getData('damage') ?? PLAYER.bulletDamage);
      crab.takeHit(damage, bullet.x);
      bullet.destroy();
    });
  }

  private setupHud(): void {
    this.cards = new CardSystem(this, this.makeCardHost(), this.run);
    this.hud = new Hud(this, {
      bossMode: false,
      onUseCard: (index) => {
        if (this.quizOpen || this.rewardOpen || this.finished || this.transitioning || this.gateAnimating) {
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

  private updateInteractions(): void {
    this.nearGate1 = !this.gate1Passed && Math.abs(this.player.x - GATE1_X) < 150;
    this.nearGate2 =
      this.gate1Passed && !this.gate2Passed && Math.abs(this.player.x - GATE2_X) < 170;
    this.nearExit = Math.abs(this.player.x - EXIT_X) < 180;

    if (this.quizOpen || this.rewardOpen || this.gateAnimating) {
      this.hud.setHint(null);
      return;
    }
    if (this.nearGate1) {
      const prompt = this.gate1DemoDone ? STRINGS.act2.gate1Retry : STRINGS.act2.gate1Prompt;
      this.hud.setHint(this.touch ? prompt.replace('按 E', '点「交互」') : prompt);
    } else if (this.nearGate2) {
      const prompt = this.gate2DemoDone ? STRINGS.act2.gate2Retry : STRINGS.act2.gate2Prompt;
      this.hud.setHint(this.touch ? prompt.replace('按 E', '点「交互」') : prompt);
    } else if (this.nearExit) {
      let prompt: string;
      if (!this.gate1Passed) {
        prompt = STRINGS.act2.gate1Locked;
      } else if (!this.gate2Passed) {
        prompt = STRINGS.act2.bossLocked;
      } else {
        prompt = STRINGS.act2.exitPrompt;
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
    if (this.nearGate1) {
      this.startGate1Sequence();
      return;
    }
    if (this.nearGate2) {
      this.startGate2Sequence();
      return;
    }
    if (this.nearExit) {
      if (!this.gate1Passed) {
        this.hud.toast(STRINGS.act2.gate1Locked, 'rust');
        return;
      }
      if (!this.gate2Passed) {
        this.hud.toast(STRINGS.act2.bossLocked, 'rust');
        return;
      }
      this.enterBoss();
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

  private fireAllyShot(x: number, y: number): void {
    const target = this.crabs.find((crab) => crab.active && crab.isAlive());
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
    if (this.crabs.length === 0) {
      this.hud.toast('附近没有补给目标。', 'paper');
      return false;
    }
    this.ally = new Ally(
      this,
      this.player,
      durationMs,
      () => this.crabs.some((crab) => crab.active && crab.isAlive()),
      (x, y) => this.fireAllyShot(x, y),
    );
    return true;
  }

  private doScreenClear(): number {
    let hit = 0;
    this.crabs.forEach((crab) => {
      if (crab.active && crab.isAlive()) {
        crab.takeHit(30, this.player.x);
        hit += 1;
      }
    });
    this.cameras.main.flash(160, 232, 178, 58, false);
    return hit;
  }

  private cleanupProjectiles(time: number): void {
    this.bullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) {
        return;
      }
      const expire = Number(bullet.getData('expireAt') ?? 0);
      if (time > expire || bullet.x < -80 || bullet.x > ISLAND_WIDTH + 80 || bullet.y < -80 || bullet.y > GAME_HEIGHT + 120) {
        bullet.destroy();
      }
    });
  }

  private spawnDashDust(x: number, y: number): void {
    const image = this.add.image(x, y, TEX.dust);
    image.setDepth(19);
    image.setTint(COLORS.neon);
    image.setAlpha(0.5);
    image.setScale(1.4);
    this.tweens.add({ targets: image, alpha: 0, scale: 0.4, duration: 220, onComplete: () => image.destroy() });
  }

  private beginGateLock(): void {
    this.returnTrap?.reset();
    this.gateAnimating = true;
    this.quizOpen = true;
    this.player.setControlEnabled(false);
    this.player.setVelocity(0, 0);
    this.touch?.setEnabled(false);
    this.hud.setHint(null);
    this.crabs.forEach((crab) => crab.setVelocityX(0));
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
    this.gate1DemoDone = true;
    this.beginGateLock();
    this.hud.toast(STRINGS.act2.gate1Demo, 'paper');
    audio.play('ropeTension');

    const demo = this.add.container(0, 0);
    demo.setDepth(42);
    const host = this.add.image(1588, 590, TEX.wastelandBoss);
    host.setScale(0.52);
    host.setAlpha(0.94);
    const sign = this.add.container(1700, 552);
    const sg = this.add.graphics();
    sg.fillStyle(COLORS.paper, 0.94);
    sg.fillRect(-66, -34, 132, 68);
    sg.lineStyle(2, COLORS.coal, 0.8);
    sg.strokeRect(-66, -34, 132, 68);
    sg.fillStyle(COLORS.rust, 0.85);
    sg.fillRect(-66, -34, 132, 6);
    sign.add(sg);
    const signText = this.add.text(0, 4, '唯一退路', {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    signText.setOrigin(0.5);
    sign.add(signText);
    sign.setAngle(-0.08);
    const drone = this.add.image(1836, 338, TEX.drone);
    drone.setScale(1.6);
    const rope = this.add.graphics();
    rope.lineStyle(2, COLORS.warning, 0.8);
    rope.beginPath();
    rope.moveTo(1836, 346);
    rope.lineTo(1760, 488);
    rope.strokePath();
    rope.lineStyle(2, COLORS.paperDark, 0.8);
    rope.beginPath();
    rope.moveTo(1546, 490);
    rope.lineTo(1690, 434);
    rope.lineTo(1836, 346);
    rope.strokePath();
    const selfie = this.add.graphics();
    selfie.lineStyle(4, COLORS.coal, 0.9);
    selfie.lineBetween(1616, 552, 1662, 446);
    selfie.lineStyle(1, COLORS.paperDim, 0.6);
    selfie.lineBetween(1613, 552, 1659, 446);
    selfie.fillStyle(COLORS.coal, 1);
    selfie.fillRect(1651, 430, 28, 44);
    selfie.fillStyle(COLORS.neon, 0.7);
    selfie.fillRect(1655, 436, 20, 30);
    selfie.fillStyle(COLORS.paper, 0.8);
    selfie.fillRect(1658, 438, 14, 3);
    selfie.fillRect(1658, 444, 9, 2);
    selfie.fillRect(1658, 449, 12, 2);

    const signal = addHotTag(this, 1628, 360, '信号 · 满格', COLORS.neon, 0.02);
    signal.setScale(0.72);
    const linking = addHotTag(this, 1836, 248, STRINGS.act2.gate1Linking, COLORS.warning, -0.02);
    linking.setScale(0.78);
    linking.setAlpha(0);

    const hook = this.add.container(1712, 486);
    const hg = this.add.graphics();
    hg.lineStyle(3, COLORS.paperDim, 0.95);
    hg.lineBetween(0, -24, 0, 10);
    hg.lineStyle(7, COLORS.coal, 1);
    hg.lineBetween(0, 4, 0, 22);
    hg.lineStyle(3, COLORS.warning, 0.95);
    hg.lineBetween(-4, 18, -22, 2);
    hg.lineBetween(4, 18, 22, 2);
    hg.lineStyle(2, COLORS.paper, 0.75);
    hg.lineBetween(-2, 20, -19, 5);
    hg.lineBetween(2, 20, 19, 5);
    hook.add(hg);
    hook.setAngle(0.28);
    hook.setScale(0.92);

    const taut = this.add.graphics();
    taut.lineStyle(4, COLORS.rust, 0.9);
    taut.lineBetween(1836, 346, 1712, 462);
    taut.setAlpha(0);
    demo.add([host, sign, drone, rope, selfie, signal, linking, hook, taut]);

    audio.play('droneFocus');
    this.time.delayedCall(260, () => {
      if (this.finished) {
        return;
      }
      linking.setAlpha(0.95);
      audio.play('droneFocus');
    });
    this.time.delayedCall(700, () => {
      if (this.finished) {
        return;
      }
      this.tweens.add({ targets: hook, angle: -0.08, y: 480, duration: 260, ease: 'Sine.easeOut' });
      audio.play('gearToss');
      addFloatingLine(this, 1712, 420, '挂钩张开', COLORS.warning, 15, 900);
    });
    this.time.delayedCall(1150, () => {
      if (this.finished) {
        return;
      }
      audio.play('canClink');
      hook.setAngle(0);
      this.tweens.add({ targets: sign, angle: 0.06, duration: 90, yoyo: true, repeat: 2 });
      addFloatingLine(this, 1712, 430, '咔哒。', COLORS.paper, 18, 850);
    });
    this.time.delayedCall(1380, () => {
      if (this.finished) {
        return;
      }
      audio.play('ropeTension');
      this.cameras.main.shake(180, 0.008);
      this.tweens.add({ targets: taut, alpha: 1, duration: 90, yoyo: true, hold: 220 });
      this.hud.toast(STRINGS.act2.gate1Hook, 'paper');
    });
    this.time.delayedCall(1550, () => {
      if (this.finished) {
        return;
      }
      audio.play('signScrape');
      this.tweens.add({
        targets: [host, sign, selfie],
        x: '+=246',
        y: '+=10',
        angle: '+=0.16',
        duration: 1500,
        ease: 'Sine.easeIn',
      });
      this.tweens.add({
        targets: [drone, hook, linking],
        x: '+=286',
        y: '+=10',
        angle: 8,
        duration: 1500,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: host,
        angle: '+=18',
        duration: 1500,
        ease: 'Sine.easeIn',
      });
      this.hud.toast(STRINGS.act2.gate1Drag, 'rust');
    });

    const chars = ['亡', '命', '天', '涯'];
    chars.forEach((char, index) => {
      const text = this.add.text(1612 + index * 88, 608, char, {
        fontFamily: FONTS.display,
        fontSize: '30px',
        color: CSS.rust,
        fontStyle: 'bold',
      });
      text.setOrigin(0.5);
      text.setDepth(41);
      text.setAlpha(0);
      demo.add(text);
      this.time.delayedCall(1650 + index * 230, () => {
        if (this.finished) {
          return;
        }
        text.setAlpha(0.82);
        text.setAngle(Phaser.Math.FloatBetween(-0.18, 0.12));
        audio.play('signScrape');
        pixelBurst(this, text.x, text.y + 12, COLORS.rust, 4, 0.6);
      });
    });

    this.time.delayedCall(2750, () => {
      if (this.finished) {
        return;
      }
      this.hud.toast(STRINGS.act2.gate1Chase, 'neon');
      this.tweens.add({ targets: host, y: '+=6', duration: 120, yoyo: true, repeat: 1 });
    });
    this.time.delayedCall(3350, () => {
      if (this.finished) {
        return;
      }
      demo.destroy(true);
      audio.play('bell');
      this.openGate1Quiz();
    });
  }

  private openGate1Quiz(): void {
    this.quizOpen = true;
    const prepared = this.quizSystem.prepareDoor('door_wangming_act2');
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
          this.finishGate1();
          return;
        }
        this.releaseGateControls();
        this.hud.toast(failReason === 'timeout' ? STRINGS.door.timeout : STRINGS.door.wrong, 'rust');
      },
    });
  }

  private finishGate1(): void {
    this.gate1Passed = true;
    this.run.act2Door1Passed = true;
    this.run.act2BridgeCheckpoint = false;
    this.missileUsed = true;
    this.missileWarning = false;
    if (this.activeMissile) {
      this.activeMissile.destroy();
      this.activeMissile = null;
    }
    this.missileLauncher?.setAlpha(0.5);
    this.missileGuide?.setAlpha(0.1);
    this.missileLight?.setFillStyle(COLORS.coalFaint, 0.8);
    this.spawnPoint = { x: CHECKPOINT_X, y: 560 };
    this.player.heal(Math.round(PLAYER.maxHp * 0.3));
    this.run.hp = this.player.getHp();
    this.gate1Light?.setFillStyle(COLORS.neon, 1);

    const rope = this.add.graphics();
    rope.setDepth(43);
    rope.lineStyle(2, COLORS.warning, 0.85);
    rope.beginPath();
    rope.moveTo(this.player.x, this.player.y - 20);
    rope.lineTo(BRIDGE_X - 100, GROUND_Y - 150);
    rope.strokePath();
    audio.play('ropeTension');
    this.cameras.main.shake(180, 0.007);

    if (this.bridgeCollider) {
      this.bridgeCollider.destroy();
      this.bridgeCollider = null;
    }
    if (this.bridgeBarrier) {
      this.bridgeBarrier.destroy();
      this.bridgeBarrier = null;
    }
    if (this.bridgeVisual) {
      this.tweens.add({
        targets: this.bridgeVisual,
        alpha: 1,
        angle: 0,
        y: GROUND_Y,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          audio.play('stampThud');
          this.cameras.main.flash(160, 75, 227, 200, false);
          pixelBurst(this, BRIDGE_X, GROUND_Y - 20, COLORS.neon, 14, 1.4);
          rope.destroy();
        },
      });
    }
    const bridgeStamp = stamp(this, BRIDGE_X, GROUND_Y - 60, STRINGS.act2.gate1Bridge, {
      color: COLORS.neon,
      fontSize: 24,
      angle: -0.08,
      alpha: 0.86,
    });
    bridgeStamp.setDepth(44);
    this.tweens.add({ targets: bridgeStamp, alpha: 0, delay: 1100, duration: 380, onComplete: () => bridgeStamp.destroy(true) });
    this.hud.toast(STRINGS.act2.gate1Open, 'neon');
    this.gateAnimating = true;
    this.time.delayedCall(1150, () => this.showCardReward());
  }

  private startGate2Sequence(): void {
    if (this.quizOpen || this.rewardOpen || this.gate2Passed || this.finished || this.gateAnimating) {
      return;
    }
    this.gate2DemoDone = true;
    this.beginGateLock();
    this.gate2Epoch += 1;
    const epoch = this.gate2Epoch;
    if (this.gate2Shelf) {
      this.tweens.killTweensOf(this.gate2Shelf);
      this.gate2Shelf.setY(636);
    }
    if (this.gate2Bucket) {
      this.tweens.killTweensOf(this.gate2Bucket);
      this.gate2Bucket.setY(560);
    }
    this.drawGate2Rope();
    this.hud.toast(STRINGS.act2.gate2Demo, 'paper');
    audio.play('waterDrip');

    for (let i = 0; i < 10; i += 1) {
      const drop = this.add.image(2906 + (i % 5) * 28, 300, TEX.spark);
      drop.setTint(COLORS.neon);
      drop.setDepth(44);
      drop.setScale(0.32, 0.7);
      this.tweens.add({
        targets: drop,
        y: 548,
        alpha: 0.2,
        duration: 620,
        delay: i * 130,
        ease: 'Quad.easeIn',
        onComplete: () => {
          drop.destroy();
          if (i % 2 === 0 && epoch === this.gate2Epoch) {
            audio.play('waterDrip');
          }
        },
      });
    }

    if (this.gate2BucketFill) {
      this.tweens.addCounter({
        from: 0.12,
        to: 0.78,
        duration: 1900,
        delay: 260,
        onUpdate: (tween) => {
          if (epoch !== this.gate2Epoch) {
            return;
          }
          const value = tween.getValue() ?? 0.12;
          this.drawGate2Water(value, 0);
        },
      });
    }
    this.time.delayedCall(900, () => {
      if (epoch !== this.gate2Epoch || this.finished) {
        return;
      }
      audio.play('ropeTension');
      if (this.gate2Bucket) {
        this.tweens.add({
          targets: this.gate2Bucket,
          y: 574,
          duration: 500,
          ease: 'Sine.easeInOut',
          onUpdate: () => this.drawGate2Rope(),
        });
      }
    });
    this.time.delayedCall(1160, () => {
      if (epoch !== this.gate2Epoch || this.finished) {
        return;
      }
      if (this.gate2Shelf) {
        this.tweens.add({
          targets: this.gate2Shelf,
          y: 500,
          duration: 760,
          ease: 'Sine.easeInOut',
          yoyo: true,
          hold: 320,
          onUpdate: () => this.drawGate2Rope(),
        });
      }
    });
    this.time.delayedCall(1500, () => {
      if (epoch !== this.gate2Epoch || this.finished) {
        return;
      }
      audio.play('waterDrip');
      this.cameras.main.shake(90, 0.004);
    });
    this.time.delayedCall(2050, () => {
      if (epoch !== this.gate2Epoch || this.finished) {
        return;
      }
      addFloatingLine(this, 2954, 352, STRINGS.act2.gate2Haoshi, COLORS.paper, 15, 1700);
    });
    this.time.delayedCall(2300, () => {
      if (epoch !== this.gate2Epoch || this.finished) {
        return;
      }
      audio.play('stampThud');
      const tag = addHotTag(this, 2954, 412, '水桶变重 → 滑轮 → 货架', COLORS.neon, -0.02);
      tag.setDepth(46);
      this.tweens.add({
        targets: tag,
        alpha: 0,
        delay: 480,
        duration: 260,
        onComplete: () => tag.destroy(),
      });
    });
    this.time.delayedCall(3200, () => {
      if (epoch !== this.gate2Epoch || this.finished) {
        return;
      }
      this.openGate2Quiz();
    });
  }

  private openGate2Quiz(): void {
    this.quizOpen = true;
    const prepared = this.quizSystem.prepareDoor('door_haoshi_act2');
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
          this.finishGate2();
          return;
        }
        this.releaseGateControls();
        if (this.gate2Shelf) {
          this.tweens.killTweensOf(this.gate2Shelf);
          this.gate2Shelf.setY(636);
        }
        if (this.gate2Bucket) {
          this.tweens.killTweensOf(this.gate2Bucket);
          this.gate2Bucket.setY(560);
        }
        this.drawGate2Water(0.12, 0);
        this.gate2BucketLabel?.setText('空桶');
        this.drawGate2Rope();
        this.hud.toast(failReason === 'timeout' ? STRINGS.door.timeout : STRINGS.door.wrong, 'rust');
      },
    });
  }

  private finishGate2(): void {
    this.gate2Passed = true;
    this.run.act2Door2Passed = true;
    this.spawnPoint = { x: CHECKPOINT2_X, y: 560 };
    this.player.heal(Math.round(PLAYER.maxHp * 0.3));
    this.run.hp = this.player.getHp();
    this.gate2Light?.setFillStyle(COLORS.neon, 1);

    if (this.gate2Collider) {
      this.gate2Collider.destroy();
      this.gate2Collider = null;
    }
    if (this.gate2Barrier) {
      this.gate2Barrier.destroy();
      this.gate2Barrier = null;
    }
    audio.play('ropeTension');
    this.cameras.main.shake(180, 0.007);
    this.gate2BucketLabel?.setText('满桶');
    if (this.gate2Shelf) {
      this.tweens.killTweensOf(this.gate2Shelf);
    }
    if (this.gate2Bucket) {
      this.tweens.killTweensOf(this.gate2Bucket);
      this.tweens.add({
        targets: this.gate2Bucket,
        y: 574,
        duration: 500,
        ease: 'Sine.easeInOut',
        onUpdate: () => this.drawGate2Rope(),
      });
    }
    if (this.gate2BucketFill) {
      this.tweens.addCounter({
        from: 0.78,
        to: 1,
        duration: 700,
        onUpdate: (tween) => this.drawGate2Water(tween.getValue() ?? 1, 0),
      });
    }
    if (this.gate2Shelf) {
      this.tweens.add({
        targets: this.gate2Shelf,
        y: 396,
        duration: 900,
        ease: 'Cubic.easeOut',
        onUpdate: () => this.drawGate2Rope(),
        onComplete: () => {
          audio.play('stampThud');
          this.cameras.main.flash(160, 75, 227, 200, false);
          pixelBurst(this, SHELF_X, 380, COLORS.neon, 14, 1.4);
        },
      });
    }
    const mark = stamp(this, SHELF_X, 300, '货架升空', {
      color: COLORS.neon,
      fontSize: 24,
      angle: -0.08,
      alpha: 0.86,
    });
    mark.setDepth(46);
    this.tweens.add({ targets: mark, alpha: 0, delay: 1100, duration: 380, onComplete: () => mark.destroy(true) });
    this.hud.toast(STRINGS.act2.gate2Open, 'neon');
    this.gateAnimating = true;
    this.time.delayedCall(1200, () => this.showCardReward());
  }

  private showCardReward(): void {
    if (this.rewardOpen) {
      return;
    }
    this.rewardOpen = true;
    this.hud.setHint(null);
    new CardPickOverlay(this, {
      cards: this.cards,
      slotsUsed: this.run.cards.length,
      onClose: () => {
        this.rewardOpen = false;
        this.gateAnimating = false;
        this.releaseGateControls();
      },
    });
  }

  private enterBoss(): void {
    if (this.transitioning || this.finished) {
      return;
    }
    if (!this.gate1Passed) {
      this.hud.toast(STRINGS.act2.gate1Locked, 'rust');
      return;
    }
    if (!this.gate2Passed) {
      this.hud.toast(STRINGS.act2.bossLocked, 'rust');
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
    this.time.delayedCall(440, () => this.scene.start('WastelandBoss'));
  }

  private handleFall(): void {
    if (this.respawning || this.finished) {
      return;
    }
    this.respawning = true;
    this.pendingReason = STRINGS.act2.fall;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.returnTrap?.reset();
    this.resetMissileChallenge();
    this.hud.toast(STRINGS.act2.fall, 'rust');
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
      this.player.setControlEnabled(!this.quizOpen && !this.rewardOpen && !this.gateAnimating);
      this.touch?.setEnabled(!this.quizOpen && !this.rewardOpen && !this.gateAnimating);
      this.respawning = false;
      this.pendingReason = STRINGS.act2.deathReason;
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
      act: 2,
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
    this.viewfinder?.destroy();
    this.viewfinder = null;
    this.tutorialEpoch += 1;
    this.quizOverlay = null;
    this.returnTrap?.destroy();
    this.returnTrap = null;
    voice.stopAll();
    if (this.voicePresenter) {
      voice.setPresenter(null);
      this.voicePresenter = null;
    }
  }
}
