import { create } from 'zustand';
import type { HandStrengthResult, ConfidenceResult, AuditResult, PreflopStrategyResult, DrawResult, BlockerResult, ScareCardResult } from '../types/ai';

interface AIStore {
  // State
  handStrength: HandStrengthResult | null;
  confidenceScores: Record<string, ConfidenceResult>;
  lastAuditResults: AuditResult[];
  equityHistory: number[];
  isComputing: boolean;
  preflopAdvice: PreflopStrategyResult | null;
  drawInfo: DrawResult | null;
  blockerInfo: BlockerResult | null;
  scareCardInfo: ScareCardResult | null;
  lastAuditedRound: number | null;  // Survives StrictMode remounts (unlike refs)

  // Actions
  setHandStrength: (result: HandStrengthResult) => void;
  setConfidenceScore: (opponentId: string, result: ConfidenceResult) => void;
  setAuditResults: (results: AuditResult[]) => void;
  addEquityPoint: (equity: number) => void;
  setIsComputing: (computing: boolean) => void;
  setPreflopAdvice: (result: PreflopStrategyResult | null) => void;
  setDrawInfo: (result: DrawResult | null) => void;
  setBlockerInfo: (result: BlockerResult | null) => void;
  setScareCardInfo: (result: ScareCardResult | null) => void;
  setLastAuditedRound: (roundNum: number | null) => void;
  clearForNewRound: () => void;
}

export const useAIStore = create<AIStore>((set) => ({
  handStrength: null,
  confidenceScores: {},
  lastAuditResults: [],
  equityHistory: [],
  isComputing: false,
  preflopAdvice: null,
  drawInfo: null,
  blockerInfo: null,
  scareCardInfo: null,
  lastAuditedRound: null,

  setHandStrength: (result: HandStrengthResult) => {
    set(state => ({
      handStrength: result,
      equityHistory: [...state.equityHistory, result.equity],
    }));
  },

  setConfidenceScore: (opponentId: string, result: ConfidenceResult) => {
    set(state => ({
      confidenceScores: {
        ...state.confidenceScores,
        [opponentId]: result,
      },
    }));
  },

  setAuditResults: (results: AuditResult[]) => {
    set({ lastAuditResults: results });
  },

  addEquityPoint: (equity: number) => {
    set(state => ({
      equityHistory: [...state.equityHistory, equity],
    }));
  },

  setIsComputing: (computing: boolean) => {
    set({ isComputing: computing });
  },

  setPreflopAdvice: (result) => { set({ preflopAdvice: result }); },
  setDrawInfo: (result) => { set({ drawInfo: result }); },
  setBlockerInfo: (result) => { set({ blockerInfo: result }); },
  setScareCardInfo: (result) => { set({ scareCardInfo: result }); },
  setLastAuditedRound: (roundNum) => { set({ lastAuditedRound: roundNum }); },

  clearForNewRound: () => {
    set({
      handStrength: null,
      // confidenceScores intentionally NOT cleared — they persist across rounds
      // because they are based on long-term opponent profiles, not the current hand
      equityHistory: [],
      isComputing: false,
      preflopAdvice: null,
      drawInfo: null,
      blockerInfo: null,
      scareCardInfo: null,
      lastAuditedRound: null,  // Allow auditing the new round
    });
  },
}));
