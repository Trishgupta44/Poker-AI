"""
Monte Carlo Hand Equity Simulator

Calculates hand equity by running N simulations:
1. Remove known cards (hole + community) from deck
2. Deal random hole cards to each opponent
3. Complete community board to 5 cards
4. Evaluate all hands
5. Count wins/ties/losses

Equity = (wins + ties/numTied) / iterations * 100

Default: 1000 iterations (~100-200ms in Python).
"""

import random
from treys import Card, Deck, Evaluator

from .hand_evaluator import card_to_treys, cards_to_treys, HAND_CATEGORIES
from .board_texture import classify_board_texture
from .explanation_engine import generate_hand_strength_explanation, get_recommended_action

# Global evaluator (reused across calls)
_evaluator = Evaluator()


def calculate_hand_equity(
    hole_cards: list[dict],
    community_cards: list[dict],
    num_opponents: int,
    street: str,
    iterations: int = 1000,
    current_bet: float = 0,
    pot: float = 0,
    facing_raise: bool = False,
) -> dict:
    """
    Calculate hand equity via Monte Carlo simulation.

    Args:
        hole_cards: Player's 2 hole cards [{rank, suit}, {rank, suit}]
        community_cards: 0-5 community cards
        num_opponents: Number of opponents still in the hand
        street: 'PREFLOP', 'FLOP', 'TURN', 'RIVER'
        iterations: Number of Monte Carlo iterations (default 1000)
        current_bet: Current bet the player faces
        pot: Current pot size
        facing_raise: Whether player is facing a raise

    Returns:
        {
            equity: float (0-100),
            handCategory: str,
            explanation: str,
            recommendedAction: str,
            recommendationReason: str,
            street: str,
            simulationCount: int
        }
    """
    # Convert cards to treys format
    hero_hand = cards_to_treys(hole_cards)
    board = cards_to_treys(community_cards)

    # Build the set of known cards (to exclude from random dealing)
    known_cards = set(hero_hand + board)

    # Full 52-card deck as treys integers
    full_deck = Deck.GetFullDeck()
    remaining = [c for c in full_deck if c not in known_cards]

    # Ensure we have enough cards for opponents + community
    cards_needed_per_sim = (num_opponents * 2) + (5 - len(board))
    if len(remaining) < cards_needed_per_sim:
        num_opponents = max(1, (len(remaining) - (5 - len(board))) // 2)

    wins = 0
    ties = 0
    total = 0

    for _ in range(iterations):
        # Shuffle remaining deck
        random.shuffle(remaining)
        idx = 0

        # Deal opponent hands
        opponent_hands = []
        for _ in range(num_opponents):
            opp_hand = [remaining[idx], remaining[idx + 1]]
            opponent_hands.append(opp_hand)
            idx += 2

        # Complete community board to 5 cards
        needed = 5 - len(board)
        sim_board = list(board) + remaining[idx : idx + needed]

        # Evaluate hero's hand
        hero_score = _evaluator.evaluate(sim_board, hero_hand)

        # Evaluate each opponent's hand
        opp_scores = []
        for opp_hand in opponent_hands:
            opp_score = _evaluator.evaluate(sim_board, opp_hand)
            opp_scores.append(opp_score)

        # Compare (lower score = better in treys)
        if opp_scores:
            best_opponent = min(opp_scores)
            if hero_score < best_opponent:
                wins += 1
            elif hero_score == best_opponent:
                ties += 1

        total += 1

    # Calculate equity percentage
    equity = ((wins + ties * 0.5) / max(1, total)) * 100
    equity = round(min(100, max(0, equity)), 1)

    # Get hand category from current board (if available)
    if len(board) >= 3:
        current_score = _evaluator.evaluate(board, hero_hand)
        rank_class = _evaluator.get_rank_class(current_score)
        hand_category = HAND_CATEGORIES.get(rank_class, "Unknown")
    elif len(board) == 0:
        # Pre-flop: classify by hole card type
        hand_category = _classify_preflop_hand(hole_cards)
    else:
        hand_category = "Unknown"

    # Generate explanation
    board_texture = classify_board_texture(community_cards) if community_cards else "DRY"
    explanation = generate_hand_strength_explanation(
        hand_category, equity, community_cards, hole_cards, board_texture
    )

    # Get recommended action
    rec = get_recommended_action(equity, community_cards, current_bet, pot, facing_raise)

    return {
        "equity": equity,
        "handCategory": hand_category,
        "explanation": explanation,
        "recommendedAction": rec["action"],
        "recommendationReason": rec["reason"],
        "street": street,
        "simulationCount": total,
    }


def _classify_preflop_hand(hole_cards: list[dict]) -> str:
    """Classify pre-flop hand type for display."""
    ranks = [c["rank"] for c in hole_cards]
    suits = [c["suit"] for c in hole_cards]

    is_pair = ranks[0] == ranks[1]
    is_suited = suits[0] == suits[1]

    rank_names = {
        "A": "Ace", "K": "King", "Q": "Queen", "J": "Jack", "T": "Ten",
        "9": "Nine", "8": "Eight", "7": "Seven", "6": "Six", "5": "Five",
        "4": "Four", "3": "Three", "2": "Two",
    }

    if is_pair:
        return f"Pocket {rank_names.get(ranks[0], ranks[0])}s"
    elif is_suited:
        return f"{rank_names.get(ranks[0], ranks[0])}-{rank_names.get(ranks[1], ranks[1])} Suited"
    else:
        return f"{rank_names.get(ranks[0], ranks[0])}-{rank_names.get(ranks[1], ranks[1])}"


def quick_preflop_equity(hole_cards: list[dict], num_opponents: int) -> float:
    """
    Quick pre-flop equity estimate using fewer iterations.
    Used by bot brain for faster decisions.
    """
    result = calculate_hand_equity(
        hole_cards, [], num_opponents, "PREFLOP", iterations=300
    )
    return result["equity"]
