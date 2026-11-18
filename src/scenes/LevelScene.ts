import Phaser from 'phaser';
import { Player } from '../objects/Player';
import type { Question, QuizData } from '../types';
import questionsData from '../data/questions.json';

const FONT = '"Microsoft YaHei", system-ui, sans-serif';

interface GateState {
  sprite: Phaser.Physics.Arcade.Image;
  solved: boolean;
}

export class LevelScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private gates: GateState[] = [];
  private gatePool: Question[] = [];
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private gateText!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private eKey!: Phaser.Input.Keyboard.Key;
  private solvedCount = 0;
  private finishing = false;

  constructor() {
    super('LevelScene');
  }

  create(): void {
    this.finishing = false;
    this.gates = [];
    this.solvedCount = 0;
    this.gatePool = (questionsData as unknown as Question[]).filter((q) => q.type === 'gate');

    const worldW = 3600;
    this.physics.world.setBounds(0, 0, worldW, 600);
    this.cameras.main.setBounds(0, 0, worldW, 540);
    this.cameras.main.setBackgroundColor(0x0d1320);

    for (let i = 0; i < 16; i++) {
      const h = Phaser.Math.Between(70, 170);
      this.add
        .rectangle(i * 240 + 80, 500 - h / 2, 120, h, 0x111a2b)
        .setScrollFactor(0.35)
        .setDepth(-3);
    }
    for (let i = 0; i < 24; i++) {
      const h = Phaser.Math.Between(30, 90);
      this.add
        .rectangle(i * 160 + 40, 500 - h / 2, 80, h, 0x18233a)
        .setScrollFactor(0.6)
        .setDepth(-2);
    }

    this.platforms = this.physics.add.staticGroup();
    const segments: [number, number][] = [
      [0, 1150],
      [1300, 2350],
      [2500, 3600],
    ];
    for (const [from, to] of segments) {
      const len = to - from;
      const tile = this.platforms.create(from + len / 2, 516, 'ground') as Phaser.Physics.Arcade.Image;
      tile.setDisplaySize(len, 32).refreshBody();
    }
    const floats: [number, number, number][] = [
      [320, 400, 160],
      [620, 340, 128],
      [900, 400, 128],
      [1420, 380, 160],
      [1720, 320, 128],
      [2060, 400, 160],
      [2600, 380, 160],
      [2980, 340, 128],
      [3250, 400, 128],
    ];
    for (const [x, y, w] of floats) {
      const p = this.platforms.create(x, y, 'platform') as Phaser.Physics.Arcade.Image;
      p.setDisplaySize(w, 18).refreshBody();
    }

    this.player = new Player(this, 90, 430, (x, y, dir, dmg) => this.fireBullet(x, y, dir, dmg));
    this.physics.add.collider(this.player, this.platforms);

    this.enemies = this.physics.add.group();
    const enemyDefs: [string, number, number, number, number][] = [
      ['opossum', 520, 450, 380, 700],
      ['opossum', 1500, 450, 1350, 1750],
      ['lobster', 1850, 450, 1650, 2050],
      ['opossum', 2680, 450, 2550, 2900],
      ['lobster', 3050, 450, 2900, 3300],
    ];
    for (const [tex, x, y, min, max] of enemyDefs) {
      const e = this.enemies.create(x, y, tex) as Phaser.Physics.Arcade.Image;
      e.setData('minX', min).setData('maxX', max).setData('dir', 1).setData('hp', 24);
      const bw = tex === 'opossum' ? 20 : 18;
      const bh = tex === 'opossum' ? 14 : 16;
      (e.body as Phaser.Physics.Arcade.Body).setSize(bw, bh);
    }
    this.physics.add.collider(this.enemies, this.platforms);

    this.bullets = this.physics.add.group({ allowGravity: false });

    this.spawnGate(1050, 470);
    this.spawnGate(2250, 470);

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
      this.onBulletEnemy(b as Phaser.Physics.Arcade.Image, e as Phaser.Physics.Arcade.Image);
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Phaser.Physics.Arcade.Image;
      this.player.hurt(10, enemy.x);
    });

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(220, 140);

    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.createHud();
  }

  private createHud(): void {
    this.add.rectangle(0, 0, 960, 44, 0x0a0e16, 0.55).setOrigin(0).setScrollFactor(0).setDepth(90);
    this.add
      .rectangle(18, 14, 184, 16, 0x22304a)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100);
    this.hpBar = this.add
      .rectangle(20, 16, 180, 12, 0x63d68b)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(101);
    this.hpText = this.add
      .text(212, 12, '100 / 100', { fontFamily: FONT, fontSize: '13px', color: '#cfd8ea' })
      .setScrollFactor(0)
      .setDepth(100);
    this.gateText = this.add
      .text(940, 12, '名字门 0/2', { fontFamily: FONT, fontSize: '14px', color: '#ffd166' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.tip = this.add
      .text(480, 500, '', { fontFamily: FONT, fontSize: '16px', color: '#ffd166' })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  private spawnGate(x: number, y: number): void {
    const g = this.physics.add.staticImage(x, y, 'gate');
    this.physics.add.collider(this.player, g);
    this.gates.push({ sprite: g, solved: false });
  }

  private updateHud(): void {
    const ratio = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.hpBar.setScale(ratio, 1);
    this.hpBar.setFillStyle(ratio > 0.5 ? 0x63d68b : ratio > 0.25 ? 0xffd166 : 0xd9534f);
    this.hpText.setText(`${this.player.hp} / ${this.player.maxHp}`);
    this.gateText.setText(`名字门 ${this.solvedCount}/${this.gates.length}`);
  }

  private fireBullet(x: number, y: number, dir: number, dmg: number): void {
    const b = this.bullets.create(x, y, 'bullet') as Phaser.Physics.Arcade.Image;
    b.setVelocityX(dir * 760).setDepth(9);
    b.setData('dmg', dmg);
    this.time.delayedCall(900, () => {
      if (b.active) b.destroy();
    });
  }

  private onBulletEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active || !enemy.active) return;
    const dmg = bullet.getData('dmg') as number;
    bullet.destroy();
    const hp = (enemy.getData('hp') as number) - dmg;
    enemy.setData('hp', hp);
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(60, () => {
      if (enemy.active) enemy.clearTint();
    });
    if (hp <= 0) {
      this.add
        .particles(enemy.x, enemy.y, 'spark', {
          speed: { min: 60, max: 180 },
          lifespan: 300,
          quantity: 10,
          scale: { start: 1, end: 0 },
        })
        .setDepth(11);
      enemy.destroy();
    }
  }

  private openGateQuiz(gate: GateState): void {
    if (this.gatePool.length === 0) return;
    const q = Phaser.Utils.Array.GetRandom(this.gatePool);
    const data: QuizData = {
      mode: 'gate',
      question: q,
      onDone: (ok: boolean) => {
        this.scene.resume();
        this.input.keyboard?.resetKeys();
        if (ok) {
          gate.solved = true;
          gate.sprite.destroy();
          this.solvedCount++;
          this.player.applyCard(q.card);
          this.cameras.main.flash(160, 70, 120, 80);
          const t = this.add
            .text(gate.sprite.x, gate.sprite.y - 40, `梗卡到手：${q.answer}`, {
              fontFamily: FONT,
              fontSize: '16px',
              color: '#8ef0b0',
            })
            .setOrigin(0.5)
            .setDepth(20);
          this.tweens.add({
            targets: t,
            y: t.y - 50,
            alpha: 0,
            duration: 1100,
            onComplete: () => t.destroy(),
          });
          this.updateHud();
        }
      },
    };
    this.scene.launch('QuizScene', data);
    this.scene.pause();
  }

  update(time: number): void {
    this.player.update(time);

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Phaser.Physics.Arcade.Image;
      if (!e.active) return;
      let dir = e.getData('dir') as number;
      if (e.x <= (e.getData('minX') as number)) dir = 1;
      if (e.x >= (e.getData('maxX') as number)) dir = -1;
      e.setData('dir', dir);
      e.setVelocityX(dir * 70);
      e.setFlipX(dir < 0);
    });

    if (this.player.y > 590) {
      const checkpoints = [90, 1350, 2550];
      let cx = checkpoints[0];
      for (const c of checkpoints) if (this.player.x > c) cx = c;
      this.player.hp = Math.max(0, this.player.hp - 20);
      this.player.respawnAt(cx + 40, 380);
      this.cameras.main.flash(200, 120, 30, 30);
    }

    this.updateHud();

    let nearGate: GateState | null = null;
    for (const g of this.gates) {
      if (!g.solved && g.sprite.active && Math.abs(this.player.x - g.sprite.x) < 90) {
        nearGate = g;
        break;
      }
    }
    this.tip.setVisible(!!nearGate);
    if (nearGate) this.tip.setText('按 E 认梗开锁');
    if (nearGate && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.openGateQuiz(nearGate);
    }

    if (!this.finishing && this.player.x > 3480) {
      this.finishing = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('BossScene');
      });
    }

    if (!this.finishing && this.player.hp <= 0) {
      this.finishing = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('ResultScene', { win: false });
      });
    }
  }
}