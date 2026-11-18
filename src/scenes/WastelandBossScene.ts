import Phaser from 'phaser';
import {
  BOSS,
  CARD,
  GAME_HEIGHT,
  GAME_WIDTH,
  MEME,
  PLAYER,
} from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { BOSS_HUANG, STRINGS } from '../data';
import type { BossAttackId, BossPhase, ResultPayload, RunState } from '../types/game';
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
import { Boss } from '../entities/Boss';
import { Ally } from '../entities/Ally';
import { Hud } from '../ui/Hud';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { Viewfinder } from '../ui/Viewfinder';
import { CardSystem, type CardHost } from '../systems/CardSystem';
import { MemeMeter } from '../systems/MemeMeter';
import { elapsedMs, getRunState } from '../systems/RunState';
import { audio } from '../systems/AudioSystem';

const BOSS_HOVER_X = 930;
const BOSS_HOVER_Y = 500;
const ARENA_FLOOR_Y = 636;

export class WastelandBossScene extends Phaser.Scene {
  private run!: RunState;
  private player!: Player;
  private boss!: Boss;
  private hud!: Hud;
  private touch: TouchControls | null = null;
  private meme!: MemeMeter;
  private cards!: CardSystem;
  private ally: Ally | null = null;
  private bullets!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private floor!: Phaser.GameObjects.Rectangle;
  private fightStarted = false;
  private finished = false;
  private transitioning = false;
  private attackBusy = false;
  private attackEpoch = 0;
  private nextAttackAt = 0;
  private lastAttack: BossAttackId | null = null;
  private firstViewfinder = true;
  private pendingReason = STRINGS.act2.deathReason;
  private cardsChangedHandler: (() => void) | null = null;
  private activeViewfinder: Viewfinder | null = null;
  private activeDrone: Phaser.GameObjects.Image | null = null;
  private activeNet: Phaser.GameObjects.Container | null = null;
  private introActive = false;
  private introEpoch = 0;
  private introWorld: Phaser.GameObjects.Container | null = null;
  private introUi: Phaser.GameObjects.Container | null = null;
  private introSkipHandler: (() => void) | null = null;

  constructor() {
    super('WastelandBoss');
  }

  create(): void {
    this.fightStarted = false;
    this.finished = false;
    this.transitioning = false;
    this.attackBusy = false;
    this.attackEpoch = 0;
    this.nextAttackAt = 0;
    this.lastAttack = null;
    this.firstViewfinder = true;
    this.pendingReason = STRINGS.act2.deathReason;
    this.ally = null;
    this.cardsChangedHandler = null;
    this.activeViewfinder = null;
    this.activeDrone = null;
    this.activeNet = null;
    this.introActive = false;
    this.introEpoch = 0;
    this.introWorld = null;
    this.introUi = null;
    this.introSkipHandler = null;

    this.run = getRunState(this);
    this.run.act = 2;
    if (this.run.hp <= 0) {
      this.run.hp = Math.max(1, Math.round(PLAYER.maxHp * 0.6));
    }

    this.physics.world.setBounds(0, 0, GAME_WIDTH, 1000);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.fadeIn(280, 23, 19, 16);
    audio.setMusic('boss');

    this.buildArena();
    this.player = new Player(this, 220, 560, this.run.hp, this.makePlayerCallbacks());
    this.meme = new MemeMeter(this.run);
    this.boss = new Boss(this, BOSS_HOVER_X, BOSS_HOVER_Y, this.makeBossHost(), {
      config: BOSS_HUANG,
      texture: TEX.wastelandBoss,
      glitchTexture: TEX.wastelandBossGlitch,
      glitchTint: COLORS.warning,
      bodyWidth: 96,
      bodyHeight: 172,
      bodyOffsetX: 42,
      bodyOffsetY: 36,
    });
    const introSeen = this.registry.get('act2IntroSeen') === true;
    this.boss.setInvulnerable(introSeen ? 600 : BOSS.introMs + 800);
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.bossProjectiles = this.physics.add.group({ allowGravity: false });
    this.setupCollisions();
    this.setupHud();
    this.setupTouch();
    this.setupAmbient();

    if (introSeen) {
      this.boss.setPresentationVisible(true);
      this.setupCamera();
      this.startFight();
    } else {
      this.playIntro();
    }
    addScanlines(this, 90);
    this.events.once('shutdown', () => this.cleanupScene());
  }

