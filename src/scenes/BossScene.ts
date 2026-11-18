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
import { QuizOverlay } from '../ui/QuizOverlay';
import { CardSystem, type CardHost } from '../systems/CardSystem';
import { MemeMeter } from '../systems/MemeMeter';
import { QuizSystem } from '../systems/QuizSystem';
import { elapsedMs, getRunState } from '../systems/RunState';
import { audio } from '../systems/AudioSystem';

const BOSS_HOVER_X = 930;
const BOSS_HOVER_Y = 500;
const DASH_Y = 520;

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
    this.boss.setInvulnerable(BOSS.introMs + 300);
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.bossProjectiles = this.physics.add.group({ allowGravity: false });
    this.setupCollisions();
    this.setupHud();
    this.setupTouch();
    this.setupAmbient();

    this.showIntro();
    addScanlines(this, 90);
    this.events.once('shutdown', () => this.cleanupScene());

    this.time.delayedCall(BOSS.introMs, () => {
      if (this.finished) {
        return;
      }
      this.fightStarted = true;
      this.boss.setInvulnerable(0);
      this.nextAttackAt = this.time.now + 900;
      this.nextSpecialAt = this.time.now + BOSS.firstSpecialDelayMs;
      this.hud.toast('认出梗，就能把发布会打回去。', 'neon');
    });
  }

  override update(time: number, delta: number): void {
    if (!this.player) {
      return;
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

  private showIntro(): void {
    const root = this.add.container(GAME_WIDTH / 2, 300);
    root.setScrollFactor(0);
    root.setDepth(450);
    const g = this.add.graphics();
    g.fillStyle(COLORS.coal, 0.93);
    g.fillRect(-500, -190, 1000, 380);
    g.lineStyle(3, COLORS.warning, 0.8);
    g.strokeRect(-500, -190, 1000, 380);
    g.fillStyle(COLORS.rust, 0.95);
    g.fillRect(-500, -190, 10, 380);
    g.fillStyle(COLORS.paper, 0.08);
    for (let y = -170; y < 180; y += 18) {
      g.fillRect(-480, y, 960, 1);
    }
    const tape = makeTape(this, 0, -190, 260, 24, COLORS.warning);
    tape.setRotation(-0.02);
    const header = this.add.text(0, -148, STRINGS.boss.arrive, {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: CSS.warning,
      fontStyle: 'bold',
    });
    header.setOrigin(0.5);
    const name = glitchText(this, 0, -80, this.boss.config.name, {
      fontFamily: FONTS.display,
      fontSize: '58px',
      color: CSS.paper,
      fontStyle: 'bold',
    });
    const title = this.add.text(0, -26, this.boss.config.title, {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS.paperDim,
    });
    title.setOrigin(0.5);
    const quote = this.add.text(0, 32, `“${this.boss.config.intro}”`, {
      fontFamily: FONTS.body,
      fontSize: '18px',
      color: CSS.paper,
      align: 'center',
      wordWrap: { width: 820 },
    });
    quote.setOrigin(0.5);
    const hint = this.add.text(0, 104, '认梗弹反：Boss 蓄力时，2 秒内按 1 / 2 / 3 作答。答对＝硬直＋反噬。', {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: CSS.neon,
      align: 'center',
      wordWrap: { width: 860 },
    });
    hint.setOrigin(0.5);
    const small = this.add.text(0, 148, '答题时战斗不会暂停。留意漏过来的弹幕。', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS.paperDim,
    });
    small.setOrigin(0.5);
    root.add([g, tape, header, name, title, quote, hint, small]);
    this.tweens.add({
      targets: root,
      alpha: 0,
      y: 270,
      delay: BOSS.introMs - 300,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => root.destroy(true),
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
    const prepared = this.quizSystem.prepareParry(phase.parryQuestionId);
    const specialTag = addHotTag(
      this,
      this.boss.x,
      this.boss.y - 170,
      '特殊招式 · 认梗弹反',
      COLORS.rust,
      -0.02,
    );
    specialTag.setDepth(97);
    this.tweens.add({
      targets: specialTag,
      alpha: 0,
      delay: 1200,
      duration: 380,
      onComplete: () => specialTag.destroy(),
    });
    audio.play('stagger');
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
    this.quizOverlay = null;
  }
}