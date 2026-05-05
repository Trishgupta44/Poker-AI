import type { Street } from './game';

export type AuditTag = 'BLUFF' | 'VALUE_BET' | 'SLOW_PLAY' | 'PASSIVE' | 'FOLD' | 'NO_TAG';
export type BoardTexture = 'DRY' | 'WET' | 'PAIRED';

export type RecommendedAction = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL-IN';

export interface HandStrengthResult {
  equity: number;              // 0-100 percentage
  handCategory: string;        // e.g. "Top Pair", "Flush Draw"
  explanation: string;         // 1-2 sentence plain English
  recommendedAction: RecommendedAction;
  recommendationReason: string;
  street: Street;
  simulationCount: number;
}

export interface ConfidenceResult {
  opponentId: string;
  opponentName: string;
  score: number | null;        // 0-100, null if insufficient data
  label: string;
  explanation: string;
  dataSufficient: boolean;
  handsRecorded: number;
  featureBreakdown?: {
    [featureName: string]: {
      favoursBluff: boolean;
      note: string;
    };
  };
}

export interface OpponentProfile {
  subjectId: string;
  subjectName: string;
  totalHands: number;
  bluffFrequency: number;
  overbetBluffRate: number;
  dryBoardBluffRate: number;
  wetBoardBluffRate: number;
  slowPlayFrequency: number;
  passivePlayRate: number;
  lastUpdated: number;

  // ── Street conditionals ──
  flopBluffRate: number;       // P(bluff | flop)
  turnBluffRate: number;       // P(bluff | turn)
  riverBluffRate: number;      // P(bluff | river)
  flopValueRate: number;       // P(value | flop)
  turnValueRate: number;       // P(value | turn)
  riverValueRate: number;      // P(value | river)

  // ── Sizing conditionals ──
  smallBetBluffRate: number;   // P(bluff | small bet <0.5x)
  smallBetValueRate: number;   // P(value | small bet <0.5x)
  medBetBluffRate: number;     // P(bluff | med bet 0.5-1x)
  medBetValueRate: number;     // P(value | med bet 0.5-1x)
  ovBetValueRate: number;      // P(value | overbet >1x)

  // ── Position conditionals ──
  inPosBluffRate: number;      // P(bluff | in position)
  inPosValueRate: number;      // P(value | in position)

  // ── Sequence conditionals ──
  checkRaiseBluffRate: number;
  checkRaiseValueRate: number;
  passiveRaiseBluffRate: number;
  passiveRaiseValueRate: number;
  persistentAggrBluffRate: number;
  persistentAggrValueRate: number;

  // ── SPR conditionals ──
  lowSprBluffRate: number;     // P(bluff | SPR < 3)
  lowSprValueRate: number;     // P(value | SPR < 3)
  highSprBluffRate: number;    // P(bluff | SPR > 8)
  highSprValueRate: number;    // P(value | SPR > 8)

  // ── Recency ──
  lastCaughtRoundsAgo: number | null;

  // ── Action Speed conditionals (Feature 8) ──
  snapActionBluffRate: number;   // P(bluff | action < 3s)
  snapActionValueRate: number;   // P(value | action < 3s)
  slowActionBluffRate: number;   // P(bluff | action > 8s)
  slowActionValueRate: number;   // P(value | action > 8s)

  // ── Donk Bet conditionals (Feature A3) ──
  donkBetBluffRate: number;      // P(bluff | donk bet)
  donkBetValueRate: number;      // P(value | donk bet)
}

export interface AuditResult {
  playerId: string;
  playerName: string;
  tag: AuditTag;
  handStrengthPercentile: number;
  betSizeRatio: number;
  street: Street;
}

export interface PreflopStrategyResult {
  action: string;
  reason: string;
  confidence: number;
  hand_tier: number;
}

export interface DrawResult {
  flush_draw: boolean;
  flush_draw_suit: string | null;
  flush_draw_outs: number;
  straight_draw: boolean;
  straight_draw_type: 'OPEN_ENDED' | 'GUTSHOT' | null;
  straight_draw_outs: number;
  combo_draw: boolean;
  backdoor_flush: boolean;
  backdoor_straight: boolean;
  total_outs: number;
  draw_strength: number;
  explanation: string;
}

export interface BlockerResult {
  blocks_nut_flush: boolean;
  blocks_flush: boolean;
  blocks_top_pair: boolean;
  blocks_overpair: boolean;
  blocks_set: boolean;
  blocks_straight: boolean;
  blocker_score: number;
  blockers: string[];
  explanation: string;
  straightBlockerCards: string[];
  flushBlockerCard: string | null;
}

export interface ScareCardResult {
  scare_level: number;
  reasons: string[];
  is_flush_completing: boolean;
  is_straight_completing: boolean;
  is_pairing: boolean;
  is_overcard: boolean;
  board_scariness: 'SAFE' | 'MILD' | 'SCARY' | 'VERY_SCARY';
  affectsUs: boolean;
  affectsThem: boolean;
}

export interface TrainingStatsPoint {
  label: string;
  value: number;
  labelled?: number;
}

export interface TrainingStatsRecentHand {
  roundNumber: number;
  potTotal: number;
  actionCount: number;
  examples: number;
  labelled: number;
  aggressiveActions: number;
}

export interface TrainingStatsResult {
  dbPath: string;
  hands: number;
  actions: number;
  trainingExamples: number;
  labelledExamples: number;
  labelCoverage: number;
  actionDistribution: TrainingStatsPoint[];
  tagDistribution: TrainingStatsPoint[];
  streetDistribution: TrainingStatsPoint[];
  learningCurve: TrainingStatsPoint[];
  recentHands: TrainingStatsRecentHand[];
}

export function createDefaultProfile(subjectId: string, subjectName: string): OpponentProfile {
  return {
    subjectId,
    subjectName,
    totalHands: 0,
    bluffFrequency: 0.40,
    overbetBluffRate: 0.55,
    dryBoardBluffRate: 0.45,
    wetBoardBluffRate: 0.35,
    slowPlayFrequency: 0.25,
    passivePlayRate: 0.25,
    lastUpdated: Date.now(),

    // Street conditionals (population priors)
    flopBluffRate: 0.45,
    turnBluffRate: 0.40,
    riverBluffRate: 0.35,
    flopValueRate: 0.35,
    turnValueRate: 0.40,
    riverValueRate: 0.45,

    // Sizing conditionals
    smallBetBluffRate: 0.30,
    smallBetValueRate: 0.40,
    medBetBluffRate: 0.45,
    medBetValueRate: 0.45,
    ovBetValueRate: 0.20,

    // Position conditionals
    inPosBluffRate: 0.55,
    inPosValueRate: 0.45,

    // Sequence conditionals
    checkRaiseBluffRate: 0.45,
    checkRaiseValueRate: 0.35,
    passiveRaiseBluffRate: 0.50,
    passiveRaiseValueRate: 0.30,
    persistentAggrBluffRate: 0.40,
    persistentAggrValueRate: 0.40,

    // SPR conditionals
    lowSprBluffRate: 0.25,
    lowSprValueRate: 0.35,
    highSprBluffRate: 0.55,
    highSprValueRate: 0.30,

    // Recency
    lastCaughtRoundsAgo: null,

    // Action Speed conditionals
    snapActionBluffRate: 0.35,
    snapActionValueRate: 0.45,
    slowActionBluffRate: 0.60,
    slowActionValueRate: 0.20,

    // Donk Bet conditionals
    donkBetBluffRate: 0.55,
    donkBetValueRate: 0.45,
  };
}
