import { nanoid } from 'nanoid';
import type { Card } from '../types/card';
import type { Player } from '../types/player';
import { createHumanPlayer, createBotPlayer, BOT_PERSONALITIES } from '../types/player';
import type {
  GameState, GameConfig, RoundState, ActionType, Street,
  CompletedRound, PlayerRoundResult,
} from '../types/game';
import { createShuffledDeck, burnAndDeal, dealCards } from './deck';
import {
  applyAction, isBettingRoundComplete, getNextActivePlayerIndex,
  countActivePlayers, countActingPlayers, resetStreetBetting,
} from './betting';
import { resolveShowdown } from './showdown';
import { getHandStrengthPercentile } from './hand-evaluator';

// ─── Initialize Game ──────────────────────────────────────────────────────

export function initializeGame(config: GameConfig): GameState {
  const players: Player[] = [];
  let seatIndex = 0;

  if (config.mode === 'VS_BOTS') {
    // Human player at the bottom of the table
    players.push(
      createHumanPlayer(nanoid(), 'You', config.startingChips, seatIndex++, true)
    );

    // Add bot players
    const botCount = Math.min(config.botCount, BOT_PERSONALITIES.length);
    for (let i = 0; i < botCount; i++) {
      players.push(
        createBotPlayer(
          nanoid(),
          BOT_PERSONALITIES[i],
          config.startingChips,
          seatIndex++
        )
      );
    }
  } else {
    // LOCAL_2P mode
    players.push(
      createHumanPlayer(nanoid(), 'Player 1', config.startingChips, seatIndex++, true)
    );
    players.push(
      createHumanPlayer(nanoid(), 'Player 2', config.startingChips, seatIndex++, false)
    );
  }

  return {
    config,
    players,
    currentRound: null,
    roundHistory: [],
    isGameOver: false,
    winnerId: null,
  };
}

// ─── Start New Round ──────────────────────────────────────────────────────

export function startNewRound(state: GameState): GameState {
  const { config, players, roundHistory } = state;
  const roundNumber = roundHistory.length + 1;

  // Reset player per-round state
  const resetPlayers = players.map(p => ({
    ...p,
    holeCards: [] as Card[],
    currentBet: 0,
    totalBetThisRound: 0,
    isFolded: p.chips <= 0, // Can't play with no chips
    isAllIn: false,
    isSittingOut: p.chips <= 0,
  }));

  // Rotate dealer
  const dealerIndex = roundNumber === 1
    ? 0
    : ((state.currentRound?.dealerIndex ?? 0) + 1) % resetPlayers.length;

  // Create shuffled deck
  const deck = createShuffledDeck();

  // Create the round state
  const round: RoundState = {
    roundNumber,
    deck,
    burnCards: [],
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentStreet: 'PREFLOP',
    dealerIndex,
    activePlayerIndex: -1, // Will be set after blinds
    currentBet: 0,
    minRaise: config.bigBlind,
    lastRaiseAmount: config.bigBlind,
    actions: [],
    phase: 'DEALING',
    playersActedThisStreet: new Set(),
  };

  // Post blinds
  const { round: afterBlinds, players: afterBlindPlayers } =
    postBlinds(round, resetPlayers, config);

  // Deal hole cards
  const { round: afterDeal, players: afterDealPlayers } =
    dealHoleCards(afterBlinds, afterBlindPlayers);

  // Set active player (left of big blind for pre-flop)
  const activePlayers = afterDealPlayers.filter(p => !p.isFolded && !p.isSittingOut);
  if (activePlayers.length <= 1) {
    // Not enough players to play
    return state;
  }

  const bbIndex = getBigBlindIndex(dealerIndex, afterDealPlayers);
  const firstToAct = getNextActivePlayerIndex(bbIndex, afterDealPlayers);

  const finalRound: RoundState = {
    ...afterDeal,
    activePlayerIndex: firstToAct,
    phase: 'BETTING',
  };

  return {
    ...state,
    players: afterDealPlayers,
    currentRound: finalRound,
  };
}

// ─── Process Player Action ────────────────────────────────────────────────