  override update(time: number, delta: number): void {
    if (!this.player) {
      return;
    }
    if (!this.finished) {
      this.player.tick(time, delta);
      this.boss.tick(time);
      this.tickAlly(time);
      this.cleanupProjectiles(time);
      this.hud.updatePlayer(this.player.getHp(), this.player.getMaxHp());
      this.hud.updateMeme(this.meme.getValue(), this.meme.isBurstActive(), this.meme.getStreak());
      this.hud.updateBoss(
        this.boss.config.name,
        this.boss.config.title,
        this.boss.getHp(),
        this.boss.getMaxHp(),
        this.boss.getPhaseNumber(),
        this.boss.getMaxPhases(),
      );
      this.cards.update(delta);
      this.hud.updateActiveEffects(this.cards.getActiveEffects());
      this.meme.update(delta);
      this.run.hp = this.player.getHp();
      this.meme.sync(this.run);
      this.run.cards = [...this.run.cards];

      if (
        this.fightStarted &&
        !this.boss.isDead() &&
        !this.boss.isStaggered(time) &&
        !this.attackBusy &&
        time >= this.nextAttackAt
      ) {
        this.performAttack(time);
      }
    }
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
        this.cameras.main.shake(120, 0.007);
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

  private buildArena(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.islandSky).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const overlay = this.add.graphics();
    overlay.fillStyle(COLORS.coal, 0.3);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.fillStyle(COLORS.warning, 0.06);
    overlay.fillTriangle(760, 110, 1280, 0, 1280, 470);
    overlay.fillStyle(COLORS.rust, 0.2);
    overlay.fillRect(0, 558, GAME_WIDTH, 82);
    overlay.fillStyle(COLORS.paperDark, 0.55);
    overlay.fillRect(0, 558, GAME_WIDTH, 3);
    overlay.lineStyle(2, COLORS.paper, 0.1);
    for (let x = 0; x < GAME_WIDTH; x += 84) {
      overlay.lineBetween(x, 596, x + 38, 636);
    }

    const ground = this.add.graphics();
    ground.setDepth(9);
    ground.fillStyle(0x2b322a, 1);
    ground.fillRect(0, ARENA_FLOOR_Y, GAME_WIDTH, 84);
    ground.fillStyle(0x59614b, 1);
    ground.fillRect(0, ARENA_FLOOR_Y, GAME_WIDTH, 17);
    ground.fillStyle(0x7c8562, 0.85);
    ground.fillRect(0, ARENA_FLOOR_Y, GAME_WIDTH, 5);
    ground.fillStyle(COLORS.coal, 0.6);
    for (let x = 30; x < GAME_WIDTH; x += 118) {
      ground.fillRect(x, ARENA_FLOOR_Y + 24, 52 + (x % 4) * 12, 3);
      ground.fillRect(x + 18, ARENA_FLOOR_Y + 38, 30, 2);
    }
    ground.fillStyle(0x3d463b, 0.9);
    for (let x = 16; x < GAME_WIDTH; x += 96) {
      ground.fillTriangle(x, ARENA_FLOOR_Y + 84, x + 22, ARENA_FLOOR_Y + 62, x + 44, ARENA_FLOOR_Y + 84);
    }
    ground.fillStyle(COLORS.warning, 0.4);
    ground.fillRect(606, ARENA_FLOOR_Y + 7, 160, 3);

    this.floor = this.add.rectangle(GAME_WIDTH / 2, 678, GAME_WIDTH, 84, 0x000000, 0);
    this.physics.add.existing(this.floor, true);

    const props = this.add.graphics();
    props.setDepth(4);
    props.fillStyle(COLORS.coal, 0.86);
    props.fillRect(1108, 470, 12, 168);
    props.fillRect(1172, 470, 12, 168);
    props.fillRect(1040, 470, 220, 14);
    props.fillStyle(COLORS.coal, 0.7);
    props.fillRect(1140, 484, 14, 140);
    props.fillStyle(0x4b5642, 0.8);
    props.fillRect(1056, 486, 172, 48);
    props.lineStyle(2, COLORS.paper, 0.18);
    props.strokeRect(1056, 486, 172, 48);
    props.fillStyle(COLORS.rust, 0.75);
    props.fillRect(1056, 486, 172, 4);
    props.fillStyle(0x3d463b, 0.9);
    props.fillRect(80, 534, 170, 102);
    props.fillStyle(0x59614b, 0.8);
    props.fillRect(80, 534, 170, 8);
    props.lineStyle(2, COLORS.coal, 0.7);
    props.strokeRect(80, 534, 170, 102);
    props.fillStyle(COLORS.warning, 0.7);
    props.fillRect(80, 534, 8, 102);
    props.fillStyle(COLORS.coal, 0.4);
    for (let x = 98; x < 244; x += 28) {
      props.lineBetween(x, 544, x - 14, 630);
    }

    const cable = this.add.graphics();
    cable.setDepth(5);
    cable.lineStyle(2, COLORS.coal, 0.75);
    cable.beginPath();
    cable.moveTo(0, 246);
    cable.lineTo(600, 268);
    cable.lineTo(GAME_WIDTH, 240);
    cable.strokePath();
    cable.lineStyle(1, COLORS.paperDark, 0.45);
    cable.beginPath();
    cable.moveTo(0, 252);
    cable.lineTo(600, 274);
    cable.lineTo(GAME_WIDTH, 246);
    cable.strokePath();
    cable.fillStyle(COLORS.warning, 0.8);
    cable.fillCircle(600, 268, 6);
    cable.lineStyle(2, COLORS.warning, 0.55);
    cable.lineBetween(600, 268, 610, 336);
    cable.fillStyle(COLORS.paper, 0.85);
    cable.fillRect(562, 336, 96, 58);
    cable.lineStyle(2, COLORS.coal, 0.7);
    cable.strokeRect(562, 336, 96, 58);
    cable.fillStyle(COLORS.rust, 0.8);
    cable.fillRect(562, 336, 96, 5);
    const hanging = this.add.text(610, 366, '唯一退路', {
      fontFamily: FONTS.display,
      fontSize: '15px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    hanging.setOrigin(0.5);
    hanging.setDepth(6);

    const canopy = this.add.container(1026, 300);
    canopy.setDepth(4);
    const tarp = this.add.graphics();
    tarp.fillStyle(0x4b5642, 0.86);
    tarp.fillPoints(
      [
        new Phaser.Geom.Point(-150, -54),
        new Phaser.Geom.Point(130, -86),
        new Phaser.Geom.Point(176, -12),
        new Phaser.Geom.Point(124, -20),
        new Phaser.Geom.Point(76, 30),
        new Phaser.Geom.Point(28, -8),
        new Phaser.Geom.Point(-24, 24),
        new Phaser.Geom.Point(-58, -10),
        new Phaser.Geom.Point(-120, 6),
      ],
      true,
    );
    tarp.lineStyle(2, COLORS.paper, 0.22);
    tarp.strokePoints(
      [
        new Phaser.Geom.Point(-150, -54),
        new Phaser.Geom.Point(130, -86),
        new Phaser.Geom.Point(176, -12),
        new Phaser.Geom.Point(124, -20),
        new Phaser.Geom.Point(76, 30),
        new Phaser.Geom.Point(28, -8),
        new Phaser.Geom.Point(-24, 24),
        new Phaser.Geom.Point(-58, -10),
        new Phaser.Geom.Point(-120, 6),
      ],
      true,
    );
    tarp.lineStyle(2, COLORS.coal, 0.5);
    tarp.lineBetween(-140, -60, -190, -170);
    tarp.lineBetween(130, -88, 180, -190);
    canopy.add(tarp);
    const leak = this.add.text(52, -42, '雨棚 · 漏水', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS.paperDim,
    });
    canopy.add(leak);

    const truck = this.add.container(958, 608);
    truck.setDepth(8);
    const tg = this.add.graphics();
    tg.fillStyle(COLORS.coal, 0.24);
    tg.fillEllipse(0, 30, 130, 16);
    tg.fillStyle(0x6e5a3f, 1);
    tg.fillRect(-58, -36, 116, 66);
    tg.fillStyle(0x8a7351, 1);
    tg.fillRect(-58, -36, 116, 8);
    tg.lineStyle(2, COLORS.coal, 0.8);
    tg.strokeRect(-58, -36, 116, 66);
    tg.fillStyle(COLORS.warning, 0.7);
    tg.fillRect(-8, -36, 16, 66);
    truck.add(tg);

    const drone = this.add.image(1140, 190, TEX.drone);
    drone.setDepth(30);
    drone.setScale(1.5);
    this.tweens.add({
      targets: drone,
      y: 174,
      angle: 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (let i = 0; i < 22; i += 1) {
      const dust = this.add.image(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(150, 560),
        TEX.dust,
      );
      dust.setDepth(-5);
      dust.setTint(i % 3 === 0 ? COLORS.warning : COLORS.paper);
      dust.setAlpha(Phaser.Math.FloatBetween(0.05, 0.16));
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(80, 180),
        y: dust.y - Phaser.Math.Between(20, 70),
        alpha: 0,
        duration: Phaser.Math.Between(2600, 5600),
        repeat: -1,
        delay: Phaser.Math.Between(0, 2200),
        onRepeat: () => {
          dust.setPosition(Phaser.Math.Between(20, GAME_WIDTH - 120), Phaser.Math.Between(200, 560));
          dust.setAlpha(Phaser.Math.FloatBetween(0.05, 0.16));
        },
      });
    }

    const liveLeft = addHotTag(this, 170, 96, '荒野直播中', COLORS.warning, -0.03);
    liveLeft.setScrollFactor(0);
    liveLeft.setDepth(95);
    const liveRight = addHotTag(this, 1110, 96, '#这是好事呀#', COLORS.neon, 0.025);
    liveRight.setScrollFactor(0);
    liveRight.setDepth(95);
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
    this.physics.add.collider(this.player, this.floor);
    this.physics.add.collider(this.bullets, this.floor, (a, b) => {
      this.projectileFrom(this.bullets, a, b)?.destroy();
    });
    this.physics.add.collider(this.bossProjectiles, this.floor, (a, b) => {
      const gear = this.projectileFrom(this.bossProjectiles, a, b);
      if (gear?.active) {
        pixelBurst(this, gear.x, gear.y, COLORS.warning, 3, 0.6);
        gear.destroy();
      }
    });
    this.physics.add.overlap(this.bullets, this.boss, (a, b) => {
      const bullet = this.projectileFrom(this.bullets, a, b);
      if (!bullet || !bullet.active || this.boss.isDead() || this.finished) {
        return;
      }
      const damage = Number(bullet.getData('damage') ?? PLAYER.bulletDamage);
      this.boss.takeDamage(damage);
      this.meme.addSmall(MEME.bossHitGain);
      pixelBurst(this, bullet.x, bullet.y, COLORS.warning, 3, 0.6);
      bullet.destroy();
    });
    this.physics.add.overlap(this.bossProjectiles, this.player, (a, b) => {
      const projectile = this.projectileFrom(this.bossProjectiles, a, b);
      if (!projectile || !projectile.active || this.finished) {
        return;
      }
      const damage = Number(projectile.getData('damage') ?? 10);
      if (this.player.takeDamage(damage, projectile.x) > 0) {
        this.cameras.main.shake(100, 0.006);
      }
      projectile.destroy();
    });
    this.physics.add.overlap(this.player, this.boss, () => {
      if (this.finished || this.boss.isDead()) {
        return;
      }
      const actual = this.player.takeDamage(BOSS.contactDamage, this.boss.x);
      if (actual > 0) {
        this.cameras.main.shake(120, 0.008);
      }
    });
  }

  private setupHud(): void {
    this.cards = new CardSystem(this, this.makeCardHost(), this.run);
    this.hud = new Hud(this, {
      bossMode: true,
      onUseCard: (index) => {
        if (this.finished || this.transitioning || this.introActive) {
          return;
        }
        this.cards.useSlot(index);
      },
    });
    this.hud.updateCards(this.cards.getCards());
    this.hud.updateMeme(this.meme.getValue(), this.meme.isBurstActive(), this.meme.getStreak());
    this.hud.updateBoss(
      this.boss.config.name,
      this.boss.config.title,
      this.boss.getHp(),
      this.boss.getMaxHp(),
      this.boss.getPhaseNumber(),
      this.boss.getMaxPhases(),
    );
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
      freezeBoss: (durationMs) => this.freezeBoss(durationMs),
      screenClear: () => this.doScreenClear(),
      summonAlly: (durationMs) => this.summonAlly(durationMs),
      toast: (text, tone) => this.hud.toast(text, tone),
    };
  }

