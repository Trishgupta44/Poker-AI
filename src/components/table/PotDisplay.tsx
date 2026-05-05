import { motion, AnimatePresence } from 'framer-motion';

interface PotDisplayProps {
  amount: number;
}

export function PotDisplay({ amount }: PotDisplayProps) {
  if (amount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={amount}
        initial={{ scale: 0.9, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex items-center gap-2 bg-noir-bg/85 border border-gold-border/45 rounded-full px-4 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-gold-primary shadow-[0_0_12px_rgba(201,168,76,0.6)]" />
        <span className="font-[DM_Mono] text-[10px] tracking-[0.18em] text-gold-primary">POT</span>
        <span className="font-[DM_Mono] text-gold-light font-medium text-sm">
          {amount.toLocaleString()}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
