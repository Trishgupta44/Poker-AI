import { motion, AnimatePresence } from 'framer-motion';

interface PotDisplayProps {
  amount: number;
  recentGain?: number | null;
  recentGainToken?: string | null;
}

const CHIP_DENOMS = [500, 100, 25, 5, 1] as const;
const CHIP_COLORS: Record<number, { top: string; edge: string; ring: string }> = {
  500: { top: '#2b2b33', edge: '#16161d', ring: '#d4b26a' },
  100: { top: '#8d1f2c', edge: '#5c111c', ring: '#f0dfba' },
  25: { top: '#1d5b3a', edge: '#124228', ring: '#ead7ac' },
  5: { top: '#274e80', edge: '#17345a', ring: '#e6cf9a' },
  1: { top: '#7b6c52', edge: '#584b35', ring: '#e8d8b4' },
};

function buildChipStacks(amount: number): Array<{ denom: number; count: number }> {
  let remaining = Math.max(0, Math.floor(amount));
  const stacks: Array<{ denom: number; count: number }> = [];

  for (const denom of CHIP_DENOMS) {
    if (remaining <= 0) break;
    const rawCount = Math.floor(remaining / denom);
    if (rawCount <= 0) continue;
    const visibleCount = Math.min(6, rawCount);
    stacks.push({ denom, count: visibleCount });
    remaining -= rawCount * denom;
  }

  return stacks.slice(0, 4);
}

export function PotDisplay({ amount, recentGain = null, recentGainToken = null }: PotDisplayProps) {
  if (amount === 0) return null;

  const chipStacks = buildChipStacks(amount);

  return (
    <AnimatePresence>
      <motion.div
        key={amount}
        initial={{ scale: 0.9, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative flex items-center gap-3 bg-noir-bg/88 border border-gold-border/45 rounded-full px-4 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex items-end gap-1.5 min-w-[48px]">
          {chipStacks.map(stack => {
            const colors = CHIP_COLORS[stack.denom];
            return (
              <div key={stack.denom} className="relative h-5 w-3.5">
                {Array.from({ length: stack.count }).map((_, idx) => (
                  <span
                    key={idx}
                    className="absolute left-0 h-2 w-3.5 rounded-full border"
                    style={{
                      bottom: `${idx * 2}px`,
                      background: `linear-gradient(180deg, ${colors.top} 0%, ${colors.edge} 100%)`,
                      borderColor: 'rgba(0,0,0,.45)',
                      boxShadow: idx === stack.count - 1 ? `0 0 0 1px ${colors.ring}44 inset` : 'none',
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gold-primary shadow-[0_0_12px_rgba(201,168,76,0.6)]" />
          <span className="font-[DM_Mono] text-[10px] tracking-[0.18em] text-gold-primary">POT</span>
          <span className="font-[DM_Mono] text-gold-light font-medium text-sm">
            {amount.toLocaleString()}
          </span>
        </div>
        <AnimatePresence>
          {recentGain && recentGainToken && (
            <motion.div
              key={recentGainToken}
              initial={{ opacity: 0, x: -6, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 4, scale: 0.9 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute -right-10 top-1/2 -translate-y-1/2 rounded-full border border-gold-border/45 bg-noir-bg/92 px-2 py-0.5 shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
            >
              <span className="font-[DM_Mono] text-[10px] text-gold-light whitespace-nowrap">
                +{Math.round(recentGain)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