  private freezeBoss(durationMs: number): boolean {
    if (this.boss.isDead() || this.finished) {
      return false;
    }
    this.boss.setStagger(durationMs);
    this.hud.toast('荒哥被画地为牢。', 'neon');
    return true;
  }

  private doScreenClear(): number {
    const count = this.bossProjectiles.getChildren().filter((child) => child.active).length;
    this.clearBossProjectiles();
    if (!this.boss.isDead() && !this.finished) {
      this.boss.takeDamage(18);
    }
    this.cameras.main.flash(160, 232, 178, 58, false);
    return count;
  }

  private setupTouch(): void {
    if (isTouchDevice()) {
      this.touch = new TouchControls(this, this.player);
    }
  }

  private setupCamera(): void {
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(300, 130);
    this.cameras.main.setZoom(1);
  }

  private setupAmbient(): void {
    this.time.addEvent({
      delay: 3200,
      loop: true,
      callback: () => {
        if (this.finished || !this.fightStarted) {
          return;
        }
        const bar = this.add.graphics();
        bar.setDepth(97);
        bar.fillStyle(Math.random() > 0.5 ? COLORS.warning : COLORS.neon, 0.22);
        bar.fillRect(
          Phaser.Math.Between(20, 1000),
          Phaser.Math.Between(170, 420),
          Phaser.Math.Between(70, 240),
          Phaser.Math.Between(2, 5),
        );
        this.tweens.add({ targets: bar, alpha: 0, duration: 160, onComplete: () => bar.destroy() });
      },
    });
  }

