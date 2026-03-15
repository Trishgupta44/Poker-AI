import type { Player } from '../types/player';
import type { SidePot } from '../types/game';

/**
 * Calculate side pots when players are all-in for different amounts.
 *
 * Algorithm:
 * 1. Get all unique bet levels from players who went all-in
 * 2. For each level, create a pot from contributions up to that level
 * 3. Players who bet at least that level are eligible for that pot
 */
export function calculateSidePots(players: Player[]): SidePot[] {
  const activePlayers = players.filter(p => !p.isFolded && !p.isSittingOut);

  if (activePlayers.length === 0) return [];

  // Get unique sorted bet levels
  const betLevels = [...new Set(
    activePlayers.map(p => p.totalBetThisRound)
  )].sort((a, b) => a - b);

  const sidePots: SidePot[] = [];
  let previousLevel = 0;

  for (const level of betLevels) {
    if (level <= previousLevel) continue;

    let potAmount = 0;
    const eligiblePlayerIds: string[] = [];

    // Include contributions from ALL players (even folded) up to this level
    for (const player of players) {
      if (player.isSittingOut) continue;
      const contribution = Math.min(player.totalBetThisRound, level) - Math.min(player.totalBetThisRound, previousLevel);
      if (contribution > 0) {
        potAmount += contribution;
      }
      // Only non-folded players are eligible to win
      if (!player.isFolded && player.totalBetThisRound >= level) {
        eligiblePlayerIds.push(player.id);
      }
    }

    if (potAmount > 0 && eligiblePlayerIds.length > 0) {
      sidePots.push({ amount: potAmount, eligiblePlayerIds });
    }

    previousLevel = level;
  }

  // Merge consecutive pots with same eligible players
  return mergeSidePots(sidePots);
}

/** Merge adjacent side pots with identical eligible players */
function mergeSidePots(pots: SidePot[]): SidePot[] {
  if (pots.length <= 1) return pots;

  const merged: SidePot[] = [pots[0]];

  for (let i = 1; i < pots.length; i++) {
    const last = merged[merged.length - 1];
    const current = pots[i];

    if (sameEligiblePlayers(last.eligiblePlayerIds, current.eligiblePlayerIds)) {
      last.amount += current.amount;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function sameEligiblePlayers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/**
 * Simple pot total calculation (when no side pots needed).
 * Just sums all bets from all players.
 */
export function calculateTotalPot(players: Player[]): number {
  return players.reduce((sum, p) => sum + p.totalBetThisRound, 0);
}

/**
 * Check if side pots are needed (when any player is all-in with less than max bet)
 */
export function needsSidePots(players: Player[]): boolean {
  const activePlayers = players.filter(p => !p.isFolded && !p.isSittingOut);
  const allInPlayers = activePlayers.filter(p => p.isAllIn);

  if (allInPlayers.length === 0) return false;

  const maxBet = Math.max(...activePlayers.map(p => p.totalBetThisRound));
  return allInPlayers.some(p => p.totalBetThisRound < maxBet);
}
