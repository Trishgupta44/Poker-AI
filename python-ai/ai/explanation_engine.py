"""
Explanation Engine — generates plain English explanations for AI scores.

Template-based system that references board texture, hand category,
bet sizing, and equity to produce human-readable advice.
"""

from .board_texture import classify_board_texture

# ── Hand Strength Explanations ───────────────────────────────────────────────

def generate_hand_strength_explanation(
    hand_category: str,
    equity: float,
    community_cards: list[dict],
    hole_cards: list[dict],
    board_texture: str,
) -> str:
    """
    Generate a 1-2 sentence explanation of the player's hand strength.

    Args:
        hand_category: e.g. "Two Pair", "Flush", "High Card"
        equity: 0-100 percentage
        community_cards: Board cards
        hole_cards: Player's hole cards
        board_texture: 'DRY', 'WET', or 'PAIRED'

    Returns:
        Plain English explanation string
    """
    # Pre-flop (no community cards)
    if len(community_cards) == 0:
        if equity >= 75:
            return f"Great starting hand — {hand_category}. Raise to build the pot."
        elif equity >= 55:
            return f"Good starting hand — {hand_category}. Worth raising."
        elif equity >= 40:
            return f"Decent hand — {hand_category}. Playable but be careful."
        elif equity >= 25:
            return f"Weak hand — {hand_category}. Only play if it's cheap."
        else:
            return f"Poor hand — {hand_category}. Best to fold."

    # Post-flop
    if equity >= 85:
        return f"Very strong — you likely have the best hand with {hand_category}. Bet big."
    elif equity >= 65:
        return f"Good hand — {hand_category}. You're probably ahead. Bet to protect your lead."
    elif equity >= 45:
        return f"Decent hand — {hand_category}. You might be ahead but stay alert."
    elif equity >= 25:
        return f"Weak hand — {hand_category}. Be cautious, you're likely behind."
    else:
        return f"Very weak — {hand_category}. Consider folding if opponents bet."


# ── Recommended Action ───────────────────────────────────────────────────────

def get_recommended_action(
    equity: float,
    community_cards: list[dict],
    current_bet: float,
    pot: float,
    facing_raise: bool,
) -> dict:
    """
    Get the AI's recommended action based on equity and game context.

    Returns:
        { action: str, reason: str }
    """
    is_preflop = len(community_cards) == 0

    # Very strong hand
    if equity >= 75:
        return {
            "action": "RAISE",
            "reason": "Very strong hand — raise to win more.",
        }

    # Strong hand
    if equity >= 60:
        if facing_raise:
            return {
                "action": "CALL",
                "reason": "Strong hand — call and see what comes next.",
            }
        return {
            "action": "RAISE",
            "reason": "Strong hand — raise while you're ahead.",
        }

    # Medium hand
    if equity >= 40:
        if facing_raise:
            call_amount = current_bet
            pot_total = pot + call_amount
            cost_ratio = call_amount / pot_total * 100 if pot_total > 0 else 50
            if equity > cost_ratio:
                return {
                    "action": "CALL",
                    "reason": "Decent hand — the math favors calling here.",
                }
            return {
                "action": "FOLD",
                "reason": "Borderline hand — too costly to call.",
            }
        return {
            "action": "CHECK",
            "reason": "Medium hand — check and see what happens.",
        }

    # Weak hand
    if equity >= 25:
        if facing_raise:
            return {
                "action": "FOLD",
                "reason": "Weak hand facing a bet — fold and wait.",
            }
        if is_preflop and current_bet == 0:
            return {
                "action": "CHECK",
                "reason": "Weak hand — check for a free card.",
            }
        return {
            "action": "CALL" if current_bet > 0 else "CHECK",
            "reason": "Cheap enough to see the flop." if is_preflop
            else "Check and hope to improve.",
        }

    # Very weak
    if facing_raise:
        return {
            "action": "FOLD",
            "reason": "Very weak hand — fold now.",
        }

    if current_bet > 0:
        return {
            "action": "FOLD",
            "reason": "Weak hand — fold and wait for better cards.",
        }

    return {
        "action": "CHECK",
        "reason": "Weak hand — check and hope to improve.",
    }


# ── Confidence Explanation ───────────────────────────────────────────────────

def generate_confidence_explanation(
    profile: dict,
    bet_size_ratio: float,
    board_texture: str,
    confidence: float,
) -> str:
    """
    Generate an explanation for the confidence score.

    Args:
        profile: Opponent profile dict
        bet_size_ratio: Bet amount / pot
        board_texture: 'DRY', 'WET', or 'PAIRED'
        confidence: 0-100 (100 = strong hand, 0 = bluffing)
    """
    name = profile.get("subjectName", "Opponent")
    total_hands = profile.get("totalHands", 0)
    bluff_pct = round(100 - confidence)

    bluff_signals = []

    if bet_size_ratio > 1.0:
        bluff_signals.append("betting very big")
    elif bet_size_ratio > 0.7:
        bluff_signals.append("betting large")

    if board_texture == "DRY":
        bluff_signals.append("safe board makes bluffs more likely")

    if bluff_pct > 60:
        bluff_signals.append("has bluffed often before")

    explanation = (
        f"{name} — {bluff_pct}% chance of bluffing "
        f"(based on {total_hands} hands seen). "
    )

    if bluff_signals:
        explanation += "Why: " + ", ".join(bluff_signals) + "."
    else:
        explanation += "No clear bluff signals."

    return explanation
