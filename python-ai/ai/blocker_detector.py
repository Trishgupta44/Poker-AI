"""
Blocker Detector — identifies which strong opponent hands are blocked by hero's cards.

Blockers reduce the number of combos an opponent can have of certain strong hands.
For example, holding the A♠ when 3 spades are on the board means the opponent
CANNOT have the nut flush in spades.

Key blocker types:
  - Nut flush blocker: Holding the ace of the flush suit
  - Top pair blocker: Holding a card matching the highest board card
  - Set blocker: Holding a card matching a board card (blocks opponent sets)
  - Straight blocker: Holding cards that reduce opponent straight combos
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


def detect_blockers(
    hole_cards: list[dict],
    community_cards: list[dict],
) -> dict:
    """
    Analyze hero's hole cards for blocker effects against opponent ranges.

    Args:
        hole_cards:      [{rank, suit}, {rank, suit}]
        community_cards: List of community card dicts (3-5 cards)

    Returns:
        {
            blocks_nut_flush: bool,
            blocks_flush: bool,
            blocks_top_pair: bool,
            blocks_overpair: bool,
            blocks_set: bool,
            blocks_straight: bool,
            blocker_score: float (0-1),
            blockers: list[str],
            explanation: str,
        }
    """
    if len(community_cards) < 3:
        return {
            "blocks_nut_flush": False,
            "blocks_flush": False,
            "blocks_top_pair": False,
            "blocks_overpair": False,
            "blocks_set": False,
            "blocks_straight": False,
            "blocker_score": 0,
            "blockers": [],
            "explanation": "Need at least 3 community cards for blocker analysis.",
            "straightBlockerCards": [],
            "flushBlockerCard": None,
        }

    hero_ranks = [_rank_value(c.get("rank", "2")) for c in hole_cards]
    hero_suits = [c.get("suit", "").lower() for c in hole_cards]
    board_ranks = [_rank_value(c.get("rank", "2")) for c in community_cards]
    board_suits = [c.get("suit", "").lower() for c in community_cards]
    board_rank_set = set(board_ranks)

    blockers = []
    score = 0.0

    # ── Flush blockers ──
    suit_counts: dict[str, int] = {}
    for s in board_suits:
        suit_counts[s] = suit_counts.get(s, 0) + 1

    blocks_nut_flush = False
    blocks_flush = False

    for suit, count in suit_counts.items():
        if count >= 3:
            # Flush-possible board
            for i, hs in enumerate(hero_suits):
                if hs == suit:
                    hr = hero_ranks[i]
                    if hr == 14:  # Ace of flush suit
                        blocks_nut_flush = True
                        blocks_flush = True
                        blockers.append(f"A{suit} blocks nut flush")
                        score += 0.30
                    elif hr >= 12:  # K or Q of flush suit
                        blocks_flush = True
                        blockers.append(f"{_rank_label(hr)}{suit} blocks strong flushes")
                        score += 0.15

    # ── Top pair blocker ──
    blocks_top_pair = False
    top_board_rank = max(board_ranks)
    for hr in hero_ranks:
        if hr == top_board_rank:
            blocks_top_pair = True
            blockers.append(f"Holding {_rank_label(hr)} blocks opponent top pair")
            score += 0.15
            break

    # ── Overpair blocker ──
    blocks_overpair = False
    for hr in hero_ranks:
        if hr > top_board_rank and hr >= 12:
            blocks_overpair = True
            blockers.append(f"Holding {_rank_label(hr)} blocks overpairs above the board")
            score += 0.10
            break

    # ── Set blocker ──
    blocks_set = False
    for hr in hero_ranks:
        if hr in board_rank_set:
            blocks_set = True
            blockers.append(f"Holding {_rank_label(hr)} blocks opponent sets of {_rank_label(hr)}s")
            score += 0.10
            break

    # ── Straight blocker ──
    blocks_straight = False
    straight_blocker_cards = []
    sorted_board = sorted(board_ranks)
    for low in range(max(1, min(sorted_board) - 4), min(sorted_board) + 1):
        window = set(range(low, low + 5))
        board_in_window = window & board_rank_set
        if len(board_in_window) >= 3:
            missing = window - board_rank_set
            for i, hr in enumerate(hero_ranks):
                if hr in missing:
                    blocks_straight = True
                    card_str = f"{_rank_label(hr)}{hero_suits[i]}"
                    if card_str not in straight_blocker_cards:
                        straight_blocker_cards.append(card_str)
                    blockers.append(f"Holding {_rank_label(hr)} blocks a straight")
                    score += 0.10
            break

    # ── Track specific flush blocker card ──
    flush_blocker_card = None
    for suit, count in suit_counts.items():
        if count >= 3:
            for i, hs in enumerate(hero_suits):
                if hs == suit and hero_ranks[i] >= 12:
                    flush_blocker_card = f"{_rank_label(hero_ranks[i])}{hs}"
                    break
            if flush_blocker_card:
                break

    # ── Normalize score ──
    blocker_score = min(1.0, score)

    # ── Explanation (plain English) ──
    if blockers:
        plain_parts = []
        if blocks_nut_flush:
            plain_parts.append("Your cards make the best flush unlikely for opponents")
        if blocks_flush:
            plain_parts.append("You reduce opponents' flush chances")
        if blocks_top_pair:
            plain_parts.append("You make top pair less likely for opponents")
        if blocks_set:
            plain_parts.append("You block three of a kind")
        if blocks_straight:
            plain_parts.append("You reduce straight possibilities")
        if blocks_overpair:
            plain_parts.append("You block big pocket pairs")
        explanation = ". ".join(plain_parts) + "." if plain_parts else "Your cards block some strong hands."
    else:
        explanation = "No blockers — opponents could have any strong hand."

    return {
        "blocks_nut_flush": blocks_nut_flush,
        "blocks_flush": blocks_flush,
        "blocks_top_pair": blocks_top_pair,
        "blocks_overpair": blocks_overpair,
        "blocks_set": blocks_set,
        "blocks_straight": blocks_straight,
        "blocker_score": round(blocker_score, 2),
        "blockers": blockers,
        "explanation": explanation,
        "straightBlockerCards": straight_blocker_cards,
        "flushBlockerCard": flush_blocker_card,
    }
