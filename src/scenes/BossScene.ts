import Phaser from 'phaser';
import {
  BOSS,
  CARD,
  COMBAT,
  GAME_HEIGHT,
  GAME_WIDTH,
  MEME,
  PLAYER,
  QUIZ,
} from '../config/balance';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';
import { STRINGS } from '../data';
import type { BossAttackId, BossPhase, BossSpecialId, ResultPayload, RunState } from '../types/game';
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
import { QuizOverlay } from '../ui/QuizOverlay';
import { CardSystem, type CardHost } from '../systems/CardSystem';
import { MemeMeter } from '../systems/MemeMeter';
import { QuizSystem } from '../systems/QuizSystem';
import { elapsedMs, getRunState } from '../systems/RunState';
import { audio } from '../systems/AudioSystem';

const BOSS_HOVER_X = 930;
const BOSS_HOVER_Y = 500;
const DASH_Y = 520;

/** 萝卜舞台：构图目标——阿浣在左、萝卜居中、Boss 在右。 */
const STAGE_RADISH_X = 640;
const STAGE_GROUND_Y = 636;
/** 演出压暗层（在背景之上、角色之下）与演出道具层（在角色之上、答题层之下）。 */
const STAGE_DIM_DEPTH = 12;
const STAGE_PROP_DEPTH = 60;

