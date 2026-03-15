import type { Card } from '../../types/card';
import { CardComponent } from './CardComponent';

interface CommunityCardsProps {
  cards: Card[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  // Always show 5 card slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);

  return (
    <div className="flex gap-2 items-center justify-center">
      {slots.map((card, index) => (
        <div key={index}>
          {card ? (
            <CardComponent
              card={card}
              size="md"
              delay={index * 0.15}
              animate={true}
            />
          ) : (
            <div
              className="rounded-md border border-dashed border-noir-border/50 bg-noir-bg/30"
              style={{ width: 64, height: 92 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
