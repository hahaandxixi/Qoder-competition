export type QuestionMode = 'parry' | 'door';

export interface Question {
  id: string;
  mode: QuestionMode;
  prompt: string;
  options: string[];
  answer: string;
  reveal: string;
  hints: string[];
  cardId: string;
  tags: string[];
}

export type CardEffectId =
  | 'heal_full'
  | 'freeze_boss'
  | 'attack_speed'
  | 'dash_no_cd'
  | 'shield'
  | 'move_attack'
  | 'summon_ally'
  | 'screen_clear';

export interface CardDef {
  id: string;
  name: string;
  effect: CardEffectId;
  durationMs: number;
  desc: string;
  quote: string;
  stamp: string;
  color: string;
}

export type BossAttackId = 'dash_combo' | 'aimed_shots' | 'data_rain' | 'red_carpet_dash';

export interface BossPhase {
  phase: number;
  fromHpPct: number;
  attackIntervalMs: number;
  parryQuestionId: string;
  attackPool: BossAttackId[];
  staggerMs: number;
  label: string;
}

export interface BossConfig {
  id: string;
  name: string;
  title: string;
  hp: number;
  phases: BossPhase[];
  taunts: string[];
  intro: string;
  defeatLine: string;
}

export interface RunStats {
  correct: number;
  wrong: number;
  timeouts: number;
  parries: number;
  cardsCollected: number;
  enemiesDefeated: number;
}

export interface RunState {
  hp: number;
  maxHp: number;
  meme: number;
  streak: number;
  cards: string[];
  doorPassed: boolean;
  startedAt: number;
  stats: RunStats;
}

export interface BestRecord {
  cleared: boolean;
  bestTimeMs: number;
  bestCorrect: number;
  runs: number;
}

export interface ResultPayload {
  victory: boolean;
  timeMs: number;
  stats: RunStats;
  cards: string[];
  reason: string;
}

export interface QuizOptionView {
  label: string;
  index: number;
}

export interface QuizResult {
  correct: boolean;
  timedOut: boolean;
  chosen: string | null;
  answer: string;
}

export interface ParryRequest {
  question: Question;
  windowMs: number;
  bossName: string;
}

export interface CardUseHooks {
  healFull: () => void;
  freezeBoss: () => boolean;
  shield: () => void;
  screenClear: () => number;
  summonAlly: () => boolean;
  toast: (text: string, tone?: 'paper' | 'rust' | 'neon') => void;
}

export interface PlayerModifiers {
  attackSpeedMultiplier: number;
  moveSpeedMultiplier: number;
  dashFree: boolean;
  shieldCharges: number;
  damageMultiplier: number;
}