import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, GameConfig, ActionType } from '../types/game';
import {
  initializeGame,
  startNewRound,
  processPlayerAction,
  getCurrentPlayer,
} from '../engine/game-controller';

interface GameStore {
  // State
  gameState: GameState | null;
  showRevealModal: boolean;
  turnHandoverTarget: string | null;
  isProcessingAction: boolean;
  lastActionTimestamp: number;
  turnStartedAt: number;  // When the current player's turn began (for action speed tracking)

  // Actions
  initGame: (config: GameConfig) => void;
  startRound: () => void;
  submitAction: (playerId: string, action: ActionType, amount: number) => void;
  setShowRevealModal: (show: boolean) => void;
  setTurnHandover: (playerName: string | null) => void;
  resetGame: () => void;
  advanceToNextRound: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: null,
      showRevealModal: false,
      turnHandoverTarget: null,
      isProcessingAction: false,
      lastActionTimestamp: 0,
      turnStartedAt: 0,

      initGame: (config: GameConfig) => {
        const gameState = initializeGame(config);
        set({ gameState, showRevealModal: false, turnHandoverTarget: null });
      },

      startRound: () => {
        try {
          const { gameState } = get();
          if (!gameState) return;

          const newState = startNewRound(gameState);
          set({
            gameState: newState,
            showRevealModal: false,
            lastActionTimestamp: Date.now(),
            turnStartedAt: Date.now(),
          });
        } catch (e) {
          console.error('Error starting round:', e);
        }
      },

      submitAction: (playerId: string, action: ActionType, amount: number) => {
        const { gameState, isProcessingAction, showRevealModal } = get();
        if (!gameState || isProcessingAction) return;
        // Block actions while reveal modal is showing OR round is in SHOWDOWN.
        // Prevents stale bot timeouts from processing actions after the round ended.
        if (showRevealModal) return;
        if (gameState.currentRound?.phase === 'SHOWDOWN') return;

        try {
          const newState = processPlayerAction(gameState, playerId, action, amount);

          // Check if round ended (showdown)
          const isShowdown = newState.currentRound?.phase === 'SHOWDOWN';

          set({
            gameState: newState,
            isProcessingAction: false,
            showRevealModal: isShowdown,
            lastActionTimestamp: Date.now(),
            turnStartedAt: Date.now(),  // Next player's turn starts now
          });
        } catch (error) {
          console.error('Error processing action:', error);
        }
      },

      setShowRevealModal: (show: boolean) => {
        set({ showRevealModal: show });
      },

      setTurnHandover: (playerName: string | null) => {
        set({ turnHandoverTarget: playerName });
      },

      advanceToNextRound: () => {
        try {
          const { gameState } = get();
          if (!gameState) return;

          // ATOMIC: hide modal AND start next round in a single set() call.
          // Previously this used two separate set() calls which caused the modal
          // to dismiss before the new round was ready, making it auto-advance.
          const newState = startNewRound(gameState);
          set({
            gameState: newState,
            showRevealModal: false,
            lastActionTimestamp: Date.now(),
            turnStartedAt: Date.now(),
          });
        } catch (e) {
          console.error('Error advancing to next round:', e);
        }
      },

      resetGame: () => {
        set({
          gameState: null,
          showRevealModal: false,
          turnHandoverTarget: null,
          isProcessingAction: false,
        });
      },
    }),
    {
      name: 'poker-game-store',
      partialize: (state) => ({
        gameState: state.gameState,
        // NOTE: showRevealModal intentionally NOT persisted — it's transient UI state.
        // Persisting it caused infinite audit loops on page refresh (rehydrated as true).
        turnHandoverTarget: state.turnHandoverTarget,
        lastActionTimestamp: state.lastActionTimestamp,
        turnStartedAt: state.turnStartedAt,
      }),
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const parsed = JSON.parse(str);
            // ── Migration: strip fields that are no longer persisted ──
            // partialize no longer saves showRevealModal, but OLD localStorage entries
            // still contain it. Zustand merge would rehydrate the stale value, so delete it.
            if (parsed?.state) {
              delete parsed.state.showRevealModal;
            }
            // If the game was saved mid-SHOWDOWN (page refresh while reveal modal was open),
            // clear currentRound so the game auto-starts a fresh round on mount.
            // Without this, the stale SHOWDOWN state triggers infinite audit API calls.
            const gs = parsed?.state?.gameState;
            if (gs?.currentRound?.phase === 'SHOWDOWN') {
              gs.currentRound = null;
            }
            if (gs?.currentRound?.playersActedThisStreet) {
              const raw = gs.currentRound.playersActedThisStreet;
              gs.currentRound.playersActedThisStreet = new Set(
                Array.isArray(raw) ? raw : Object.keys(raw)
              );
            }
            if (gs?.previousRounds) {
              for (const r of gs.previousRounds) {
                if (r?.playersActedThisStreet) {
                  const raw = r.playersActedThisStreet;
                  r.playersActedThisStreet = new Set(
                    Array.isArray(raw) ? raw : Object.keys(raw)
                  );
                }
              }
            }
            return parsed;
          } catch (e) {
            console.warn('Failed to load game state, starting fresh:', e);
            localStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            // Convert Sets to arrays before serializing
            const clone = JSON.parse(JSON.stringify(value, (_key, val) =>
              val instanceof Set ? [...val] : val
            ));
            localStorage.setItem(name, JSON.stringify(clone));
          } catch (e) {
            console.warn('Failed to persist game state:', e);
            // If quota exceeded, trim roundHistory and retry once
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
              try {
                const trimmed = JSON.parse(JSON.stringify(value, (_key, val) =>
                  val instanceof Set ? [...val] : val
                ));
                // Keep only last 5 rounds of history
                if (trimmed?.state?.gameState?.roundHistory) {
                  trimmed.state.gameState.roundHistory =
                    trimmed.state.gameState.roundHistory.slice(-5);
                }
                localStorage.setItem(name, JSON.stringify(trimmed));
              } catch {
                // Give up silently — game continues in-memory
              }
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

// Selectors
export const selectCurrentPlayer = (state: GameStore) => {
  if (!state.gameState) return null;
  return getCurrentPlayer(state.gameState);
};

export const selectIsHumanTurn = (state: GameStore) => {
  const player = selectCurrentPlayer(state);
  return player?.type === 'HUMAN';
};

export const selectIsBotTurn = (state: GameStore) => {
  const player = selectCurrentPlayer(state);
  return player?.type === 'BOT';
};

export const selectActivePlayers = (state: GameStore) => {
  if (!state.gameState) return [];
  return state.gameState.players.filter(p => !p.isFolded && !p.isSittingOut);
};
