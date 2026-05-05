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
          background: 'radial-gradient(ellipse, rgba(20,105,55,.45) 0%, rgba(201,168,76,.09) 46%, transparent 74%)',
          filter: 'blur(28px)',
          animation: 'aGlow 4s ease-in-out infinite alternate',
        }}
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
            background: 'linear-gradient(160deg, #21170a, #090909 54%, #1a1207)',
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
              background: 'conic-gradient(from 0deg, #c9a84c 0%, #7a5210 18%, #c9a84c 36%, #e8c86a 54%, #7a5210 72%, #c9a84c 100%)',
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
                background: 'radial-gradient(ellipse at 30% 25%, #3a2209, #140b03 68%)',
                boxShadow: 'inset 0 6px 22px rgba(0,0,0,.68), inset 0 -2px 0 rgba(201,168,76,.1)',
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
                    background: 'radial-gradient(ellipse at 42% 36%, #248144, #10502a 52%, #062713)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 5px 34px rgba(0,0,0,.52), inset 0 0 0 1px rgba(255,255,255,.035)',
                  }}
                >
                  {/* Micro weave texture */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 999,
                      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0, rgba(0,0,0,.05) 1px, transparent 1px, transparent 3px),
                        repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0, rgba(0,0,0,.05) 1px, transparent 1px, transparent 3px)`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '14%',
                      borderRadius: 999,
                      border: '1px solid rgba(232,213,163,.13)',
                      boxShadow: 'inset 0 0 24px rgba(0,0,0,.18)',
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
                    <PotDisplay amount={pot} />
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
