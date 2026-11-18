import { getDoorQuestions, getQuestion, shuffle } from '../data';
import type { Question, QuizResult } from '../types/game';

export interface PreparedQuiz {
  question: Question;
  options: string[];
  answerIndex: number;
}

export class QuizSystem {
  private usedDoorIds = new Set<string>();

  prepareDoor(): PreparedQuiz {
    const all = getDoorQuestions();
    const fresh = all.filter((q) => !this.usedDoorIds.has(q.id));
    const pool = fresh.length > 0 ? fresh : all;
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? all[0];
    if (!chosen) {
      throw new Error('Door question pool is empty');
    }
    return this.rebuild(chosen);
  }

  prepareParry(questionId: string): PreparedQuiz {
    return this.rebuild(getQuestion(questionId));
  }

  rebuild(question: Question): PreparedQuiz {
    const options = shuffle(question.options);
    const answerIndex = options.indexOf(question.answer);
    if (answerIndex < 0) {
      throw new Error(`Answer missing from options: ${question.id}`);
    }
    return { question, options, answerIndex };
  }

  markDoorUsed(questionId: string): void {
    this.usedDoorIds.add(questionId);
  }

  judge(prepared: PreparedQuiz, chosen: string | null): QuizResult {
    const timedOut = chosen === null;
    return {
      correct: !timedOut && chosen === prepared.question.answer,
      timedOut,
      chosen,
      answer: prepared.question.answer,
    };
  }
}