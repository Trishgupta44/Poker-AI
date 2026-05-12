import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Player } from '../../types/player';
import type { Card } from '../../types/card';
import type { PlayerAction, ActionType } from '../../types/game';
import { PlayerSeat } from './PlayerSeat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';

interface PokerTableProps {
  players: Player[];
  communityCards: Card[];
  pot: number;
  dealerIndex: number;
  activePlayerIndex: number;
  showCardsForPlayerId: string | null;
  isShowdown: boolean;
  actions?: PlayerAction[];
}

type SeatPosition = { x: string; y: string };

function getSeatLayout(playerCount: number): Array<{ x: string; y: string }> {
  // Original rail-style seating: cards sit around the oval rather than on top
  // of the felt.
  const bottomCenter = { x: '45%', y: 'calc(85% + 20px)' };
  const topCenter    = { x: '45%', y: '-20%' };
  const leftCenter   = { x: '-6%',  y: '40%' };
  const rightCenter  = { x: '93%', y: '40%' };

  if (playerCount === 2) {
    return [bottomCenter, topCenter];
  }
  
  if (playerCount === 3) {
    return [bottomCenter, leftCenter, rightCenter];
  }

  // 4 or more players (falls back to 4 max supported by this specific layout)
  return [bottomCenter, leftCenter, topCenter, rightCenter];
}

