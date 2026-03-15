import type { Player } from '../types/player';
import type { RoundState, ActionType } from '../types/game';

/** Safely convert a value to a Set (handles arrays/objects from JSON persistence) */
function toSet<T>(val: Set<T> | T[] | Record<string, unknown> | undefined): Set<T> {
  if (val instanceof Set) return val;
  if (Array.isArray(val)) return new Set(val);
  return new Set();
}

export interface ValidAction {
  type: ActionType;
  minAmount: number;
  maxAmount: number;
}

/** Get all valid actions for a player given the current round state */
export function getValidActions(
  player: Player,
  round: RoundState,
  players: Player[]
): ValidAction[] {
  if (player.isFolded || player.isAllIn || player.isSittingOut) {
    return [];
  }

  const actions: ValidAction[] = [];
  const toCall = round.currentBet - player.currentBet;
  const canCheck = toCall === 0;

  // FOLD - always available if there's a bet to face
  if (!canCheck) {
    actions.push({ type: 'FOLD', minAmount: 0, maxAmount: 0 });
  }

  // CHECK - only when no bet to face
  if (canCheck) {
    actions.push({ type: 'CHECK', minAmount: 0, maxAmount: 0 });
  }

  // CALL - when there's a bet to match
  if (!canCheck) {
    const callAmount = Math.min(toCall, player.chips);
    if (callAmount > 0) {
      // If calling would put player all-in, it's still a CALL
      actions.push({ type: 'CALL', minAmount: callAmount, maxAmount: callAmount });
    }
  }

  // RAISE - if player has enough chips
  const minRaiseTo = round.currentBet + round.minRaise;
  const maxRaiseTo = player.chips + player.currentBet; // player's total possible bet

  // Only allow raise if there are active players who can still act
  const activePlayers = players.filter(
    p => !p.isFolded && !p.isAllIn && p.id !== player.id
  );

  if (activePlayers.length > 0 && player.chips > toCall) {
    if (maxRaiseTo >= minRaiseTo) {
      actions.push({
        type: 'RAISE',
        minAmount: Math.min(minRaiseTo, maxRaiseTo),
        maxAmount: maxRaiseTo,
      });
    }
    // ALL_IN - always available if player can bet more than call
    actions.push({
      type: 'ALL_IN',
      minAmount: player.chips,
      maxAmount: player.chips,
    });
  } else if (player.chips > 0 && player.chips <= toCall) {
    // Can only call all-in
    actions.push({
      type: 'ALL_IN',
      minAmount: player.chips,
      maxAmount: player.chips,
    });
  }

  return actions;
}

