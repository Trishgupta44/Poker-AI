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
  sm: { width: 48, height: 68, rank: 11, suit: 9, centerSuit: 22, pad: 3 },
  md: { width: 62, height: 86, rank: 15, suit: 12, centerSuit: 34, pad: 5 },
  lg: { width: 80, height: 115, rank: 18, suit: 14, centerSuit: 46, pad: 6 },
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
          background: 'linear-gradient(160deg, #2f3f62 0%, #1a2437 56%, #0f1624 100%)',
          border: '1.5px solid rgba(223,191,121,.48)',
          boxShadow: '0 6px 18px rgba(0,0,0,.68), inset 0 1px 0 rgba(226,236,255,.2)',
          position: 'relative',
          overflow: 'hidden',
          animation: animate ? `cDeal .28s cubic-bezier(.34,1.56,.64,1) ${delay}s both` : undefined,
        }}
      >
        {/* Vintage back frame */}
        <div
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: 4,
            border: '1px solid rgba(241,214,165,.34)',
            boxShadow: 'inset 0 0 0 1px rgba(24,31,47,.55)',
          }}
        />
        {/* Crosshatch pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 7,
            borderRadius: 4,
            backgroundImage: `repeating-linear-gradient(45deg, rgba(220,198,154,.08) 0, rgba(220,198,154,.08) 1px, transparent 1px, transparent 7px),
              repeating-linear-gradient(-45deg, rgba(220,198,154,.06) 0, rgba(220,198,154,.06) 1px, transparent 1px, transparent 7px)`,
            border: '1px solid rgba(220,198,154,.2)',
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
            color: 'rgba(240,219,180,.18)',
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
  const col = isRed ? '#871a2b' : '#171c29';

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
      className="flex-shrink-0 cursor-default"
      style={{
        width: s.width,
        height: s.height,
        borderRadius: 7,
        background: `
          radial-gradient(circle at 18% 14%, rgba(255,255,255,.82), transparent 34%),
          linear-gradient(165deg, #f6f7fb 0%, #dee4ef 100%)
        `,
        border: '1px solid rgba(43,49,67,.36)',
        boxShadow: '0 7px 22px rgba(0,0,0,.6), 0 2px 5px rgba(0,0,0,.2), inset 0 1px 0 rgba(251,252,255,.92)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: `${s.pad}px ${s.pad + 1}px`,
        animation: animate ? `cDeal .3s cubic-bezier(.34,1.56,.64,1) ${delay}s both` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 2,
          borderRadius: 5,
          border: '1px solid rgba(76,90,124,.24)',
          pointerEvents: 'none',
        }}
      />
      {/* Top-left corner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1, color: col }}>
        <span
          style={{
            fontSize: s.rank,
            fontWeight: 800,
            fontFamily: "'Cinzel', serif",
            lineHeight: 1,
            textShadow: '0 1px 0 rgba(255,255,255,.35)',
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
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.2))',
            opacity: 0.96,
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
          alignItems: 'flex-start',
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
            textShadow: '0 1px 0 rgba(255,255,255,.35)',
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
