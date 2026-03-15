import { useAIStore } from '../../store/ai-store';
import { useGameStore } from '../../store/game-store';
import { useProfileStore } from '../../store/profile-store';
import { getValidActions } from '../../engine/betting';
import { HandStrengthGauge } from './HandStrengthGauge';
import { BluffGauge } from './BluffGauge';
import { ConfidenceCard } from './ConfidenceCard';
import type { RecommendedAction, ConfidenceResult } from '../../types/ai';

interface AIAdvisorPanelProps {
  visible: boolean;
}

const ACTION_STYLES: Record<RecommendedAction, { bg: string; text: string; icon: string }> = {
  'FOLD': { bg: 'bg-status-danger/20 border-status-danger/40', text: 'text-status-danger', icon: '\u270B' },
  'CHECK': { bg: 'bg-gold-primary/15 border-gold-primary/30', text: 'text-gold-light', icon: '\uD83D\uDC41' },
  'CALL': { bg: 'bg-status-success/15 border-status-success/30', text: 'text-status-success', icon: '\u2705' },
  'RAISE': { bg: 'bg-status-success/20 border-status-success/40', text: 'text-status-success', icon: '\uD83D\uDE80' },
  'ALL-IN': { bg: 'bg-status-warning/20 border-status-warning/40', text: 'text-status-warning', icon: '\uD83D\uDCA5' },
};

/**
 * Cross-check AI recommendation against actual valid actions.
 * If the recommended action isn't available, substitute a sensible alternative.
 */
function adjustRecommendation(
  rec: RecommendedAction | undefined,
  reason: string | undefined,
  equity: number | undefined,
  validTypes: string[],
): { action: RecommendedAction; reason: string } | null {
  if (!rec || !reason || validTypes.length === 0) return null;

  const recType = rec === 'ALL-IN' ? 'ALL_IN' : rec;
  if (validTypes.includes(recType)) return { action: rec, reason };

  if (rec === 'CHECK' && !validTypes.includes('CHECK')) {
    const eq = equity ?? 0;
    if (validTypes.includes('CALL')) {
      if (eq >= 35) {
        return { action: 'CALL', reason: 'Pot odds justify calling with your current equity.' };
      }
      return { action: 'FOLD', reason: 'Weak hand facing a bet — fold and wait for a better spot.' };
    }
    if (validTypes.includes('FOLD')) {
      return { action: 'FOLD', reason: 'Weak hand facing a bet — fold and wait for a better spot.' };
    }
  }

  if (rec === 'RAISE' && !validTypes.includes('RAISE')) {
    if (validTypes.includes('CALL')) return { action: 'CALL', reason: reason.replace('raise', 'call') };
    if (validTypes.includes('CHECK')) return { action: 'CHECK', reason: 'Check — cannot raise here.' };
  }

  if (rec === 'CALL' && !validTypes.includes('CALL')) {
    if (validTypes.includes('CHECK')) return { action: 'CHECK', reason: 'No bet to face — check.' };
  }

  return { action: rec, reason };
}

