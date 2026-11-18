import { MEME } from '../config/balance';
import type { RunState } from '../types/game';

export class MemeMeter {
  private value: number;
  private streak: number;
  private burstActive = false;
  private burstRemaining = 0;

  constructor(run: RunState) {
    this.value = run.meme;
    this.streak = run.streak;
  }

  addCorrect(base: number): { gained: number; burstStarted: boolean } {
    if (this.burstActive) {
      this.streak += 1;
      return { gained: 0, burstStarted: false };
    }
    const gained = base + this.streak * MEME.streakBonus;
    this.streak += 1;
    if (this.value + gained >= MEME.max) {
      this.value = MEME.max;
      this.startBurst();
      return { gained, burstStarted: true };
    }
    this.value = Math.min(MEME.max - 1, this.value + gained);
    return { gained, burstStarted: false };
  }

  addSmall(amount: number): void {
    if (this.burstActive) {
      return;
    }
    this.value = Math.min(MEME.max - 1, this.value + amount);
  }

  registerWrong(): void {
    this.streak = 0;
  }

  update(deltaMs: number): boolean {
    if (!this.burstActive) {
      return false;
    }
    this.burstRemaining = Math.max(0, this.burstRemaining - deltaMs);
    this.value = (this.burstRemaining / MEME.burstDurationMs) * MEME.max;
    if (this.burstRemaining <= 0) {
      this.burstActive = false;
      this.value = 0;
      return true;
    }
    return false;
  }

  private startBurst(): void {
    this.burstActive = true;
    this.burstRemaining = MEME.burstDurationMs;
  }

  getValue(): number {
    return Math.max(0, Math.min(MEME.max, this.value));
  }

  getStreak(): number {
    return this.streak;
  }

  isBurstActive(): boolean {
    return this.burstActive;
  }

  getDamageMultiplier(): number {
    return this.burstActive ? MEME.burstDamageMultiplier : 1;
  }

  getBurstRemainingMs(): number {
    return this.burstRemaining;
  }

  sync(run: RunState): void {
    run.meme = this.getValue();
    run.streak = this.streak;
  }
}