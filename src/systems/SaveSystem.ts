import type { BestRecord, ResultPayload } from '../types/game';

const SAVE_KEY = 'raccoon-rocket-archive-v1';

interface SaveData {
  mute: boolean;
  best: BestRecord;
}

const DEFAULT_SAVE: SaveData = {
  mute: false,
  best: {
    cleared: false,
    act1Cleared: false,
    act2Cleared: false,
    bestTimeMs: 0,
    bestCorrect: 0,
    runs: 0,
  },
};

function normalizeBestRecord(value: unknown): BestRecord {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_SAVE.best };
  }
  const record = value as Record<string, unknown>;
  const cleared = record.cleared === true;
  return {
    cleared,
    // 旧存档没有分幕字段；旧版能通第二幕必然先通过第一幕。
    act1Cleared: record.act1Cleared === true || (record.act1Cleared === undefined && cleared),
    act2Cleared: record.act2Cleared === true,
    bestTimeMs: typeof record.bestTimeMs === 'number' ? record.bestTimeMs : 0,
    bestCorrect: typeof record.bestCorrect === 'number' ? record.bestCorrect : 0,
    runs: typeof record.runs === 'number' ? record.runs : 0,
  };
}

function readSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { ...DEFAULT_SAVE, best: { ...DEFAULT_SAVE.best } };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_SAVE, best: { ...DEFAULT_SAVE.best } };
    }
    const record = parsed as Record<string, unknown>;
    return {
      mute: typeof record.mute === 'boolean' ? record.mute : DEFAULT_SAVE.mute,
      best: normalizeBestRecord(record.best),
    };
  } catch {
    return { ...DEFAULT_SAVE, best: { ...DEFAULT_SAVE.best } };
  }
}

function writeSave(data: SaveData): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable in private mode; the run continues without persistence.
  }
}

export const SaveSystem = {
  getBest(): BestRecord {
    return readSave().best;
  },

  getMuted(): boolean {
    return readSave().mute;
  },

  setMuted(muted: boolean): void {
    const data = readSave();
    data.mute = muted;
    writeSave(data);
  },

  recordRun(payload: ResultPayload): { isNewBest: boolean; best: BestRecord } {
    const data = readSave();
    const best = { ...data.best };
    best.runs += 1;
    let isNewBest = false;

    if (payload.victory) {
      best.cleared = true;
      if (payload.act === 1) {
        best.act1Cleared = true;
      }
      if (payload.act === 2 && payload.temporary !== true) {
        best.act2Cleared = true;
      }
      if (best.bestTimeMs === 0 || payload.timeMs < best.bestTimeMs) {
        best.bestTimeMs = payload.timeMs;
        isNewBest = true;
      }
      best.bestCorrect = Math.max(best.bestCorrect, payload.stats.correct);
    }

    data.best = best;
    writeSave(data);
    return { isNewBest, best };
  },
};

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}