export function processPlayerAction(
  state: GameState,
  playerId: string,
  action: ActionType,
  amount: number
): GameState {
  if (!state.currentRound) throw new Error('No active round');
  if (state.currentRound.phase !== 'BETTING') throw new Error('Not in betting phase');

  const currentPlayer = state.players[state.currentRound.activePlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`Not ${playerId}'s turn. Current: ${currentPlayer.id}`);
  }

  // Apply the action
  const actionResult = applyAction(
    state.currentRound, state.players, playerId, action, amount
  );
  let round = actionResult.round;
  const players = actionResult.players;

  // Check if only one player left (everyone else folded)
  const activeCount = countActivePlayers(players);
  if (activeCount <= 1) {
    return goToShowdown({ ...state, currentRound: round, players });
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(round, players)) {
    // Advance to next street or showdown
    return advanceStreet({ ...state, currentRound: round, players });
  }

  // Move to next active player
  const nextIndex = getNextActivePlayerIndex(round.activePlayerIndex, players);
  if (nextIndex === -1) {
    // No more active players can act
    return advanceStreet({ ...state, currentRound: round, players });
  }

  round = { ...round, activePlayerIndex: nextIndex };

  return {
    ...state,
    currentRound: round,
    players,
  };
}

// ─── Advance Street ───────────────────────────────────────────────────────

export function advanceStreet(state: GameState): GameState {
  if (!state.currentRound) throw new Error('No active round');

  const { currentRound: round, players, config } = state;
  const nextStreet = getNextStreet(round.currentStreet);

  if (nextStreet === 'SHOWDOWN' || countActingPlayers(players) <= 1) {
    // If only all-in players remain, deal all remaining community cards
    let updatedState = state;
    if (round.currentStreet === 'PREFLOP') {
      updatedState = dealCommunityCards(updatedState, 'FLOP');
      updatedState = dealCommunityCards(updatedState, 'TURN');
      updatedState = dealCommunityCards(updatedState, 'RIVER');
    } else if (round.currentStreet === 'FLOP') {
      updatedState = dealCommunityCards(updatedState, 'TURN');
      updatedState = dealCommunityCards(updatedState, 'RIVER');
    } else if (round.currentStreet === 'TURN') {
      updatedState = dealCommunityCards(updatedState, 'RIVER');
    }
    return goToShowdown(updatedState);
  }

  // Deal community cards for the new street
  const updatedState = dealCommunityCards(state, nextStreet);

  // Reset betting for new street
  const { round: resetRound, players: resetPlayers } =
    resetStreetBetting(updatedState.currentRound!, updatedState.players, config.bigBlind);

  // First to act post-flop is left of dealer
  const firstToAct = getNextActivePlayerIndex(
    resetRound.dealerIndex, resetPlayers
  );

  const newRound: RoundState = {
    ...resetRound,
    currentStreet: nextStreet,
    activePlayerIndex: firstToAct,
    phase: 'BETTING',
  };

  return {
    ...updatedState,
    currentRound: newRound,
    players: resetPlayers,
  };
}

// ─── Showdown ─────────────────────────────────────────────────────────────

