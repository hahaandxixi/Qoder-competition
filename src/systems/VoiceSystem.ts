import { audio } from './AudioSystem';
import {
  VOICE_CLIP_DURATION_MS,
  VOICE_CLIP_FILES,
  type VoiceClipName,
} from './voiceClips';

export interface VoiceLine {
  clip: VoiceClipName;
  speaker: string;
  text: string;
  ownerId?: string;
  x: number;
  y: number;
  color?: number;
  priority?: number;
  dedupeKey?: string;
  subtitle?: boolean;
  volume?: number;
  playbackRate?: number;
}

export interface VoicePresenter {
  show(line: VoiceLine, durationMs: number): void;
  hide(): void;
}

interface ActiveVoice {
  line: VoiceLine;
  durationMs: number;
  source: AudioBufferSourceNode | null;
  endTimer: number | null;
}

class VoiceSystem {
  private presenter: VoicePresenter | null = null;
  private current: ActiveVoice | null = null;
  private queue: VoiceLine[] = [];
  private readonly seen = new Set<string>();
  private preloaded = false;

  setPresenter(presenter: VoicePresenter | null): void {
    this.presenter = presenter;
  }

  preloadAll(): void {
    if (this.preloaded) {
      return;
    }
    this.preloaded = true;
    for (const clip of Object.keys(VOICE_CLIP_FILES) as VoiceClipName[]) {
      void audio.preloadVoice(clip);
    }
  }

  resetOneShots(): void {
    this.seen.clear();
  }

  getCurrentLine(): VoiceLine | null {
    return this.current?.line ?? null;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  speak(line: VoiceLine): boolean {
    if (line.dedupeKey) {
      if (this.seen.has(line.dedupeKey)) {
        return false;
      }
      this.seen.add(line.dedupeKey);
    }

    if (this.current) {
      if ((line.priority ?? 1) <= 0) {
        return false;
      }
      if (this.queue.length >= 3) {
        const lowIndex = this.queue.findIndex((queued) => (queued.priority ?? 1) <= 0);
        if (lowIndex >= 0) {
          this.queue.splice(lowIndex, 1);
        } else {
          return false;
        }
      }
      this.queue.push(line);
      return true;
    }

    this.start(line);
    return true;
  }

  cancelOwner(ownerId: string): void {
    this.queue = this.queue.filter((line) => line.ownerId !== ownerId);
    if (this.current?.line.ownerId === ownerId) {
      this.finish();
    }
  }

  stopAll(): void {
    this.queue = [];
    this.finish();
  }

  private start(line: VoiceLine): void {
    const rate = line.playbackRate ?? 1;
    const durationMs = Math.max(350, Math.round(VOICE_CLIP_DURATION_MS[line.clip] / rate));
    if (line.subtitle !== false) {
      this.presenter?.show(line, durationMs);
    }

    let source: AudioBufferSourceNode | null = null;
    if (!audio.isMuted()) {
      const playback = audio.playVoiceClip(line.clip, line.volume ?? 1, durationMs);
      if (playback) {
        source = playback.source;
        audio.setDuck(true, 'voice');
      }
    }

    const active: ActiveVoice = { line, durationMs, source, endTimer: null };
    this.current = active;
    if (source) {
      source.addEventListener(
        'ended',
        () => {
          if (this.current === active) {
            this.finish();
          }
        },
        { once: true },
      );
    }
    active.endTimer = window.setTimeout(() => {
      if (this.current === active) {
        this.finish();
      }
    }, durationMs + 150);
  }

  private finish(): void {
    const active = this.current;
    if (!active) {
      return;
    }
    this.current = null;
    if (active.endTimer !== null) {
      window.clearTimeout(active.endTimer);
    }
    if (active.source) {
      audio.stopVoiceClip(active.source);
    }
    audio.setDuck(false, 'voice');
    this.presenter?.hide();
    const next = this.queue.shift();
    if (next) {
      this.start(next);
    }
  }
}

export const voice = new VoiceSystem();