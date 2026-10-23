export const MAX_GHOSTS = 40;
export const POWER_SECONDS = 6;
export const MAX_POWER_SECONDS = 9;
export const spawnInterval = (wave: number) =>
  Math.max(0.55, 2.7 - wave * 0.22);
export const earnsOrb = (freshLetters: number) =>
  freshLetters > 0 && freshLetters % 6 === 0;
export const extendPower = (remaining: number) =>
  Math.min(MAX_POWER_SECONDS, Math.max(0, remaining) + POWER_SECONDS);
