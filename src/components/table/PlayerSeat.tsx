import { motion } from 'framer-motion';
import type { Player } from '../../types/player';
import type { ActionType } from '../../types/game';
import { CardComponent } from './CardComponent';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  showCards: boolean;
  position: { x: string; y: string };
  lastAction?: ActionType;
}

/** Action badge color config */
const ACTION_COLORS: Record<string, { bg: string; bd: string; c: string }> = {
  RAISE:  { bg: 'rgba(160,115,10,.14)', bd: 'rgba(201,168,76,.45)', c: '#d4a843' },
  CALL:   { bg: 'rgba(25,90,42,.14)',   bd: 'rgba(72,160,80,.4)',  c: '#68bb6e' },
  CHECK:  { bg: 'rgba(25,55,130,.14)',  bd: 'rgba(90,140,210,.4)', c: '#7aaaf0' },
  FOLD:   { bg: 'rgba(110,18,18,.14)', bd: 'rgba(170,55,45,.4)',  c: '#e07070' },
  ALL_IN: { bg: 'rgba(90,18,110,.14)', bd: 'rgba(170,75,190,.4)', c: '#cc8de0' },
};

const ACTION_DISPLAY: Record<string, string> = {
  ALL_IN: 'ALL-IN',
};

function ActionBadge({ action }: { action: ActionType }) {
  const cfg = ACTION_COLORS[action] || ACTION_COLORS.CHECK;
  const display = ACTION_DISPLAY[action] || action;

  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: 3,
        background: cfg.bg,
        border: `1px solid ${cfg.bd}`,
        color: cfg.c,
        fontSize: 7.5,
        fontWeight: 700,
        letterSpacing: '.1em',
        fontFamily: "'DM Mono', monospace",
        animation: 'fadeUp .2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  );
}

export function PlayerSeat({ player, isActive, isDealer, showCards, position, lastAction }: PlayerSeatProps) {
  const isFolded = player.isFolded;
  const isAllIn = player.isAllIn;

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        opacity: isFolded ? 0.4 : 1,
        scale: isActive ? 1.05 : 1,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Cards */}
      <div className="flex gap-0.5 mb-1">
        {player.holeCards.length > 0 ? (
          player.holeCards.map((card, i) => (
            <CardComponent
              key={i}
              card={card}
              faceDown={!showCards}
              size="sm"
              delay={i * 0.1}
            />
          ))
        ) : (
          <div className="h-[68px]" /> // Spacer when no cards
        )}
      </div>

      {/* Player Info Box */}
      <div
        className={`relative rounded-lg px-3 py-1.5 min-w-[100px] text-center transition-all duration-300
          ${isActive
            ? 'bg-noir-elevated border-2 border-gold-primary shadow-[0_0_15px_rgba(201,168,76,0.3)]'
            : 'bg-noir-card border border-noir-border'
          }
          ${isFolded ? 'border-noir-border/50' : ''}
        `}
      >
        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-gold-primary rounded-full flex items-center justify-center
                          text-noir-bg text-[10px] font-bold shadow-md">
            D
          </div>
        )}

        {/* Name + Action Badge row */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className={`font-[Cinzel] text-xs truncate ${isFolded ? 'text-text-muted' : 'text-text-primary'}`}>
            {player.name}
            {player.hasAIAssistance && (
              <span className="ml-1 text-gold-primary" title="AI Assisted">✦</span>
            )}
          </span>
          {lastAction && <ActionBadge action={lastAction} />}
        </div>

        {/* Chips */}
        <div className={`font-[DM_Mono] text-xs ${isFolded ? 'text-text-muted' : 'text-gold-light'}`}>
          {player.chips.toLocaleString()}
        </div>

        {/* Status badges */}
        {isFolded && (
          <div className="font-[DM_Mono] text-[10px] text-status-danger/70 mt-0.5">
            FOLDED
          </div>
        )}
        {isAllIn && !isFolded && (
          <div className="font-[DM_Mono] text-[10px] text-status-warning mt-0.5">
            ALL IN
          </div>
        )}
      </div>

      {/* Current bet */}
      {player.currentBet > 0 && !isFolded && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 bg-noir-bg/80 border border-gold-border/30 rounded-full px-2 py-0.5"
        >
          <span className="font-[DM_Mono] text-[10px] text-gold-light">
            {player.currentBet.toLocaleString()}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
