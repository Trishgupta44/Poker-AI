import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game-store';
import * as aiApi from '../api/ai-api';
import { getValidActions } from '../engine/betting';
import type { ActionType } from '../types/game';

/**
 * Hook that drives bot decision-making.
 * When it's a bot's turn, calls the Python API for a decision after a simulated think delay.
 */
export function useBotActions() {
  const gameState = useGameStore(s => s.gameState);
  const submitAction = useGameStore(s => s.submitAction);
  const isProcessingAction = useGameStore(s => s.isProcessingAction);
  const showRevealModal = useGameStore(s => s.showRevealModal);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDecidingRef = useRef(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gameState?.currentRound) return;
    if (gameState.currentRound.phase !== 'BETTING') return;
    if (isProcessingAction) return;
    if (showRevealModal) return;

    const currentPlayer = gameState.players[gameState.currentRound.activePlayerIndex];
    if (!currentPlayer || currentPlayer.type !== 'BOT') return;

    // Prevent duplicate decisions while async call is in flight
    if (isDecidingRef.current) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Bot's turn — call Python API for decision (async)
    isDecidingRef.current = true;
    let cancelled = false; // Cancellation flag for stale async callbacks

    (async () => {
      try {
        const decision = await aiApi.decideBotAction(
          currentPlayer,
          gameState.currentRound!,
          gameState.players
        );

        // If the effect was cleaned up while API was in flight, bail out
        if (cancelled) { isDecidingRef.current = false; return; }

        // Validate the bot's action against legal actions
        const validActions = getValidActions(currentPlayer, gameState.currentRound!, gameState.players);
        const validTypes = validActions.map(a => a.type);
        let finalAction: ActionType = decision.action as ActionType;
        let finalAmount = decision.amount;

        if (!validTypes.includes(finalAction)) {
          // Bot returned an invalid action — find best fallback
          if (validTypes.includes('CALL')) {
            const callAction = validActions.find(a => a.type === 'CALL')!;
            finalAction = 'CALL';
            finalAmount = callAction.minAmount;
          } else if (validTypes.includes('ALL_IN')) {
            const allInAction = validActions.find(a => a.type === 'ALL_IN')!;
            finalAction = 'ALL_IN';
            finalAmount = allInAction.minAmount;
          } else if (validTypes.includes('CHECK')) {
            finalAction = 'CHECK';
            finalAmount = 0;
          } else {
            finalAction = 'FOLD';
            finalAmount = 0;
          }
          console.warn(`Bot ${currentPlayer.name}: invalid action "${decision.action}" → fallback to "${finalAction}"`);
        }

        timeoutRef.current = setTimeout(() => {
          isDecidingRef.current = false;
          submitAction(currentPlayer.id, finalAction, finalAmount);
        }, decision.thinkTimeMs);
      } catch (e) {
        console.error('Bot decision error:', e);
        if (!cancelled) isDecidingRef.current = false;
      }
    })();

    // Cleanup: cancel stale async callbacks and clear pending timeouts.
    // This prevents stale bot decisions from firing submitAction after
    // the game has moved on (e.g., to SHOWDOWN), which could dismiss
    // the reveal modal by setting showRevealModal back to false.
    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isDecidingRef.current = false;
    };
  }, [
    gameState?.currentRound?.activePlayerIndex,
    gameState?.currentRound?.phase,
    gameState?.currentRound?.currentStreet,
    isProcessingAction,
    showRevealModal,
    gameState,
    submitAction,
  ]);
}
