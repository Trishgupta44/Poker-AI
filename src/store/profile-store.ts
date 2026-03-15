import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OpponentProfile, AuditResult, BoardTexture } from '../types/ai';
import { createDefaultProfile } from '../types/ai';
import type { Street } from '../types/game';
import * as aiApi from '../api/ai-api';

interface ProfileStore {
  profiles: Record<string, OpponentProfile>;

  getProfile: (subjectId: string, subjectName?: string) => OpponentProfile;
  updateProfile: (
    subjectId: string,
    auditResult: AuditResult,
    boardTexture: BoardTexture | string,
    street: Street,
    betSizeRatio: number,
    wasInPosition: boolean,
    actionSequence: string,
    spr: number,
    wasCaughtBluffing: boolean,
    actionTimeMs?: number | null
  ) => void;
  resetAllProfiles: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: {},

      getProfile: (subjectId: string, subjectName?: string): OpponentProfile => {
        const existing = get().profiles[subjectId];
        if (existing) return existing;

        const newProfile = createDefaultProfile(subjectId, subjectName ?? 'Unknown');
        set(state => ({
          profiles: {
            ...state.profiles,
            [subjectId]: newProfile,
          },
        }));
        return newProfile;
      },

      updateProfile: (
        subjectId: string,
        auditResult: AuditResult,
        boardTexture: BoardTexture | string,
        street: Street,
        betSizeRatio: number,
        wasInPosition: boolean,
        actionSequence: string,
        spr: number,
        wasCaughtBluffing: boolean,
        actionTimeMs: number | null = null
      ) => {
        const profile = get().getProfile(subjectId, auditResult.playerName);

        // Call Python API (async) — updates profile via EMA
        (async () => {
          try {
            const updated = await aiApi.updateProfile(
              profile,
              auditResult,
              boardTexture as string,
              street,
              betSizeRatio,
              wasInPosition,
              actionSequence,
              spr,
              wasCaughtBluffing,
              actionTimeMs
            );

            set(state => ({
              profiles: {
                ...state.profiles,
                [subjectId]: updated,
              },
            }));
          } catch (e) {
            console.error('Profile update error:', e);
          }
        })();
      },

      resetAllProfiles: () => {
        set({ profiles: {} });
      },
    }),
    {
      name: 'poker-ai-profiles',
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name);
            if (!str) return null;
            return JSON.parse(str);
          } catch (e) {
            console.warn('Failed to load profiles, starting fresh:', e);
            localStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            console.warn('Failed to persist profiles:', e);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
