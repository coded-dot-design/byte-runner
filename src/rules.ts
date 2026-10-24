export const MAX_GHOSTS = 12;
export const POWER_SECONDS = 6;
export const MAX_POWER_SECONDS = 9;
export const extendPower = (remaining: number) =>
  Math.min(MAX_POWER_SECONDS, Math.max(0, remaining) + POWER_SECONDS);
