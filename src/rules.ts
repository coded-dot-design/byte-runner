// Byte Runner's numbers (0.10.2's, unchanged).
export const MAX_GHOSTS = 12;
export const POWER_SECONDS = 6;
export const MAX_POWER_SECONDS = 9;
/** Power food stacks, up to nine seconds: never infinite immunity. */
export const extendPower = (remaining: number) => Math.min(MAX_POWER_SECONDS, Math.max(0, remaining) + POWER_SECONDS);
/** Eaten food grows back (simulation seconds). Regrown food is a bonus: only the first bite counts. */
export const PELLET_RETURN_SECONDS = 12;
export const POWER_RETURN_SECONDS = 20;
/** How far the tongue reaches for a fly while powered: about two pellet spacings. */
export const TONGUE_REACH = 54;
