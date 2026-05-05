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
  // Using the explicit left (x) and top (y) values to ensure the elements are properly centered
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

  // Edge-based player seats positioning.
  // The table visually occupies left: 8.5%, right: 91.5%, top: 15%, bottom: 85% of the container.

  return (
    <div className="relative w-full max-w-[800px] mx-auto overflow-visible" style={{ aspectRatio: '16/9' }}>
      {/* Ambient felt glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '68%',
          height: '58%',
          left: '16%',
          top: '21%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(15,65,28,.4) 0%, transparent 70%)',
          filter: 'blur(24px)',
          animation: 'aGlow 4s ease-in-out infinite alternate',
        }}
      />

      {/* ── Multi-layered oval table ── */}
      <div
        className="absolute"
        style={{
          left: '8.5%',
          top: '15%',
          width: '83%',
          height: '70%',
        }}
      >
        {/* Layer 1: Outer dark frame */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 120,
            background: 'linear-gradient(160deg, #1a1a1a, #0d0d0d)',
            boxShadow: '0 22px 75px rgba(0,0,0,.88), inset 0 1px 0 rgba(255,255,255,.04)',
            padding: 7,
          }}
        >
          {/* Layer 2: Gold ring */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 120,
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
                borderRadius: 120,
                padding: 9,
                background: 'radial-gradient(ellipse at 30% 25%, #271806, #130b03)',
                boxShadow: 'inset 0 4px 18px rgba(0,0,0,.65)',
              }}
            >
              {/* Layer 4: Thin gold inner accent */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 120,
                  border: '1.5px solid rgba(201,168,76,.18)',
                  padding: 5,
                }}
              >
                {/* Layer 5: Green felt */}
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 120,
                    background: 'radial-gradient(ellipse at 42% 36%, #1d6530, #11401e, #0a2c14)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 3px 30px rgba(0,0,0,.45)',
                  }}
                >
                  {/* Micro weave texture */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 120,
                      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0, rgba(0,0,0,.05) 1px, transparent 1px, transparent 3px),
                        repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0, rgba(0,0,0,.05) 1px, transparent 1px, transparent 3px)`,
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
