import { motion, AnimatePresence } from 'framer-motion';

interface TurnHandoverModalProps {
  show: boolean;
  playerName: string;
  onReady: () => void;
}

export function TurnHandoverModal({ show, playerName, onReady }: TurnHandoverModalProps) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: '#0A0A0A' }} // Fully opaque — hide everything
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <div className="text-text-muted text-sm font-[DM_Mono] mb-4 tracking-widest">
            PASS THE DEVICE TO
          </div>
          <h2 className="font-[Cinzel] text-4xl text-gold-gradient mb-8">
            {playerName}
          </h2>
          <button
            onClick={onReady}
            className="px-12 py-4 bg-gradient-to-r from-gold-dark via-gold-primary to-gold-dark
                       text-noir-bg font-[Cinzel] font-bold text-lg rounded-lg
                       hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all btn-press cursor-pointer"
          >
            I'm Ready
          </button>
          <div className="mt-6 text-text-muted text-xs font-[DM_Mono]">
            The other player's cards will be hidden
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
