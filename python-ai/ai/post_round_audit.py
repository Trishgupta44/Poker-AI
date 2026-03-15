"""
Post-Round Audit — classifies each player's betting behavior after showdown.

Uses revealed hole cards + hand strength to tag actions:
  BLUFF     — big bet + weak hand (bottom 30%)
  VALUE_BET — big bet + strong hand (top 30%)
  SLOW_PLAY — small bet/check + strong hand (top 30%)
  PASSIVE   — small bet/check + medium hand (30-70%)
  NO_TAG    — folded before showdown (no ground truth)
"""

import json
import os
import time

from .hand_evaluator import get_hand_strength_percentile


_BRAIN_PATH = os.path.join(os.path.dirname(__file__), "brain.json")


def _load_brain() -> list[dict]:
    """Load existing brain.json (if any)."""
    try:
        with open(_BRAIN_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        # Corrupt file — start fresh rather than crashing the server/tests.
        return []


def _save_brain(entries: list[dict]) -> None:
    """Persist entries back to brain.json."""
    with open(_BRAIN_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)


def _update_brain(
    audit_results: list[dict],
    players: list[dict],
    community_cards: list[dict],
) -> None:
    """
    Append showdown data (including revealed hole cards) into brain.json.

    Only players with a concrete audit tag (i.e. not NO_TAG) are recorded,
    which corresponds to opponents who reached showdown with revealed cards.
    """
    if not audit_results:
        return

    brain = _load_brain()
    players_by_id = {p.get("id", ""): p for p in players}
    timestamp = time.time()

    for result in audit_results:
        if result.get("tag") == "NO_TAG":
            # Folded / no ground-truth — skip for the persistent brain.
            continue

        player_id = result.get("playerId")
        player = players_by_id.get(player_id, {})
        hole_cards = player.get("holeCards", [])

        brain.append(
            {
                "timestamp": timestamp,
                "playerId": player_id,
                "playerName": result.get("playerName"),
                "holeCards": hole_cards,
                "communityCards": community_cards,
                "tag": result.get("tag"),
                "handStrengthPercentile": result.get("handStrengthPercentile"),
                "betSizeRatio": result.get("betSizeRatio"),
                "street": result.get("street"),
            }
        )

    _save_brain(brain)


def audit_round(
    round_state: dict,
    players: list[dict],
    community_cards: list[dict],
) -> list[dict]:
    """
    Classify every player's behavior in the completed round.

    Args:
        round_state: Round data with actions, pot, etc.
        players: All player objects (with holeCards)
        community_cards: Final community board (3-5 cards)

    Returns:
        List of AuditResult dicts:
        [{playerId, playerName, tag, handStrengthPercentile, betSizeRatio, street}]
    """
    results = []
    actions = round_state.get("actions", [])
    pot = round_state.get("pot", 0)

    for player in players:
        player_id = player.get("id", "")
        player_name = player.get("name", "")
        hole_cards = player.get("holeCards", [])
        is_folded = player.get("isFolded", False)

        # If player folded or has no cards, no ground truth → NO_TAG
        if is_folded or len(hole_cards) < 2 or len(community_cards) < 3:
            results.append({
                "playerId": player_id,
                "playerName": player_name,
                "tag": "NO_TAG",
                "handStrengthPercentile": 0,
                "betSizeRatio": 0,
                "street": round_state.get("currentStreet", "RIVER"),
            })
            continue

        # Get hand strength percentile
        percentile = get_hand_strength_percentile(hole_cards, community_cards)

        # Find the player's last aggressive action (bet/raise)
        player_actions = [a for a in actions if a.get("playerId") == player_id]
        aggressive_actions = [
            a for a in player_actions
            if a["action"] in ("RAISE", "ALL_IN")
        ]

        # Calculate bet size ratio
        if aggressive_actions:
            last_agg = aggressive_actions[-1]
            amount = last_agg.get("amount", 0)
            # Use potBefore from action (reliable pot before this action was applied)
            pot_before = last_agg.get("potBefore", 0)
            pot_before = max(pot_before, 1)  # avoid division by zero
            bet_size_ratio = amount / pot_before
            action_street = last_agg.get("street", "RIVER")
        else:
            # No aggressive action — check total bet
            total_bet = player.get("totalBetThisRound", 0)
            bet_size_ratio = total_bet / pot if pot > 0 else 0
            action_street = round_state.get("currentStreet", "RIVER")

        # ── Classify the action ──
        tag = classify_action(percentile, bet_size_ratio)

        results.append(
            {
                "playerId": player_id,
                "playerName": player_name,
                "tag": tag,
                "handStrengthPercentile": round(percentile, 1),
                "betSizeRatio": round(bet_size_ratio, 2),
                "street": action_street,
            }
        )

    # Persist showdown information (including revealed hole cards)
    # so the backend has a long-term memory of opponent tendencies.
    _update_brain(results, players, community_cards)

    return results


def classify_action(percentile: float, bet_size_ratio: float) -> str:
    """
    Classify a player's action based on hand strength and bet sizing.

    Rules:
        BLUFF:     big bet (>0.4x pot) + weak hand (<30th percentile)
        VALUE_BET: big bet (>0.4x pot) + strong hand (>70th percentile)
        SLOW_PLAY: small bet (<0.3x pot) + strong hand (>70th percentile)
        PASSIVE:   small bet (<0.3x pot) + medium hand (30-70th percentile)
        NO_TAG:    everything else
    """
    is_big_bet = bet_size_ratio > 0.4
    is_small_bet = bet_size_ratio < 0.3
    is_weak = percentile < 30
    is_strong = percentile > 70
    is_medium = 30 <= percentile <= 70

    if is_big_bet and is_weak:
        return "BLUFF"
    if is_big_bet and is_strong:
        return "VALUE_BET"
    if is_small_bet and is_strong:
        return "SLOW_PLAY"
    if is_small_bet and is_medium:
        return "PASSIVE"

    return "NO_TAG"