  private playIntro(): void {
    this.introActive = true;
    this.introEpoch += 1;
    const epoch = this.introEpoch;
    this.fightStarted = false;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.hud.setVisible(false);
    this.boss.setPresentationVisible(false);
    this.boss.setPosition(BOSS_HOVER_X, 720);
    this.cameras.main.stopFollow();
    this.cameras.main.zoomTo(1.16, 800, 'Sine.easeInOut');
    this.cameras.main.pan(600, 360, 800, 'Sine.easeInOut');

    const world = this.add.container(0, 0);
    world.setDepth(410);
    this.introWorld = world;

    const rope = this.add.graphics();
    rope.lineStyle(3, COLORS.coal, 0.85);
    rope.beginPath();
    rope.moveTo(40, 306);
    rope.lineTo(520, 324);
    rope.lineTo(1040, 286);
    rope.strokePath();
    rope.lineStyle(1, COLORS.paperDark, 0.65);
    rope.beginPath();
    rope.moveTo(40, 300);
    rope.lineTo(520, 318);
    rope.lineTo(1040, 280);
    rope.strokePath();
    rope.fillStyle(COLORS.warning, 0.9);
    rope.fillCircle(1040, 286, 7);
    world.add(rope);

    const cardboard = this.add.container(1010, 296);
    const cg = this.add.graphics();
    cg.fillStyle(COLORS.paper, 0.96);
    cg.fillRect(-100, -54, 200, 108);
    cg.lineStyle(3, COLORS.coal, 0.85);
    cg.strokeRect(-100, -54, 200, 108);
    cg.fillStyle(COLORS.rust, 0.85);
    cg.fillRect(-100, -54, 200, 8);
    cg.fillStyle(COLORS.coal, 0.25);
    cg.fillRect(-72, 22, 144, 3);
    cg.fillRect(-72, 32, 96, 3);
    cardboard.add(cg);
    const cardboardTitle = this.add.text(0, -20, STRINGS.act2.bossIntroTag, {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    cardboardTitle.setOrigin(0.5);
    const cardboardSub = this.add.text(0, 14, '纸板替代 · 请稍候', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.rust,
    });
    cardboardSub.setOrigin(0.5);
    const cardboardTape = makeTape(this, 74, -46, 74, 16, COLORS.warning);
    cardboardTape.setRotation(-0.15);
    cardboard.add([cardboardTitle, cardboardSub, cardboardTape]);
    cardboard.setRotation(-0.04);
    world.add(cardboard);

    const drone = this.add.image(850, 190, TEX.drone);
    drone.setScale(1.6);
    world.add(drone);

    const skip = this.add.text(GAME_WIDTH / 2, 86, STRINGS.boss.cinematic.skip, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.paperDim,
      backgroundColor: CSS.coal,
      padding: { x: 12, y: 6 },
    });
    skip.setOrigin(0.5);
    skip.setScrollFactor(0);
    skip.setDepth(500);
    skip.setAlpha(0.85);
    const skipRoot = this.add.container(0, 0);
    skipRoot.setScrollFactor(0);
    skipRoot.setDepth(500);
    skipRoot.add(skip);
    this.introUi = skipRoot;

    const skipHandler = () => this.finishIntro(true);
    this.introSkipHandler = skipHandler;
    this.input.keyboard?.on('keydown-SPACE', skipHandler);
    this.input.on('pointerup', skipHandler);

    this.time.delayedCall(420, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      audio.play('droneFocus');
      this.tweens.add({
        targets: drone,
        x: 1032,
        y: 210,
        duration: 1000,
        ease: 'Sine.easeInOut',
      });
    });
    this.time.delayedCall(1320, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      audio.play('shutter');
      this.cameras.main.flash(90, 255, 247, 228, false);
      this.cameras.main.pan(820, 380, 760, 'Sine.easeInOut');
      audio.play('ropeTension');
    });
    this.time.delayedCall(1580, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      this.tweens.add({
        targets: cardboard,
        angle: 78,
        y: 520,
        alpha: 0,
        duration: 620,
        ease: 'Cubic.easeIn',
      });
      this.boss.setPresentationVisible(true);
      this.tweens.add({
        targets: this.boss,
        y: BOSS_HOVER_Y,
        duration: 760,
        ease: 'Back.easeOut',
      });
    });
    this.time.delayedCall(2280, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      audio.play('stampThud');
      this.cameras.main.shake(160, 0.006);
      const stick = this.add.graphics();
      stick.lineStyle(4, COLORS.coal, 1);
      stick.lineBetween(0, 0, 0, -96);
      stick.lineStyle(3, COLORS.warning, 1);
      stick.lineBetween(0, -96, 0, -118);
      stick.fillStyle(COLORS.coal, 1);
      stick.fillRect(-16, -146, 32, 30);
      stick.fillStyle(COLORS.neon, 0.9);
      stick.fillRect(-12, -142, 24, 20);
      const stickRoot = this.add.container(this.boss.x + 54, this.boss.y - 18);
      stickRoot.add(stick);
      stickRoot.setRotation(-0.26);
      world.add(stickRoot);
      this.tweens.add({
        targets: stickRoot,
        rotation: 0.04,
        duration: 420,
        ease: 'Back.easeOut',
      });
    });
    this.time.delayedCall(3000, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      this.tweens.add({
        targets: drone,
        x: this.boss.x + 166,
        y: 286,
        duration: 620,
        ease: 'Sine.easeInOut',
      });
      audio.play('droneFocus');
      this.cameras.main.pan(930, 410, 700, 'Sine.easeInOut');
    });
    this.time.delayedCall(3560, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      audio.play('shutter');
      this.cameras.main.flash(120, 255, 247, 228, false);
      const nameplate = addHotTag(this, this.boss.x, this.boss.y - 196, STRINGS.act2.bossNameplate, COLORS.rust, -0.02);
      nameplate.setDepth(420);
      world.add(nameplate);
      this.tweens.add({
        targets: nameplate,
        scale: { from: 1.6, to: 1 },
        duration: 260,
        ease: 'Back.easeOut',
      });
    });
    this.time.delayedCall(4050, () => {
      if (epoch !== this.introEpoch || !this.introActive) {
        return;
      }
      this.finishIntro(false);
    });
  }

  private finishIntro(skipped: boolean): void {
    if (!this.introActive || this.finished) {
      return;
    }
    this.introActive = false;
    this.introEpoch += 1;
    this.registry.set('act2IntroSeen', true);
    if (this.introSkipHandler) {
      this.input.keyboard?.off('keydown-SPACE', this.introSkipHandler);
      this.input.off('pointerup', this.introSkipHandler);
      this.introSkipHandler = null;
    }
    this.tweens.killTweensOf(this.boss);
    this.boss.setPresentationVisible(true);
    this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
    this.boss.setAngle(0);
    this.introWorld?.destroy(true);
    this.introWorld = null;
    this.introUi?.destroy(true);
    this.introUi = null;
    this.cameras.main.zoomTo(1, 320, 'Sine.easeInOut');
    this.cameras.main.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 320, 'Sine.easeInOut');
    this.input.keyboard?.resetKeys();
    this.time.delayedCall(100, () => {
      if (this.finished) {
        return;
      }
      this.hud.setVisible(true);
      if (skipped) {
        this.hud.toast('已跳过登场。', 'paper');
      }
      this.player.setControlEnabled(true);
      this.touch?.setEnabled(true);
      this.setupCamera();
      this.startFight();
    });
  }

  private startFight(): void {
    if (this.finished || this.fightStarted) {
      return;
    }
    this.fightStarted = true;
    this.boss.setInvulnerable(0);
    this.nextAttackAt = this.time.now + 1100;
    this.hud.toast('荒哥：镜头跟上，这段一次过。', 'neon');
    this.time.delayedCall(650, () => {
      if (this.finished || !this.fightStarted) {
        return;
      }
      const warning = addHotTag(this, BOSS_HOVER_X - 70, 372, STRINGS.act2.bossFirstHint, COLORS.warning, -0.02);
      warning.setDepth(97);
      this.tweens.add({
        targets: warning,
        alpha: 0,
        delay: 1200,
        duration: 320,
        onComplete: () => warning.destroy(),
      });
    });
  }

  private makeBossHost(): {
    burstAt: (x: number, y: number, color: number, count: number) => void;
    floatText: (x: number, y: number, text: string, color?: number) => void;
    onPhaseReached: (phase: BossPhase) => void;
    onStaggered: () => void;
    onDefeated: () => void;
  } {
    return {
      burstAt: (x, y, color, count) => pixelBurst(this, x, y, color, count),
      floatText: (x, y, text, color) => addFloatingLine(this, x, y, text, color ?? COLORS.warning, 17),
      onPhaseReached: (phase) => this.handlePhaseReached(phase),
      onStaggered: () => {
        this.attackEpoch += 1;
        this.attackBusy = false;
        this.cleanupViewfinderAttack();
        this.boss.setVelocity(0, 0);
        this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
        this.nextAttackAt = this.time.now + 1100;
      },
      onDefeated: () => this.handleBossDefeated(),
    };
  }

  private performAttack(time: number): void {
    if (!this.fightStarted || this.finished) {
      return;
    }
    const phase = this.boss.getPhaseConfig();
    this.nextAttackAt = time + phase.attackIntervalMs;
    const pool = phase.attackPool.filter((attack) => attack !== this.lastAttack);
    const options = pool.length > 0 ? pool : phase.attackPool;
    const attack = options[Math.floor(Math.random() * options.length)] ?? 'viewfinder_net';
    this.lastAttack = attack;
    if (attack === 'viewfinder_net') {
      this.attackViewfinder();
    } else if (attack === 'gear_toss') {
      this.attackGearToss();
    }
  }

  private attackViewfinder(): void {
    this.attackBusy = true;
    this.attackEpoch += 1;
    const epoch = this.attackEpoch;
    this.cleanupViewfinderAttack();
    const targetX = Phaser.Math.Clamp(this.player.x, 240, 1040);
    const frame = new Viewfinder(this, {
      x: targetX,
      y: 600,
      width: 190,
      height: 118,
      color: COLORS.warning,
      label: STRINGS.act2.bossViewLabel,
      depth: 70,
    });
    this.activeViewfinder = frame;
    const drone = this.add.image(this.boss.x - 40, 320, TEX.drone);
    drone.setDepth(72);
    drone.setScale(1.5);
    this.activeDrone = drone;
    this.tweens.add({
      targets: drone,
      x: targetX + 84,
      y: 318,
      angle: 4,
      duration: 520,
      ease: 'Sine.easeInOut',
    });
    audio.play('droneFocus');
    this.time.delayedCall(360, () => {
      if (epoch !== this.attackEpoch || this.finished) {
        return;
      }
      const duration = this.firstViewfinder ? 2100 : 1650;
      this.firstViewfinder = false;
      frame.close(duration, () => {
        if (epoch !== this.attackEpoch || this.finished) {
          return;
        }
        audio.play('shutter');
        this.cameras.main.flash(90, 255, 247, 228, false);
        this.time.delayedCall(120, () => {
          if (epoch !== this.attackEpoch || this.finished) {
            return;
          }
          this.dropNetAt(frame.getPosition().x, frame.getPosition().y);
          const caught = frame.contains(this.player.x, this.player.y);
          if (caught) {
            const actual = this.player.takeDamage(13, frame.getPosition().x);
            if (actual > 0) {
              this.cameras.main.shake(140, 0.009);
              addFloatingLine(this, this.player.x, this.player.y - 84, '被罩住了', COLORS.rust, 18);
            }
          } else {
            addFloatingLine(this, this.player.x, this.player.y - 84, '躲开镜头', COLORS.neon, 18);
          }
          this.time.delayedCall(680, () => {
            if (epoch !== this.attackEpoch) {
              return;
            }
            this.cleanupViewfinderAttack();
            this.attackBusy = false;
            this.nextAttackAt = Math.max(this.nextAttackAt, this.time.now + 700);
          });
        });
      });
    });
  }

  private attackGearToss(): void {
    this.attackBusy = true;
    this.attackEpoch += 1;
    const epoch = this.attackEpoch;
    this.hud.toast(STRINGS.act2.bossGearHint, 'paper');
    audio.play('ropeTension');
    this.tweens.add({
      targets: this.boss,
      angle: { from: 0, to: -7 },
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    this.time.delayedCall(380, () => {
      if (epoch !== this.attackEpoch || this.finished || this.boss.isDead()) {
        return;
      }
      audio.play('gearToss');
      for (let i = 0; i < 3; i += 1) {
        const gear = this.bossProjectiles.create(this.boss.x - 20, this.boss.y - 18, TEX.gear) as Phaser.Physics.Arcade.Image;
        gear.setDepth(22);
        gear.setScale(0.9);
        const body = gear.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(true);
        body.setSize(18, 18);
        const direction = this.player.x < this.boss.x ? -1 : 1;
        gear.setVelocity(direction * (240 + i * 55), -430 + i * 34);
        gear.setData('damage', 10);
        gear.setData('spin', (i % 2 === 0 ? 1 : -1) * Phaser.Math.Between(5, 9));
        gear.setData('expireAt', this.time.now + 2400);
      }
      this.time.delayedCall(700, () => {
        if (epoch !== this.attackEpoch) {
          return;
        }
        this.attackBusy = false;
        this.nextAttackAt = Math.max(this.nextAttackAt, this.time.now + 700);
      });
    });
  }

  private dropNetAt(x: number, y: number): void {
    if (this.activeNet) {
      this.activeNet.destroy(true);
      this.activeNet = null;
    }
    const net = this.add.container(x, y - 190);
    net.setDepth(74);
    const g = this.add.graphics();
    g.lineStyle(2, COLORS.paper, 0.9);
    g.strokeRect(-96, -62, 192, 124);
    for (let gx = -96; gx <= 96; gx += 24) {
      g.lineBetween(gx, -62, gx, 62);
    }
    for (let gy = -62; gy <= 62; gy += 24) {
      g.lineBetween(-96, gy, 96, gy);
    }
    g.fillStyle(COLORS.warning, 0.9);
    g.fillCircle(-96, -62, 4);
    g.fillCircle(96, -62, 4);
    g.fillCircle(-96, 62, 4);
    g.fillCircle(96, 62, 4);
    net.add(g);
    this.activeNet = net;
    audio.play('netDrop');
    this.tweens.add({
      targets: net,
      y,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(90, 0.004);
        pixelBurst(this, x, y, COLORS.warning, 6, 0.7);
        this.tweens.add({
          targets: net,
          alpha: 0,
          delay: 720,
          duration: 260,
          onComplete: () => {
            if (this.activeNet === net) {
              this.activeNet = null;
            }
            net.destroy(true);
          },
        });
      },
    });
  }

  private cleanupViewfinderAttack(): void {
    this.activeViewfinder?.destroy();
    this.activeViewfinder = null;
    this.activeDrone?.destroy();
    this.activeDrone = null;
    if (this.activeNet) {
      this.activeNet.destroy(true);
      this.activeNet = null;
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
    if (this.boss.isDead()) {
      return;
    }
    const bullet = this.bullets.create(x, y, TEX.bulletAlly) as Phaser.Physics.Arcade.Image;
    bullet.setDepth(22);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(10, 4);
    const angle = Math.atan2(this.boss.y - y, this.boss.x - x);
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
    if (this.boss.isDead() || this.finished) {
      return false;
    }
    this.ally = new Ally(
      this,
      this.player,
      durationMs,
      () => !this.boss.isDead() && !this.finished,
      (x, y) => this.fireAllyShot(x, y),
    );
    return true;
  }

  private cleanupProjectiles(time: number): void {
    this.bullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) {
        return;
      }
      const expire = Number(bullet.getData('expireAt') ?? 0);
      if (time > expire || bullet.x < -80 || bullet.x > GAME_WIDTH + 80 || bullet.y < -80 || bullet.y > GAME_HEIGHT + 80) {
        bullet.destroy();
      }
    });
    this.bossProjectiles.getChildren().forEach((child) => {
      const gear = child as Phaser.Physics.Arcade.Image;
      if (!gear.active) {
        return;
      }
      const expire = Number(gear.getData('expireAt') ?? 0);
      gear.setAngle(gear.angle + Number(gear.getData('spin') ?? 4));
      if (time > expire || gear.y > GAME_HEIGHT + 80) {
        gear.destroy();
      }
    });
  }

  private clearBossProjectiles(): void {
    this.bossProjectiles.getChildren().forEach((child) => {
      const gear = child as Phaser.Physics.Arcade.Image;
      if (gear.active) {
        pixelBurst(this, gear.x, gear.y, COLORS.warning, 2, 0.5);
        gear.destroy();
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

  private handlePhaseReached(phase: BossPhase): void {
    if (this.finished) {
      return;
    }
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.cleanupViewfinderAttack();
    this.clearBossProjectiles();
    this.boss.setVelocity(0, 0);
    this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);

    if (phase.phase >= 2) {
      this.finished = true;
      this.fightStarted = false;
      this.player.setControlEnabled(false);
      this.touch?.setEnabled(false);
      this.hud.setHint(null);
      this.boss.setInvulnerable(999999);
      audio.play('stagger');
      this.cameras.main.flash(180, 255, 247, 228, false);
      this.cameras.main.shake(180, 0.009);
      this.hud.toast(STRINGS.act2.bossTempClear, 'neon');
      const mark = stamp(this, GAME_WIDTH / 2, 300, STRINGS.act2.bossTempClear, {
        color: COLORS.rust,
        fontSize: 34,
        angle: -0.06,
        alpha: 0.9,
      });
      mark.setScrollFactor(0);
      mark.setDepth(445);
      this.tweens.add({ targets: mark, scale: { from: 2, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      const done = addHotTag(this, this.boss.x, this.boss.y - 160, '镜头跟上 · 先导段收工', COLORS.warning, 0.02);
      done.setDepth(97);
      this.time.delayedCall(1300, () => this.finishRun(true, true));
      return;
    }

    this.boss.setInvulnerable(BOSS.phaseBannerMs + 300);
    this.nextAttackAt = this.time.now + 1700;
  }

  private handleBossDefeated(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.fightStarted = false;
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.clearBossProjectiles();
    this.cleanupViewfinderAttack();
    audio.play('victory');
    this.cameras.main.shake(360, 0.018);
    this.cameras.main.flash(220, 255, 247, 228, false);
    this.hud.toast(STRINGS.act2.bossDefeated, 'neon');
    const finalWord = this.add.text(this.boss.x, this.boss.y - 150, this.boss.config.defeatLine, {
      fontFamily: FONTS.body,
      fontSize: '16px',
      color: CSS.paper,
      fontStyle: 'bold',
      stroke: CSS.coal,
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 420 },
    });
    finalWord.setOrigin(0.5);
    finalWord.setDepth(150);
    const winStamp = stamp(this, GAME_WIDTH / 2, 280, STRINGS.act2.bossDefeated, {
      color: COLORS.rust,
      fontSize: 42,
      angle: -0.07,
      alpha: 0.9,
    });
    winStamp.setScrollFactor(0);
    winStamp.setDepth(445);
    this.tweens.add({ targets: winStamp, scale: { from: 2.2, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: this.boss,
      angle: -82,
      y: this.boss.y + 70,
      alpha: 0.55,
      duration: BOSS.deathDelayMs,
      ease: 'Cubic.easeIn',
    });
    this.time.delayedCall(BOSS.deathDelayMs + 420, () => this.finishRun(true, false));
  }

  private handleDeath(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.fightStarted = false;
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.boss.setVelocity(0, 0);
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.clearBossProjectiles();
    this.cleanupViewfinderAttack();
    audio.play('defeat');
    this.cameras.main.shake(260, 0.016);
    this.cameras.main.flash(180, 168, 58, 34, false);
    const marker = glitchText(this, this.player.x, this.player.y - 96, STRINGS.misc.died, {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    marker.setDepth(150);
    this.tweens.add({ targets: marker, alpha: 0, y: marker.y - 30, delay: 900, duration: 400 });
    this.time.delayedCall(1500, () => this.finishRun(false, false));
  }

  private finishRun(victory: boolean, temporary: boolean): void {
    if (this.transitioning) {
      return;
    }
    this.transitioning = true;
    this.attackEpoch += 1;
    this.cleanupViewfinderAttack();
    this.clearBossProjectiles();
    this.run.hp = Math.max(0, this.player.getHp());
    this.meme.sync(this.run);
    this.run.cards = [...this.run.cards];
    const payload: ResultPayload = {
      act: 2,
      victory,
      timeMs: elapsedMs(this.run),
      stats: { ...this.run.stats },
      cards: [...this.run.cards],
      reason: temporary
        ? STRINGS.act2.bossTempReason
        : victory
          ? STRINGS.act2.bossDefeatedSub
          : this.pendingReason,
    };
    if (temporary) {
      payload.temporary = true;
    }
    audio.setMusic('result');
    this.cameras.main.fadeOut(300, 23, 19, 16);
    this.time.delayedCall(320, () => {
      this.scene.start('Result', { payload, record: !temporary });
    });
  }

  private cleanupScene(): void {
    this.attackEpoch += 1;
    if (this.introSkipHandler) {
      this.input.keyboard?.off('keydown-SPACE', this.introSkipHandler);
      this.input.off('pointerup', this.introSkipHandler);
      this.introSkipHandler = null;
    }
    if (this.cardsChangedHandler) {
      this.events.off('cards-changed', this.cardsChangedHandler);
      this.cardsChangedHandler = null;
    }
    this.cleanupViewfinderAttack();
    this.introWorld = null;
    this.introUi = null;
  }
}