export function goToShowdown(state: GameState): GameState {
  if (!state.currentRound) throw new Error('No active round');

  const { currentRound: round, players } = state;

  // Resolve the showdown
  const showdownResult = resolveShowdown(players, round.communityCards);

  // Apply winnings to player chips
  const updatedPlayers = players.map(p => {
    const won = showdownResult.winnings.get(p.id) ?? 0;
    return {
      ...p,
      chips: p.chips + won,
    };
  });

  // Build completed round record
  const playerResults: PlayerRoundResult[] = players.map(p => {
    const won = showdownResult.winnings.get(p.id) ?? 0;
    const handResult = showdownResult.handResults.get(p.id);
    const lastAction = [...round.actions].reverse().find(a => a.playerId === p.id);

    return {
      playerId: p.id,
      playerName: p.name,
      holeCards: [...p.holeCards],
      finalAction: lastAction?.action ?? 'FOLD',
      chipsWon: won,
      chipsLost: p.totalBetThisRound,
      auditTag: null, // Will be set by post-round audit
      handName: handResult?.name ?? null,
      handStrengthAtShowdown: p.holeCards.length === 2 && round.communityCards.length >= 3
        ? getHandStrengthPercentile(p.holeCards, round.communityCards)
        : null,
    };
  });

  const completedRound: CompletedRound = {
    roundNumber: round.roundNumber,
    communityCards: [...round.communityCards],
    playerResults,
    potTotal: round.pot,
    winnerIds: showdownResult.winnerIds,
  };

  // Check if game is over (only one player with chips)
  const playersWithChips = updatedPlayers.filter(p => p.chips > 0);
  const isGameOver = playersWithChips.length <= 1;

  return {
    ...state,
    players: updatedPlayers,
    currentRound: {
      ...round,
      phase: 'SHOWDOWN',
      sidePots: showdownResult.sidePots,
    },
    roundHistory: [...state.roundHistory, completedRound],
    isGameOver,
    winnerId: isGameOver && playersWithChips.length === 1 ? playersWithChips[0].id : null,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────

function postBlinds(
  round: RoundState,
  players: Player[],
  config: GameConfig
): { round: RoundState; players: Player[] } {
  const sbIndex = getSmallBlindIndex(round.dealerIndex, players);
  const bbIndex = getBigBlindIndex(round.dealerIndex, players);

  // Post small blind
  let result = applyAction(round, players, players[sbIndex].id, 'POST_BLIND', config.smallBlind);
  // Post big blind
  result = applyAction(result.round, result.players, result.players[bbIndex].id, 'POST_BLIND', config.bigBlind);

  // Set current bet to big blind
  result.round = {
    ...result.round,
    currentBet: config.bigBlind,
  };

  return result;
}

function dealHoleCards(
  round: RoundState,
  players: Player[]
): { round: RoundState; players: Player[] } {
  let deck = [...round.deck];
  const updatedPlayers = players.map(p => ({ ...p }));

  // Deal 2 cards to each non-sitting-out player
  for (const player of updatedPlayers) {
    if (!player.isSittingOut) {
      const { dealt, remaining } = dealCards(deck, 2);
      player.holeCards = dealt;
      deck = remaining;
    }
  }

  return {
    round: { ...round, deck },
    players: updatedPlayers,
  };
}

function dealCommunityCards(
  state: GameState,
  street: Street
): GameState {
  if (!state.currentRound) return state;

  let deck = [...state.currentRound.deck];
  let communityCards = [...state.currentRound.communityCards];
  const burnCards = [...state.currentRound.burnCards];

  let count: number;
  switch (street) {
    case 'FLOP': count = 3; break;
    case 'TURN': count = 1; break;
    case 'RIVER': count = 1; break;
    default: return state;
  }

  const { burned, dealt, remaining } = burnAndDeal(deck, count);
  burnCards.push(burned);
  communityCards = [...communityCards, ...dealt];
  deck = remaining;

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      deck,
      communityCards,
      burnCards,
    },
  };
}

function getSmallBlindIndex(dealerIndex: number, players: Player[]): number {
  const n = players.length;
  if (n === 2) {
    // Heads-up: dealer is small blind
    return dealerIndex;
  }
  // Next active player after dealer
  let index = (dealerIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (!players[index].isSittingOut) return index;
    index = (index + 1) % n;
  }
  return (dealerIndex + 1) % n;
}

function getBigBlindIndex(dealerIndex: number, players: Player[]): number {
  const n = players.length;
  if (n === 2) {
    // Heads-up: non-dealer is big blind
    const otherIndex = (dealerIndex + 1) % n;
    return otherIndex;
  }
  // Two positions after dealer
  const sbIndex = getSmallBlindIndex(dealerIndex, players);
  let index = (sbIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (!players[index].isSittingOut) return index;
    index = (index + 1) % n;
  }
  return (sbIndex + 1) % n;
}

function getNextStreet(current: Street): Street {
  switch (current) {
    case 'PREFLOP': return 'FLOP';
    case 'FLOP': return 'TURN';
    case 'TURN': return 'RIVER';
    case 'RIVER': return 'SHOWDOWN';
    default: return 'SHOWDOWN';
  }
}

/** Check if the game should end */
export function checkGameOver(state: GameState): boolean {
  const playersWithChips = state.players.filter(p => p.chips > 0);
  return playersWithChips.length <= 1;
}

/** Get the current active player */
export function getCurrentPlayer(state: GameState): Player | null {
  if (!state.currentRound || state.currentRound.phase !== 'BETTING') return null;
  return state.players[state.currentRound.activePlayerIndex] ?? null;
}
