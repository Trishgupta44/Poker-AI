"""
Scare Card Detector — identifies community cards that dramatically change the board texture.

Scare cards are community cards that:
  - Complete a possible flush (3rd card of a suit)
  - Complete a possible straight (connecting cards)
  - Pair the board (full house/trips potential)
  - Bring an overcard above previous board cards

Scare level 0-1:
  0.0 = brick (changes nothing)
  0.3 = minor scare (backdoor completed, low card paired)
  0.6 = moderate scare (flush possible, straight possible)
  1.0 = maximum scare (obvious flush/straight completed)
"""

RANK_ORDER = "23456789TJQKA"


def _rank_value(rank: str) -> int:
    r = rank.upper()
    if r == "10":
        r = "T"
    idx = RANK_ORDER.find(r)
    return idx + 2 if idx >= 0 else 0


def _rank_label(value: int) -> str:
    if value < 2 or value > 14:
        return "?"
    return RANK_ORDER[value - 2]


def detect_scare_cards(
    community_cards: list[dict],
    new_card: dict | None = None,
    hole_cards: list[dict] | None = None,
) -> dict:
    """
    Analyze community cards for scare factors.

    If new_card is provided, evaluate how scary that specific card is
    relative to the existing board. Otherwise, evaluate the overall
    board scariness.

    Args:
        community_cards: All community cards currently on board (3-5)
        new_card:        Optional — the latest card dealt (turn or river)

    Returns:
        {
            scare_level: float (0-1),
            reasons: list[str],
            is_flush_completing: bool,
            is_straight_completing: bool,
            is_pairing: bool,
            is_overcard: bool,
            board_scariness: str ('SAFE' | 'MILD' | 'SCARY' | 'VERY_SCARY'),
        }
    """
    if len(community_cards) < 3:
        return {
            "scare_level": 0,
            "reasons": [],
            "is_flush_completing": False,
            "is_straight_completing": False,
            "is_pairing": False,
            "is_overcard": False,
            "board_scariness": "SAFE",
            "affectsUs": False,
            "affectsThem": False,
        }

    # If new_card provided, analyze it vs the rest of the board
    if new_card is not None:
        prior_cards = [c for c in community_cards if c is not new_card]
        # If new_card is in community_cards, separate it
        if len(prior_cards) == len(community_cards):
            # new_card wasn't in community_cards — it's the newest
            all_cards = community_cards
        else:
            all_cards = community_cards
    else:
        prior_cards = community_cards[:3] if len(community_cards) > 3 else community_cards
        all_cards = community_cards
        new_card = community_cards[-1] if len(community_cards) > 3 else None

    all_ranks = [_rank_value(c.get("rank", "2")) for c in all_cards]
    all_suits = [c.get("suit", "").lower() for c in all_cards]

    reasons = []
    scare = 0.0
    is_flush_completing = False
    is_straight_completing = False
    is_pairing = False
    is_overcard = False

    # ── Flush scare ──
    suit_counts: dict[str, int] = {}
    for s in all_suits:
        suit_counts[s] = suit_counts.get(s, 0) + 1

    for suit, count in suit_counts.items():
        if count >= 3:
            is_flush_completing = True
            if count >= 4:
                reasons.append(f"Four cards of same suit — someone likely has a flush")
                scare += 0.45
            else:
                reasons.append(f"Three cards of same suit — a flush is possible")
                scare += 0.30

    # ── Straight scare ──
    unique_ranks = sorted(set(all_ranks))
    # Add low-ace for wheel
    if 14 in unique_ranks:
        unique_ranks_ext = [1] + unique_ranks
    else:
        unique_ranks_ext = unique_ranks

    for low in range(1, 11):
        window = set(range(low, low + 5))
        present = window & set(unique_ranks_ext)
        if len(present) >= 4:
            is_straight_completing = True
            if len(present) == 5:
                reasons.append("Cards in a row on board — a straight is very likely")
                scare += 0.40
            else:
                reasons.append("Almost connected cards — a straight is possible")
                scare += 0.20
            break

    # ── Board pairing ──
    rank_counts: dict[int, int] = {}
    for r in all_ranks:
        rank_counts[r] = rank_counts.get(r, 0) + 1

    for rank, count in rank_counts.items():
        if count >= 3:
            is_pairing = True
            reasons.append(f"Three {_rank_label(rank)}s on board — someone could have a full house")
            scare += 0.25
            break
        elif count == 2:
            is_pairing = True
            reasons.append(f"The board has a pair of {_rank_label(rank)}s — three of a kind is possible")
            scare += 0.15
            break

    # ── Overcard scare (new card only) ──
    if new_card is not None:
        new_rank = _rank_value(new_card.get("rank", "2"))
        prior_ranks = [_rank_value(c.get("rank", "2")) for c in prior_cards]
        if prior_ranks and new_rank > max(prior_ranks):
            is_overcard = True
            reasons.append(f"A high card ({_rank_label(new_rank)}) appeared — could give someone a better pair")
            scare += 0.15

    # ── Normalize ──
    scare_level = min(1.0, scare)

    if scare_level >= 0.6:
        board_scariness = "VERY_SCARY"
    elif scare_level >= 0.35:
        board_scariness = "SCARY"
    elif scare_level >= 0.15:
        board_scariness = "MILD"
    else:
        board_scariness = "SAFE"

    if not reasons:
        reasons.append("Board looks safe — no obvious danger cards")

    # ── B2: Determine if scare card affects us vs opponents ──
    affects_us = False
    affects_them = True  # default: assume it helps opponents
    if hole_cards and len(hole_cards) == 2:
        hero_suits_sc = [c.get("suit", "").lower() for c in hole_cards]
        hero_ranks_sc = [_rank_value(c.get("rank", "2")) for c in hole_cards]
        # Check if flush-completing board helps our hand
        if is_flush_completing:
            for suit, count in suit_counts.items():
                if count >= 3:
                    hero_has_suit = sum(1 for hs in hero_suits_sc if hs == suit)
                    if hero_has_suit >= 1:
                        affects_us = True
                        affects_them = False
                    break
        # Check if board pairing helps us (we hold that rank)
        if is_pairing:
            for rank, count in rank_counts.items():
                if count >= 2:
                    if rank in hero_ranks_sc:
                        affects_us = True
                        affects_them = False
                    break
        # Check if overcard matches our hand
        if is_overcard and new_card is not None:
            new_r = _rank_value(new_card.get("rank", "2"))
            if new_r in hero_ranks_sc:
                affects_us = True
                affects_them = False

    return {
        "scare_level": round(scare_level, 2),
        "reasons": reasons,
        "is_flush_completing": is_flush_completing,
        "is_straight_completing": is_straight_completing,
        "is_pairing": is_pairing,
        "is_overcard": is_overcard,
        "board_scariness": board_scariness,
        "affectsUs": affects_us,
        "affectsThem": affects_them,
    }
