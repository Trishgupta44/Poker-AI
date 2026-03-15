import { Hand } from 'pokersolver';
import type { Card } from '../types/card';
import { cardToPokerSolver } from '../types/card';

export interface EvaluatedHand {
  rank: number;
  name: string;
  description: string;
  cards: Card[];
}

/** Evaluate a poker hand from hole cards + community cards */
export function evaluateHand(
  holeCards: Card[],
  communityCards: Card[]
): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];
  const psCards = allCards.map(cardToPokerSolver);
  const solved = Hand.solve(psCards);

  return {
    rank: solved.rank,
    name: solved.name,
    description: solved.descr,
    cards: allCards,
  };
}

/** Compare multiple hands and return the winner(s) */
export function compareHands(
  hands: Array<{ playerId: string; holeCards: Card[]; communityCards: Card[] }>
): { winnerIds: string[]; isTie: boolean } {
  const solvedHands = hands.map(h => {
    const allCards = [...h.holeCards, ...h.communityCards];
    const psCards = allCards.map(cardToPokerSolver);
    return {
      playerId: h.playerId,
      solved: Hand.solve(psCards),
    };
  });

  const winners = Hand.winners(solvedHands.map(h => h.solved));

  const winnerIds = solvedHands
    .filter(h => winners.includes(h.solved))
    .map(h => h.playerId);

  return {
    winnerIds,
    isTie: winnerIds.length > 1,
  };
}

/**
 * Map a hand rank to a 0-100 percentile.
 * pokersolver ranks: higher rank = better hand.
 * Max rank varies but Royal Flush is around 10, High Card is 1.
 * We use the hand name to bucket into percentile ranges.
 */
export function getHandStrengthPercentile(
  holeCards: Card[],
  communityCards: Card[]
): number {
  const evaluated = evaluateHand(holeCards, communityCards);
  return handNameToPercentile(evaluated.name, evaluated.rank);
}

function handNameToPercentile(name: string, rank: number): number {
  // Map hand categories to approximate percentile ranges
  // These represent roughly where in the distribution of all possible hands this falls
  const basePercentiles: Record<string, [number, number]> = {
    'Royal Flush': [99.5, 100],
    'Straight Flush': [99, 99.5],
    'Four of a Kind': [97, 99],
    'Full House': [93, 97],
    'Flush': [88, 93],
    'Straight': [82, 88],
    'Three of a Kind': [72, 82],
    'Two Pair': [55, 72],
    'Pair': [25, 55],
    'High Card': [0, 25],
  };

  const range = basePercentiles[name];
  if (!range) return 50; // fallback

  // Use the rank to interpolate within the range
  // Higher rank within the category = higher percentile
  const spread = range[1] - range[0];
  const normalized = Math.min(1, Math.max(0, (rank % 100) / 100));
  return range[0] + spread * normalized;
}

/** Get a human-readable hand category for explanation engine */
export function getHandCategory(
  holeCards: Card[],
  communityCards: Card[]
): string {
  if (communityCards.length === 0) {
    return getPreflopCategory(holeCards);
  }

  const evaluated = evaluateHand(holeCards, communityCards);
  return evaluated.name;
}

function getPreflopCategory(holeCards: Card[]): string {
  if (holeCards.length !== 2) return 'Unknown';

  const [c1, c2] = holeCards;
  const isPair = c1.rank === c2.rank;
  const isSuited = c1.suit === c2.suit;

  if (isPair) {
    const rank = c1.rank;
    if (['A', 'K', 'Q', 'J'].includes(rank)) return 'Premium Pair';
    if (['T', '9', '8'].includes(rank)) return 'Medium Pair';
    return 'Small Pair';
  }

  const ranks = [c1.rank, c2.rank].sort(
    (a, b) => '23456789TJQKA'.indexOf(b) - '23456789TJQKA'.indexOf(a)
  );

  const highRank = ranks[0];
  const hasAce = highRank === 'A';
  const hasKing = highRank === 'K';

  if (hasAce && ['K', 'Q', 'J'].includes(ranks[1])) {
    return isSuited ? 'Premium Suited' : 'Premium Offsuit';
  }
  if (hasAce || hasKing) {
    return isSuited ? 'Strong Suited' : 'Strong Offsuit';
  }

  // Check for connectors
  const gap = '23456789TJQKA'.indexOf(ranks[0]) - '23456789TJQKA'.indexOf(ranks[1]);
  if (gap <= 2) {
    return isSuited ? 'Suited Connector' : 'Connected';
  }

  return isSuited ? 'Suited Cards' : 'Weak Hand';
}