/** Apply a player action to the round state. Returns updated round and players. */
export function applyAction(
  round: RoundState,
  players: Player[],
  playerId: string,
  action: ActionType,
  amount: number
): { round: RoundState; players: Player[] } {
  const playerIndex = players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player ${playerId} not found`);

  const updatedPlayers = players.map(p => ({ ...p }));
  const player = updatedPlayers[playerIndex];
  const updatedRound = {
    ...round,
    actions: [...round.actions],
    playersActedThisStreet: toSet(round.playersActedThisStreet),
  };

  switch (action) {
    case 'FOLD':
      player.isFolded = true;
      break;

    case 'CHECK':
      // No chips moved
      break;

    case 'CALL': {
      const callAmount = Math.min(round.currentBet - player.currentBet, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      player.totalBetThisRound += callAmount;
      updatedRound.pot += callAmount;
      if (player.chips === 0) {
        player.isAllIn = true;
      }
      break;
    }

    case 'RAISE': {
      // `amount` is the raise-to amount (total bet this street)
      const raiseToAmount = Math.min(amount, player.chips + player.currentBet);
      const chipsToPut = raiseToAmount - player.currentBet;
      const raiseIncrement = raiseToAmount - round.currentBet;

      player.chips -= chipsToPut;
      player.currentBet = raiseToAmount;
      player.totalBetThisRound += chipsToPut;
      updatedRound.pot += chipsToPut;
      updatedRound.currentBet = raiseToAmount;
      updatedRound.lastRaiseAmount = raiseIncrement;
      updatedRound.minRaise = Math.max(round.minRaise, raiseIncrement);

      if (player.chips === 0) {
        player.isAllIn = true;
      }

      // Reset who has acted — everyone needs to act again after a raise
      updatedRound.playersActedThisStreet = new Set([playerId]);
      break;
    }

    case 'ALL_IN': {
      const allInAmount = player.chips;
      const newTotalBet = player.currentBet + allInAmount;

      if (newTotalBet > round.currentBet) {
        // This all-in is a raise
        const raiseIncrement = newTotalBet - round.currentBet;
        if (raiseIncrement >= round.minRaise) {
          updatedRound.minRaise = raiseIncrement;
          // Reset actions — full raise reopens action
          updatedRound.playersActedThisStreet = new Set([playerId]);
        }
        updatedRound.currentBet = newTotalBet;
        updatedRound.lastRaiseAmount = raiseIncrement;
      }

      player.currentBet = newTotalBet;
      player.totalBetThisRound += allInAmount;
      updatedRound.pot += allInAmount;
      player.chips = 0;
      player.isAllIn = true;
      break;
    }

    case 'POST_BLIND': {
      const blindAmount = Math.min(amount, player.chips);
      player.chips -= blindAmount;
      player.currentBet = blindAmount;
      player.totalBetThisRound = blindAmount;
      updatedRound.pot += blindAmount;
      if (player.chips === 0) {
        player.isAllIn = true;
      }
      break;
    }
  }

  // Record the action
  updatedRound.actions.push({
    playerId,
    playerName: player.name,
    street: round.currentStreet,
    action,
    amount: action === 'RAISE' ? amount : (action === 'CALL' ? Math.min(round.currentBet - players[playerIndex].currentBet, players[playerIndex].chips) : amount),
    timestamp: Date.now(),
    potBefore: round.pot,
  });

  if (action !== 'POST_BLIND') {
    updatedRound.playersActedThisStreet.add(playerId);
  }

  return { round: updatedRound, players: updatedPlayers };
}

/** Check if the current betting round is complete */
export function isBettingRoundComplete(
  round: RoundState,
  players: Player[]
): boolean {
  const activePlayers = players.filter(p => !p.isFolded && !p.isSittingOut);
  const nonAllInActive = activePlayers.filter(p => !p.isAllIn);

  // Only one player left (everyone else folded)
  if (activePlayers.length <= 1) return true;

  // All active non-all-in players have acted and bets match
  if (nonAllInActive.length === 0) return true;
  if (nonAllInActive.length === 1 && nonAllInActive[0].currentBet >= round.currentBet) {
    // Only one non-all-in player, and they've matched the bet
    return toSet(round.playersActedThisStreet).has(nonAllInActive[0].id);
  }

  // All non-all-in players must have acted AND matched the current bet
  const acted = toSet(round.playersActedThisStreet);
  return nonAllInActive.every(
    p => acted.has(p.id) && p.currentBet === round.currentBet
  );
}

/** Get the next active player index (clockwise) */
export function getNextActivePlayerIndex(
  currentIndex: number,
  players: Player[]
): number {
  const n = players.length;
  let nextIndex = (currentIndex + 1) % n;

  for (let i = 0; i < n; i++) {
    const player = players[nextIndex];
    if (!player.isFolded && !player.isAllIn && !player.isSittingOut) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % n;
  }

  return -1; // No active player found
}

/** Count players still in the hand (not folded) */
export function countActivePlayers(players: Player[]): number {
  return players.filter(p => !p.isFolded && !p.isSittingOut).length;
}

/** Count players who can still act (not folded, not all-in) */
export function countActingPlayers(players: Player[]): number {
  return players.filter(p => !p.isFolded && !p.isAllIn && !p.isSittingOut).length;
}

/** Reset per-street betting state */
export function resetStreetBetting(
  round: RoundState,
  players: Player[],
  bigBlind: number
): { round: RoundState; players: Player[] } {
  const updatedPlayers = players.map(p => ({
    ...p,
    currentBet: 0,
  }));

  const updatedRound: RoundState = {
    ...round,
    currentBet: 0,
    minRaise: bigBlind,
    lastRaiseAmount: bigBlind,
    playersActedThisStreet: new Set<string>(),
  };

  return { round: updatedRound, players: updatedPlayers };
}
