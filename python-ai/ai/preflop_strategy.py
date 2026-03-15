"""
Preflop Strategy — position-based hand selection and action recommendations.

Hand tiers (1 = premium, 5 = speculative):
  Tier 1: AA, KK, QQ, AKs
  Tier 2: JJ, TT, AKo, AQs, AQo
  Tier 3: 99, 88, AJs, ATs, KQs, KQo, AJo
  Tier 4: 77, 66, KJs, KTs, QJs, QTs, JTs, ATo, A9s-A2s
  Tier 5: 55-22, suited connectors (T9s-54s), suited one-gappers

Position ranges:
  UTG:  Tiers 1-2
  MP:   Tiers 1-3
  CO:   Tiers 1-4
  BTN:  Tiers 1-5
  SB:   Tiers 1-4 (out of position post-flop)
  BB:   Tiers 1-4 (already invested, defend wider)
"""

# ── Rank utilities ──────────────────────────────────────────────────────────

RANK_ORDER = "23456789TJQKA"


def _rank_value(rank: str) -> int:
    """Convert rank char to numeric value (2=0 ... A=12)."""
    return RANK_ORDER.index(rank.upper()) if rank.upper() in RANK_ORDER else 0


def _normalize_hand(hole_cards: list[dict]) -> tuple[str, str, bool]:
    """
    Normalize hole cards into (high_rank, low_rank, is_suited).

    Args:
        hole_cards: [{rank, suit}, {rank, suit}]

    Returns:
        (high_rank, low_rank, is_suited)
    """
    r1 = hole_cards[0].get("rank", "2").upper()
    r2 = hole_cards[1].get("rank", "2").upper()
    s1 = hole_cards[0].get("suit", "").lower()
    s2 = hole_cards[1].get("suit", "").lower()

    # Normalize 10 → T
    if r1 == "10":
        r1 = "T"
    if r2 == "10":
        r2 = "T"

    is_suited = s1 == s2

    if _rank_value(r1) >= _rank_value(r2):
        return r1, r2, is_suited
    return r2, r1, is_suited


# ── Hand tier classification ───────────────────────────────────────────────

TIER_1 = {"AA", "KK", "QQ", "AKs"}
TIER_2 = {"JJ", "TT", "AKo", "AQs", "AQo"}
TIER_3 = {"99", "88", "AJs", "ATs", "KQs", "KQo", "AJo"}
TIER_4 = {
    "77", "66", "KJs", "KTs", "QJs", "QTs", "JTs",
    "ATo", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "KJo", "QJo",
}
TIER_5 = {
    "55", "44", "33", "22",
    "T9s", "98s", "87s", "76s", "65s", "54s",
    "J9s", "T8s", "97s", "86s", "75s", "64s",
}


def _get_hand_tier(high: str, low: str, is_suited: bool) -> int:
    """
    Classify a normalized hand into tiers 1-6.
    Tier 6 = unplayable trash.
    """
    if high == low:
        # Pocket pair
        label = high + low
    else:
        suffix = "s" if is_suited else "o"
        label = high + low + suffix

    if label in TIER_1:
        return 1
    if label in TIER_2:
        return 2
    if label in TIER_3:
        return 3
    if label in TIER_4:
        return 4
    if label in TIER_5:
        return 5

    # Also check pair without suffix
    pair_label = high + low
    if pair_label in TIER_1:
        return 1
    if pair_label in TIER_2:
        return 2
    if pair_label in TIER_3:
        return 3
    if pair_label in TIER_4:
        return 4
    if pair_label in TIER_5:
        return 5

    # Suited bonus: no suited hand should be Tier 6 (unplayable)
    # Promote suited hands to Tier 5 — they have flush potential
    if is_suited:
        return 5

    return 6  # Unplayable offsuit trash


# ── Position ranges ────────────────────────────────────────────────────────

# Maximum tier allowed to open from each position
POSITION_MAX_TIER = {
    "UTG": 2,
    "MP": 3,
    "CO": 4,
    "BTN": 5,
    "SB": 4,
    "BB": 4,
}

# When facing a raise, tighten by this many tiers
FACING_RAISE_TIGHTEN = 1

# Short-stack threshold (in big blinds) for push/fold mode
SHORT_STACK_BB = 10


# ── Main function ──────────────────────────────────────────────────────────

