import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Player } from '../../types/player';
import type { RoundState } from '../../types/game';
import { getValidActions } from '../../engine/betting';

interface ActionPanelProps {
  player: Player;
  round: RoundState;
  players: Player[];
  onAction: (action: string, amount: number) => void;
  disabled: boolean;
}

export function ActionPanel({ player, round, players, onAction, disabled }: ActionPanelProps) {
  const validActions = useMemo(
    () => getValidActions(player, round, players),
    [player, round, players]
  );

  const canFold = validActions.some(a => a.type === 'FOLD');
  const canCheck = validActions.some(a => a.type === 'CHECK');
  const canCall = validActions.some(a => a.type === 'CALL');
  const raiseAction = validActions.find(a => a.type === 'RAISE');
  const callAction = validActions.find(a => a.type === 'CALL');

  const callAmount = callAction?.minAmount ?? 0;
  const minRaise = raiseAction?.minAmount ?? 0;
  const maxRaise = raiseAction?.maxAmount ?? 0;

  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Pot presets for raise sizing
  const potPresets = useMemo(() => {
    if (!raiseAction) return [];
    const pot = round.pot;
    const presets = [
      { label: '1/3', amount: Math.max(minRaise, Math.round(pot * 0.33 + round.currentBet)) },
      { label: '1/2', amount: Math.max(minRaise, Math.round(pot * 0.5 + round.currentBet)) },
      { label: '2/3', amount: Math.max(minRaise, Math.round(pot * 0.67 + round.currentBet)) },
      { label: 'Pot', amount: Math.max(minRaise, Math.round(pot + round.currentBet)) },
    ].filter(p => p.amount <= maxRaise && p.amount >= minRaise);
    return presets;
  }, [raiseAction, round.pot, round.currentBet, minRaise, maxRaise]);

  const handleRaise = () => {
    if (showRaiseSlider) {
      onAction('RAISE', raiseAmount);
      setShowRaiseSlider(false);
    } else {
      setRaiseAmount(minRaise);
      setShowRaiseSlider(true);
    }
  };

  const handleAllIn = () => {
    onAction('ALL_IN', player.chips);
  };

  if (disabled || validActions.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center">
        <span className="font-[DM_Mono] text-text-muted text-sm animate-pulse">
          Waiting...
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Raise Slider (shown when raise is selected) */}
      {showRaiseSlider && raiseAction && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-noir-card border border-noir-border rounded-lg p-4"
        >
          {/* Amount display */}
          <div className="text-center mb-3">
            <span className="font-[DM_Mono] text-gold-light text-lg">
              {raiseAmount.toLocaleString()}
            </span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full h-2 bg-noir-elevated rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
                       [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-gold-primary
                       [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(201,168,76,0.5)]"
          />

          {/* Preset buttons */}
          <div className="flex gap-2 mt-3">
            {potPresets.map(preset => (
              <button
                key={preset.label}
                onClick={() => setRaiseAmount(preset.amount)}
                className="flex-1 py-1.5 bg-noir-elevated border border-noir-border rounded
                           font-[DM_Mono] text-xs text-text-secondary
                           hover:border-gold-muted hover:text-gold-light transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={handleAllIn}
              className="flex-1 py-1.5 bg-status-danger/20 border border-status-danger/30 rounded
                         font-[DM_Mono] text-xs text-status-danger
                         hover:bg-status-danger/30 transition-colors cursor-pointer"
            >
              All-In
            </button>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* Fold */}
        {canFold && (
          <button
            onClick={() => { onAction('FOLD', 0); setShowRaiseSlider(false); }}
            className="flex-1 py-3 bg-noir-card border border-noir-border rounded-lg
                       font-[Cinzel] text-sm text-text-secondary
                       hover:border-status-danger/50 hover:text-status-danger
                       transition-all btn-press cursor-pointer"
          >
            Fold
          </button>
        )}

        {/* Check */}
        {canCheck && (
          <button
            onClick={() => { onAction('CHECK', 0); setShowRaiseSlider(false); }}
            className="flex-1 py-3 bg-noir-card border border-gold-border/30 rounded-lg
                       font-[Cinzel] text-sm text-gold-light
                       hover:border-gold-primary/50 hover:bg-gold-primary/10
                       transition-all btn-press cursor-pointer"
          >
            Check
          </button>
        )}

        {/* Call */}
        {canCall && (
          <button
            onClick={() => { onAction('CALL', callAmount); setShowRaiseSlider(false); }}
            className="flex-1 py-3 bg-noir-card border border-gold-border/30 rounded-lg
                       font-[Cinzel] text-sm text-gold-light
                       hover:border-gold-primary/50 hover:bg-gold-primary/10
                       transition-all btn-press cursor-pointer"
          >
            Call
            <span className="font-[DM_Mono] text-xs ml-1 text-gold-primary">
              {callAmount.toLocaleString()}
            </span>
          </button>
        )}

        {/* Raise */}
        {raiseAction && (
          <button
            onClick={handleRaise}
            className={`flex-1 py-3 rounded-lg font-[Cinzel] text-sm transition-all btn-press cursor-pointer
              ${showRaiseSlider
                ? 'bg-gradient-to-r from-gold-dark via-gold-primary to-gold-dark text-noir-bg font-bold'
                : 'bg-gold-primary/20 border border-gold-primary/50 text-gold-light hover:bg-gold-primary/30'
              }`}
          >
            {showRaiseSlider ? 'Confirm Raise' : 'Raise'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
