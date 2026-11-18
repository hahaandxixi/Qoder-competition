import Phaser from 'phaser';
import { Player } from '../objects/Player';
import type { Question, QuizData } from '../types';
import questionsData from '../data/questions.json';

const FONT = '"Microsoft YaHei", system-ui, sans-serif';

export class BossScene extends Phaser.Scene {
  private player!: Player;
  private boss!: Phaser.Physics.Arcade.Image;
  private bullets!: Phaser.Physics.Arcade.Group;
  private bossHp = 320;
  private bossMaxHp = 320;
  private parryPool: Question[] = [];
  private parryIndex = 0;
  private staggered = false;
  private dashHitUntil = 0;
  private quizOpen = false;
  private finishing = false;
  private bossBar!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private bubble?: Phaser.GameObjects.Text;

  constructor() {
    super('BossScene');
  }

  create(): void {
    this.bossHp = 320;
    this.parryIndex = 0;
    this.staggered = false;
    this.quizOpen = false;
    this.finishing = false;
    this.parryPool = (questionsData as unknown as Question[]).filter((q) => q.type === 'parry');

    this.physics.world.setBounds(0, 0, 960, 600);
    this.cameras.main.setBounds(0, 0, 960, 540);
    this.cameras.main.setBackgroundColor(0x140c12);
    for (let i = 0; i < 14; i++) {
      this.add
        .rectangle(i * 80 + 40, 300, 60, Phaser.Math.Between(120, 360), 0x1d1220)
        .setDepth(-2)
        .setScrollFactor(0.4);
    }

    const ground = this.physics.add.staticImage(480, 516, 'ground');
    ground.setDisplaySize(960, 32).refreshBody();

    this.player = new Player(this, 120, 430, (x, y, dir, dmg) => this.fireBullet(x, y, dir, dmg));
    this.physics.add.collider(this.player, ground);

    this.boss = this.physics.add.image(740, 320, 'boss');
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(52, 80).setOffset(10, 6);
    this.boss.setDepth(8);
    this.tweens.add({
      targets: this.boss,
      y: 300,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.bullets = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.bullets, this.boss, (b) => {
      this.onBulletBoss(b as Phaser.Physics.Arcade.Image);
    });
    this.physics.add.overlap(this.player, this.boss, () => {
      if (this.staggered || this.finishing) return;
      const dmg = this.time.now < this.dashHitUntil ? 20 : 10;
      this.player.hurt(dmg, this.boss.x);
    });

    this.time.addEvent({ delay: 3200, loop: true, callback: () => this.tryAttack() });
    this.createHud();
  }

  private createHud(): void {
    this.add.rectangle(0, 0, 960, 52, 0x0a0e16, 0.55).setOrigin(0).setDepth(90);
    this.add
      .text(480, 6, '假 Boss：甄领先·试用版', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ff9f7a',
      })
      .setOrigin(0.5, 0)
      .setDepth(100);
    this.add
      .rectangle(270, 30, 420, 14, 0x22304a)
      .setOrigin(0)
      .setDepth(100);
    this.bossBar = this.add
      .rectangle(270, 30, 420, 14, 0xff5c5c)
      .setOrigin(0)
      .setDepth(101);

    this.add
      .rectangle(18, 14, 184, 16, 0x22304a)
      .setOrigin(0)
      .setDepth(100);
    this.hpBar = this.add
      .rectangle(20, 16, 180, 12, 0x63d68b)
      .setOrigin(0)
      .setDepth(101);
    this.hpText = this.add
      .text(212, 12, '100 / 100', { fontFamily: FONT, fontSize: '13px', color: '#cfd8ea' })
      .setDepth(100);
  }

  private fireBullet(x: number, y: number, dir: number, dmg: number): void {
    const b = this.bullets.create(x, y, 'bullet') as Phaser.Physics.Arcade.Image;
    b.setVelocityX(dir * 760).setDepth(9);
    b.setData('dmg', dmg);
    this.time.delayedCall(900, () => {
      if (b.active) b.destroy();
    });
  }

  private onBulletBoss(bullet: Phaser.Physics.Arcade.Image): void {
    if (this.finishing || !bullet.active) return;
    const mul = this.staggered ? 2 : 1;
    const dmg = (bullet.getData('dmg') as number) * mul;
    bullet.destroy();
    this.bossHp = Math.max(0, this.bossHp - dmg);
    this.bossBar.setScale(this.bossHp / this.bossMaxHp, 1);
    if (!this.staggered) {
      this.boss.setTintFill(0xffffff);
      this.time.delayedCall(50, () => {
        if (this.boss.active) this.boss.clearTint();
      });
    }
    if (this.bossHp <= 0) this.win();
  }

  private tryAttack(): void {
    if (this.finishing || this.staggered || this.quizOpen) return;
    const q = this.parryPool[this.parryIndex % this.parryPool.length];
    this.parryIndex++;
    this.showBubble(q.bossLine ?? '看招！');
    this.time.delayedCall(450, () => {
      if (this.finishing || this.staggered) return;
      this.startParry(q);
    });
  }

  private showBubble(text: string): void {
    this.bubble?.destroy();
    this.bubble = this.add
      .text(this.boss.x - 40, this.boss.y - 80, `「${text}」`, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffd9a0',
        backgroundColor: '#1c2740',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(20);
    const t = this.bubble;
    this.time.delayedCall(1400, () => {
      if (t.active) t.destroy();
    });
  }

  private startParry(q: Question): void {
    this.quizOpen = true;
    const data: QuizData = {
      mode: 'parry',
      question: q,
      timeLimitMs: 2000,
      onDone: (ok: boolean) => {
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        this.quizOpen = false;
        if (ok) this.onParrySuccess(q);
        else this.bossDash();
      },
    };
    this.scene.launch('QuizScene', data);
    this.scene.pause();
  }

  private onParrySuccess(q: Question): void {
    this.staggered = true;
    this.boss.setTint(0x8ef0b0);
    this.player.applyCard(q.card);
    this.cameras.main.flash(160, 80, 160, 100);
    this.cameras.main.shake(180, 0.006);
    const t = this.add
      .text(480, 200, '完美弹反！梗卡到手', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#8ef0b0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: t,
      y: 150,
      alpha: 0,
      duration: 1200,
      onComplete: () => t.destroy(),
    });
    this.time.delayedCall(4000, () => {
      if (!this.finishing && this.boss.active) {
        this.staggered = false;
        this.boss.clearTint();
      }
    });
  }

  private bossDash(): void {
    if (this.finishing || !this.boss.active) return;
    const dir = this.player.x < this.boss.x ? -1 : 1;
    this.boss.setVelocityX(dir * 520);
    this.dashHitUntil = this.time.now + 650;
    this.time.delayedCall(650, () => {
      if (this.boss.active) this.boss.setVelocityX(0);
    });
  }

  private win(): void {
    if (this.finishing) return;
    this.finishing = true;
    this.physics.pause();
    this.boss.setTint(0x333333);
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('ResultScene', { win: true });
    });
  }

  update(time: number): void {
    if (!this.finishing) this.player.update(time);

    const ratio = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.hpBar.setScale(ratio, 1);
    this.hpBar.setFillStyle(ratio > 0.5 ? 0x63d68b : ratio > 0.25 ? 0xffd166 : 0xd9534f);
    this.hpText.setText(`${this.player.hp} / ${this.player.maxHp}`);
    this.bossBar.setScale(Math.max(0, this.bossHp / this.bossMaxHp), 1);

    if (!this.finishing && this.player.hp <= 0) {
      this.finishing = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('ResultScene', { win: false });
      });
    }
  }
}