def get_preflop_strategy_action(
    hole_cards: list[dict],
    position: str,
    is_facing_raise: bool,
    is_open_action: bool,
    folded_to_player: bool,
    hero_stack: float,
    current_bet: float,
    pot: float,
) -> dict:
    """
    Recommend a preflop action based on hand strength and position.

    Args:
        hole_cards:       [{rank, suit}, {rank, suit}]
        position:         'UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'
        is_facing_raise:  True if there's a raise ahead
        is_open_action:   True if first voluntary action
        folded_to_player: True if everyone folded to us
        hero_stack:       Current chip count
        current_bet:      Amount to call
        pot:              Current pot size

    Returns:
        {
            action: 'RAISE' | 'CALL' | 'FOLD' | 'CHECK',
            reason: str,
            confidence: float (0-1),
            hand_tier: int (1-6),
        }
    """
    if len(hole_cards) < 2:
        return {
            "action": "FOLD",
            "reason": "Invalid hand.",
            "confidence": 0,
            "hand_tier": 6,
        }

    high, low, is_suited = _normalize_hand(hole_cards)
    tier = _get_hand_tier(high, low, is_suited)
    pos = position.upper() if position else "MP"
    max_tier = POSITION_MAX_TIER.get(pos, 3)

    # Calculate big blind for stack depth
    big_blind = max(current_bet, 1) if current_bet > 0 else max(pot / 1.5, 1)
    stack_in_bb = hero_stack / big_blind if big_blind > 0 else 20

    suited_str = "suited" if is_suited else "offsuit"
    hand_label = f"{high}{low} {suited_str}" if high != low else f"pocket {high}{low}"

    # ── Short-stack push/fold mode ──
    if stack_in_bb <= SHORT_STACK_BB:
        if tier <= 3:
            return {
                "action": "RAISE",
                "reason": f"Low chips with {hand_label} — go all-in while you can.",
                "confidence": min(1.0, 0.6 + (4 - tier) * 0.15),
                "hand_tier": tier,
            }
        return {
            "action": "FOLD",
            "reason": f"Low chips but {hand_label} is too weak — wait for a better hand.",
            "confidence": 0.7,
            "hand_tier": tier,
        }

    # ── Facing a raise: tighten range ──
    if is_facing_raise:
        effective_max = max(1, max_tier - FACING_RAISE_TIGHTEN)

        if tier <= effective_max:
            if tier <= 2:
                return {
                    "action": "RAISE",
                    "reason": f"Strong hand — raise back to build the pot.",
                    "confidence": min(1.0, 0.7 + (3 - tier) * 0.15),
                    "hand_tier": tier,
                }
            return {
                "action": "CALL",
                "reason": f"Good hand — call and see the flop.",
                "confidence": 0.55,
                "hand_tier": tier,
            }

        return {
            "action": "FOLD",
            "reason": f"Weak hand against a raise — fold and wait.",
            "confidence": 0.65,
            "hand_tier": tier,
        }

    # ── Open action (no raise ahead) ──
    if is_open_action or folded_to_player:
        if tier <= max_tier:
            if tier <= 2:
                return {
                    "action": "RAISE",
                    "reason": f"Strong hand — raise to build the pot.",
                    "confidence": min(1.0, 0.8 + (3 - tier) * 0.1),
                    "hand_tier": tier,
                }
            return {
                "action": "RAISE",
                "reason": f"Playable hand — raise to take control.",
                "confidence": max(0.4, 0.7 - (tier - 2) * 0.1),
                "hand_tier": tier,
            }
        return {
            "action": "FOLD",
            "reason": f"Weak hand for this spot — fold and wait for better cards.",
            "confidence": 0.6,
            "hand_tier": tier,
        }

    # ── Limped pot (someone limped, no raise) ──
    if tier <= max_tier:
        if tier <= 2:
            return {
                "action": "RAISE",
                "reason": f"Strong hand — raise to punish limpers.",
                "confidence": 0.75,
                "hand_tier": tier,
            }
        return {
            "action": "CALL",
            "reason": f"Decent hand — call and see the flop cheaply.",
            "confidence": 0.50,
            "hand_tier": tier,
        }

    return {
        "action": "FOLD",
        "reason": f"Weak hand — not worth playing here.",
        "confidence": 0.55,
        "hand_tier": tier,
    }
