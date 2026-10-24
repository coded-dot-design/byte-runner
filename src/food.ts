import type { Pellet } from "./maze.js";
export const PELLET_RETURN_SECONDS = 12;
export const POWER_RETURN_SECONDS = 20;
/** Regrown food is a bonus. Only the first bite counts toward clearing a level. */
export function eatPellet(pellet: Pellet, time: number) {
  if (pellet.eaten) return false;
  const first = !pellet.cleared;
  pellet.eaten = pellet.cleared = true;
  pellet.respawnAt =
    time + (pellet.power ? POWER_RETURN_SECONDS : PELLET_RETURN_SECONDS);
  return first;
}
export function refillPellet(pellet: Pellet, time: number) {
  if (!pellet.eaten || time < pellet.respawnAt) return false;
  pellet.eaten = false;
  return true;
}
