declare module 'pokersolver' {
  export class Hand {
    static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand;
    static winners(hands: Hand[]): Hand[];
    cardPool: Array<{ value: string; suit: string }>;
    cards: Array<{ value: string; suit: string }>;
    name: string;
    descr: string;
    rank: number;
    toString(): string;
  }
}