export function AIAdvisorPanel({ visible }: AIAdvisorPanelProps) {
  const handStrength = useAIStore(s => s.handStrength);
  const confidenceScores = useAIStore(s => s.confidenceScores);
  const isComputing = useAIStore(s => s.isComputing);
  const equityHistory = useAIStore(s => s.equityHistory);
  const preflopAdvice = useAIStore(s => s.preflopAdvice);
  const drawInfo = useAIStore(s => s.drawInfo);
  const blockerInfo = useAIStore(s => s.blockerInfo);
  const scareCardInfo = useAIStore(s => s.scareCardInfo);
  const gameState = useGameStore(s => s.gameState);
  const profiles = useProfileStore(s => s.profiles);

  if (!visible) return null;

  // Get valid actions for the current player to cross-check the recommendation
  let validTypes: string[] = [];
  if (gameState?.currentRound) {
    const assistedPlayer = gameState.players.find(p => p.hasAIAssistance);
    if (assistedPlayer) {
      validTypes = getValidActions(assistedPlayer, gameState.currentRound, gameState.players)
        .map(a => a.type);
    }
  }

  const adjusted = adjustRecommendation(
    handStrength?.recommendedAction,
    handStrength?.recommendationReason,
    handStrength?.equity,
    validTypes,
  );
  const recommendation = adjusted?.action;
  const recommendationReason = adjusted?.reason;
  const actionStyle = recommendation ? ACTION_STYLES[recommendation] : null;

  // ── Build opponent entries: use real confidence data when available,
  //    otherwise create synthetic "Insufficient Data" entries ──
  const heroPlayer = gameState?.players.find(p => p.hasAIAssistance);
  const allOpponentEntries: ConfidenceResult[] = [];

  if (gameState) {
    for (const player of gameState.players) {
      if (player.id === heroPlayer?.id) continue;
      const existing = confidenceScores[player.id];
      if (existing) {
        allOpponentEntries.push(existing);
      } else {
        const profile = profiles[player.id];
        const handsRecorded = profile?.totalHands ?? 0;
        const remaining = Math.max(0, 1 - handsRecorded);
        allOpponentEntries.push({
          opponentId: player.id,
          opponentName: player.name,
          score: null,
          label: 'Insufficient Data',
          explanation: remaining > 0
            ? `Need ${remaining} more hand${remaining > 1 ? 's' : ''} to read ${player.name}.`
            : `Gathering data on ${player.name}...`,
          dataSufficient: false,
          handsRecorded,
        });
      }
    }
  }

  // ── Pick the most recently acting opponent for the bluff gauge ──
  // Shows the bluff score of whoever just acted, not a fixed player.
  const round = gameState?.currentRound;
  const heroId = heroPlayer?.id;
  let latestConfidence: ConfidenceResult | null = null;

  if (round && round.actions.length > 0) {
    // Walk backwards through actions to find the last non-hero, non-blind opponent
    for (let i = round.actions.length - 1; i >= 0; i--) {
      const act = round.actions[i];
      if (act.playerId === heroId || act.action === 'POST_BLIND') continue;
      const entry = allOpponentEntries.find(e => e.opponentId === act.playerId);
      if (entry && entry.dataSufficient && entry.score !== null) {
        latestConfidence = entry;
      }
      break; // always break — we want the most recent acting opponent
    }
  }

  // Fallback: if no recent actor has a score, pick any scored entry
  if (!latestConfidence) {
    const scored = allOpponentEntries.filter(e => e.dataSufficient && e.score !== null);
    latestConfidence = scored.length > 0 ? scored[scored.length - 1] : null;
  }

  const bluffPercent = latestConfidence?.score != null
    ? 100 - latestConfidence.score
    : null;

  return (
    <div className="bg-noir-card border border-noir-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-gold-primary">{'\u2726'}</span>
        <h3 className="font-[Cinzel] text-sm text-gold-light tracking-wider">AI ADVISOR</h3>
        {isComputing && (
          <span className="ml-auto font-[DM_Mono] text-[10px] text-gold-muted animate-pulse">
            COMPUTING...
          </span>
        )}
      </div>

      {/* MOVE RECOMMENDATION */}
      {recommendation && actionStyle && (
        <div className={`rounded-lg border p-3 ${actionStyle.bg}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{actionStyle.icon}</span>
            <span className={`font-[Cinzel] font-bold text-base tracking-wider ${actionStyle.text}`}>
              {recommendation}
            </span>
            {preflopAdvice && (
              <span className={`font-[DM_Mono] text-[10px] ml-auto ${
                preflopAdvice.action === 'RAISE' ? 'text-status-success' :
                preflopAdvice.action === 'CALL' ? 'text-gold-light' : 'text-status-danger'
              }`}>
                {Math.round(preflopAdvice.confidence * 100)}% confident
              </span>
            )}
          </div>
          <p className="font-[DM_Mono] text-[11px] text-text-secondary leading-relaxed">
            {recommendationReason}
          </p>
          {preflopAdvice && (
            <p className="font-[DM_Mono] text-[10px] text-text-muted mt-1">
              {preflopAdvice.reason}
            </p>
          )}
        </div>
      )}

      {/* ── Dual Gauges: Hand Strength + Bluff Likelihood ── */}
      <div className="flex gap-2">
        {/* Hand Strength Gauge */}
        <div className="flex-1 min-w-0">
          <div className="text-text-muted text-[10px] font-[DM_Mono] tracking-wider mb-1 text-center">
            HAND STRENGTH
          </div>
          <HandStrengthGauge
            equity={handStrength?.equity ?? null}
            category={handStrength?.handCategory ?? null}
          />
        </div>

        {/* Bluff Likelihood Gauge */}
        <div className="flex-1 min-w-0">
          <div className="text-text-muted text-[10px] font-[DM_Mono] tracking-wider mb-1 text-center">
            BLUFF LIKELIHOOD
          </div>
          <BluffGauge
            bluffPercent={bluffPercent}
            opponentName={latestConfidence?.opponentName ?? null}
          />
        </div>
      </div>

      {/* Hand explanation */}
      {handStrength?.explanation && (
        <p className="text-text-secondary text-xs italic leading-relaxed">
          {handStrength.explanation}
        </p>
      )}

      {/* Equity History Sparkline */}
      {equityHistory.length > 1 && (
        <div className="h-8 flex items-end gap-0.5">
          {equityHistory.map((eq, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all duration-300"
              style={{
                height: `${Math.max(4, eq)}%`,
                backgroundColor: eq >= 65 ? '#22C55E' : eq >= 40 ? '#F59E0B' : '#DC2626',
                opacity: i === equityHistory.length - 1 ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Draw / Blocker / Scare Card Info ── */}
      {drawInfo && (drawInfo.flush_draw || drawInfo.straight_draw || drawInfo.combo_draw) && (
        <div className="bg-noir-surface/50 rounded-lg border border-noir-border p-2.5">
          <div className="text-text-muted text-[10px] font-[DM_Mono] tracking-wider mb-1">YOUR DRAWS</div>
          <div className="flex flex-wrap gap-1.5">
            {drawInfo.flush_draw && <span className="text-[10px] font-[DM_Mono] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Flush draw</span>}
            {drawInfo.straight_draw && <span className="text-[10px] font-[DM_Mono] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">{drawInfo.straight_draw_type === 'OPEN_ENDED' ? 'Straight draw (open-ended)' : 'Straight draw (1 card needed)'}</span>}
            {drawInfo.combo_draw && <span className="text-[10px] font-[DM_Mono] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">Flush + straight draw</span>}
          </div>
          <p className="text-text-secondary text-[10px] font-[DM_Mono] mt-1">{drawInfo.explanation}</p>
        </div>
      )}

      {blockerInfo && blockerInfo.blocker_score > 0 && (
        <div className="bg-noir-surface/50 rounded-lg border border-noir-border p-2.5">
          <div className="text-text-muted text-[10px] font-[DM_Mono] tracking-wider mb-1">YOUR BLOCKERS</div>
          <div className="flex flex-wrap gap-1.5">
            {blockerInfo.blocks_nut_flush && <span className="text-[10px] font-[DM_Mono] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Blocks best flush</span>}
            {blockerInfo.blocks_top_pair && <span className="text-[10px] font-[DM_Mono] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded">Blocks top pair</span>}
            {blockerInfo.blocks_set && <span className="text-[10px] font-[DM_Mono] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded">Blocks three of a kind</span>}
            {blockerInfo.blocks_straight && <span className="text-[10px] font-[DM_Mono] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">Blocks straight</span>}
          </div>
          <p className="text-text-secondary text-[10px] font-[DM_Mono] mt-1">{blockerInfo.explanation}</p>
        </div>
      )}

      {scareCardInfo && scareCardInfo.board_scariness !== 'SAFE' && (
        <div className={`bg-noir-surface/50 rounded-lg border p-2.5 ${
          scareCardInfo.board_scariness === 'VERY_SCARY' ? 'border-red-500/50' :
          scareCardInfo.board_scariness === 'SCARY' ? 'border-orange-500/40' : 'border-yellow-500/30'
        }`}>
          <div className="text-text-muted text-[10px] font-[DM_Mono] tracking-wider mb-1">BOARD WARNING</div>
          <span className={`text-[10px] font-[DM_Mono] font-bold ${
            scareCardInfo.board_scariness === 'VERY_SCARY' ? 'text-red-400' :
            scareCardInfo.board_scariness === 'SCARY' ? 'text-orange-400' : 'text-yellow-400'
          }`}>{
            scareCardInfo.board_scariness === 'VERY_SCARY' ? 'DANGEROUS BOARD' :
            scareCardInfo.board_scariness === 'SCARY' ? 'RISKY BOARD' : 'CAUTION'
          }</span>
          {scareCardInfo.reasons.length > 0 && (
            <p className="text-text-secondary text-[10px] font-[DM_Mono] mt-0.5">{scareCardInfo.reasons.join(', ')}</p>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gold-border to-transparent" />

      {/* ── Opponent Analysis — always visible ── */}
      <div>
        <div className="text-text-muted text-[10px] font-[DM_Mono] tracking-wider mb-2">
          OPPONENT ANALYSIS
        </div>
        <div className="space-y-2">
          {allOpponentEntries.map(conf => (
            <ConfidenceCard key={conf.opponentId} confidence={conf} />
          ))}
        </div>
      </div>
    </div>
  );
}