export class BossScene extends Phaser.Scene {
  private run!: RunState;
  private player!: Player;
  private boss!: Boss;
  private hud!: Hud;
  private touch: TouchControls | null = null;
  private meme!: MemeMeter;
  private cards!: CardSystem;
  private readonly quizSystem = new QuizSystem();
  private quizOverlay: QuizOverlay | null = null;
  private bullets!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private floor!: Phaser.GameObjects.Rectangle;
  private ally: Ally | null = null;
  private fightStarted = false;
  private finished = false;
  private transitioning = false;
  private parryActive = false;
  private parryUsedThisPhase = false;
  private attackBusy = false;
  private bossDashing = false;
  private attackEpoch = 0;
  private nextAttackAt = 0;
  private nextSpecialAt = 0;
  private lastAttack: BossAttackId | null = null;
  private pendingCardId: string | null = null;
  private pendingPhase: BossPhase | null = null;
  private pendingReason = '网络热度归零';
  private cardsChangedHandler: (() => void) | null = null;
  /** 认梗招式的舞台演出：压暗层与道具层分开管理，方便压暗背景但保住角色可读。 */
  private specialDim: Phaser.GameObjects.Container | null = null;
  private specialProps: Phaser.GameObjects.Container | null = null;
  private specialStampView: Phaser.GameObjects.Container | null = null;
  private specialRobot: Phaser.GameObjects.Container | null = null;
  private specialReceipt: Phaser.GameObjects.Container | null = null;
  private specialStamps: Phaser.GameObjects.Container[] = [];
  private specialEpoch = 0;
  /** 首次登场的四秒连续镜头。 */
  private introActive = false;
  private introEpoch = 0;
  private introWorld: Phaser.GameObjects.Container | null = null;
  private introUi: Phaser.GameObjects.Container | null = null;
  private introSkipHandler: (() => void) | null = null;
  private introProjection: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Boss');
  }

  create(): void {
    this.fightStarted = false;
    this.finished = false;
    this.transitioning = false;
    this.parryActive = false;
    this.parryUsedThisPhase = false;
    this.attackBusy = false;
    this.bossDashing = false;
    this.attackEpoch = 0;
    this.nextAttackAt = 0;
    this.nextSpecialAt = 0;
    this.lastAttack = null;
    this.pendingCardId = null;
    this.pendingPhase = null;
    this.pendingReason = '网络热度归零';
    this.ally = null;
    this.quizOverlay = null;
    this.cardsChangedHandler = null;
    this.specialDim = null;
    this.specialProps = null;
    this.specialStampView = null;
    this.specialRobot = null;
    this.specialReceipt = null;
    this.specialStamps = [];
    this.specialEpoch = 0;
    this.introActive = false;
    this.introEpoch = 0;
    this.introWorld = null;
    this.introUi = null;
    this.introSkipHandler = null;

    this.run = getRunState(this);
    if (this.run.hp <= 0) {
      this.run.hp = Math.round(PLAYER.maxHp * 0.6);
    }

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.fadeIn(280, 23, 19, 16);
    audio.setMusic('boss');

    this.buildArena();
    this.player = new Player(this, 220, 560, this.run.hp, this.makePlayerCallbacks());
    this.meme = new MemeMeter(this.run);
    this.boss = new Boss(this, BOSS_HOVER_X, BOSS_HOVER_Y, this.makeBossHost());
    const introSeen = this.registry.get('bossIntroSeen') === true;
    this.boss.setInvulnerable(introSeen ? 500 : BOSS.introMs + 300);
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.bossProjectiles = this.physics.add.group({ allowGravity: false });
    this.setupCollisions();
    this.setupHud();
    this.setupTouch();
    this.setupAmbient();

    if (introSeen) {
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
    if (this.introActive && this.introUi) {
      const zoom = this.cameras.main.zoom;
      this.introUi.setScale(1 / zoom);
      if (this.introProjection) {
        this.introProjection.setScale(1 / zoom);
        this.introProjection.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 + (132 - GAME_HEIGHT / 2) / zoom);
      }
    }
    if (!this.finished) {
      this.player.tick(time, delta);
      this.quizOverlay?.update(delta);
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
        !this.quizActive() &&
        !this.boss.isDead() &&
        !this.boss.isStaggered(time) &&
        !this.attackBusy
      ) {
        if (time >= this.nextSpecialAt && !this.parryUsedThisPhase) {
          this.startParry();
        } else if (time >= this.nextAttackAt) {
          this.performAttack(time);
        }
      }
    }
  }

  private quizActive(): boolean {
    return this.parryActive;
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
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.stageBg).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const overlay = this.add.graphics();
    overlay.fillStyle(COLORS.coal, 0.22);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.fillStyle(COLORS.rust, 0.22);
    overlay.fillRect(0, 560, GAME_WIDTH, 78);
    overlay.fillStyle(COLORS.warning, 0.5);
    overlay.fillRect(0, 560, GAME_WIDTH, 4);
    overlay.lineStyle(2, COLORS.paper, 0.12);
    for (let x = 0; x < GAME_WIDTH; x += 80) {
      overlay.lineBetween(x, 596, x + 42, 636);
    }

    this.floor = this.add.rectangle(GAME_WIDTH / 2, 678, GAME_WIDTH, 84, 0x000000, 0);
    this.physics.add.existing(this.floor, true);

    const redCarpet = this.add.graphics();
    redCarpet.setDepth(4);
    redCarpet.fillStyle(COLORS.rust, 0.25);
    redCarpet.fillRect(270, 570, 740, 64);
    redCarpet.fillStyle(COLORS.warning, 0.25);
    redCarpet.fillRect(270, 570, 740, 3);
    redCarpet.fillRect(270, 631, 740, 3);
    for (let x = 288; x < 1000; x += 56) {
      redCarpet.lineStyle(1, COLORS.coal, 0.25);
      redCarpet.lineBetween(x, 574, x + 20, 632);
    }

    const stageProps = this.add.graphics();
    stageProps.setDepth(5);
    // 中景：快递传送带与升降台
    stageProps.fillStyle(COLORS.coal, 0.9);
    stageProps.fillRect(300, 588, 330, 30);
    stageProps.fillStyle(COLORS.warning, 0.6);
    stageProps.fillRect(300, 588, 330, 3);
    stageProps.fillStyle(COLORS.coalFaint, 1);
    for (let x = 312; x < 620; x += 26) {
      stageProps.fillCircle(x, 606, 6);
      stageProps.fillStyle(COLORS.paperDim, 0.45);
      stageProps.fillCircle(x, 606, 2);
      stageProps.fillStyle(COLORS.coalFaint, 1);
    }
    const liftRail = this.add.graphics();
    liftRail.setDepth(5);
    liftRail.fillStyle(COLORS.coal, 0.85);
    liftRail.fillRect(730, 500, 10, 136);
    liftRail.fillRect(808, 500, 10, 136);
    liftRail.fillStyle(COLORS.paperDim, 0.24);
    liftRail.fillRect(742, 524, 64, 8);
    liftRail.fillStyle(COLORS.warning, 0.7);
    liftRail.fillRect(742, 600, 64, 5);
    // 远景讲台（Boss 舞台右侧、角色后方）
    const podium = this.add.graphics();
    podium.setDepth(3);
    podium.fillStyle(COLORS.coal, 0.92);
    podium.fillRect(878, 574, 104, 62);
    podium.lineStyle(2, COLORS.warning, 0.55);
    podium.strokeRect(878, 574, 104, 62);
    podium.fillStyle(COLORS.rust, 0.7);
    podium.fillRect(878, 574, 104, 5);
    // 近景：垂下来的卷曲面单
    const slips = this.add.graphics();
    slips.setDepth(6);
    for (let i = 0; i < 5; i += 1) {
      const x = 120 + i * 250;
      const length = 96 + (i % 3) * 34;
      slips.fillStyle(i % 2 === 0 ? COLORS.paperDim : COLORS.paper, 0.1);
      slips.fillRect(x, 44, 38, length);
      slips.fillStyle(COLORS.rust, 0.16);
      slips.fillRect(x + 5, 64, 28, 2);
      slips.fillRect(x + 5, 76, 20, 2);
      slips.lineStyle(2, COLORS.coalFaint, 0.5);
      slips.lineBetween(x, 44, x, 140 + length);
      slips.fillStyle(COLORS.paperDark, 0.18);
      slips.fillTriangle(x, 44 + length, x + 38, 44 + length, x + 19, 44 + length + 16);
    }

    for (let i = 0; i < 10; i += 1) {
      const dust = this.add.image(Phaser.Math.Between(40, 1240), Phaser.Math.Between(120, 500), TEX.dust);
      dust.setAlpha(Phaser.Math.FloatBetween(0.08, 0.2));
      dust.setTint(i % 2 === 0 ? COLORS.warning : COLORS.neon);
      this.tweens.add({
        targets: dust,
        y: dust.y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(2600, 6000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
        onRepeat: () => {
          dust.setPosition(Phaser.Math.Between(40, 1240), Phaser.Math.Between(300, 520));
          dust.setAlpha(Phaser.Math.FloatBetween(0.08, 0.2));
        },
      });
    }

    const liveLeft = addHotTag(this, 150, 172, STRINGS.boss.barrageTop, COLORS.warning, -0.035);
    liveLeft.setScrollFactor(0);
    liveLeft.setDepth(95);
    const liveRight = addHotTag(this, 1130, 172, '#发布会文学#', COLORS.neon, 0.03);
    liveRight.setScrollFactor(0);
    liveRight.setDepth(95);
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.player, this.floor);
    this.physics.add.collider(this.bullets, this.floor, (bulletObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        bullet.destroy();
      }
    });
    this.physics.add.collider(this.bossProjectiles, this.floor, (bulletObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        pixelBurst(this, bullet.x, bullet.y, COLORS.rust, 2, 0.5);
        bullet.destroy();
      }
    });
    this.physics.add.overlap(this.bullets, this.boss, (bulletObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      if (!bullet.active || this.boss.isDead() || this.finished) {
        return;
      }
      const damage = Number(bullet.getData('damage') ?? PLAYER.bulletDamage);
      this.boss.takeDamage(damage);
      this.meme.addSmall(MEME.bossHitGain);
      pixelBurst(this, bullet.x, bullet.y, COLORS.warning, 3, 0.6);
      bullet.destroy();
    });
    this.physics.add.overlap(this.bossProjectiles, this.player, (_, projectileObj) => {
      const projectile = projectileObj as Phaser.Physics.Arcade.Image;
      if (!projectile.active || this.finished) {
        return;
      }
      const damage = Number(projectile.getData('damage') ?? BOSS.projectileDamage);
      if (this.player.takeDamage(damage, projectile.x) > 0) {
        this.cameras.main.shake(100, 0.006);
      }
      projectile.destroy();
    });
    this.physics.add.overlap(this.player, this.boss, () => {
      if (this.finished || this.boss.isDead()) {
        return;
      }
      const damage = this.bossDashing ? BOSS.dashDamage : BOSS.contactDamage;
      const actual = this.player.takeDamage(damage, this.boss.x);
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
        if (this.finished || this.transitioning || this.parryActive) {
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

  private setupTouch(): void {
    if (isTouchDevice()) {
      this.touch = new TouchControls(this, this.player);
    }
  }

  private setupAmbient(): void {
    this.time.addEvent({
      delay: 2400,
      loop: true,
      callback: () => {
        if (this.finished || !this.fightStarted) {
          return;
        }
        const text = Phaser.Utils.Array.GetRandom(STRINGS.barrage) as string;
        const x = Phaser.Math.Between(180, GAME_WIDTH - 180);
        const label = this.add.text(x, 230, text, {
          fontFamily: FONTS.body,
          fontSize: `${Phaser.Math.Between(14, 20)}px`,
          color: Math.random() > 0.5 ? CSS.paper : CSS.neon,
          fontStyle: 'bold',
          stroke: CSS.coal,
          strokeThickness: 4,
        });
        label.setOrigin(0.5);
        label.setAlpha(0.5);
        label.setDepth(96);
        this.tweens.add({
          targets: label,
          y: label.y + 130,
          alpha: 0,
          duration: 2500,
          ease: 'Sine.easeIn',
          onComplete: () => label.destroy(),
        });
      },
    });
    this.time.addEvent({
      delay: 3600,
      loop: true,
      callback: () => {
        if (this.finished) {
          return;
        }
        const bar = this.add.graphics();
        bar.setDepth(97);
        bar.fillStyle(Math.random() > 0.5 ? COLORS.rust : COLORS.neon, 0.26);
        bar.fillRect(Phaser.Math.Between(20, 1000), Phaser.Math.Between(180, 430), Phaser.Math.Between(80, 260), Phaser.Math.Between(2, 6));
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
    this.cameras.main.zoomTo(1.3, 520, 'Sine.easeInOut');
    this.cameras.main.pan(BOSS_HOVER_X, 425, 620, 'Sine.easeInOut');
    audio.play('door');

    const world = this.add.container(0, 0);
    world.setDepth(58);
    this.introWorld = world;

    const shade = this.add.graphics();
    shade.fillStyle(COLORS.coal, 0.34);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    world.add(shade);
    const spotlight = this.add.ellipse(BOSS_HOVER_X, 510, 320, 470, COLORS.warning, 0.12);
    spotlight.setBlendMode(Phaser.BlendModes.ADD);
    world.add(spotlight);

    const podium = this.add.graphics();
    podium.fillStyle(COLORS.coal, 0.98);
    podium.fillRect(BOSS_HOVER_X - 104, 430, 208, 236);
    podium.lineStyle(3, COLORS.warning, 0.7);
    podium.strokeRect(BOSS_HOVER_X - 104, 430, 208, 236);
    podium.fillStyle(COLORS.rust, 0.65);
    podium.fillRect(BOSS_HOVER_X - 104, 430, 208, 8);
    podium.fillStyle(COLORS.paperDim, 0.2);
    for (let x = BOSS_HOVER_X - 92; x < BOSS_HOVER_X + 100; x += 26) {
      podium.fillRect(x, 446, 2, 204);
    }
    podium.lineStyle(2, COLORS.coal, 0.7);
    podium.lineBetween(BOSS_HOVER_X - 90, 466, BOSS_HOVER_X + 90, 466);
    world.add(podium);

    const podiumTag = makeTape(this, BOSS_HOVER_X - 6, 620, 142, 26, COLORS.warning);
    podiumTag.setRotation(-0.02);
    world.add(podiumTag);
    const podiumText = this.add.text(BOSS_HOVER_X - 6, 620, '倒扣周转箱', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    podiumText.setOrigin(0.5);
    world.add(podiumText);

    const speakerG = this.add.graphics();
    for (const sx of [BOSS_HOVER_X - 232, BOSS_HOVER_X + 218]) {
      speakerG.fillStyle(COLORS.coal, 0.98);
      speakerG.fillRect(sx - 24, 494, 48, 112);
      speakerG.lineStyle(2, COLORS.warning, 0.45);
      speakerG.strokeRect(sx - 24, 494, 48, 112);
      speakerG.fillStyle(COLORS.paperDim, 0.28);
      speakerG.fillCircle(sx, 524, 12);
      speakerG.fillCircle(sx, 558, 17);
      speakerG.fillStyle(COLORS.rust, 0.7);
      speakerG.fillRect(sx - 18, 584, 36, 4);
    }
    world.add(speakerG);

    const mic = this.add.graphics();
    mic.lineStyle(5, COLORS.paperDim, 0.9);
    mic.lineBetween(BOSS_HOVER_X + 4, 548, BOSS_HOVER_X + 4, 480);
    mic.fillStyle(COLORS.paper, 0.9);
    mic.fillRoundedRect(BOSS_HOVER_X - 10, 462, 28, 24, 7);
    mic.fillStyle(COLORS.rust, 0.9);
    mic.fillRect(BOSS_HOVER_X - 6, 466, 20, 3);
    world.add(mic);

    const bubble = this.add.container(608, 320);
    bubble.setAlpha(0);
    const bubbleBg = this.add.graphics();
    bubbleBg.fillStyle(COLORS.coal, 0.96);
    bubbleBg.fillRect(-216, -78, 432, 156);
    bubbleBg.lineStyle(3, COLORS.warning, 0.9);
    bubbleBg.strokeRect(-216, -78, 432, 156);
    bubbleBg.fillStyle(COLORS.coal, 0.96);
    bubbleBg.fillTriangle(200, -80, 200, 80, 258, 22);
    bubbleBg.lineStyle(3, COLORS.warning, 0.9);
    bubbleBg.lineBetween(200, -78, 258, 22);
    bubbleBg.lineBetween(258, 22, 200, 78);
    const bubbleText = this.add.text(0, 0, STRINGS.boss.cinematic.scannerQuestion, {
      fontFamily: FONTS.display,
      fontSize: '46px',
      color: CSS.paper,
      fontStyle: 'bold',
      align: 'center',
    });
    bubbleText.setOrigin(0.5);
    const bubbleSmall = this.add.text(0, 50, '奶娃指着阿浣腰间的旧扫码枪', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.neon,
    });
    bubbleSmall.setOrigin(0.5);
    bubble.add([bubbleBg, bubbleText, bubbleSmall]);
    world.add(bubble);

    const pointer = this.add.graphics();
    pointer.lineStyle(5, COLORS.warning, 0.85);
    pointer.lineBetween(BOSS_HOVER_X - 180, 452, 520, 486);
    pointer.fillStyle(COLORS.warning, 0.9);
    pointer.fillTriangle(520, 486, 552, 468, 542, 506);
    pointer.setAlpha(0);
    world.add(pointer);

    const flash = this.add.circle(BOSS_HOVER_X - 180, 452, 12, COLORS.warning, 0.8);
    flash.setAlpha(0);
    world.add(flash);

    const introUi = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    introUi.setDepth(445);
    introUi.setScrollFactor(0);
    introUi.setScale(1 / 1.3);
    this.introUi = introUi;
    const halfW = GAME_WIDTH / 2;
    const halfH = GAME_HEIGHT / 2;
    const bars = this.add.graphics();
    bars.fillStyle(COLORS.coal, 0.88);
    bars.fillRect(-halfW, -halfH, GAME_WIDTH, 44);
    bars.fillRect(-halfW, halfH - 52, GAME_WIDTH, 52);
    bars.fillStyle(COLORS.rust, 0.7);
    bars.fillRect(-halfW, -halfH + 44, GAME_WIDTH, 2);
    bars.fillStyle(COLORS.warning, 0.3);
    bars.fillRect(-halfW, halfH - 54, GAME_WIDTH, 2);
    const caption = this.add.text(0, halfH - 24, STRINGS.boss.cinematic.gateLock, {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.paperDim,
      fontStyle: 'bold',
    });
    caption.setOrigin(0.5);
    const skipBg = this.add.graphics();
    skipBg.fillStyle(COLORS.rust, 0.92);
    skipBg.fillRect(halfW - 250, -halfH + 8, 232, 30);
    skipBg.lineStyle(1, COLORS.warning, 0.9);
    skipBg.strokeRect(halfW - 250, -halfH + 8, 232, 30);
    const skipText = this.add.text(halfW - 134, -halfH + 23, STRINGS.boss.cinematic.skip, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    skipText.setOrigin(0.5);

    const projection = this.add.container(GAME_WIDTH / 2, 132);
    projection.setDepth(446);
    projection.setScrollFactor(0);
    projection.setAlpha(0);
    this.introProjection = projection;
    const projG = this.add.graphics();
    projG.fillStyle(COLORS.paper, 0.9);
    projG.fillRect(-280, -48, 560, 96);
    projG.lineStyle(3, COLORS.rust, 0.85);
    projG.strokeRect(-280, -48, 560, 96);
    projG.fillStyle(COLORS.coal, 0.1);
    for (let x = -268; x < 272; x += 18) {
      projG.fillRect(x, -40, 1, 80);
    }
    const projTitle = this.add.text(0, -10, STRINGS.boss.cinematic.screenName, {
      fontFamily: FONTS.display,
      fontSize: '36px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    projTitle.setOrigin(0.5);
    const projSmall = this.add.text(0, 30, 'SCAN OK · 本场唯一合法手机', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS.rust,
      fontStyle: 'bold',
    });
    projSmall.setOrigin(0.5);
    projection.add([projG, projTitle, projSmall]);
    introUi.add([bars, caption, skipBg, skipText]);

    this.introSkipHandler = () => this.finishIntro(true);
    this.input.keyboard?.on('keydown-SPACE', this.introSkipHandler);
    this.input.on('pointerup', this.introSkipHandler);

    const tag = (text: string, x: number, y: number, delay: number, tone: string): void => {
      this.time.delayedCall(delay, () => {
        if (epoch !== this.introEpoch) {
          return;
        }
        audio.play('paper');
        const t = this.add.text(x, y, text, {
          fontFamily: FONTS.display,
          fontSize: '24px',
          color: tone,
          fontStyle: 'bold',
          stroke: CSS.coal,
          strokeThickness: 6,
        });
        t.setOrigin(0.5);
        t.setDepth(72);
        t.setAngle(Phaser.Math.Between(-8, 8));
        this.tweens.add({
          targets: t,
          y: y - 46,
          alpha: 0,
          duration: 760,
          ease: 'Sine.easeOut',
          onComplete: () => t.destroy(),
        });
      });
    };

    this.time.delayedCall(380, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      audio.play('select');
      this.tweens.add({ targets: this.boss, angle: { from: -2, to: 2 }, duration: 90, yoyo: true, repeat: 1 });
    });
    tag(STRINGS.boss.cinematic.mic, BOSS_HOVER_X - 172, 436, 520, CSS.paper);
    this.time.delayedCall(720, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      audio.play('select');
      this.tweens.add({ targets: this.boss, angle: { from: 2, to: -2 }, duration: 90, yoyo: true, repeat: 1 });
    });
    tag(STRINGS.boss.cinematic.mic, BOSS_HOVER_X + 172, 436, 790, CSS.paper);

    this.time.delayedCall(980, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      audio.play('stampThud');
      this.tweens.add({ targets: podium, x: 7, duration: 60, yoyo: true, repeat: 2 });
      addFloatingLine(this, BOSS_HOVER_X, 404, STRINGS.boss.cinematic.crateRattle, COLORS.paperDim, 13, 900);
    });

    this.time.delayedCall(1240, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      this.tweens.add({
        targets: [podium, podiumTag, podiumText],
        y: 154,
        duration: 520,
        ease: 'Sine.easeInOut',
      });
    });

    this.time.delayedCall(1320, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      this.tweens.add({ targets: [bubble, pointer], alpha: 1, duration: 240 });
      audio.play('select');
      flash.setAlpha(0.9);
      this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 380 });
    });

    this.time.delayedCall(2720, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      audio.play('scan');
      caption.setText(STRINGS.boss.cinematic.scan);
      caption.setColor(CSS.neon);
      this.tweens.add({ targets: projection, alpha: 1, y: 138, duration: 220, ease: 'Back.easeOut' });
      addFloatingLine(this, this.player.x + 50, this.player.y - 80, '滴。', COLORS.neon, 30, 900);
    });

    this.time.delayedCall(3060, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      const nameStamp = stamp(this, BOSS_HOVER_X, BOSS_HOVER_Y + 42, STRINGS.boss.cinematic.screenName.split('｜')[0] ?? '甄领先', {
        color: COLORS.rust,
        fontSize: 22,
        angle: 0.08,
        alpha: 0.96,
      });
      nameStamp.setDepth(140);
      nameStamp.setScale(1.8);
      this.tweens.add({
        targets: nameStamp,
        scale: 1,
        y: BOSS_HOVER_Y + 64,
        duration: 180,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (epoch !== this.introEpoch) {
            nameStamp.destroy(true);
            return;
          }
          audio.play('stampThud');
          this.cameras.main.shake(150, 0.008);
          this.tweens.add({ targets: [this.boss], y: BOSS_HOVER_Y + 12, duration: 100, yoyo: true });
          this.tweens.add({ targets: podium, y: 164, duration: 100 });
          pixelBurst(this, BOSS_HOVER_X, BOSS_HOVER_Y + 35, COLORS.warning, 8, 0.8);
          this.time.delayedCall(260, () => {
            if (epoch !== this.introEpoch) {
              return;
            }
            this.tweens.add({
              targets: nameStamp,
              x: GAME_WIDTH - 300,
              y: 64,
              scale: 0.35,
              alpha: 0.15,
              duration: 480,
              ease: 'Cubic.easeIn',
              onComplete: () => nameStamp.destroy(true),
            });
          });
        },
      });
    });

    this.time.delayedCall(3440, () => {
      if (epoch !== this.introEpoch) {
        return;
      }
      caption.setText(STRINGS.boss.cinematic.selfStamp);
      this.cameras.main.zoomTo(1.06, 420, 'Sine.easeInOut');
      this.cameras.main.pan(GAME_WIDTH / 2, 390, 420, 'Sine.easeInOut');
    });

    this.time.delayedCall(BOSS.introMs, () => {
      if (epoch === this.introEpoch) {
        this.finishIntro(false);
      }
    });
  }

  private finishIntro(skipped: boolean): void {
    if (!this.introActive || this.finished) {
      return;
    }
    this.introActive = false;
    this.introEpoch += 1;
    this.registry.set('bossIntroSeen', true);
    if (this.introSkipHandler) {
      this.input.keyboard?.off('keydown-SPACE', this.introSkipHandler);
      this.input.off('pointerup', this.introSkipHandler);
      this.introSkipHandler = null;
    }
    this.introWorld?.destroy(true);
    this.introWorld = null;
    this.introUi?.destroy(true);
    this.introUi = null;
    this.introProjection?.destroy(true);
    this.introProjection = null;
    this.tweens.killTweensOf(this.boss);
    this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
    this.boss.setAngle(0);
    this.cameras.main.zoomTo(1, 320, 'Sine.easeInOut');
    this.cameras.main.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 320, 'Sine.easeInOut');
    this.input.keyboard?.resetKeys();
    this.time.delayedCall(90, () => {
      if (this.finished) {
        return;
      }
      this.hud.setVisible(true);
      if (skipped) {
        this.hud.toast('已跳过登场。', 'paper');
      }
      this.player.setControlEnabled(true);
      this.touch?.setEnabled(true);
      this.startFight();
    });
  }

  private startFight(): void {
    if (this.finished || this.fightStarted) {
      return;
    }
    this.fightStarted = true;
    this.boss.setInvulnerable(0);
    this.nextAttackAt = this.time.now + 900;
    this.nextSpecialAt = this.time.now + BOSS.firstSpecialDelayMs;
    this.hud.toast('认出梗，就能把发布会打回去。', 'neon');
    this.time.delayedCall(650, () => {
      if (this.finished || this.parryActive) {
        return;
      }
      const warning = addHotTag(this, BOSS_HOVER_X - 70, 372, '首招预警 · 盯住讲台右侧', COLORS.warning, -0.02);
      warning.setDepth(97);
      this.tweens.add({
        targets: warning,
        alpha: 0,
        delay: 1100,
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
        this.bossDashing = false;
        this.boss.setVelocity(0, 0);
        this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
        this.nextAttackAt = this.time.now + 1100;
      },
      onDefeated: () => this.handleBossDefeated(),
    };
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
    if (this.ally && this.ally.active) {
      this.ally.destroy();
    }
    this.ally = new Ally(
      this,
      this.player,
      durationMs,
      () => !this.boss.isDead(),
      (x, y) => this.fireAllyShot(x, y),
    );
    return true;
  }

  private freezeBoss(durationMs: number): boolean {
    if (this.finished || this.boss.isDead()) {
      return false;
    }
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.bossDashing = false;
    this.boss.setVelocity(0, 0);
    this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
    this.boss.setStagger(durationMs);
    this.hud.toast(STRINGS.boss.staggerLine, 'neon');
    return true;
  }

  private doScreenClear(): number {
    let cleared = 0;
    this.bossProjectiles.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        bullet.destroy();
        cleared += 1;
      }
    });
    if (!this.boss.isDead()) {
      this.boss.takeDamage(CARD.screenClearDamage);
    }
    this.cameras.main.flash(160, 75, 227, 200, false);
    return cleared;
  }

  private performAttack(time: number): void {
    if (!this.fightStarted || this.finished) {
      return;
    }
    const phase = this.boss.getPhaseConfig();
    this.nextAttackAt = time + phase.attackIntervalMs;
    const pool = phase.attackPool.filter((attack) => attack !== this.lastAttack);
    const options = pool.length > 0 ? pool : phase.attackPool;
    const attack = options[Math.floor(Math.random() * options.length)] ?? 'aimed_shots';
    this.lastAttack = attack;
    switch (attack) {
      case 'aimed_shots':
        this.attackAimedShots();
        break;
      case 'data_rain':
        this.attackDataRain();
        break;
      case 'dash_combo':
        this.attackDashCombo(false);
        break;
      case 'red_carpet_dash':
        this.attackDashCombo(true);
        break;
      default:
        break;
    }
  }

  private pickTaunt(): string {
    const taunts = this.boss.config.taunts;
    return taunts[Math.floor(Math.random() * taunts.length)] ?? '遥遥领先！';
  }

  private attackAimedShots(): void {
    this.attackBusy = true;
    const epoch = this.attackEpoch;
    this.boss.setTint(COLORS.warning);
    addFloatingLine(this, this.boss.x, this.boss.y - 128, this.pickTaunt(), COLORS.warning, 18, 1000);
    this.time.delayedCall(BOSS.aimTelegraphMs, () => {
      if (this.finished || this.boss.isDead() || epoch !== this.attackEpoch) {
        this.attackBusy = false;
        return;
      }
      this.boss.clearTint();
      const baseAngle = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
      for (let i = 0; i < BOSS.aimedShots; i += 1) {
        const offset = (i - (BOSS.aimedShots - 1) / 2) * BOSS.aimedSpreadRad;
        const angle = baseAngle + offset;
        this.spawnBossOrb(
          this.boss.x,
          this.boss.y,
          Math.cos(angle) * BOSS.projectileSpeed,
          Math.sin(angle) * BOSS.projectileSpeed,
        );
      }
      audio.play('shoot');
      this.cameras.main.shake(80, 0.003);
      this.attackBusy = false;
    });
  }

  private attackDataRain(): void {
    this.attackBusy = true;
    const epoch = this.attackEpoch;
    this.boss.setTint(COLORS.neon);
    addFloatingLine(this, this.boss.x, this.boss.y - 128, '跑分数据：请求过多！', COLORS.neon, 18, 1100);
    for (let i = 0; i < BOSS.rainCount; i += 1) {
      this.time.delayedCall(i * BOSS.rainSpawnIntervalMs, () => {
        if (this.finished || this.boss.isDead() || epoch !== this.attackEpoch) {
          return;
        }
        const x = Phaser.Math.Between(150, GAME_WIDTH - 150);
        const warning = this.add.text(x, 560, '↓ 弹幕预警', {
          fontFamily: FONTS.mono,
          fontSize: '10px',
          color: CSS.warning,
          fontStyle: 'bold',
        });
        warning.setOrigin(0.5);
        warning.setDepth(21);
        this.tweens.add({ targets: warning, alpha: 0, duration: 520, onComplete: () => warning.destroy() });
        this.time.delayedCall(260, () => {
          if (this.finished || this.boss.isDead() || epoch !== this.attackEpoch) {
            return;
          }
          this.spawnBossOrb(x, 90, Phaser.Math.Between(-30, 30), Phaser.Math.Between(280, 360));
        });
      });
    }
    this.time.delayedCall(BOSS.rainCount * BOSS.rainSpawnIntervalMs + 700, () => {
      if (epoch === this.attackEpoch && !this.finished && !this.boss.isDead()) {
        this.boss.clearTint();
        this.attackBusy = false;
      }
    });
  }

  private attackDashCombo(redCarpet: boolean): void {
    if (this.finished) {
      return;
    }
    this.attackBusy = true;
    this.attackEpoch += 1;
    const epoch = this.attackEpoch;
    this.lastAttack = redCarpet ? 'red_carpet_dash' : 'dash_combo';
    this.boss.setTint(redCarpet ? COLORS.rust : COLORS.warning);
    addFloatingLine(
      this,
      this.boss.x,
      this.boss.y - 128,
      redCarpet ? '红毯已经铺好，你走不掉了！' : '三连残影冲刺！',
      redCarpet ? COLORS.rust : COLORS.warning,
      19,
      1100,
    );
    if (redCarpet) {
      const carpet = this.add.graphics();
      carpet.setDepth(5);
      carpet.fillStyle(COLORS.rust, 0.28);
      carpet.fillRect(180, 560, 920, 76);
      carpet.lineStyle(2, COLORS.warning, 0.35);
      carpet.strokeRect(180, 560, 920, 76);
      this.tweens.add({ targets: carpet, alpha: 0, duration: 2800, onComplete: () => carpet.destroy() });
      for (let i = 0; i < 4; i += 1) {
        this.time.delayedCall(500 + i * 380, () => {
          if (epoch !== this.attackEpoch || this.finished) {
            return;
          }
          const x = Phaser.Math.Between(220, 1060);
          this.spawnBossOrb(x, 620, Phaser.Math.Between(-20, 20), -Phaser.Math.Between(220, 300));
        });
      }
    }

    this.time.delayedCall(360, () => {
      if (epoch !== this.attackEpoch || this.finished || this.boss.isDead()) {
        this.attackBusy = false;
        return;
      }
      this.performDashSeries(redCarpet ? 2 : BOSS.dashCount, epoch, redCarpet);
    });
  }

  private performDashSeries(count: number, epoch: number, redCarpet: boolean): void {
    if (this.finished || epoch !== this.attackEpoch || this.boss.isDead()) {
      this.finishDashSeries();
      return;
    }
    const startX = this.player.x > GAME_WIDTH / 2 ? 240 : GAME_WIDTH - 240;
    this.boss.setPosition(startX, DASH_Y);
    this.spawnAfterimage();

    const dashStep = (remaining: number): void => {
      if (this.finished || epoch !== this.attackEpoch || this.boss.isDead()) {
        this.finishDashSeries();
        return;
      }
      if (this.boss.isStaggered(this.time.now)) {
        this.finishDashSeries();
        return;
      }
      const direction = this.player.x >= this.boss.x ? 1 : -1;
      this.boss.setVelocityX(direction * BOSS.dashSpeed);
      this.bossDashing = true;
      this.boss.setAngle(this.boss.angle + direction * 5);
      this.spawnAfterimage();
      this.time.delayedCall(400, () => {
        if (epoch !== this.attackEpoch || this.finished) {
          return;
        }
        this.boss.setVelocityX(0);
        this.bossDashing = false;
        this.cameras.main.shake(100, 0.006);
        this.spawnAfterimage();
        if (remaining > 1) {
          this.time.delayedCall(BOSS.dashPauseMs, () => {
            if (this.finished || epoch !== this.attackEpoch || this.boss.isDead()) {
              this.finishDashSeries();
              return;
            }
            const nextStart = this.player.x > GAME_WIDTH / 2 ? 160 : GAME_WIDTH - 160;
            this.boss.setPosition(nextStart, DASH_Y);
            this.spawnAfterimage();
            dashStep(remaining - 1);
          });
        } else {
          this.time.delayedCall(redCarpet ? 420 : 260, () => this.finishDashSeries());
        }
      });
    };
    dashStep(count);
  }

  private finishDashSeries(): void {
    this.attackBusy = false;
    this.bossDashing = false;
    if (!this.boss.isDead() && this.boss.active) {
      this.boss.setVelocity(0, 0);
      this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
      this.boss.clearTint();
    }
  }

  private spawnAfterimage(): void {
    if (this.boss.isDead()) {
      return;
    }
    const ghost = this.add.image(this.boss.x, this.boss.y, TEX.bossGlitch);
    ghost.setDepth(22);
    ghost.setTint(COLORS.neon);
    ghost.setAlpha(0.32);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      x: ghost.x - 34,
      duration: 280,
      onComplete: () => ghost.destroy(),
    });
  }

  private spawnBossOrb(x: number, y: number, vx: number, vy: number): void {
    const projectile = this.bossProjectiles.create(x, y, TEX.orb) as Phaser.Physics.Arcade.Image;
    projectile.setDepth(21);
    projectile.setScale(Phaser.Math.FloatBetween(0.9, 1.2));
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(14, 14);
    projectile.setVelocity(vx, vy);
    projectile.setData('damage', BOSS.projectileDamage);
    projectile.setData('expireAt', this.time.now + 5000);
    projectile.setData('spin', Phaser.Math.FloatBetween(-4, 4));
  }

  private startParry(): void {
    if (this.finished || this.parryActive || this.parryUsedThisPhase || this.boss.isDead()) {
      return;
    }
    this.parryUsedThisPhase = true;
    this.parryActive = true;
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.bossDashing = false;
    this.clearBossProjectiles();
    this.boss.setVelocity(0, 0);
    this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
    this.boss.setTint(COLORS.neon);
    this.pendingCardId = null;
    const phase = this.boss.getPhaseConfig();
    const special = phase.special ?? null;
    this.showSpecialTag(special);
    audio.play('stagger');
    if (special === 'radish_stamping') {
      this.performRadishSpecial(phase);
    } else if (special === 'auto_signing') {
      this.performSigningSpecial(phase);
    } else {
      this.openParryQuiz(phase);
    }
  }

  private showSpecialTag(special: BossSpecialId | null): void {
    const label =
      special === 'radish_stamping'
        ? '特殊招式 · 新品自动分类'
        : special === 'auto_signing'
          ? '特殊招式 · 全自动签收'
          : STRINGS.boss.specialPrompt;
    const specialTag = addHotTag(this, this.boss.x, this.boss.y - 170, label, COLORS.rust, -0.02);
    specialTag.setDepth(97);
    this.tweens.add({
      targets: specialTag,
      alpha: 0,
      delay: 1200,
      duration: 380,
      onComplete: () => specialTag.destroy(),
    });
  }

  /** 认梗弹反答题层：演出结束后打开，逻辑与旧版一致，仅把答对的演出外挂出去。 */
  private openParryQuiz(phase: BossPhase): void {
    const prepared = this.quizSystem.prepareParry(phase.parryQuestionId);
    this.quizOverlay = new QuizOverlay(this, {
      mode: 'parry',
      prepared,
      windowMs: QUIZ.parryWindowMs,
      onResolve: (result) => {
        if (this.finished) {
          return;
        }
        if (result.correct) {
          this.run.stats.correct += 1;
          this.run.stats.parries += 1;
          const memeResult = this.meme.addCorrect(MEME.bossCorrect);
          if (memeResult.burstStarted) {
            audio.play('burst');
            this.hud.toast(STRINGS.toasts.burst, 'neon');
          }
          this.pendingCardId = prepared.question.cardId;
          this.playSpecialSuccessFx(phase.special ?? null);
          this.boss.takeDamage(BOSS.reflectDamage);
          this.boss.setStagger(phase.staggerMs);
          this.clearBossProjectiles();
          this.cameras.main.flash(220, 255, 247, 228, false);
          this.cameras.main.shake(230, 0.016);
          this.physics.world.pause();
          this.time.delayedCall(COMBAT.hitstopHeavyMs, () => this.physics.world.resume());
          damagePopup(this, this.boss.x, this.boss.y - 90, `-${BOSS.reflectDamage}`, COLORS.neon, 36);
          this.spawnParryBurst();
          this.hud.toast(STRINGS.quiz.parrySuccess, 'neon');
        } else {
          if (result.timedOut) {
            this.run.stats.timeouts += 1;
          } else {
            this.run.stats.wrong += 1;
          }
          this.meme.registerWrong();
          this.pendingReason = '认梗失误，被热搜吞没';
          const actual = this.player.takeDamage(BOSS.quizFailDamage, this.boss.x, true);
          if (actual > 0) {
            this.cameras.main.shake(160, 0.01);
          }
          this.hud.toast(STRINGS.quiz.parryFail, 'rust');
          this.pendingReason = '网络热度归零';
        }
      },
      onClose: () => {
        this.quizOverlay = null;
        this.parryActive = false;
        this.clearSpecialStage(600);
        if (this.finished) {
          return;
        }
        if (!this.boss.isStaggered(this.time.now)) {
          this.boss.clearTint();
        }
        this.boss.setVelocity(0, 0);
        this.nextSpecialAt = this.time.now + BOSS.specialCooldownMs;
        this.nextAttackAt = this.time.now + 1000;
        if (this.pendingCardId) {
          this.cards.acquire(this.pendingCardId);
          this.pendingCardId = null;
        }
        if (this.pendingPhase) {
          const phase = this.pendingPhase;
          this.pendingPhase = null;
          this.showPhaseBanner(phase);
        }
      },
    });
  }

  /**
   * 「萝卜盖章 · 又是类魂」三拍演出的前两拍：看懂笑点 → 作出判断。
   * 全程原创像素绘制：浇水机器人、白萝卜、巨章。答题层打开前给足阅读时间。
   */
  private performRadishSpecial(phase: BossPhase): void {
    const epoch = this.specialEpoch;
    const dim = this.add.container(0, 0);
    dim.setDepth(STAGE_DIM_DEPTH);
    const dimRect = this.add.graphics();
    dimRect.fillStyle(COLORS.coal, 0.52);
    dimRect.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dimRect.setAlpha(0);
    dim.add(dimRect);
    const spotlight = this.add.ellipse(STAGE_RADISH_X + 8, 560, 340, 160, COLORS.warning, 0.07);
    dim.add(spotlight);
    this.specialDim = dim;
    this.boss.clearTint();
    this.tweens.add({ targets: dimRect, alpha: 1, duration: 260, ease: 'Sine.easeOut' });

    const props = this.add.container(0, 0);
    props.setDepth(STAGE_PROP_DEPTH);
    this.specialProps = props;

    // 构图：把阿浣请到画面左侧，短暂锁控。
    this.lockPlayerForStage(300);
    addFloatingLine(this, this.boss.x, this.boss.y - 128, '新品演示：全自动分类！', COLORS.warning, 18, 1700);

    // 第一拍·看懂笑点：萝卜登场 → 机器人浇水 → 开花 → 巨章盖「类魂」→ 巨幕飘字。
    const radish = this.buildRadish();
    radish.setPosition(STAGE_RADISH_X, STAGE_GROUND_Y);
    radish.setScale(0.25);
    radish.setAlpha(0);
    props.add(radish);

    const robot = this.buildWaterRobot();
    robot.setPosition(STAGE_RADISH_X - 190, STAGE_GROUND_Y);
    props.add(robot);
    this.specialRobot = robot;

    const stampView = this.buildStageStamp('类魂');
    stampView.setPosition(STAGE_RADISH_X, 210);
    props.add(stampView);
    this.specialStampView = stampView;

    this.time.delayedCall(320, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      audio.play('paper');
      this.tweens.add({ targets: radish, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    });

    this.time.delayedCall(760, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      audio.play('select');
      this.tweens.add({ targets: robot, x: STAGE_RADISH_X - 78, duration: 420, ease: 'Sine.easeOut' });
    });

    this.time.delayedCall(1220, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      audio.play('spray');
      this.tweens.add({ targets: robot, angle: { from: 0, to: -14 }, duration: 190, yoyo: true, repeat: 2 });
      for (let i = 0; i < 7; i += 1) {
        this.time.delayedCall(i * 90, () => {
          if (epoch !== this.specialEpoch) {
            return;
          }
          const drop = this.add.circle(STAGE_RADISH_X - 44 + Phaser.Math.Between(-6, 8), 540, 3, COLORS.neon, 0.9);
          drop.setDepth(STAGE_PROP_DEPTH + 1);
          this.tweens.add({ targets: drop, y: STAGE_GROUND_Y - 34, duration: 200, onComplete: () => drop.destroy() });
        });
      }
    });

    this.time.delayedCall(1880, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      this.tweens.add({ targets: radish, scale: 1.3, duration: 280, ease: 'Back.easeOut' });
      pixelBurst(this, STAGE_RADISH_X, 570, COLORS.warning, 8, 0.9);
      addFloatingLine(this, STAGE_RADISH_X, 528, '萝卜开花了！', COLORS.paper, 15, 950);
    });

    this.time.delayedCall(2300, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      this.tweens.add({ targets: stampView, y: 572, duration: 430, ease: 'Cubic.easeIn' });
    });

    this.time.delayedCall(2730, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      audio.play('stampThud');
      this.cameras.main.shake(110, 0.006);
      pixelBurst(this, STAGE_RADISH_X, 584, COLORS.paper, 7, 0.8);
      this.tweens.add({ targets: radish, scaleX: 1.18, scaleY: 0.88, duration: 90, yoyo: true });
    });

    this.time.delayedCall(3010, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      const banner = glitchText(this, -180, 250, '又是类魂', {
        fontFamily: FONTS.display,
        fontSize: '46px',
        color: CSS.warning,
        fontStyle: 'bold',
      });
      banner.setDepth(STAGE_PROP_DEPTH + 3);
      this.tweens.add({
        targets: banner,
        x: GAME_WIDTH + 180,
        duration: 1650,
        ease: 'Linear',
        onComplete: () => banner.destroy(),
      });
    });

    // 第二拍·作出判断：章口转向阿浣，萝卜身上的「类魂」标签保留可读。
    this.time.delayedCall(3260, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      const label = stamp(this, STAGE_RADISH_X, 566, '类魂', {
        color: COLORS.rust,
        fontSize: 20,
        angle: -0.1,
        alpha: 0.95,
      });
      label.setScale(0.2);
      this.tweens.add({ targets: label, scale: 1, duration: 180, ease: 'Back.easeOut' });
      props.add(label);
      const targetX = Phaser.Math.Clamp(this.player.x, 220, 460);
      this.tweens.add({
        targets: stampView,
        x: targetX,
        y: 322,
        angle: -16,
        duration: 480,
        ease: 'Cubic.easeInOut',
      });
    });

    this.time.delayedCall(3880, () => {
      if (epoch !== this.specialEpoch || this.finished) {
        return;
      }
      this.releasePlayerFromStage();
      this.openParryQuiz(phase);
    });
  }

  /** 第二拍的反向演出：签收联挡住前两枚章，第三枚弹回围兜。 */
  private performSigningSpecial(phase: BossPhase): void {
    const epoch = this.specialEpoch;
    const dim = this.add.container(0, 0);
    dim.setDepth(STAGE_DIM_DEPTH);
    const dimRect = this.add.graphics();
    dimRect.fillStyle(COLORS.coal, 0.5);
    dimRect.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dimRect.setAlpha(0);
    dim.add(dimRect);
    const spotlight = this.add.ellipse(STAGE_RADISH_X, 470, 430, 300, COLORS.warning, 0.08);
    dim.add(spotlight);
    this.specialDim = dim;
    this.boss.clearTint();
    this.tweens.add({ targets: dimRect, alpha: 1, duration: 240, ease: 'Sine.easeOut' });

    const props = this.add.container(0, 0);
    props.setDepth(STAGE_PROP_DEPTH);
    this.specialProps = props;
    this.lockPlayerForStage(300);
    addFloatingLine(this, this.boss.x - 30, this.boss.y - 140, STRINGS.boss.cinematic.signingAnnounce, COLORS.warning, 19, 1900);

    const receipt = this.add.container(STAGE_RADISH_X, 486);
    const rg = this.add.graphics();
    rg.fillStyle(COLORS.coal, 0.96);
    rg.fillRect(-182, -118, 364, 236);
    rg.fillStyle(COLORS.paper, 1);
    rg.fillRect(-174, -110, 348, 220);
    rg.lineStyle(3, COLORS.rust, 0.86);
    rg.strokeRect(-174, -110, 348, 220);
    rg.fillStyle(COLORS.warning, 0.85);
    rg.fillRect(-174, -110, 348, 20);
    rg.fillStyle(COLORS.paperDim, 0.6);
    for (let y = -70; y < 88; y += 28) {
      rg.fillRect(-150, y, 300, 1);
    }
    rg.fillStyle(COLORS.coal, 0.5);
    for (let x = -146; x < 140; x += 12) {
      rg.fillRect(x, 80, 4, 10);
    }
    const receiptHeader = this.add.text(0, -100, '代 签 单 · 回 收', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: CSS.coal,
      fontStyle: 'bold',
    });
    receiptHeader.setOrigin(0.5);
    const lines = [
      '收件人　甄领先',
      '代签人　甄建国',
      '与收件人关系　父',
    ];
    const lineTexts = lines.map((line, i) => {
      const txt = this.add.text(-146, -56 + i * 38, line, {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: CSS.coal,
        fontStyle: 'bold',
      });
      txt.setOrigin(0, 0.5);
      return txt;
    });
    receipt.add([rg, receiptHeader, ...lineTexts]);
    receipt.setScale(0.1, 1);
    receipt.setAlpha(0);
    props.add(receipt);
    this.specialReceipt = receipt;

    this.time.delayedCall(260, () => {
      if (epoch !== this.specialEpoch) {
        return;
      }
      audio.play('paper');
      this.tweens.add({ targets: receipt, scaleX: 1, alpha: 1, duration: 620, ease: 'Back.easeOut' });
    });

    const stampViews: Phaser.GameObjects.Container[] = [];
    [470, 640, 810].forEach((x, index) => {
      const s = this.buildStageStamp(STRINGS.boss.cinematic.signingDone);
      s.setPosition(x, 180 - index * 16);
      s.setScale(0.2);
      s.setAlpha(0);
      props.add(s);
      stampViews.push(s);
      this.time.delayedCall(980 + index * 260, () => {
        if (epoch !== this.specialEpoch) {
          return;
        }
        audio.play('stampThud');
        this.tweens.add({ targets: s, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      });
    });
    this.specialStamps = stampViews;
    this.specialStampView = stampViews[2] ?? null;

    this.time.delayedCall(2920, () => {
      if (epoch !== this.specialEpoch || this.finished) {
        return;
      }
      this.releasePlayerFromStage();
      this.openParryQuiz(phase);
    });
  }

  private playSigningCounterFx(): void {
    audio.play('scan');
    const receipt = this.specialReceipt;
    const stamps = this.specialStamps;
    if (receipt && receipt.active) {
      this.tweens.add({ targets: receipt, scaleX: 1.18, scaleY: 1.06, duration: 170, yoyo: true });
    }
    this.spawnTailWhip(this.boss.x - 10, this.boss.y + 20);
    const first = stamps[0];
    const second = stamps[1];
    const third = stamps[2];
    if (first?.active) {
      this.tweens.add({ targets: first, x: 600, y: 500, angle: -12, alpha: 0, duration: 260, ease: 'Cubic.easeIn', onComplete: () => first.destroy(true) });
    }
    if (second?.active) {
      this.tweens.add({ targets: second, x: 680, y: 500, angle: 10, alpha: 0, duration: 300, ease: 'Cubic.easeIn', onComplete: () => second.destroy(true) });
    }
    if (third?.active) {
      this.tweens.add({
        targets: third,
        x: BOSS_HOVER_X,
        y: BOSS_HOVER_Y + 10,
        scale: 0.72,
        angle: 8,
        duration: 360,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          audio.play('stampThud');
          this.cameras.main.shake(120, 0.008);
          pixelBurst(this, BOSS_HOVER_X, BOSS_HOVER_Y + 8, COLORS.warning, 9, 0.8);
          const bib = stamp(this, BOSS_HOVER_X, BOSS_HOVER_Y + 12, STRINGS.boss.cinematic.signingDone, {
            color: COLORS.rust,
            fontSize: 21,
            angle: 0.08,
            alpha: 0.96,
          });
          bib.setDepth(142);
          bib.setScale(1.7);
          this.tweens.add({ targets: bib, scale: 1, duration: 180, ease: 'Back.easeOut' });
          third.destroy(true);
          this.time.delayedCall(2600, () => {
            this.tweens.add({ targets: bib, alpha: 0, duration: 360, onComplete: () => bib.destroy(true) });
          });
        },
      });
    }
  }

  private spawnTailWhip(targetX: number, targetY: number): void {
    const tail = this.add.graphics();
    tail.setDepth(141);
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(this.player.x + 26, this.player.y - 4),
      new Phaser.Math.Vector2(this.player.x + 120, this.player.y - 190),
      new Phaser.Math.Vector2(targetX, targetY),
    );
    const points = curve.getPoints(18);
    tail.lineStyle(9, COLORS.paper, 0.96);
    tail.strokePoints(points);
    tail.lineStyle(3, COLORS.rust, 0.8);
    tail.strokePoints(points);
    audio.play('paper');
    this.tweens.add({ targets: tail, alpha: 0, duration: 360, onComplete: () => tail.destroy() });
  }

  /** 答对后的第三拍·享受反击：印章飞回 Boss 额头，机器人把他认成“待浇水作物”。 */
  private playRadishCounterFx(): void {
    audio.play('scan');
    const stampView = this.specialStampView;
    if (stampView && stampView.active) {
      this.tweens.add({
        targets: stampView,
        x: this.boss.x,
        y: this.boss.y + 6,
        angle: -8,
        duration: 240,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (!stampView.active) {
            return;
          }
          audio.play('stampThud');
          pixelBurst(this, this.boss.x, this.boss.y + 4, COLORS.warning, 8, 0.9);
        },
      });
    }
    this.spawnTailWhip(this.boss.x - 20, this.boss.y + 14);

    const bibLabel = stamp(this, BOSS_HOVER_X, BOSS_HOVER_Y + 10, '类魂', {
      color: COLORS.rust,
      fontSize: 22,
      angle: -0.1,
      alpha: 0.95,
    });
    bibLabel.setDepth(142);
    bibLabel.setScale(1.8);
    this.tweens.add({ targets: bibLabel, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.time.delayedCall(2000, () => {
      if (!bibLabel.active) {
        return;
      }
      addFloatingLine(this, this.boss.x, this.boss.y + 38, '（悄悄揭掉）', COLORS.paperDim, 13, 850);
      this.tweens.add({
        targets: bibLabel,
        x: BOSS_HOVER_X + 70,
        y: BOSS_HOVER_Y + 48,
        alpha: 0,
        scale: 0.55,
        duration: 520,
        onComplete: () => bibLabel.destroy(true),
      });
    });

    const robot = this.specialRobot;
    if (robot && robot.active) {
      this.tweens.add({ targets: robot, x: this.boss.x - 130, duration: 640, ease: 'Sine.easeInOut' });
      this.time.delayedCall(660, () => {
        if (!robot.active) {
          return;
        }
        audio.play('spray');
        this.tweens.add({ targets: robot, angle: { from: 0, to: -18 }, duration: 200, yoyo: true, repeat: 2 });
        for (let i = 0; i < 6; i += 1) {
          this.time.delayedCall(i * 80, () => {
            if (!robot.active) {
              return;
            }
            const drop = this.add.circle(this.boss.x - 70 + Phaser.Math.Between(-8, 8), this.boss.y - 92, 3, COLORS.neon, 0.9);
            drop.setDepth(STAGE_PROP_DEPTH + 1);
            this.tweens.add({ targets: drop, y: this.boss.y + 26, duration: 240, onComplete: () => drop.destroy() });
          });
        }
        addFloatingLine(this, this.boss.x, this.boss.y - 152, '识别失败：待浇水作物', COLORS.neon, 16, 1500);
      });
    }
  }

  private playSpecialSuccessFx(special: BossSpecialId | null): void {
    if (special === 'radish_stamping') {
      this.playRadishCounterFx();
    } else if (special === 'auto_signing') {
      this.playSigningCounterFx();
    }
  }

  /** 演出期短暂锁控并把阿浣请到舞台左侧（目标构图）。 */
  private lockPlayerForStage(targetX: number): void {
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.player.setFlipX(false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (Math.abs(this.player.x - targetX) > 30) {
      body.enable = false;
      this.tweens.add({ targets: this.player, x: targetX, duration: 620, ease: 'Sine.easeInOut' });
      this.time.delayedCall(650, () => {
        body.enable = true;
        if (this.player.active) {
          this.player.setVelocity(0, 0);
        }
      });
    }
  }

  private releasePlayerFromStage(): void {
    if (this.finished) {
      return;
    }
    this.player.setControlEnabled(true);
    this.touch?.setEnabled(true);
  }

  /** 收掉舞台演出层；fadeMs 为 0 时立刻销毁。 */
  private clearSpecialStage(fadeMs: number): void {
    this.specialEpoch += 1;
    const dim = this.specialDim;
    const props = this.specialProps;
    this.specialDim = null;
    this.specialProps = null;
    this.specialStampView = null;
    this.specialRobot = null;
    this.specialReceipt = null;
    this.specialStamps = [];
    if (fadeMs <= 0) {
      dim?.destroy(true);
      props?.destroy(true);
      return;
    }
    if (dim) {
      this.tweens.add({ targets: dim, alpha: 0, duration: fadeMs, onComplete: () => dim.destroy(true) });
    }
    if (props) {
      this.tweens.add({ targets: props, alpha: 0, duration: fadeMs, onComplete: () => props.destroy(true) });
    }
  }

  /** 白萝卜：原创像素绘制，坐标原点在根部（箱顶）。 */
  private buildRadish(): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0);
    const g = this.add.graphics();
    // 种植箱
    g.fillStyle(COLORS.coal, 1);
    g.fillRect(-32, -22, 64, 22);
    g.fillStyle(COLORS.warning, 0.85);
    g.fillRect(-32, -22, 64, 4);
    g.lineStyle(2, COLORS.coalFaint, 0.8);
    g.strokeRect(-32, -22, 64, 22);
    // 萝卜身（米白）
    g.fillStyle(COLORS.white, 1);
    g.fillEllipse(0, -52, 34, 44);
    g.fillTriangle(-13, -42, 13, -42, 0, -24);
    // 阴影条纹
    g.fillStyle(COLORS.paperDim, 0.7);
    g.fillRect(-10, -62, 4, 22);
    g.fillRect(3, -58, 3, 16);
    // 叶子（嫩绿）
    g.fillStyle(COLORS.glitch, 1);
    g.fillTriangle(-4, -72, -22, -92, -2, -74);
    g.fillTriangle(0, -74, 6, -98, 5, -72);
    g.fillTriangle(4, -72, 24, -88, 7, -70);
    g.fillStyle(COLORS.coal, 0.35);
    g.fillRect(-1, -74, 2, 8);
    root.add(g);
    return root;
  }

  /** 浇水机器人：原创像素绘制，坐标原点在轮子着地点。 */
  private buildWaterRobot(): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0);
    const g = this.add.graphics();
    // 轮子
    g.fillStyle(COLORS.coal, 1);
    g.fillCircle(0, -8, 9);
    g.fillStyle(COLORS.paperDim, 0.9);
    g.fillCircle(0, -8, 3);
    // 身体
    g.fillStyle(COLORS.coalSoft, 1);
    g.fillRect(-20, -46, 40, 34);
    g.lineStyle(2, COLORS.coal, 1);
    g.strokeRect(-20, -46, 40, 34);
    // 胸口指示灯
    g.fillStyle(COLORS.warning, 0.95);
    g.fillRect(-14, -40, 28, 6);
    // 眼睛
    g.fillStyle(COLORS.neon, 1);
    g.fillRect(4, -36, 8, 6);
    // 水壶嘴（朝右上方）
    g.fillStyle(COLORS.paper, 1);
    g.fillRect(14, -44, 22, 6);
    g.fillStyle(COLORS.paperDim, 1);
    g.fillTriangle(36, -44, 44, -52, 36, -38);
    root.add(g);
    return root;
  }

  /** 巨章：原创像素绘制，章面写大字，落章可读。 */
  private buildStageStamp(text: string): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0);
    const g = this.add.graphics();
    // 握柄
    g.fillStyle(COLORS.coalFaint, 1);
    g.fillRect(-7, -58, 14, 26);
    g.fillRect(-22, -38, 44, 10);
    // 章体
    g.fillStyle(COLORS.rustDark, 1);
    g.fillRect(-56, -18, 112, 34);
    g.lineStyle(3, COLORS.coal, 1);
    g.strokeRect(-56, -18, 112, 34);
    // 章面
    g.fillStyle(COLORS.rust, 1);
    g.fillRect(-50, -13, 100, 24);
    root.add(g);
    const label = this.add.text(0, -1, text, {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: CSS.white,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    root.add(label);
    return root;
  }

  private spawnParryBurst(): void {
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      const image = this.add.image(this.boss.x, this.boss.y, TEX.spark);
      image.setTint(i % 3 === 0 ? COLORS.neon : i % 3 === 1 ? COLORS.warning : COLORS.paper);
      image.setDepth(120);
      this.tweens.add({
        targets: image,
        x: this.boss.x + Math.cos(angle) * Phaser.Math.Between(90, 220),
        y: this.boss.y + Math.sin(angle) * Phaser.Math.Between(60, 160),
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(360, 620),
        ease: 'Cubic.easeOut',
        onComplete: () => image.destroy(),
      });
    }
    const burstText = glitchText(this, this.boss.x, this.boss.y - 150, '梗已反弹！', {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: CSS.neon,
      fontStyle: 'bold',
    });
    burstText.setDepth(121);
    this.tweens.add({ targets: burstText, alpha: 0, y: burstText.y - 60, delay: 800, duration: 400, onComplete: () => burstText.destroy() });
    for (let i = 0; i < 5; i += 1) {
      const tag = addHotTag(
        this,
        Phaser.Math.Between(260, 1020),
        Phaser.Math.Between(250, 380),
        STRINGS.barrage[i % STRINGS.barrage.length] ?? '？',
        i % 2 === 0 ? COLORS.warning : COLORS.neon,
        (Math.random() - 0.5) * 0.1,
      );
      tag.setDepth(121);
      this.tweens.add({ targets: tag, alpha: 0, y: tag.y - 50, duration: 900, delay: 500, onComplete: () => tag.destroy() });
    }
  }

  private clearBossProjectiles(): void {
    this.bossProjectiles.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active) {
        bullet.destroy();
      }
    });
  }

  private handlePhaseReached(phase: BossPhase): void {
    if (this.finished) {
      return;
    }
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.bossDashing = false;
    this.boss.setVelocity(0, 0);
    this.boss.setPosition(BOSS_HOVER_X, BOSS_HOVER_Y);
    this.clearBossProjectiles();
    this.parryUsedThisPhase = false;
    this.boss.setInvulnerable(BOSS.phaseBannerMs + 300);
    this.nextAttackAt = this.time.now + 1700;
    this.nextSpecialAt = this.time.now + 1900;
    if (this.parryActive) {
      this.pendingPhase = phase;
      return;
    }
    this.showPhaseBanner(phase);
  }

  private showPhaseBanner(phase: BossPhase): void {
    if (this.finished) {
      return;
    }
    const root = this.add.container(GAME_WIDTH / 2, 300);
    root.setScrollFactor(0);
    root.setDepth(440);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.92);
    g.fillRect(-420, -74, 840, 148);
    g.lineStyle(3, COLORS.warning, 0.8);
    g.strokeRect(-420, -74, 840, 148);
    g.fillStyle(COLORS.rust, 0.9);
    g.fillRect(-420, -74, 8, 148);
    const title = glitchText(this, 0, -26, `${STRINGS.boss.phaseBannerPrefix} ${phase.phase} ${STRINGS.boss.phaseBannerSuffix} · ${phase.label}`, {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    const taunt = this.add.text(0, 26, this.pickTaunt(), {
      fontFamily: FONTS.body,
      fontSize: '15px',
      color: CSS.warning,
    });
    taunt.setOrigin(0.5);
    root.add([g, title, taunt]);
    audio.play('stagger');
    this.cameras.main.shake(180, 0.008);
    this.tweens.add({
      targets: root,
      alpha: 0,
      y: 280,
      delay: BOSS.phaseBannerMs - 260,
      duration: 300,
      onComplete: () => root.destroy(true),
    });
    pixelBurst(this, this.boss.x, this.boss.y, COLORS.warning, 16, 1.5);
  }

  private handleBossDefeated(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.fightStarted = false;
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.bossDashing = false;
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.clearBossProjectiles();
    this.clearSpecialStage(0);
    if (this.parryActive) {
      this.quizOverlay?.cancel();
      this.parryActive = false;
    }
    audio.play('victory');
    this.cameras.main.shake(360, 0.018);
    this.cameras.main.flash(220, 255, 247, 228, false);
    this.hud.toast(STRINGS.boss.defeated, 'neon');

    for (let i = 0; i < 7; i += 1) {
      this.time.delayedCall(i * 190, () => {
        pixelBurst(
          this,
          this.boss.x + Phaser.Math.Between(-70, 70),
          this.boss.y + Phaser.Math.Between(-100, 70),
          i % 2 === 0 ? COLORS.warning : COLORS.neon,
          10,
          1.4,
        );
        this.cameras.main.shake(100, 0.006);
      });
    }
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
    const winStamp = stamp(this, GAME_WIDTH / 2, 280, STRINGS.boss.defeated, {
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
    this.time.delayedCall(BOSS.deathDelayMs + 420, () => this.finishRun(true));
  }

  private handleDeath(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.fightStarted = false;
    this.attackEpoch += 1;
    this.attackBusy = false;
    this.bossDashing = false;
    this.boss.setVelocity(0, 0);
    this.player.setControlEnabled(false);
    this.touch?.setEnabled(false);
    this.clearBossProjectiles();
    this.clearSpecialStage(0);
    if (this.parryActive) {
      this.quizOverlay?.cancel();
      this.parryActive = false;
    }
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
    this.time.delayedCall(1500, () => this.finishRun(false));
  }

  private finishRun(victory: boolean): void {
    if (this.transitioning) {
      return;
    }
    this.transitioning = true;
    this.run.hp = Math.max(0, this.player.getHp());
    this.meme.sync(this.run);
    this.run.cards = [...this.run.cards];
    const payload: ResultPayload = {
      victory,
      timeMs: elapsedMs(this.run),
      stats: { ...this.run.stats },
      cards: [...this.run.cards],
      reason: victory ? STRINGS.boss.defeatedSub : this.pendingReason,
    };
    audio.setMusic('result');
    this.cameras.main.fadeOut(300, 23, 19, 16);
    this.time.delayedCall(320, () => {
      this.scene.start('Result', { payload, record: true });
    });
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
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) {
        return;
      }
      const expire = Number(bullet.getData('expireAt') ?? 0);
      bullet.setAngle(bullet.angle + Number(bullet.getData('spin') ?? 2));
      if (time > expire || bullet.y > GAME_HEIGHT + 40) {
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

  private cleanupScene(): void {
    if (this.cardsChangedHandler) {
      this.events.off('cards-changed', this.cardsChangedHandler);
      this.cardsChangedHandler = null;
    }
    this.clearSpecialStage(0);
    this.quizOverlay = null;
  }
}