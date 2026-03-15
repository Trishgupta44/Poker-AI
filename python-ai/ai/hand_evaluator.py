"""
Hand Evaluator — wraps the treys library for poker hand evaluation.

Converts between our card format {rank, suit} and treys integer format.
Provides hand scoring, category names, and percentile ranking.
"""

from treys import Card, Evaluator

# Global evaluator instance (thread-safe for reads)
_evaluator = Evaluator()

# ── Card Conversion ──────────────────────────────────────────────────────────

def card_to_treys(card: dict) -> int:
    """
    Convert our card dict {rank: 'A', suit: 's'} to a treys integer.

    Our format:
      rank: '2','3','4','5','6','7','8','9','T','J','Q','K','A'
      suit: 'h','d','c','s'

    Treys format: Card.new('As') for Ace of Spades
    """
    rank = card["rank"]
    suit = card["suit"]
    return Card.new(f"{rank}{suit}")


def cards_to_treys(cards: list[dict]) -> list[int]:
    """Convert a list of card dicts to treys format."""
    return [card_to_treys(c) for c in cards]


# ── Hand Evaluation ──────────────────────────────────────────────────────────

# Hand category names from treys (rank class 0-8)
HAND_CATEGORIES = {
    0: "Straight Flush",
    1: "Four of a Kind",
    2: "Full House",
    3: "Flush",
    4: "Straight",
    5: "Three of a Kind",
    6: "Two Pair",
    7: "Pair",
    8: "High Card",
}


def evaluate_hand(hole_cards: list[dict], community_cards: list[dict]) -> dict:
    """
    Evaluate a poker hand.

    Args:
        hole_cards: Player's 2 hole cards [{rank, suit}, ...]
        community_cards: 3-5 community cards

    Returns:
        {
            score: int (1=best, 7462=worst),
            category: str (e.g. "Two Pair"),
            percentile: float (0-100, higher=better)
        }
    """
    hand = cards_to_treys(hole_cards)
    board = cards_to_treys(community_cards)

    score = _evaluator.evaluate(board, hand)
    rank_class = _evaluator.get_rank_class(score)
    category = HAND_CATEGORIES.get(rank_class, "Unknown")

    # Percentile: treys scores go from 1 (best) to 7462 (worst)
    # Convert to 0-100 where 100 = best
    percentile = (1 - (score / 7462)) * 100

    return {
        "score": score,
        "category": category,
        "percentile": round(percentile, 1),
    }


def get_hand_strength_percentile(hole_cards: list[dict], community_cards: list[dict]) -> float:
    """Get hand strength as a 0-100 percentile (100 = best)."""
    result = evaluate_hand(hole_cards, community_cards)
    return result["percentile"]


def compare_hands(
    hands: list[list[dict]],
    community_cards: list[dict]
) -> list[int]:
    """
    Compare multiple hands, return indices of winner(s).
    Lower treys score = better hand.

    Args:
        hands: List of hole card pairs [[{rank,suit},{rank,suit}], ...]
        community_cards: Community cards

    Returns:
        List of winner indices (multiple if tie)
    """
    board = cards_to_treys(community_cards)
    scores = []

    for hand in hands:
        treys_hand = cards_to_treys(hand)
        score = _evaluator.evaluate(board, treys_hand)
        scores.append(score)

    best_score = min(scores)
    winners = [i for i, s in enumerate(scores) if s == best_score]

    return winners
