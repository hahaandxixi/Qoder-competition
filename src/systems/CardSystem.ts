import Phaser from 'phaser';
import { CARD } from '../config/balance';
import { getCard } from '../data';
import { STRINGS } from '../data';
import type { CardDef, RunState } from '../types/game';
import { audio } from './AudioSystem';

export interface CardHost {
  healFull: () => void;
  grantShield: (durationMs: number) => void;
  grantAttackSpeed: (multiplier: number, durationMs: number) => void;
  grantDashFree: (durationMs: number) => void;
  grantMoveSpeed: (multiplier: number, durationMs: number) => void;
  freezeBoss: (durationMs: number) => boolean;
  screenClear: () => number;
  summonAlly: (durationMs: number) => boolean;
  toast: (text: string, tone?: 'paper' | 'rust' | 'neon') => void;
}

export interface ActiveEffect {
  label: string;
  remainingMs: number;
  totalMs: number;
}

export class CardSystem {
  private readonly scene: Phaser.Scene;
  private readonly host: CardHost;
  private readonly run: RunState;
  private active: ActiveEffect[] = [];

  constructor(scene: Phaser.Scene, host: CardHost, run: RunState) {
    this.scene = scene;
    this.host = host;
    this.run = run;
  }

  acquire(cardId: string): boolean {
    const card = getCard(cardId);
    if (!card) {
      return false;
    }
    let replaced = false;
    if (this.run.cards.length >= CARD.maxSlots) {
      this.run.cards.shift();
      replaced = true;
    }
    this.run.cards.push(card.id);
    this.run.stats.cardsCollected += 1;
    audio.play('card');
    this.host.toast(replaced ? STRINGS.toasts.cardFull : card.quote, 'neon');
    this.emitChanged();
    return true;
  }

  useSlot(index: number): boolean {
    const cardId = this.run.cards[index];
    if (!cardId) {
      return false;
    }
    const card = getCard(cardId);
    if (!card) {
      this.run.cards.splice(index, 1);
      this.emitChanged();
      return false;
    }

    if (card.effect === 'freeze_boss' && !this.host.freezeBoss(card.durationMs)) {
      this.host.toast(STRINGS.toasts.noBoss, 'rust');
      return false;
    }

    this.run.cards.splice(index, 1);
    this.apply(card);
    this.emitChanged();
    return true;
  }

  private apply(card: CardDef): void {
    switch (card.effect) {
      case 'heal_full':
        this.host.healFull();
        break;
      case 'freeze_boss':
        this.addActive(card.name, card.durationMs);
        break;
      case 'attack_speed':
        this.host.grantAttackSpeed(CARD.attackSpeedMultiplier, card.durationMs);
        this.addActive(card.name, card.durationMs);
        break;
      case 'dash_no_cd':
        this.host.grantDashFree(card.durationMs);
        this.addActive(card.name, card.durationMs);
        break;
      case 'shield':
        this.host.grantShield(card.durationMs);
        this.addActive(card.name, card.durationMs);
        break;
      case 'move_attack':
        this.host.grantMoveSpeed(CARD.leadMultiplier, card.durationMs);
        this.host.grantAttackSpeed(CARD.leadMultiplier, card.durationMs);
        this.addActive(card.name, card.durationMs);
        break;
      case 'summon_ally':
        if (this.host.summonAlly(card.durationMs)) {
          this.addActive(card.name, card.durationMs);
        }
        break;
      case 'screen_clear': {
        const cleared = this.host.screenClear();
        if (cleared > 0) {
          this.host.toast(`${card.quote} 清理 ${cleared} 条弹幕。`, 'paper');
        } else {
          this.host.toast(card.quote, 'paper');
        }
        break;
      }
      default:
        break;
    }
    audio.play('card');
    if (card.effect !== 'screen_clear') {
      this.host.toast(card.quote, 'neon');
    }
  }

  private addActive(label: string, durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }
    this.active = this.active.filter((effect) => effect.label !== label);
    this.active.push({ label, remainingMs: durationMs, totalMs: durationMs });
  }

  update(deltaMs: number): void {
    if (this.active.length === 0) {
      return;
    }
    this.active.forEach((effect) => {
      effect.remainingMs = Math.max(0, effect.remainingMs - deltaMs);
    });
    this.active = this.active.filter((effect) => effect.remainingMs > 0);
  }

  getCards(): CardDef[] {
    return this.run.cards
      .map((id) => getCard(id))
      .filter((card): card is CardDef => card !== undefined);
  }

  getActiveEffects(): ActiveEffect[] {
    return this.active.map((effect) => ({ ...effect }));
  }

  emitChanged(): void {
    this.scene.events.emit('cards-changed');
  }
}