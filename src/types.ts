export type CardKind = 'heal' | 'damage' | 'speed';

export type QuestionType = 'gate' | 'parry';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  answer: string;
  hint: string;
  card: CardKind;
  bossLine?: string;
}

export interface QuizData {
  mode: QuestionType;
  question: Question;
  onDone: (ok: boolean) => void;
  timeLimitMs?: number;
}