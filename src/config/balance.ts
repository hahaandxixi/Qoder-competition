export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const WORLD = {
  gravityY: 1900,
  levelWidth: 6600,
  bossWidth: 1280,
  floorY: 636,
  fallDamageY: 840,
  respawnInvulnMs: 1200,
} as const;

export const PLAYER = {
  maxHp: 100,
  lowHpRatio: 0.3,
  moveSpeed: 285,
  groundAccel: 2600,
  airAccel: 1900,
  groundDrag: 2400,
  jumpVelocity: -660,
  doubleJumpVelocity: -590,
  coyoteMs: 110,
  jumpBufferMs: 130,
  dashSpeed: 880,
  dashDurationMs: 150,
  dashCooldownMs: 850,
  dashInvulnMs: 180,
  shootCooldownMs: 210,
  bulletSpeed: 920,
  bulletLifeMs: 360,
  bulletDamage: 7,
  pelletsPerShot: 3,
  spreadDeg: 8,
  invulnMs: 950,
  knockbackX: 280,
  knockbackY: -260,
  fallRespawnDamage: 22,
} as const;

export const ENEMY = {
  opossumHp: 48,
  opossumSpeed: 68,
  opossumAggroRange: 300,
  opossumLungeSpeed: 350,
  opossumLungeMs: 220,
  opossumDamage: 12,
  opossumCooldownMs: 1500,
  turretHp: 76,
  turretRange: 560,
  turretFireCooldownMs: 1900,
  turretProjectileSpeed: 290,
  turretDamage: 10,
  contactDamage: 10,
} as const;

export const HAZARD = {
  damage: 14,
} as const;

export const COMBAT = {
  hitstopLightMs: 45,
  hitstopHeavyMs: 110,
  cameraShakeLight: 0.0035,
  cameraShakeHeavy: 0.011,
  particlesPerHit: 7,
  particlesPerDeath: 14,
} as const;

export const QUIZ = {
  parryWindowMs: 2000,
  parryRevealMs: 1250,
  doorWindowMs: 30000,
  doorRetryDelayMs: 1000,
  optionCountParry: 3,
} as const;

export const MEME = {
  max: 100,
  bossCorrect: 34,
  doorCorrect: 20,
  streakBonus: 5,
  enemyKill: 3,
  burstDurationMs: 5000,
  burstDamageMultiplier: 2,
  bossHitGain: 0.4,
} as const;

export const BOSS = {
  specialCooldownMs: 13500,
  firstSpecialDelayMs: 2500,
  staggerMs: 3200,
  contactDamage: 16,
  quizFailDamage: 20,
  reflectDamage: 90,
  projectileDamage: 12,
  projectileSpeed: 330,
  aimedShots: 3,
  aimedSpreadRad: 0.24,
  aimTelegraphMs: 420,
  dashTelegraphMs: 560,
  dashSpeed: 880,
  dashDamage: 14,
  dashCount: 3,
  dashPauseMs: 260,
  rainCount: 8,
  rainSpawnIntervalMs: 110,
  rainDamage: 11,
  phaseBannerMs: 1500,
  introMs: 4000,
  deathDelayMs: 1700,
  reflectCardSlots: 3,
} as const;

export const CARD = {
  toastMs: 1700,
  maxSlots: 3,
  freezeMs: 2800,
  attackSpeedMs: 5000,
  attackSpeedMultiplier: 2,
  dashFreeMs: 7000,
  shieldMs: 8000,
  leadMs: 5000,
  leadMultiplier: 1.3,
  allyMs: 9000,
  allyShotCooldownMs: 520,
  allyDamage: 9,
  screenClearDamage: 45,
} as const;

export const UI = {
  hudDepth: 100,
  overlayDepth: 500,
  touchDepth: 300,
  parryPanelHeight: 330,
  damagePopupRise: 52,
  damagePopupMs: 680,
} as const;