"""
Board Texture Classifier — analyzes community cards to determine
if the board is DRY, WET, or PAIRED.

This matters for bluff detection:
- DRY boards (few draws) → more bluffs expected
- WET boards (flush/straight draws) → fewer bluffs, more value
- PAIRED boards → tricky, can go either way
"""

# Rank values for connectivity calculation
RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
    "7": 7, "8": 8, "9": 9, "T": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14,
}


def classify_board_texture(community_cards: list[dict]) -> str:
    """
    Classify the board texture.

    Args:
        community_cards: List of card dicts [{rank, suit}, ...]

    Returns:
        'DRY', 'WET', or 'PAIRED'
    """
    if len(community_cards) < 3:
        return "DRY"  # Pre-flop, no board to classify

    details = get_board_details(community_cards)

    # PAIRED: any two cards share a rank
    if details["is_paired"]:
        return "PAIRED"

    # WET: flush draw, straight draw, or monotone
    if details["has_flush_draw"] or details["has_straight_draw"] or details["is_monotone"]:
        return "WET"

    # Everything else is DRY
    return "DRY"


def get_board_details(community_cards: list[dict]) -> dict:
    """
    Get detailed board analysis.

    Returns dict with:
        texture, has_flush_draw, has_straight_draw, is_paired,
        high_card, is_monotone, is_rainbow, connected_count
    """
    ranks = [card["rank"] for card in community_cards]
    suits = [card["suit"] for card in community_cards]
    values = sorted([RANK_VALUES[r] for r in ranks])

    # Suit analysis
    suit_counts = {}
    for s in suits:
        suit_counts[s] = suit_counts.get(s, 0) + 1

    max_suit_count = max(suit_counts.values()) if suit_counts else 0
    has_flush_draw = max_suit_count >= 3
    is_monotone = max_suit_count == len(community_cards) and len(community_cards) >= 3
    is_rainbow = max_suit_count == 1

    # Rank analysis — check for pairs
    rank_counts = {}
    for r in ranks:
        rank_counts[r] = rank_counts.get(r, 0) + 1
    is_paired = any(count >= 2 for count in rank_counts.values())

    # Straight draw detection — count connected cards
    unique_values = sorted(set(values))
    connected_count = 1
    max_connected = 1
    for i in range(1, len(unique_values)):
        if unique_values[i] - unique_values[i - 1] <= 2:  # Gap of 1 or 2
            connected_count += 1
            max_connected = max(max_connected, connected_count)
        else:
            connected_count = 1

    has_straight_draw = max_connected >= 3

    # High card
    high_card = max(ranks, key=lambda r: RANK_VALUES[r]) if ranks else None

    # ── Connectedness score (0-10) ──
    connectedness = 0
    for i in range(len(unique_values)):
        for j in range(i + 1, len(unique_values)):
            gap = unique_values[j] - unique_values[i]
            if gap == 1:
                connectedness += 2   # consecutive ranks
            elif gap == 2:
                connectedness += 1   # one-gap ranks
    # Bonus for 3+ consecutive
    if max_connected >= 3:
        connectedness += 3
    connectedness = min(10, connectedness)

    # ── Danger level ──
    danger_score = 0
    if has_flush_draw:
        danger_score += 3
    if is_monotone:
        danger_score += 2
    if has_straight_draw:
        danger_score += 2
    if is_paired:
        danger_score += 1
    danger_score += connectedness / 3

    if danger_score >= 5:
        danger_level = "high"
    elif danger_score >= 2.5:
        danger_level = "medium"
    else:
        danger_level = "low"

    # Determine texture inline (avoid recursive call to classify_board_texture)
    if is_paired:
        texture = "PAIRED"
    elif has_flush_draw or has_straight_draw or is_monotone:
        texture = "WET"
    else:
        texture = "DRY"

    return {
        "texture": texture,
        "has_flush_draw": has_flush_draw,
        "has_straight_draw": has_straight_draw,
        "is_paired": is_paired,
        "high_card": high_card,
        "suit_counts": suit_counts,
        "is_monotone": is_monotone,
        "is_rainbow": is_rainbow,
        "connected_count": max_connected,
        "connectedness": connectedness,
        "danger_level": danger_level,
    }
