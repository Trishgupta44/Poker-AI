import { motion } from 'framer-motion';
import type { Card } from '../../types/card';
import { SUIT_SYMBOLS, isRedSuit } from '../../types/card';

interface CardComponentProps {
  card: Card | null;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
  animate?: boolean;
}

/** Short display rank for card corners */
const RANK_DISPLAY: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

const sizes = {
  sm: { width: 48, height: 68, rank: 11, suit: 9, centerSuit: 20, pad: 3 },
  md: { width: 62, height: 86, rank: 15, suit: 12, centerSuit: 34, pad: 5 },
  lg: { width: 80, height: 115, rank: 18, suit: 14, centerSuit: 40, pad: 6 },
};

export function CardComponent({ card, faceDown = false, size = 'md', delay = 0, animate = true }: CardComponentProps) {
  const s = sizes[size];
  const showBack = faceDown || !card;

  // ── Card Back ──
  if (showBack) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        className="flex-shrink-0"
        style={{
          width: s.width,
          height: s.height,
          borderRadius: 7,
          background: 'linear-gradient(150deg, #1b2a4e 0%, #0e1828 100%)',
          border: '1.5px solid rgba(201,168,76,.28)',
          boxShadow: '0 5px 18px rgba(0,0,0,.65), inset 0 1px 0 rgba(201,168,76,.1)',
          position: 'relative',
          overflow: 'hidden',
          animation: animate ? `cDeal .28s cubic-bezier(.34,1.56,.64,1) ${delay}s both` : undefined,
        }}
      >
        {/* Crosshatch pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 5,
            borderRadius: 4,
            backgroundImage: `repeating-linear-gradient(45deg, rgba(201,168,76,.065) 0, rgba(201,168,76,.065) 1px, transparent 1px, transparent 8px),
              repeating-linear-gradient(-45deg, rgba(201,168,76,.065) 0, rgba(201,168,76,.065) 1px, transparent 1px, transparent 8px)`,
            border: '1px solid rgba(201,168,76,.09)',
          }}
        />
        {/* Center diamond */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: 'rgba(201,168,76,.1)',
          }}
        >
          ♦
        </div>
      </motion.div>
    );
  }

  // ── Card Face ──
  const isRed = isRedSuit(card.suit);
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const rankDisplay = RANK_DISPLAY[card.rank] ?? card.rank;
  const col = isRed ? '#b91c1c' : '#1e1b4b';

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
      className="flex-shrink-0 cursor-default"
      style={{
        width: s.width,
        height: s.height,
        borderRadius: 7,
        background: 'linear-gradient(165deg, #fffef8 0%, #f2e8cc 100%)',
        border: '1px solid rgba(0,0,0,.14)',
        boxShadow: '0 7px 22px rgba(0,0,0,.6), 0 2px 5px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.95)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: `${s.pad}px ${s.pad + 1}px`,
        animation: animate ? `cDeal .3s cubic-bezier(.34,1.56,.64,1) ${delay}s both` : undefined,
      }}
    >
      {/* Top-left corner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1, color: col }}>
        <span
          style={{
            fontSize: s.rank,
            fontWeight: 800,
            fontFamily: "'Cinzel', serif",
            lineHeight: 1,
          }}
        >
          {rankDisplay}
        </span>
        <span style={{ fontSize: s.suit, lineHeight: 1.15, marginTop: 1 }}>
          {suitSymbol}
        </span>
      </div>

      {/* Center suit */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: s.centerSuit,
            color: col,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.1))',
          }}
        >
          {suitSymbol}
        </span>
      </div>

      {/* Bottom-right corner (rotated 180) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          lineHeight: 1,
          color: col,
          transform: 'rotate(180deg)',
        }}
      >
        <span
          style={{
            fontSize: s.rank,
            fontWeight: 800,
            fontFamily: "'Cinzel', serif",
            lineHeight: 1,
          }}
        >
          {rankDisplay}
        </span>
        <span style={{ fontSize: s.suit, lineHeight: 1.15, marginTop: 1 }}>
          {suitSymbol}
        </span>
      </div>
    </motion.div>
  );
}
