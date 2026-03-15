/**
 * Hook that watches game state changes and plays appropriate sound effects.
 */

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game-store';
import { playSound } from './useSound';

export function useGameSounds() {
  const gameState = useGameStore(s => s.gameState);
  const showRevealModal = useGameStore(s => s.showRevealModal);

  // Track previous values to detect changes
  const prevRoundNumberRef = useRef<number | null>(null);
  const prevActionCountRef = useRef<number>(0);
  const prevStreetRef = useRef<string | null>(null);
  const prevShowRevealRef = useRef(false);

  // ── New round started ──
  useEffect(() => {
    if (!gameState?.currentRound) return;
    const roundNum = gameState.currentRound.roundNumber;

    if (prevRoundNumberRef.current !== null && roundNum !== prevRoundNumberRef.current) {
      playSound('round-start');
    }
    prevRoundNumberRef.current = roundNum;
  }, [gameState?.currentRound?.roundNumber]);

  // ── New street (community cards dealt) ──
  useEffect(() => {
    if (!gameState?.currentRound) return;
    const street = gameState.currentRound.currentStreet;

    if (prevStreetRef.current !== null && street !== prevStreetRef.current) {
      // Cards were dealt for new street
      if (street !== 'PREFLOP') {
        setTimeout(() => playSound('card-deal'), 200);
      }
    }
    prevStreetRef.current = street;
  }, [gameState?.currentRound?.currentStreet]);

  // ── Player action occurred ──
  useEffect(() => {
    if (!gameState?.currentRound) return;
    const actions = gameState.currentRound.actions;
    const actionCount = actions.length;

    if (actionCount > prevActionCountRef.current && prevActionCountRef.current > 0) {
      // A new action was added
      const lastAction = actions[actions.length - 1];
      if (lastAction) {
        switch (lastAction.action) {
          case 'FOLD':
            playSound('fold');
            break;
          case 'CHECK':
            playSound('check');
            break;
          case 'CALL':
            playSound('chip-bet');
            break;
          case 'RAISE':
            playSound('chip-bet');
            break;
          case 'ALL_IN':
            playSound('all-in');
            break;
          // POST_BLIND — no sound
        }
      }
    }
    prevActionCountRef.current = actionCount;
  }, [gameState?.currentRound?.actions.length]);

  // ── Round ended (reveal modal shown = someone won) ──
  useEffect(() => {
    if (showRevealModal && !prevShowRevealRef.current) {
      setTimeout(() => playSound('win'), 300);
    }
    prevShowRevealRef.current = showRevealModal;
  }, [showRevealModal]);

  // ── Hole cards dealt (round just started, preflop begins) ──
  useEffect(() => {
    if (!gameState?.currentRound) return;
    if (gameState.currentRound.currentStreet === 'PREFLOP' && gameState.currentRound.phase === 'BETTING') {
      // Small delay so it doesn't overlap with round-start
      const hasHoleCards = gameState.players.some(p => p.holeCards && p.holeCards.length > 0);
      if (hasHoleCards) {
        setTimeout(() => playSound('card-deal'), 400);
      }
    }
  }, [gameState?.currentRound?.roundNumber, gameState?.currentRound?.phase]);
}
