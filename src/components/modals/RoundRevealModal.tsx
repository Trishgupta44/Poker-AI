import { motion, AnimatePresence } from 'framer-motion';
import type { CompletedRound } from '../../types/game';
import type { AuditResult } from '../../types/ai';
import { CardComponent } from '../table/CardComponent';

interface RoundRevealModalProps {
  show: boolean;
  round: CompletedRound | null;
  auditResults: AuditResult[];
  onContinue: () => void;
  isGameOver: boolean;
  winnerName: string | null;
}

const AUDIT_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  BLUFF: { bg: 'bg-status-danger/20', text: 'text-status-danger' },
  VALUE_BET: { bg: 'bg-status-success/20', text: 'text-status-success' },
  SLOW_PLAY: { bg: 'bg-status-warning/20', text: 'text-status-warning' },
  PASSIVE: { bg: 'bg-text-muted/20', text: 'text-text-muted' },
  NO_TAG: { bg: 'bg-noir-elevated', text: 'text-text-muted' },
};

export function RoundRevealModal({
  show,
  round,
  auditResults,
  onContinue,
  isGameOver,
  winnerName,
}: RoundRevealModalProps) {
  if (!show || !round) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-noir-card border border-noir-border rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        >
          {/* Header */}
          <h2 className="font-[Cinzel] text-xl text-gold-gradient text-center mb-1">
            {isGameOver ? 'Game Over' : `Round ${round.roundNumber} Complete`}
          </h2>
          <div className="text-center font-[DM_Mono] text-sm text-gold-primary mb-6">
            Pot: {round.potTotal.toLocaleString()}
          </div>

          {/* Community Cards */}
          <div className="flex justify-center gap-1 mb-6">
            {round.communityCards.map((card, i) => (
              <CardComponent key={i} card={card} size="sm" delay={i * 0.1} />
            ))}
          </div>

          {/* Player Results */}
          <div className="space-y-3">
            {round.playerResults.map((result, index) => {
              const isWinner = round.winnerIds.includes(result.playerId);
              const audit = auditResults.find(a => a.playerId === result.playerId);
              const tagStyle = AUDIT_TAG_COLORS[audit?.tag ?? 'NO_TAG'];

              return (
                <motion.div
                  key={result.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.15 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border
                    ${isWinner
                      ? 'bg-gold-primary/10 border-gold-primary/30'
                      : 'bg-noir-elevated border-noir-border'
                    }`}
                >
                  {/* Cards */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    {result.holeCards.length > 0 ? (
                      result.holeCards.map((card, i) => (
                        <CardComponent key={i} card={card} size="sm" delay={0.4 + index * 0.15 + i * 0.1} />
                      ))
                    ) : (
                      <div className="text-text-muted text-xs italic">folded</div>
                    )}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-[Cinzel] text-sm ${isWinner ? 'text-gold-light' : 'text-text-primary'}`}>
                        {result.playerName}
                      </span>
                      {isWinner && <span className="text-gold-primary text-xs">&#9733;</span>}
                    </div>
                    <div className="font-[DM_Mono] text-xs text-text-muted">
                      {result.handName ?? result.finalAction}
                    </div>
                  </div>

                  {/* Audit tag */}
                  {audit && audit.tag !== 'NO_TAG' && (
                    <div className={`px-2 py-0.5 rounded text-[10px] font-[DM_Mono] ${tagStyle.bg} ${tagStyle.text}`}>
                      {audit.tag.replace('_', ' ')}
                    </div>
                  )}

                  {/* Chips won/lost */}
                  <div className="font-[DM_Mono] text-sm text-right flex-shrink-0">
                    {result.chipsWon > 0 ? (
                      <span className="text-status-success">+{result.chipsWon.toLocaleString()}</span>
                    ) : result.chipsLost > 0 ? (
                      <span className="text-status-danger">-{result.chipsLost.toLocaleString()}</span>
                    ) : (
                      <span className="text-text-muted">0</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Game Over message */}
          {isGameOver && winnerName && (
            <div className="mt-6 text-center">
              <div className="font-[Cinzel] text-lg text-gold-light">
                {winnerName} wins the game!
              </div>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={onContinue}
            className="w-full mt-6 py-3 bg-gradient-to-r from-gold-dark via-gold-primary to-gold-dark
                       text-noir-bg font-[Cinzel] font-bold rounded-lg
                       hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all btn-press cursor-pointer"
          >
            {isGameOver ? 'Back to Menu' : 'Next Round'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
