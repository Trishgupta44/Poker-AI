import type { ConfidenceResult, OpponentProfile } from '../types/ai';
import type { CompletedRound, GameState, ActionType } from '../types/game';
import type { Player } from '../types/player';

export interface PlayerStats {
  id: string;
  name: string;
  chips: number;
  netChips: number;
  roundsWon: number;
  chipsWon: number;
  chipsLost: number;
  folds: number;
  calls: number;
  raises: number;
  checks: number;
  allIns: number;
  showdowns: number;
  avgShowdownStrength: number | null;
}

export interface ProfileStats {
  id: string;
  name: string;
  hands: number;
  bluffFrequency: number;
  passivePlayRate: number;
  slowPlayFrequency: number;
  overbetBluffRate: number;
  riverBluffRate: number;
  snapActionBluffRate: number;
  slowActionBluffRate: number;
  confidenceScore: number | null;
  confidenceLabel: string | null;
}

export interface DerivedGameStats {
  roundsPlayed: number;
  totalPot: number;
  averagePot: number;
  largestPot: number;
  potTrend: Array<{ label: string; value: number }>;
  actionBreakdown: Array<{ label: string; value: number }>;
  profileBluffRates: Array<{ label: string; value: number }>;
  profileExperience: Array<{ label: string; value: number }>;
  confidenceScores: Array<{ label: string; value: number }>;
  playerStats: PlayerStats[];
  profileStats: ProfileStats[];
  equityHistory: Array<{ label: string; value: number }>;
  recentRounds: CompletedRound[];
}

const ACTION_LABELS: Record<ActionType, string> = {
  FOLD: 'Fold',
  CHECK: 'Check',
  CALL: 'Call',
  RAISE: 'Raise',
  ALL_IN: 'All-in',
  POST_BLIND: 'Blind',
};

export function deriveGameStats(
  gameState: GameState,
  profiles: Record<string, OpponentProfile>,
  confidenceScores: Record<string, ConfidenceResult>,
  equityHistory: number[],
): DerivedGameStats {
  const rounds = gameState.roundHistory;
  const totalPot = rounds.reduce((sum, round) => sum + round.potTotal, 0);
  const largestPot = rounds.reduce((max, round) => Math.max(max, round.potTotal), 0);

  const actionCounts = new Map<ActionType, number>();
  const bumpAction = (action: ActionType) => {
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
  };

  rounds.forEach(round => {
    round.playerResults.forEach(result => bumpAction(result.finalAction));
  });
  gameState.currentRound?.actions.forEach(action => bumpAction(action.action));

  return {
    roundsPlayed: rounds.length,
    totalPot,
    averagePot: rounds.length > 0 ? Math.round(totalPot / rounds.length) : 0,
    largestPot,
    potTrend: rounds.map(round => ({
      label: `R${round.roundNumber}`,
      value: round.potTotal,
    })),
    actionBreakdown: Array.from(actionCounts.entries())
      .filter(([action]) => action !== 'POST_BLIND')
      .map(([action, value]) => ({ label: ACTION_LABELS[action], value })),
    playerStats: buildPlayerStats(gameState.players, rounds, gameState.config.startingChips),
    profileStats: buildProfileStats(gameState.players, profiles, confidenceScores),
    profileBluffRates: buildProfileStats(gameState.players, profiles, confidenceScores).map(profile => ({
      label: profile.name,
      value: profile.bluffFrequency,
    })),
    profileExperience: buildProfileStats(gameState.players, profiles, confidenceScores).map(profile => ({
      label: profile.name,
      value: profile.hands,
    })),
    confidenceScores: buildProfileStats(gameState.players, profiles, confidenceScores)
      .filter(profile => profile.confidenceScore != null)
      .map(profile => ({
        label: profile.name,
        value: profile.confidenceScore ?? 0,
      })),
    equityHistory: equityHistory.map((value, index) => ({
      label: `${index + 1}`,
      value,
    })),
    recentRounds: rounds.slice(-6).reverse(),
  };
}

function buildPlayerStats(
  players: Player[],
  rounds: CompletedRound[],
  startingChips: number,
): PlayerStats[] {
  return players.map(player => {
    const results = rounds.flatMap(round =>
      round.playerResults.filter(result => result.playerId === player.id)
    );
    const strengthValues = results
      .map(result => result.handStrengthAtShowdown)
      .filter((value): value is number => value != null);

    return {
      id: player.id,
      name: player.name,
      chips: player.chips,
      netChips: player.chips - startingChips,
      roundsWon: rounds.filter(round => round.winnerIds.includes(player.id)).length,
      chipsWon: results.reduce((sum, result) => sum + result.chipsWon, 0),
      chipsLost: results.reduce((sum, result) => sum + result.chipsLost, 0),
      folds: results.filter(result => result.finalAction === 'FOLD').length,
      calls: results.filter(result => result.finalAction === 'CALL').length,
      raises: results.filter(result => result.finalAction === 'RAISE').length,
      checks: results.filter(result => result.finalAction === 'CHECK').length,
      allIns: results.filter(result => result.finalAction === 'ALL_IN').length,
      showdowns: strengthValues.length,
      avgShowdownStrength: strengthValues.length > 0
        ? Math.round(strengthValues.reduce((sum, value) => sum + value, 0) / strengthValues.length)
        : null,
    };
  });
}

function buildProfileStats(
  players: Player[],
  profiles: Record<string, OpponentProfile>,
  confidenceScores: Record<string, ConfidenceResult>,
): ProfileStats[] {
  const playerIds = new Set(players.map(player => player.id));

  return Object.values(profiles)
    .filter(profile => playerIds.has(profile.subjectId))
    .map(profile => {
      const confidence = confidenceScores[profile.subjectId];
      return {
        id: profile.subjectId,
        name: profile.subjectName,
        hands: profile.totalHands,
        bluffFrequency: Math.round(profile.bluffFrequency * 100),
        passivePlayRate: Math.round(profile.passivePlayRate * 100),
        slowPlayFrequency: Math.round(profile.slowPlayFrequency * 100),
        overbetBluffRate: Math.round(profile.overbetBluffRate * 100),
        riverBluffRate: Math.round(profile.riverBluffRate * 100),
        snapActionBluffRate: Math.round(profile.snapActionBluffRate * 100),
        slowActionBluffRate: Math.round(profile.slowActionBluffRate * 100),
        confidenceScore: confidence?.score ?? null,
        confidenceLabel: confidence?.label ?? null,
      };
    })
    .sort((a, b) => b.hands - a.hands);
}
