import type { Card } from './card';
import type { Player } from './player';
import type { AuditTag } from './ai';

export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN' | 'POST_BLIND';
export type GameMode = 'VS_BOTS' | 'LOCAL_2P';
export type RoundPhase = 'DEALING' | 'BETTING' | 'SHOWDOWN' | 'COMPLETE';

export interface PlayerAction {
  playerId: string;
  playerName: string;
  street: Street;
  action: ActionType;
  amount: number;
  timestamp: number;
  potBefore?: number;  // pot before this action was applied
}

export interface GameConfig {
  mode: GameMode;
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  botCount: number;
  aiAssistedPlayerIds: string[];
  actionTimerSeconds: number;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface RoundState {
  roundNumber: number;
  deck: Card[];
  burnCards: Card[];
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  currentStreet: Street;
  dealerIndex: number;
  activePlayerIndex: number;
  currentBet: number;
  minRaise: number;
  lastRaiseAmount: number;
  actions: PlayerAction[];
  phase: RoundPhase;
  playersActedThisStreet: Set<string>;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  currentRound: RoundState | null;
  roundHistory: CompletedRound[];
  isGameOver: boolean;
  winnerId: string | null;
}

export interface CompletedRound {
  roundNumber: number;
  communityCards: Card[];
  playerResults: PlayerRoundResult[];
  potTotal: number;
  winnerIds: string[];
}

export interface PlayerRoundResult {
  playerId: string;
  playerName: string;
  holeCards: Card[];
  finalAction: ActionType;
  chipsWon: number;
  chipsLost: number;
  auditTag: AuditTag | null;
  handName: string | null;
  handStrengthAtShowdown: number | null;
}
