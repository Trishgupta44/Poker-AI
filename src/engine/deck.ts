import type { Card, Suit, Rank } from '../types/card';
import { SUITS, RANKS } from '../types/card';

/** Create a standard 52-card deck */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle using crypto-secure random */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  const n = shuffled.length;

  // Use crypto.getRandomValues for cryptographic randomness
  const randomValues = new Uint32Array(n);
  crypto.getRandomValues(randomValues);

  for (let i = n - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/** Deal `count` cards from the top of the deck */
export function dealCards(
  deck: Card[],
  count: number
): { dealt: Card[]; remaining: Card[] } {
  if (count > deck.length) {
    throw new Error(`Cannot deal ${count} cards from a deck of ${deck.length}`);
  }
  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

/** Burn one card and deal `dealCount` cards (for flop/turn/river) */
export function burnAndDeal(
  deck: Card[],
  dealCount: number
): { burned: Card; dealt: Card[]; remaining: Card[] } {
  if (deck.length < dealCount + 1) {
    throw new Error(`Not enough cards in deck to burn and deal ${dealCount}`);
  }
  const burned = deck[0];
  const dealt = deck.slice(1, 1 + dealCount);
  const remaining = deck.slice(1 + dealCount);
  return { burned, dealt, remaining };
}

/** Create a fresh shuffled deck */
export function createShuffledDeck(): Card[] {
  return shuffleDeck(createDeck());
}

/** Remove specific cards from a deck (for Monte Carlo) */
export function removeCards(deck: Card[], toRemove: Card[]): Card[] {
  const removeSet = new Set(toRemove.map(c => `${c.rank}${c.suit}`));
  return deck.filter(c => !removeSet.has(`${c.rank}${c.suit}`));
}

/** Get a card's display string */
export function cardDisplay(card: Card): string {
  const suitSymbols: Record<Suit, string> = {
    h: '\u2665', d: '\u2666', c: '\u2663', s: '\u2660',
  };
  const rankDisplay: Record<Rank, string> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', 'T': '10',
    'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
  };
  return `${rankDisplay[card.rank]}${suitSymbols[card.suit]}`;
}
