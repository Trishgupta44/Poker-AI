/**
 * AI API Client — calls the Python FastAPI backend.
 *
 * All AI computation (Monte Carlo, confidence scoring, bot decisions, etc.)
 * is handled by the Python server at http://127.0.0.1:8000.
 */

import type { HandStrengthResult, ConfidenceResult, AuditResult, OpponentProfile, PreflopStrategyResult, DrawResult, BlockerResult, ScareCardResult } from '../types/ai';
import type { Card } from '../types/card';
import type { PlayerAction, Street, RoundState } from '../types/game';
import type { Player } from '../types/player';

const API_BASE = 'http://127.0.0.1:8000';

// ── Helper: POST to Python API ──────────────────────────────────────────────

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Helper: Sanitize RoundState for API (convert Set → Array, strip secrets) ──

function sanitizeRound(round: RoundState): Record<string, unknown> {
  const { deck, burnCards, playersActedThisStreet, ...rest } = round;
  return {
    ...rest,
    playersActedThisStreet: playersActedThisStreet
      ? Array.from(playersActedThisStreet)
      : [],
  };
}

// ── API Functions ───────────────────────────────────────────────────────────

export async function calculateHandEquity(
  holeCards: Card[],
  communityCards: Card[],
  numOpponents: number,
  street: Street,
  iterations: number = 1000,
  currentBet: number = 0,
  pot: number = 0,
  facingRaise: boolean = false,
): Promise<HandStrengthResult> {
  return apiPost<HandStrengthResult>('/api/hand-equity', {
    holeCards, communityCards, numOpponents, street,
    iterations, currentBet, pot, facingRaise,
  });
}

export async function calculateConfidence(
  profile: OpponentProfile,
  betSizeRatio: number,
  boardTexture: string,
  opponentPosition: 'EARLY' | 'MIDDLE' | 'LATE',
  street: Street,
  priorActions: PlayerAction[],
  opponentStack: number,
  potSize: number,
  roundsSinceBluffCaught: number | null,
  actionTimeMs: number | null = null,
): Promise<ConfidenceResult> {
  return apiPost<ConfidenceResult>('/api/confidence', {
    profile, betSizeRatio, boardTexture, opponentPosition, street,
    priorActions, opponentStack, potSize, roundsSinceBluffCaught, actionTimeMs,
  });
}

export async function decideBotAction(
  bot: Player,
  round: RoundState,
  allPlayers: Player[],
): Promise<{ action: string; amount: number; thinkTimeMs: number }> {
  return apiPost('/api/bot-decision', {
    bot, round: sanitizeRound(round), allPlayers,
  });
}

export async function auditRound(
  round: RoundState,
  players: Player[],
  communityCards: Card[],
): Promise<AuditResult[]> {
  return apiPost<AuditResult[]>('/api/audit-round', {
    round: sanitizeRound(round),
    players,
    communityCards,
  });
}

export async function updateProfile(
  profile: OpponentProfile,
  auditResult: AuditResult,
  boardTexture: string,
  street: Street,
  betSizeRatio: number,
  wasInPosition: boolean,
  actionSequence: string,
  spr: number,
  wasCaughtBluffing: boolean,
  actionTimeMs: number | null = null,
): Promise<OpponentProfile> {
  return apiPost<OpponentProfile>('/api/update-profile', {
    profile, auditResult, boardTexture, street, betSizeRatio,
    wasInPosition, actionSequence, spr, wasCaughtBluffing, actionTimeMs,
  });
}

export async function classifyBoardTexture(communityCards: Card[]): Promise<string> {
  const result = await apiPost<{ texture: string }>('/api/board-texture', {
    communityCards,
  });
  return result.texture;
}

// ── New Feature APIs ────────────────────────────────────────────────────────

export async function getPreflopStrategy(
  holeCards: Card[],
  position: string,
  isFacingRaise: boolean = false,
  isOpenAction: boolean = true,
  foldedToPlayer: boolean = false,
  heroStack: number = 1000,
  currentBet: number = 0,
  pot: number = 0,
): Promise<PreflopStrategyResult> {
  return apiPost<PreflopStrategyResult>('/api/preflop-strategy', {
    holeCards, position, isFacingRaise, isOpenAction, foldedToPlayer,
    heroStack, currentBet, pot,
  });
}

export async function detectDraws(
  holeCards: Card[],
  communityCards: Card[],
): Promise<DrawResult> {
  return apiPost<DrawResult>('/api/detect-draws', { holeCards, communityCards });
}

export async function detectBlockers(
  holeCards: Card[],
  communityCards: Card[],
): Promise<BlockerResult> {
  return apiPost<BlockerResult>('/api/detect-blockers', { holeCards, communityCards });
}

export async function detectScareCards(
  communityCards: Card[],
  newCard?: Card,
  holeCards?: Card[],
): Promise<ScareCardResult> {
  return apiPost<ScareCardResult>('/api/detect-scare-cards', { communityCards, newCard, holeCards });
}

// ── Action Sequence Classifier (simple string helper — no API call needed) ──

export type ActionSequenceType = 'CHECK_RAISE' | 'PASSIVE_THEN_RAISE' | 'PERSISTENT_AGGR' | 'NONE';

export function classifyActionSequence(
  priorActions: PlayerAction[],
  opponentId: string
): ActionSequenceType {
  const opponentActions = priorActions.filter(a => a.playerId === opponentId);
  if (opponentActions.length < 2) return 'NONE';

  const lastTwo = opponentActions.slice(-2);

  // Check-raise: checked then raised
  if (
    lastTwo[0].action === 'CHECK' &&
    (lastTwo[1].action === 'RAISE' || lastTwo[1].action === 'ALL_IN')
  ) {
    return 'CHECK_RAISE';
  }

  // Passive then raise: called then raised
  if (
    lastTwo[0].action === 'CALL' &&
    (lastTwo[1].action === 'RAISE' || lastTwo[1].action === 'ALL_IN')
  ) {
    return 'PASSIVE_THEN_RAISE';
  }

  // Persistent aggression: raised multiple times
  const raiseCount = opponentActions.filter(
    a => a.action === 'RAISE' || a.action === 'ALL_IN'
  ).length;
  if (raiseCount >= 2) {
    return 'PERSISTENT_AGGR';
  }

  return 'NONE';
}
