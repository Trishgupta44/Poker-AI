import type { Card } from './card';

export type PlayerType = 'HUMAN' | 'BOT';

export interface BotPersonality {
  name: string;
  aggressiveness: number;   // 0-1: tendency to raise vs call
  bluffFrequency: number;   // 0-1: how often to bluff
  tightness: number;        // 0-1: hand range tightness (1 = very tight)
  description: string;
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  chips: number;
  holeCards: Card[];
  currentBet: number;        // amount bet on current street
  totalBetThisRound: number; // total committed this round
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  seatIndex: number;
  botPersonality: BotPersonality | null;
  hasAIAssistance: boolean;
}

export const BOT_PERSONALITIES: BotPersonality[] = [
  {
    name: 'Viktor',
    aggressiveness: 0.7,
    bluffFrequency: 0.15,
    tightness: 0.75,
    description: 'Very honest. Plays tight, rarely bluffs — what you see is what you get.',
  },
  {
    name: 'Luna',
    aggressiveness: 0.85,
    bluffFrequency: 0.55,
    tightness: 0.3,
    description: 'Aggressive and tricky. Bets hard, bluffs often with big bets.',
  },
  {
    name: 'Rex',
    aggressiveness: 0.3,
    bluffFrequency: 0.65,
    tightness: 0.35,
    description: 'Passive but sneaky. Calls a lot, then surprises with bluffs.',
  },
];

export function createHumanPlayer(
  id: string,
  name: string,
  chips: number,
  seatIndex: number,
  hasAIAssistance: boolean
): Player {
  return {
    id,
    name,
    type: 'HUMAN',
    chips,
    holeCards: [],
    currentBet: 0,
    totalBetThisRound: 0,
    isFolded: false,
    isAllIn: false,
    isSittingOut: false,
    seatIndex,
    botPersonality: null,
    hasAIAssistance,
  };
}

export function createBotPlayer(
  id: string,
  personality: BotPersonality,
  chips: number,
  seatIndex: number
): Player {
  return {
    id,
    name: personality.name,
    type: 'BOT',
    chips,
    holeCards: [],
    currentBet: 0,
    totalBetThisRound: 0,
    isFolded: false,
    isAllIn: false,
    isSittingOut: false,
    seatIndex,
    botPersonality: personality,
    hasAIAssistance: false,
  };
}
