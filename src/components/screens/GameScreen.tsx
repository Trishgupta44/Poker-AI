import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/game-store';
import { useAIStore } from '../../store/ai-store';
import { PokerTable } from '../table/PokerTable';
import { ActionPanel } from '../actions/ActionPanel';
import { AIAdvisorPanel } from '../ai-panel/AIAdvisorPanel';
import { RoundRevealModal } from '../modals/RoundRevealModal';
import { TurnHandoverModal } from '../modals/TurnHandoverModal';
import { useBotActions } from '../../hooks/useBotActions';
import { useAIScoring } from '../../hooks/useAIScoring';
import { useGameSounds } from '../../hooks/useGameSounds';
import type { ActionType } from '../../types/game';

export function GameScreen() {
  const navigate = useNavigate();
  const gameState = useGameStore(s => s.gameState);
  const showRevealModal = useGameStore(s => s.showRevealModal);
  const submitAction = useGameStore(s => s.submitAction);
  const startRound = useGameStore(s => s.startRound);
  const advanceToNextRound = useGameStore(s => s.advanceToNextRound);
  const resetGame = useGameStore(s => s.resetGame);
  const auditResults = useAIStore(s => s.lastAuditResults);

  // ── Local 2P handover state ──
  const [turnHandoverPlayer, setTurnHandoverPlayer] = useState<string | null>(null);
  const [handoverReady, setHandoverReady] = useState(false);
  // Track which player+round we last showed a handover for, so we only show
  // the handover when the active player CHANGES (or a new round starts).
  const lastHandoveredRef = useRef<{ playerId: string; roundNumber: number } | null>(null);

  // Activate bot actions, AI scoring, and sound effects hooks
  useBotActions();
  useAIScoring();
  useGameSounds();

  // Start first round when game screen mounts (original game only, not recovery).
  useEffect(() => {
    if (gameState && !gameState.currentRound && gameState.roundHistory.length === 0) {
      startRound();
    }
  }, [gameState, startRound]);

  // Recovery: if page was refreshed mid-SHOWDOWN, rehydration clears currentRound
  // to null (see game-store getItem). Detect this on mount and start a new round.
  const hasRecovered = useRef(false);
  useEffect(() => {
    if (hasRecovered.current) return; // Only run once
    if (gameState && !gameState.currentRound && gameState.roundHistory.length > 0 && !gameState.isGameOver) {
      hasRecovered.current = true;
      startRound();
    }
  }, [gameState, startRound]);

  // Handle 2-player mode turn handover.
  // Only show handover when:
  //   (a) a DIFFERENT player needs to act, or
  //   (b) a NEW round starts (cards changed, device needs to switch)
  // This prevents unnecessary handover modals when the same player acts
  // again on a new street (e.g. Player 2 calls pre-flop, acts first on flop).
  useEffect(() => {
    if (!gameState?.currentRound) return;
    if (gameState.config.mode !== 'LOCAL_2P') return;
    if (gameState.currentRound.phase !== 'BETTING') return;

    const currentPlayer = gameState.players[gameState.currentRound.activePlayerIndex];
    if (!currentPlayer || currentPlayer.type !== 'HUMAN') return;

    const roundNum = gameState.currentRound.roundNumber;
    const last = lastHandoveredRef.current;

    const isNewRound = !last || last.roundNumber !== roundNum;
    const isDifferentPlayer = !last || last.playerId !== currentPlayer.id;

    // Only show handover when player changes or new round starts
    if (isNewRound || isDifferentPlayer) {
      lastHandoveredRef.current = { playerId: currentPlayer.id, roundNumber: roundNum };
      const playerName = currentPlayer.name;
      queueMicrotask(() => {
        setHandoverReady(false);
        setTurnHandoverPlayer(playerName);
      });
    }
  }, [
    gameState?.currentRound,
    gameState?.currentRound?.activePlayerIndex,
    gameState?.currentRound?.phase,
    gameState?.currentRound?.roundNumber,
    gameState?.config.mode,
    gameState?.players,
  ]);

  const handleAction = useCallback((action: string, amount: number) => {
    if (!gameState?.currentRound) return;
    const currentPlayer = gameState.players[gameState.currentRound.activePlayerIndex];
    if (!currentPlayer) return;

    submitAction(currentPlayer.id, action as ActionType, amount);
    // Don't reset handoverReady here — the effect handles it when the player changes.
    // This allows the same player to keep acting across street changes without
    // a redundant handover modal in between.
  }, [gameState, submitAction]);

  const handleContinue = useCallback(() => {
    if (gameState?.isGameOver) {
      resetGame();
      navigate('/');
    } else {
      // advanceToNextRound atomically hides modal + starts next round in one set() call.
      // Do NOT call setShowRevealModal(false) separately — that creates a race condition
      // where the modal dismisses before the next round is ready.
      advanceToNextRound();
    }
  }, [gameState?.isGameOver, resetGame, navigate, advanceToNextRound]);

  const handleHandoverReady = useCallback(() => {
    setTurnHandoverPlayer(null);
    setHandoverReady(true);
  }, []);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={() => navigate('/')}
          className="font-[Cinzel] text-gold-light hover:text-gold-primary transition-colors cursor-pointer"
        >
          No game in progress. Return to menu &rarr;
        </button>
      </div>
    );
  }

  const round = gameState.currentRound;
  const isHumanTurn = round?.phase === 'BETTING' &&
    gameState.players[round.activePlayerIndex]?.type === 'HUMAN';

  // Determine which player's cards to show
  const currentPlayer = round ? gameState.players[round.activePlayerIndex] : null;
  const assistedPlayer = gameState.players.find(p => p.hasAIAssistance);

  // In 2P mode, only show current human player's cards when handover is done
  // In VS_BOTS mode, always show the human player's cards
  const showCardsForPlayerId = gameState.config.mode === 'LOCAL_2P'
    ? (handoverReady ? currentPlayer?.id ?? null : null)
    : (assistedPlayer?.id ?? null);

  // Show AI panel for the assisted player when it's relevant
  // Keep panel visible even when user folds so they can watch confidence data build from bot-vs-bot play
  const showAIPanel = assistedPlayer && round?.phase === 'BETTING' &&
    (gameState.config.mode === 'VS_BOTS' || (currentPlayer?.id === assistedPlayer.id && handoverReady));

  // Is action panel enabled?
  const actionPanelDisabled = !isHumanTurn || (gameState.config.mode === 'LOCAL_2P' && !handoverReady);

  // Last completed round for reveal modal
  const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1] ?? null;
  const winnerPlayer = gameState.winnerId
    ? gameState.players.find(p => p.id === gameState.winnerId)
    : null;

  // Show reveal modal when EITHER the store flag is true OR the round is in SHOWDOWN
  // phase with a completed round available. This makes the modal resilient to any
  // code path that might accidentally set showRevealModal back to false — the modal
  // stays visible as long as the round is in SHOWDOWN phase. The only way to dismiss
  // it is advanceToNextRound(), which atomically starts a new round (phase → BETTING)
  // AND sets showRevealModal to false.
  const isShowdownPhase = round?.phase === 'SHOWDOWN';
  const showModal = showRevealModal || (isShowdownPhase && lastRound != null);

  return (
    <div className="min-h-screen xl:h-screen flex flex-col xl:overflow-hidden"
         style={{
           background: `
             radial-gradient(ellipse at 50% 7%, rgba(226,193,124,.18) 0%, rgba(226,193,124,.06) 24%, transparent 52%),
             radial-gradient(ellipse at 18% 18%, rgba(63,86,140,.14) 0%, transparent 36%),
             radial-gradient(ellipse at 82% 14%, rgba(90,110,155,.1) 0%, transparent 34%),
             radial-gradient(ellipse at center, #1b2230 0%, #111722 46%, #0a0f17 74%, #070b12 100%)
           `,
         }}>

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-noir-border/50">
        <button
          onClick={() => { resetGame(); navigate('/'); }}
          className="font-[DM_Mono] text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          &larr; Exit
        </button>
        <div className="font-[Cinzel] text-sm text-gold-light tracking-wider">
          {gameState.config.mode === 'VS_BOTS' ? 'VS BOTS' : '2-PLAYER'}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/stats')}
            className="font-[DM_Mono] text-xs text-text-muted hover:text-gold-light transition-colors cursor-pointer"
          >
            Stats
          </button>
          <div className="font-[DM_Mono] text-xs text-text-muted">
            Round {round?.roundNumber ?? 0}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col xl:flex-row min-h-0 gap-2 p-2">
        {/* Table + Actions column */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-visible rounded-2xl border border-white/[0.03] bg-black/10">
          {/* Street indicator bar */}
          {round && (
            <div
              className="flex justify-center gap-1 flex-shrink-0 flex-wrap"
              style={{
                padding: '5px 12px 2px',
                background: 'rgba(0,0,0,.18)',
              }}
            >
              {(['PREFLOP', 'FLOP', 'TURN', 'RIVER'] as const).map(s => {
                const isActive = round.currentStreet === s;
                return (
                  <div
                    key={s}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: isActive ? 'rgba(201,168,76,.11)' : 'rgba(255,255,255,.012)',
                      border: `1px solid ${isActive ? 'rgba(201,168,76,.4)' : 'rgba(255,255,255,.045)'}`,
                      color: isActive ? '#c9a84c' : 'rgba(255,255,255,.26)',
                      fontSize: 7,
                      letterSpacing: '.13em',
                      fontFamily: "'DM Mono', monospace",
                      transition: 'all .2s',
                    }}
                  >
                    {s}
                  </div>
                );
              })}
            </div>
          )}

          {/* Poker Table — takes most of the vertical space */}
          <div className="relative flex-1 flex items-center justify-center min-h-[500px] xl:min-h-0 overflow-visible px-2 py-4">
            {!isHumanTurn && round?.phase === 'BETTING' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <span className="inline-flex items-center rounded-full border border-gold-border/40 bg-noir-bg/85 px-3 py-1 font-[DM_Mono] text-[11px] tracking-[0.08em] text-gold-light shadow-[0_8px_20px_rgba(0,0,0,0.45)] animate-pulse">
                  {currentPlayer?.name ?? 'Bot'} is thinking...
                </span>
              </div>
            )}
            {round && (
              <PokerTable
                players={gameState.players}
                communityCards={round.communityCards}
                pot={round.pot}
                dealerIndex={round.dealerIndex}
                activePlayerIndex={round.activePlayerIndex}
                showCardsForPlayerId={showCardsForPlayerId}
                isShowdown={round.phase === 'SHOWDOWN'}
                actions={round.actions}
              />
            )}
          </div>

          {/* Action Panel — fixed at bottom */}
          <div className="flex-shrink-0 max-w-xl mx-auto w-full px-2 pb-2 pt-1">
            {isHumanTurn && currentPlayer && round && (
              <ActionPanel
                player={currentPlayer}
                round={round}
                players={gameState.players}
                onAction={handleAction}
                disabled={actionPanelDisabled}
              />
            )}

          </div>
        </div>

        {/* AI Advisor Panel (sidebar) */}
        <div className="w-full xl:w-80 flex-shrink-0 xl:overflow-y-auto">
          <AIAdvisorPanel visible={!!showAIPanel} />
        </div>
      </div>

      {/* Turn Handover Modal (2P mode) — hide when reveal modal is showing */}
      {!showModal && (
        <TurnHandoverModal
          show={!!turnHandoverPlayer && gameState.config.mode === 'LOCAL_2P'}
          playerName={turnHandoverPlayer ?? ''}
          onReady={handleHandoverReady}
        />
      )}

      {/* Round Reveal Modal */}
      <RoundRevealModal
        show={showModal}
        round={lastRound}
        auditResults={auditResults}
        onContinue={handleContinue}
        isGameOver={gameState.isGameOver}
        winnerName={winnerPlayer?.name ?? null}
      />
    </div>
  );
}
