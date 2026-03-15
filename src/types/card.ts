export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type CardString = `${Rank}${Suit}`;

export const SUITS: Suit[] = ['h', 'd', 'c', 's'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const SUIT_NAMES: Record<Suit, string> = {
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
  s: 'Spades',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  h: '\u2665',
  d: '\u2666',
  c: '\u2663',
  s: '\u2660',
};

export const RANK_NAMES: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace',
};

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, 'T': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function cardToString(card: Card): CardString {
  return `${card.rank}${card.suit}` as CardString;
}

export function stringToCard(str: CardString): Card {
  return {
    rank: str[0] as Rank,
    suit: str[1] as Suit,
  };
}

/** Convert to pokersolver format: "Ad", "Th", etc. */
export function cardToPokerSolver(card: Card): string {
  const rankMap: Record<Rank, string> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', 'T': 'T',
    'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
  };
  const suitMap: Record<Suit, string> = { h: 'h', d: 'd', c: 'c', s: 's' };
  return rankMap[card.rank] + suitMap[card.suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd';
}
