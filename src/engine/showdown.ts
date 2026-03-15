import type { Card } from '../types/card';
import type { Player } from '../types/player';
import type { SidePot } from '../types/game';
import { compareHands, evaluateHand } from './hand-evaluator';
import { calculateSidePots, needsSidePots } from './pot';

export interface ShowdownResult {
  /** Map of playerId -> chips won */
  winnings: Map<string, number>;
  /** For each player, their evaluated hand */
  handResults: Map<string, { name: string; description: string; rank: number }>;
  /** Player IDs who won at least one pot */
  winnerIds: string[];
  /** Side pots used in resolution */
  sidePots: SidePot[];
}

/**
 * Resolve the showdown: evaluate all hands, distribute pots to winners.
 */
export function resolveShowdown(
  players: Player[],
  communityCards: Card[]
): ShowdownResult {
  const activePlayers = players.filter(p => !p.isFolded && !p.isSittingOut);
  const winnings = new Map<string, number>();
  const handResults = new Map<string, { name: string; description: string; rank: number }>();

  // Initialize winnings to 0
  for (const p of players) {
    winnings.set(p.id, 0);
  }

  // Evaluate all active hands
  for (const player of activePlayers) {
    if (player.holeCards.length === 2 && communityCards.length >= 3) {
      const evaluated = evaluateHand(player.holeCards, communityCards);
      handResults.set(player.id, {
        name: evaluated.name,
        description: evaluated.description,
        rank: evaluated.rank,
      });
    }
  }

  // If only one player remains (everyone else folded), they win the pot
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const totalPot = players.reduce((sum, p) => sum + p.totalBetThisRound, 0);
    winnings.set(winner.id, totalPot);
    return {
      winnings,
      handResults,
      winnerIds: [winner.id],
      sidePots: [],
    };
  }

  // Calculate side pots if needed
  let sidePots: SidePot[];
  if (needsSidePots(players)) {
    sidePots = calculateSidePots(players);
  } else {
    // Single main pot
    const totalPot = players.reduce((sum, p) => sum + p.totalBetThisRound, 0);
    sidePots = [{
      amount: totalPot,
      eligiblePlayerIds: activePlayers.map(p => p.id),
    }];
  }

  const allWinnerIds = new Set<string>();

  // Resolve each pot
  for (const pot of sidePots) {
    const eligibleWithCards = pot.eligiblePlayerIds.filter(id => {
      const player = players.find(p => p.id === id);
      return player && !player.isFolded && player.holeCards.length === 2;
    });

    if (eligibleWithCards.length === 0) continue;

    if (eligibleWithCards.length === 1) {
      // Only one eligible player for this pot
      const currentWinnings = winnings.get(eligibleWithCards[0]) ?? 0;
      winnings.set(eligibleWithCards[0], currentWinnings + pot.amount);
      allWinnerIds.add(eligibleWithCards[0]);
      continue;
    }

    // Compare hands of eligible players
    const handsToCompare = eligibleWithCards.map(id => {
      const player = players.find(p => p.id === id)!;
      return {
        playerId: id,
        holeCards: player.holeCards,
        communityCards,
      };
    });

    const { winnerIds } = compareHands(handsToCompare);

    // Split pot evenly among winners
    const share = Math.floor(pot.amount / winnerIds.length);
    const remainder = pot.amount - share * winnerIds.length;

    for (let i = 0; i < winnerIds.length; i++) {
      const id = winnerIds[i];
      const bonus = i === 0 ? remainder : 0; // Odd chips to first winner
      const currentWinnings = winnings.get(id) ?? 0;
      winnings.set(id, currentWinnings + share + bonus);
      allWinnerIds.add(id);
    }
  }

  return {
    winnings,
    handResults,
    winnerIds: [...allWinnerIds],
    sidePots,
  };
}
