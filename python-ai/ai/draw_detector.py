"""
Draw Detector — identifies flush draws, straight draws, and combo draws.

Analyzes hole cards + community cards to detect:
  - Flush draws (4 to a flush, 9 outs)
  - Open-ended straight draws (8 outs)
  - Gutshot straight draws (4 outs)
  - Combo draws (flush + straight)
  - Backdoor draws (3 to a flush/straight on the flop)
"""

RANK_ORDER = "23456789TJQKA"


def _rank_value(rank: str) -> int:
    """Convert rank char to numeric value (2=2 ... A=14)."""
    r = rank.upper()
    if r == "10":
        r = "T"
    idx = RANK_ORDER.find(r)
    return idx + 2 if idx >= 0 else 0


def _get_suit(card: dict) -> str:
    return card.get("suit", "").lower()


def _get_rank(card: dict) -> int:
    return _rank_value(card.get("rank", "2"))


def detect_draws(
    hole_cards: list[dict],
    community_cards: list[dict],
) -> dict:
    """
    Detect flush and straight draws.

    Args:
        hole_cards:      [{rank, suit}, {rank, suit}]
        community_cards: List of community card dicts (0-5 cards)

    Returns:
        {
            flush_draw: bool,
            flush_draw_suit: str | None,
            flush_draw_outs: int,
            straight_draw: bool,
            straight_draw_type: 'OPEN_ENDED' | 'GUTSHOT' | None,
            straight_draw_outs: int,
            combo_draw: bool,
            backdoor_flush: bool,
            backdoor_straight: bool,
            total_outs: int,
            draw_strength: float (0-1),
            explanation: str,
        }
    """
    all_cards = list(hole_cards) + list(community_cards)
    hero_ranks = {_get_rank(c) for c in hole_cards}
    hero_suits = [_get_suit(c) for c in hole_cards]

    # ── Flush draw detection ──
    suit_counts: dict[str, int] = {}
    for c in all_cards:
        s = _get_suit(c)
        suit_counts[s] = suit_counts.get(s, 0) + 1

    flush_draw = False
    flush_draw_suit = None
    flush_draw_outs = 0
    backdoor_flush = False

    for suit, count in suit_counts.items():
        # Only count if hero contributes at least one card of this suit
        hero_has_suit = suit in hero_suits
        if not hero_has_suit:
            continue

        if count == 4:
            flush_draw = True
            flush_draw_suit = suit
            flush_draw_outs = 9  # 13 - 4 = 9 remaining of that suit
        elif count == 3 and len(community_cards) <= 3:
            backdoor_flush = True

    # ── Straight draw detection ──
    all_ranks = sorted({_get_rank(c) for c in all_cards})
    # Add low-ace for wheel draws (A-2-3-4-5)
    if 14 in all_ranks:
        all_ranks = [1] + all_ranks

    straight_draw = False
    straight_draw_type = None
    straight_draw_outs = 0
    backdoor_straight = False

    # Check all possible 5-card straight windows
    best_draw = None
    for low in range(1, 11):  # Windows: 1-5 through 10-14
        window = set(range(low, low + 5))
        present = window & set(all_ranks)
        # Hero must contribute at least one card to the straight
        hero_contributes = bool(window & hero_ranks) or (1 in window and 14 in hero_ranks)

        if not hero_contributes:
            continue

        missing = len(window) - len(present)

        if missing == 1:
            # 4 to a straight
            gap_rank = (window - set(all_ranks)).pop()
            # Open-ended: missing card is at one end
            is_open_ended = gap_rank == low or gap_rank == low + 4
            # But not open-ended if it's A-high or wheel (only one end open)
            if low == 1 and gap_rank == 1:
                is_open_ended = False
            if low == 10 and gap_rank == 14:
                is_open_ended = False

            if is_open_ended:
                if best_draw is None or best_draw[1] < 8:
                    best_draw = ("OPEN_ENDED", 8)
            else:
                if best_draw is None or best_draw[1] < 4:
                    best_draw = ("GUTSHOT", 4)
        elif missing == 2 and len(community_cards) <= 3:
            backdoor_straight = True

    if best_draw:
        straight_draw = True
        straight_draw_type = best_draw[0]
        straight_draw_outs = best_draw[1]

    # ── Combo draw ──
    combo_draw = flush_draw and straight_draw

    # ── Total outs (avoid double-counting combo outs) ──
    if combo_draw:
        # Rough: subtract ~2 for overlap
        total_outs = flush_draw_outs + straight_draw_outs - 2
    else:
        total_outs = flush_draw_outs + straight_draw_outs

    # ── Draw strength (0-1) ──
    # Approximate probability of hitting by river (2 cards to come from flop, 1 from turn)
    cards_to_come = max(1, 5 - len(community_cards))
    remaining_deck = 52 - len(all_cards)
    if remaining_deck > 0 and cards_to_come >= 2:
        # P(miss all) = C(non-outs, cards_to_come) / C(remaining, cards_to_come)
        miss_one = (remaining_deck - total_outs) / remaining_deck
        miss_two = (remaining_deck - total_outs - 1) / max(1, remaining_deck - 1) if cards_to_come >= 2 else 1
        draw_strength = 1 - (miss_one * miss_two)
    elif remaining_deck > 0:
        draw_strength = total_outs / remaining_deck
    else:
        draw_strength = 0

    draw_strength = max(0, min(1, draw_strength))

    # ── Explanation ──
    parts = []
    if combo_draw:
        parts.append(f"You could make a flush or a straight — strong drawing hand")
    elif flush_draw:
        parts.append(f"You could make a flush — good chance to complete")
    elif straight_draw:
        if straight_draw_type == "OPEN_ENDED":
            parts.append(f"You could make a straight — good chance with 2 ways to hit")
        else:
            parts.append(f"You need 1 specific card for a straight — smaller chance")

    if backdoor_flush and not flush_draw:
        parts.append("Slim chance at a flush with 2 more cards")
    if backdoor_straight and not straight_draw:
        parts.append("Slim chance at a straight with 2 more cards")

    if not parts:
        explanation = "No drawing hands right now."
    else:
        pct = draw_strength * 100
        explanation = "; ".join(parts) + f". About {pct:.0f}% chance to hit."

    return {
        "flush_draw": flush_draw,
        "flush_draw_suit": flush_draw_suit,
        "flush_draw_outs": flush_draw_outs,
        "straight_draw": straight_draw,
        "straight_draw_type": straight_draw_type,
        "straight_draw_outs": straight_draw_outs,
        "combo_draw": combo_draw,
        "backdoor_flush": backdoor_flush,
        "backdoor_straight": backdoor_straight,
        "total_outs": total_outs,
        "draw_strength": round(draw_strength, 3),
        "explanation": explanation,
    }