export function PokerTable({
  players,
  communityCards,
  pot,
  dealerIndex,
  activePlayerIndex,
  showCardsForPlayerId,
  isShowdown,
  actions = [],
}: PokerTableProps) {
  // Find the hero (AI-assisted human, or first human, or player index 0)
  let heroIndex = players.findIndex(p => p.type === 'HUMAN' && p.hasAIAssistance);
  if (heroIndex === -1) heroIndex = players.findIndex(p => p.type === 'HUMAN');
  if (heroIndex === -1) heroIndex = 0;

  // Compute last action per player from the actions array
  const lastActions = new Map<string, ActionType>();
  actions.forEach(a => {
    if (a.action !== 'POST_BLIND') {
      lastActions.set(a.playerId, a.action);
    }
  });

  const seatByPlayerId = useMemo(() => {
    const layout = getSeatLayout(players.length);
    const seatMap = new Map<string, SeatPosition>();

    players.forEach((player, index) => {
      const offset = (index - heroIndex + players.length) % players.length;
      const position = layout[offset] || layout[0];
      seatMap.set(player.id, position);
    });

    return seatMap;
  }, [heroIndex, players]);

  const [recentPotGain, setRecentPotGain] = useState<{ id: string; amount: number } | null>(null);
  const lastAnimatedActionRef = useRef<string | null>(null);

  useEffect(() => {
    const lastBetAction = [...actions]
      .reverse()
      .find(action =>
        action.action !== 'POST_BLIND' &&
        action.action !== 'CHECK' &&
        action.action !== 'FOLD' &&
        action.amount > 0
      );
    if (!lastBetAction) return;

    const actionKey = `${lastBetAction.timestamp}-${lastBetAction.playerId}-${lastBetAction.action}-${lastBetAction.amount}`;
    if (lastAnimatedActionRef.current === actionKey) return;

    const fromSeat = seatByPlayerId.get(lastBetAction.playerId);
    if (!fromSeat) return;

    lastAnimatedActionRef.current = actionKey;
    setRecentPotGain({
      id: actionKey,
      amount: lastBetAction.amount,
    });

    const timeout = setTimeout(() => setRecentPotGain(null), 700);
    return () => clearTimeout(timeout);
  }, [actions, seatByPlayerId]);

  return (
    <div className="relative w-full max-w-[800px] mx-auto overflow-visible" style={{ aspectRatio: '16/9' }}>
      {/* Ambient felt glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '74%',
          height: '62%',
          left: '13%',
          top: '19%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(60,84,145,.42) 0%, rgba(201,168,76,.14) 46%, transparent 74%)',
          filter: 'blur(28px)',
          animation: 'aGlow 4s ease-in-out infinite alternate',
        }}
      />
      <motion.div
        className="absolute pointer-events-none"
        style={{
          width: '72%',
          height: '60%',
          left: '14%',
          top: '20%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 45%, rgba(210,224,255,.12), rgba(210,224,255,.025) 42%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
        animate={{ opacity: [0.22, 0.4, 0.24] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Multi-layered oval table ── */}
      <div
        className="absolute"
        style={{
          left: '10%',
          top: '18%',
          width: '80%',
          height: '64%',
        }}
      >
        {/* Layer 1: Outer dark frame */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(160deg, #1b202e, #0c1018 52%, #252d3d)',
            boxShadow: '0 22px 75px rgba(0,0,0,.88), inset 0 1px 0 rgba(255,255,255,.04)',
            padding: 7,
          }}
        >
          {/* Layer 2: Gold ring */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 999,
              padding: 3,
              background: 'conic-gradient(from 0deg, #ad8f4b 0%, #5e4a24 15%, #e2c985 33%, #5f4b27 52%, #b99a55 70%, #473717 85%, #ad8f4b 100%)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,.5)',
            }}
          >
            {/* Layer 3: Wood rail */}
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 999,
                padding: 9,
                background: `
                  repeating-linear-gradient(22deg, rgba(255,255,255,.05) 0 2px, rgba(0,0,0,.03) 2px 6px),
                  radial-gradient(ellipse at 28% 24%, #343e58, #21283a 46%, #101521 76%)
                `,
                boxShadow: 'inset 0 6px 22px rgba(0,0,0,.68), inset 0 -2px 0 rgba(240,205,147,.14), inset 0 1px 0 rgba(230,238,255,.16)',
              }}
            >
              {/* Layer 4: Thin gold inner accent */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 999,
                  border: '1.5px solid rgba(201,168,76,.2)',
                  padding: 5,
                }}
              >
                {/* Layer 5: Green felt */}
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 999,
                    background: 'radial-gradient(ellipse at 42% 36%, #1f3049, #131f32 52%, #0a111f 84%)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 5px 34px rgba(0,0,0,.58), inset 0 0 0 1px rgba(220,230,255,.05)',
                  }}
                >
                  <motion.div
                    style={{
                      position: 'absolute',
                      inset: '-8%',
                      borderRadius: '50%',
                      background: 'linear-gradient(105deg, transparent 36%, rgba(210,225,255,.12) 49%, transparent 62%)',
                      pointerEvents: 'none',
                    }}
                    animate={{ x: ['-32%', '32%'] }}
                    transition={{ duration: 7, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                  />
                  {/* Micro weave texture */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 999,
                      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0, rgba(0,0,0,.05) 1px, transparent 1px, transparent 3px),
                        repeating-linear-gradient(90deg, rgba(0,0,0,.04) 0, rgba(0,0,0,.04) 1px, transparent 1px, transparent 3px)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '14%',
                      borderRadius: 999,
                      border: '1px solid rgba(216,226,255,.18)',
                      boxShadow: 'inset 0 0 24px rgba(0,0,0,.22)',
                    }}
                  />

                  {/* Diamond watermark */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -65%)',
                      fontSize: 28,
                      color: 'rgba(255,255,255,.03)',
                      pointerEvents: 'none',
                    }}
                  >
                    ♦
                  </div>

                  {/* Community cards + Pot in center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <PotDisplay
                      amount={pot}
                      recentGain={recentPotGain?.amount ?? null}
                      recentGainToken={recentPotGain?.id ?? null}
                    />
                    <CommunityCards cards={communityCards} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edge-based player seats */}
      {players.length > 0 && players.map((player, index) => {
        const shouldShowCards = isShowdown || player.id === showCardsForPlayerId;

        // Calculate offset relative to hero
        const offset = (index - heroIndex + players.length) % players.length;
        const layout = getSeatLayout(players.length);
        // Fallback to the first position if somehow offset is out of bounds
        const position = layout[offset] || layout[0];

        return (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={index === activePlayerIndex}
            isDealer={index === dealerIndex}
            showCards={shouldShowCards}
            position={position}
            lastAction={lastActions.get(player.id)}
          />
        );
      })}
    </div>
  );
}
