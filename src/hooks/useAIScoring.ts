import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game-store';
import { useAIStore } from '../store/ai-store';
import { useProfileStore } from '../store/profile-store';
import * as aiApi from '../api/ai-api';

/**
 * Hook that computes AI scores (Hand Strength + Confidence) when game state changes.
 * Now calls the Python API backend (with TypeScript fallback).
 * Includes Feature 8: Action Speed tracking for confidence scoring.
 */
export function useAIScoring() {
  const gameState = useGameStore(s => s.gameState);
  const showRevealModal = useGameStore(s => s.showRevealModal);
  const turnStartedAt = useGameStore(s => s.turnStartedAt);
  // ── AI store actions: use INDIVIDUAL selectors (not destructured useAIStore()) ──
  // useAIStore() without a selector subscribes to the ENTIRE store, causing
  // re-renders on EVERY state change (hand strength, confidence, equity, etc.).
  // Individual selectors return stable function references and avoid re-renders.
  const setHandStrength = useAIStore(s => s.setHandStrength);
  const setConfidenceScore = useAIStore(s => s.setConfidenceScore);
  const setAuditResults = useAIStore(s => s.setAuditResults);
  const setIsComputing = useAIStore(s => s.setIsComputing);
  const clearForNewRound = useAIStore(s => s.clearForNewRound);
  const setPreflopAdvice = useAIStore(s => s.setPreflopAdvice);
  const setDrawInfo = useAIStore(s => s.setDrawInfo);
  const setBlockerInfo = useAIStore(s => s.setBlockerInfo);
  const setScareCardInfo = useAIStore(s => s.setScareCardInfo);

  // NOTE: lastAuditedRound is read directly from useAIStore.getState() inside
  // the audit effect — NOT subscribed via React. This avoids re-render loops.

  const updateProfile = useProfileStore(s => s.updateProfile);
  const getProfile = useProfileStore(s => s.getProfile);

  const lastStreetRef = useRef<string | null>(null);
  const lastRoundRef = useRef<number | null>(null);

  // Clear AI scores when a new round starts
  useEffect(() => {
    if (!gameState?.currentRound) return;
    const roundNum = gameState.currentRound.roundNumber;

    if (lastRoundRef.current !== roundNum) {
      lastRoundRef.current = roundNum;
      lastStreetRef.current = null;
      clearForNewRound(); // This also resets lastAuditedRound to null in the AI store
    }
  }, [gameState?.currentRound?.roundNumber, clearForNewRound]);

  // Compute Hand Strength when street changes
  useEffect(() => {
    if (!gameState?.currentRound) return;
    if (gameState.currentRound.phase !== 'BETTING') return;

    const round = gameState.currentRound;
    const street = round.currentStreet;

    // Only compute when street changes
    if (lastStreetRef.current === street) return;
    lastStreetRef.current = street;

    // Find the AI-assisted player
    const assistedPlayer = gameState.players.find(p => p.hasAIAssistance);
    if (!assistedPlayer || assistedPlayer.holeCards.length !== 2) return;
    if (assistedPlayer.isFolded) return;

    const numOpponents = gameState.players.filter(
      p => !p.isFolded && !p.isSittingOut && p.id !== assistedPlayer.id
    ).length;

    setIsComputing(true);

    // Determine betting context for move recommendation
    const currentBet = round.currentBet - (assistedPlayer.currentBet || 0);
    const pot = round.pot;
    const facingRaise = round.currentBet > 0 && assistedPlayer.currentBet < round.currentBet;

    // Call Python API (async) with setTimeout to not block UI
    setTimeout(async () => {
      try {
        const result = await aiApi.calculateHandEquity(
          assistedPlayer.holeCards,
          round.communityCards,
          Math.max(1, numOpponents),
          street,
          1000,
          currentBet,
          pot,
          facingRaise
        );
        setHandStrength(result);

        // ── New Features: preflop strategy, draws, blockers, scare cards ──
        try {
          if (street === 'PREFLOP') {
            // Preflop strategy recommendation
            const activePlayers = gameState!.players.filter(p => !p.isSittingOut);
            const totalP = activePlayers.length;
            const dealerIdx = round.dealerIndex;
            const heroSeat = assistedPlayer.seatIndex;
            const posFromDealer = (heroSeat - dealerIdx + totalP) % totalP;
            const positionMap: Record<number, string> = {
              0: 'BTN', 1: 'SB', 2: 'BB',
            };
            const posStr = positionMap[posFromDealer] ??
              (posFromDealer <= Math.floor(totalP / 3) ? 'UTG' :
               posFromDealer <= Math.floor(2 * totalP / 3) ? 'MP' : 'CO');
            const isFacingRaise = round.currentBet > 0 && (assistedPlayer.currentBet || 0) < round.currentBet;
            const isOpen = round.actions.filter(a => a.action !== 'POST_BLIND').length === 0;

            const preflopResult = await aiApi.getPreflopStrategy(
              assistedPlayer.holeCards, posStr, isFacingRaise, isOpen,
              isOpen, assistedPlayer.chips, round.currentBet, round.pot,
            );
            setPreflopAdvice(preflopResult);
          } else {
            // Postflop: detect draws and blockers
            setPreflopAdvice(null);

            if (round.communityCards.length >= 3) {
              const [drawResult, blockerResult] = await Promise.all([
                aiApi.detectDraws(assistedPlayer.holeCards, round.communityCards),
                aiApi.detectBlockers(assistedPlayer.holeCards, round.communityCards),
              ]);
              setDrawInfo(drawResult);
              setBlockerInfo(blockerResult);
            }

            // Scare card detection on turn/river
            if (street === 'TURN' || street === 'RIVER') {
              const newCard = round.communityCards[round.communityCards.length - 1];
              const scareResult = await aiApi.detectScareCards(round.communityCards, newCard, assistedPlayer.holeCards);
              setScareCardInfo(scareResult);
            }
          }
        } catch (featureErr) {
          console.error('New feature error (non-critical):', featureErr);
        }
      } catch (e) {
        console.error('Hand equity error:', e);
      }
      setIsComputing(false);
    }, 50);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState?.currentRound?.currentStreet,
    gameState?.currentRound?.phase,
  ]);

  // Compute Confidence Scores when opponents bet/raise
  // Track action count to detect new actions
  const lastActionCountRef = useRef<number>(0);
  useEffect(() => {
    if (!gameState?.currentRound) return;
    if (gameState.currentRound.phase !== 'BETTING') return;

    const round = gameState.currentRound;
    const actions = round.actions;
    if (actions.length === 0) return;

    // Only fire when action count actually changes
    if (actions.length === lastActionCountRef.current) return;
    lastActionCountRef.current = actions.length;

    const lastAction = actions[actions.length - 1];

    // Only compute if an opponent (not the assisted player) acted
    const assistedPlayer = gameState.players.find(p => p.hasAIAssistance);
    if (!assistedPlayer || lastAction.playerId === assistedPlayer.id) return;

    // Skip blinds — no behavioral signal
    if (lastAction.action === 'POST_BLIND') return;

    const opponent = gameState.players.find(p => p.id === lastAction.playerId);
    if (!opponent) return;

    const profile = getProfile(opponent.id, opponent.name);
    const potBefore = lastAction.potBefore ?? round.pot;
    const betSizeRatio = potBefore > 0 ? lastAction.amount / potBefore : 0.5;

    // Determine opponent position relative to dealer
    const activePlayers = gameState.players.filter(p => !p.isSittingOut);
    const totalPlayers = activePlayers.length;
    const dealerIdx = round.dealerIndex;
    const playerSeat = opponent.seatIndex;
    const posFromDealer = (playerSeat - dealerIdx + totalPlayers) % totalPlayers;
    const position: 'EARLY' | 'MIDDLE' | 'LATE' =
      posFromDealer <= 1 ? 'EARLY' : posFromDealer >= totalPlayers - 1 ? 'LATE' : 'MIDDLE';

    // ── Feature 8: Action Speed ──
    const actionTimeMs = turnStartedAt > 0
      ? lastAction.timestamp - turnStartedAt
      : null;

    // Call Python API (async)
    (async () => {
      try {
        const confidence = await aiApi.calculateConfidence(
          profile,
          betSizeRatio,
          await aiApi.classifyBoardTexture(round.communityCards),
          position,
          round.currentStreet,
          round.actions,
          opponent.chips,
          round.pot,
          profile.lastCaughtRoundsAgo,
          actionTimeMs,
        );
        setConfidenceScore(opponent.id, confidence);
      } catch (e) {
        console.error('Confidence score error:', e);
      }
    })();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState?.currentRound?.actions.length,
    gameState?.currentRound?.phase,
    turnStartedAt,
  ]);

  // Run post-round audit when ANY round ends.
  // Records ALL opponent data — whether user folded or competed, bot-vs-bot included.
  // IMPORTANT: Read ALL state from stores directly (not from React subscriptions)
  // to prevent re-render loops when updateProfile/setLastAuditedRound mutate stores.
  useEffect(() => {
    if (!showRevealModal) return;

    // Read gameState snapshot directly from the store — NOT from the dependency array.
    const gs = useGameStore.getState().gameState;
    if (!gs?.currentRound) return;

    const round = gs.currentRound;
    const roundNum = round.roundNumber;

    // Guard: read directly from AI store (NOT via React selector subscription).
    // This avoids triggering re-renders when the guard value is set.
    const { lastAuditedRound: alreadyAudited, setLastAuditedRound } = useAIStore.getState();
    if (alreadyAudited === roundNum) return;
    setLastAuditedRound(roundNum);

    const players = gs.players;

    (async () => {
      try {
        // Run full audit only if community cards exist (can evaluate hands)
        let auditResults: Awaited<ReturnType<typeof aiApi.auditRound>> = [];
        if (round.communityCards.length >= 3) {
          auditResults = await aiApi.auditRound(round, players, round.communityCards);
          setAuditResults(auditResults);
        }

        const fullyAuditedIds = new Set(
          auditResults.filter(r => r.tag !== 'NO_TAG').map(r => r.playerId)
        );

        const boardTexture = round.communityCards.length >= 3
          ? await aiApi.classifyBoardTexture(round.communityCards)
          : 'DRY';
        const allPlayers = players.filter(p => !p.isSittingOut);
        const totalPlayers = allPlayers.length;
        const assistedPlayer = players.find(p => p.hasAIAssistance);

        // Update ALL non-hero players who took any action this round.
        // This captures bot-vs-bot data even when hero folded early.
        for (const player of players) {
          if (player.id === assistedPlayer?.id) continue; // skip hero

          const playerActions = round.actions.filter(a => a.playerId === player.id);
          if (playerActions.length === 0) continue; // no actions = nothing to record

          const dealerIdx = round.dealerIndex;
          const posFromDealer = (player.seatIndex - dealerIdx + totalPlayers) % totalPlayers;
          const wasInPosition = posFromDealer >= totalPlayers - 1;
          const actionSeq = aiApi.classifyActionSequence(round.actions, player.id);
          const originalStack = player.chips + player.totalBetThisRound;
          const spr = round.pot > 0 ? originalStack / round.pot : 10;

          let avgActionTimeMs: number | null = null;
          if (playerActions.length >= 2) {
            const times: number[] = [];
            for (let i = 1; i < playerActions.length; i++) {
              times.push(playerActions[i].timestamp - playerActions[i - 1].timestamp);
            }
            avgActionTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
          }

          const auditResult = auditResults.find(r => r.playerId === player.id);

          if (fullyAuditedIds.has(player.id) && auditResult) {
            // Full showdown data — precise BLUFF/VALUE_BET/SLOW_PLAY tag
            updateProfile(
              player.id, auditResult, boardTexture, round.currentStreet,
              auditResult.betSizeRatio, wasInPosition, actionSeq, spr,
              auditResult.tag === 'BLUFF', avgActionTimeMs,
            );
          } else {
            // No showdown tag — still record behavioral data so totalHands increments.
            const meaningfulActions = playerActions.filter(
              a => a.action !== 'POST_BLIND'
            );
            const didFold = meaningfulActions.some(a => a.action === 'FOLD');
            const aggressiveActions = meaningfulActions.filter(
              a => a.action === 'RAISE' || a.action === 'ALL_IN'
            );
            const tag = didFold ? 'FOLD' as const : 'PASSIVE' as const;
            const betSizeRatio = aggressiveActions.length > 0
              ? aggressiveActions[aggressiveActions.length - 1].amount / Math.max(round.pot, 1)
              : 0;

            updateProfile(
              player.id,
              { playerId: player.id, playerName: player.name, tag,
                handStrengthPercentile: didFold ? 30 : 50, betSizeRatio, street: round.currentStreet },
              boardTexture, round.currentStreet, betSizeRatio, wasInPosition,
              actionSeq, spr, false, avgActionTimeMs,
            );
          }
        }
      } catch (e) {
        console.error('Post-round audit error:', e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRevealModal]);
}
