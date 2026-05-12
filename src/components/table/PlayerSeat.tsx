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
        padding: '2px 7px',
        borderRadius: 999,
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
  const seatX = Number.parseFloat(position.x);
  const seatY = Number.parseFloat(position.y);

  let betPlacement: 'left' | 'right' | 'top' | 'bottom' = 'right';
  if (Number.isFinite(seatY) && seatY <= 20) {
    // Top seat: push bet upward (away from table center).
    betPlacement = 'top';
  } else if (Number.isFinite(seatX) && seatX <= 20) {
    // Left rail seat: push bet outward to the left.
    betPlacement = 'left';
  } else if (Number.isFinite(seatX) && seatX >= 80) {
    // Right rail seat: push bet outward to the right.
    betPlacement = 'right';
  } else if (Number.isFinite(seatY) && seatY >= 70) {
    // Bottom seat: place below the info box.
    betPlacement = 'bottom';
  }

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
      {isActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -inset-x-4 top-[62px] h-16 rounded-full border border-gold-primary/25 bg-gold-primary/5 blur-[1px]"
        />
      )}

      {/* Cards */}
      <div className="relative z-10 flex gap-1 mb-0.5">
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
        className={`relative rounded-lg px-3 py-1.5 min-w-[108px] text-center transition-all duration-300
          ${isActive
            ? 'bg-noir-elevated border border-gold-primary shadow-[0_0_22px_rgba(201,168,76,0.28)]'
            : 'bg-noir-card/95 border border-noir-border shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
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
        <div className={`mt-0.5 font-[DM_Mono] text-xs ${isFolded ? 'text-text-muted' : 'text-gold-light'}`}>
          {player.chips.toLocaleString()}
        </div>

        {isActive && !isFolded && (
          <div className="mt-1 font-[DM_Mono] text-[9px] uppercase tracking-[0.16em] text-gold-primary">
            Acting
          </div>
        )}

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

        {/* Current bet */}
        {player.currentBet > 0 && !isFolded && (
          <motion.div
            initial={{
              opacity: 0,
              x: betPlacement === 'left' ? 6 : betPlacement === 'right' ? -6 : 0,
              y: betPlacement === 'top' ? 6 : betPlacement === 'bottom' ? -6 : 0,
            }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            className={`absolute bg-noir-bg/90 border border-gold-border/45 rounded-full px-3 py-1 shadow-[0_6px_14px_rgba(0,0,0,0.35)] ${
              betPlacement === 'left'
                ? 'top-1/2 -translate-y-1/2 right-[calc(100%+10px)]'
                : betPlacement === 'right'
                  ? 'top-1/2 -translate-y-1/2 left-[calc(100%+10px)]'
                  : betPlacement === 'top'
                    ? 'left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)]'
                    : 'left-1/2 -translate-x-1/2 top-[calc(100%+8px)]'
            }`}
          >
            <span className="font-[DM_Mono] text-[10px] text-gold-light whitespace-nowrap">
              Bet {player.currentBet.toLocaleString()}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
