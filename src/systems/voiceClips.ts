export const VOICE_CLIP_FILES = {
  opossumMumble: 'opossum_mumble.mp3',
  opossumGuard: 'opossum_guard.mp3',
  lobsterFirst: 'lobster_first.mp3',
  lobsterBreak: 'lobster_break.mp3',
  droneCheck: 'drone_check.mp3',
  raccoonDefeat: 'raccoon_defeat.mp3',
} as const;

export type VoiceClipName = keyof typeof VOICE_CLIP_FILES;

export const VOICE_CLIP_DURATION_MS: Record<VoiceClipName, number> = {
  opossumMumble: 1840,
  opossumGuard: 3305,
  lobsterFirst: 2628,
  lobsterBreak: 2005,
  droneCheck: 1637,
  raccoonDefeat: 2156,
};