import questionsJson from './questions.json';
import cardsJson from './cards.json';
import bossesJson from './bosses.json';
import stringsJson from './strings.json';
import type { BossConfig, CardDef, Question } from '../types/game';

export const QUESTIONS = questionsJson as Question[];
export const CARDS = cardsJson as CardDef[];
const BOSSES = bossesJson as BossConfig[];
export const BOSS_ZHEN = BOSSES[0];
export const BOSS_HUANG = BOSSES[1] ?? BOSSES[0];
export const STRINGS = stringsJson;

export function getQuestion(id: string): Question {
  const found = QUESTIONS.find((q) => q.id === id);
  if (!found) {
    throw new Error(`Question not found: ${id}`);
  }
  return found;
}

export function getCard(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}

export function getParryQuestions(): Question[] {
  return QUESTIONS.filter((q) => q.mode === 'parry');
}

export function getDoorQuestions(): Question[] {
  return QUESTIONS.filter((q) => q.mode === 'door');
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    const other = copy[j];
    if (tmp !== undefined && other !== undefined) {
      copy[i] = other;
      copy[j] = tmp;
    }
  }
  return copy;
}