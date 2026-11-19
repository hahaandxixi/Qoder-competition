export type QuestionMode = 'parry' | 'door';

/** 答题期间保留在画面上的小票/面单，给玩家提供梗的线索。 */
export interface QuestionSlip {
  title: string;
  lines: string[];
}

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
  /** 答对时盖下的印章文案（缺省用门/弹反的通用文案）。 */
  correctStamp?: string;
  /** 作答期间常驻的小票（面单、取件条等）。 */
  slip?: QuestionSlip;
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

export type BossAttackId =
  | 'dash_combo'
  | 'aimed_shots'
  | 'data_rain'
  | 'red_carpet_dash'
  | 'viewfinder_net'
  | 'gear_toss'
  | 'canopy_leak';

/** Boss 认梗弹反的专属舞台演出：答题前先演一段看得懂的招式。 */
export type BossSpecialId = 'radish_stamping' | 'auto_signing' | 'road_sign_drag' | 'canopy_rain';

export interface BossPhase {
  phase: number;
  fromHpPct: number;
  attackIntervalMs: number;
  parryQuestionId: string;
  attackPool: BossAttackId[];
  staggerMs: number;
  label: string;
  special?: BossSpecialId;
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
  /** 当前幕。第一幕与第二幕的门状态、出生点和重试路由互相独立。 */
  act: 1 | 2;
  /** 收发室代签门与顶层倒带取件门各自独立，检查点/重试后仍生效。 */
  door1Passed: boolean;
  door2Passed: boolean;
  /** 荒野岛的亡命天涯门与这是好事呀门。 */
  act2Door1Passed: boolean;
  act2Door2Passed: boolean;
  startedAt: number;
  stats: RunStats;
}

export interface BestRecord {
  cleared: boolean;
  act1Cleared: boolean;
  act2Cleared: boolean;
  bestTimeMs: number;
  bestCorrect: number;
  runs: number;
}

export interface ResultPayload {
  act: 1 | 2;
  victory: boolean;
  temporary?: boolean;
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