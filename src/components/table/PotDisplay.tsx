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
        className="flex items-center gap-2 bg-noir-bg/80 border border-gold-border/30 rounded-full px-4 py-1.5"
      >
        <span className="text-gold-primary text-xs">POT</span>
        <span className="font-[DM_Mono] text-gold-light font-medium text-sm">
          {amount.toLocaleString()}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
