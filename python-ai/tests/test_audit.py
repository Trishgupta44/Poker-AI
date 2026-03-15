"""
Tests for post-round audit and confidence scoring.

Verifies that:
1. audit_round() sees all cards and classifies correctly
2. Bluffs, value bets, and folds are tagged correctly
3. calculate_confidence() returns valid scores
4. Action speed classification works
5. EMA profile updates work correctly
"""

import pytest
import sys
import os

# Add parent directory to path so we can import the ai package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ai.post_round_audit import audit_round, classify_action
from ai.confidence_score import (
    calculate_confidence,
    classify_action_speed,
    classify_bet_size,
    classify_spr,
    classify_action_sequence,
    update_opponent_profile,
    ema_update,
)
from ai.board_texture import classify_board_texture, get_board_details


# ── Helpers ────────────────────────────────────────────────────────────────

def make_card(rank: str, suit: str) -> dict:
    return {"rank": rank, "suit": suit}


def make_profile(total_hands: int = 5, bluff_freq: float = 0.35, **kwargs) -> dict:
    """Create a minimal opponent profile dict."""
    base = {
        "subjectId": "opp-1",
        "subjectName": "TestBot",
        "totalHands": total_hands,
        "bluffFrequency": bluff_freq,
    }
    base.update(kwargs)
    return base


# ══════════════════════════════════════════════════════════════════════════
# POST-ROUND AUDIT TESTS
# ══════════════════════════════════════════════════════════════════════════


class TestAuditRound:
    """Tests that audit_round() correctly classifies player behavior."""

    def test_bluff_classification(self):
        """A weak hand (23o on unpaired high board) with big bet should be tagged BLUFF."""
        # Board: K-Q-9-8-6 rainbow — no pair, no straight, no flush for 23o
        community = [
            make_card("K", "s"), make_card("Q", "d"), make_card("9", "h"),
            make_card("8", "c"), make_card("6", "s"),
        ]
        players = [
            {
                "id": "p1",
                "name": "Bluffer",
                "holeCards": [make_card("2", "h"), make_card("3", "c")],  # Very weak
                "isFolded": False,
                "totalBetThisRound": 100,
            }
        ]
        round_state = {
            "pot": 100,
            "currentStreet": "RIVER",
            "actions": [
                {"playerId": "p1", "action": "RAISE", "amount": 90, "street": "RIVER"},
            ],
        }

        results = audit_round(round_state, players, community)

        assert len(results) == 1
        assert results[0]["playerId"] == "p1"
        assert results[0]["tag"] == "BLUFF"
        assert results[0]["handStrengthPercentile"] < 30

    def test_value_bet_classification(self):
        """A strong hand (trips KKK) with big bet should be VALUE_BET."""
        # Board: K-5-2-8-3 — player has KK = three of a kind (very strong)
        community = [
            make_card("K", "d"), make_card("5", "c"), make_card("2", "h"),
            make_card("8", "s"), make_card("3", "d"),
        ]
        players = [
            {
                "id": "p1",
                "name": "ValueBetter",
                "holeCards": [make_card("K", "s"), make_card("K", "h")],  # Trips
                "isFolded": False,
                "totalBetThisRound": 150,
            }
        ]
        round_state = {
            "pot": 100,
            "currentStreet": "RIVER",
            "actions": [
                {"playerId": "p1", "action": "RAISE", "amount": 120, "street": "RIVER"},
            ],
        }

        results = audit_round(round_state, players, community)

        assert len(results) == 1
        assert results[0]["tag"] == "VALUE_BET"
        assert results[0]["handStrengthPercentile"] > 70

    def test_folded_player_gets_no_tag(self):
        """Folded players should get NO_TAG regardless of their cards."""
        community = [
            make_card("A", "s"), make_card("K", "s"), make_card("Q", "d"),
        ]
        players = [
            {
                "id": "p1",
                "name": "Folder",
                "holeCards": [make_card("A", "h"), make_card("A", "d")],
                "isFolded": True,  # Folded
                "totalBetThisRound": 20,
            }
        ]
        round_state = {
            "pot": 50,
            "currentStreet": "FLOP",
            "actions": [],
        }

        results = audit_round(round_state, players, community)

        assert len(results) == 1
        assert results[0]["tag"] == "NO_TAG"

    def test_multiple_players_audited(self):
        """All players in the round should be audited."""
        # Board: K-5-2-8-3 — trips with KK, bluff with 47o, fold
        community = [
            make_card("K", "d"), make_card("5", "c"), make_card("2", "h"),
            make_card("8", "s"), make_card("3", "d"),
        ]
        players = [
            {
                "id": "p1", "name": "Player1",
                "holeCards": [make_card("K", "s"), make_card("K", "h")],  # Trips
                "isFolded": False, "totalBetThisRound": 100,
            },
            {
                "id": "p2", "name": "Player2",
                "holeCards": [make_card("4", "c"), make_card("7", "h")],
                "isFolded": True, "totalBetThisRound": 20,
            },
            {
                "id": "p3", "name": "Player3",
                "holeCards": [make_card("Q", "h"), make_card("Q", "c")],
                "isFolded": False, "totalBetThisRound": 100,
            },
        ]
        round_state = {
            "pot": 200,
            "currentStreet": "RIVER",
            "actions": [
                {"playerId": "p1", "action": "RAISE", "amount": 180, "street": "RIVER"},
                {"playerId": "p3", "action": "CALL", "amount": 100, "street": "RIVER"},
            ],
        }

        results = audit_round(round_state, players, community)

        assert len(results) == 3
        tags = {r["playerId"]: r["tag"] for r in results}
        # p1 has KKK (strong) + big raise = VALUE_BET
        assert tags["p1"] == "VALUE_BET"
        # p2 folded = NO_TAG
        assert tags["p2"] == "NO_TAG"
        # p3 has QQ (medium) but only called — no aggressive action
        assert tags["p3"] in ("NO_TAG", "PASSIVE", "SLOW_PLAY", "VALUE_BET")

    def test_no_cards_gets_no_tag(self):
        """Player with no hole cards gets NO_TAG."""
        community = [
            make_card("A", "s"), make_card("K", "s"), make_card("Q", "d"),
        ]
        players = [
            {
                "id": "p1", "name": "NoCards",
                "holeCards": [],
                "isFolded": False, "totalBetThisRound": 0,
            }
        ]
        round_state = {"pot": 50, "currentStreet": "FLOP", "actions": []}

        results = audit_round(round_state, players, community)
        assert results[0]["tag"] == "NO_TAG"


class TestClassifyAction:
    """Tests for the classify_action() helper."""

    def test_bluff(self):
        assert classify_action(10, 1.5) == "BLUFF"  # Weak + big bet

    def test_value_bet(self):
        assert classify_action(85, 1.0) == "VALUE_BET"  # Strong + big bet

    def test_slow_play(self):
        assert classify_action(90, 0.1) == "SLOW_PLAY"  # Strong + small bet

    def test_passive(self):
        assert classify_action(50, 0.1) == "PASSIVE"  # Medium + small bet

    def test_no_tag_medium_bet(self):
        assert classify_action(50, 0.5) == "NO_TAG"  # Medium + medium bet


# ══════════════════════════════════════════════════════════════════════════
# CONFIDENCE SCORE TESTS
# ══════════════════════════════════════════════════════════════════════════


class TestCalculateConfidence:
    """Tests for the 8-feature Naive Bayes confidence scorer."""

    def test_insufficient_data(self):
        """With < 2 showdowns, should return dataSufficient=False."""
        profile = make_profile(total_hands=1)
        result = calculate_confidence(
            profile=profile,
            bet_size_ratio=0.7,
            board_texture="DRY",
            opponent_position="LATE",
            street="RIVER",
            prior_actions=[],
            opponent_stack=500,
            pot_size=100,
            rounds_since_bluff_caught=None,
        )

        assert result["dataSufficient"] is False
        assert result["score"] is None
        assert result["handsRecorded"] == 1

    def test_sufficient_data_returns_score(self):
        """With >= 2 showdowns, should return a valid 0-100 score."""
        profile = make_profile(total_hands=5)
        result = calculate_confidence(
            profile=profile,
            bet_size_ratio=0.7,
            board_texture="DRY",
            opponent_position="LATE",
            street="RIVER",
            prior_actions=[],
            opponent_stack=500,
            pot_size=100,
            rounds_since_bluff_caught=None,
        )

        assert result["dataSufficient"] is True
        assert result["score"] is not None
        assert 0 <= result["score"] <= 100

    def test_score_with_all_features(self):
        """Test confidence with all 8 features active."""
        profile = make_profile(total_hands=10, bluff_freq=0.5)
        prior_actions = [
            {"playerId": "opp-1", "action": "CHECK", "street": "FLOP"},
            {"playerId": "opp-1", "action": "RAISE", "amount": 50, "street": "TURN"},
        ]
        result = calculate_confidence(
            profile=profile,
            bet_size_ratio=1.5,          # Overbet
            board_texture="WET",
            opponent_position="LATE",    # In position
            street="RIVER",
            prior_actions=prior_actions,  # Check-raise pattern
            opponent_stack=200,
            pot_size=100,
            rounds_since_bluff_caught=2,  # Recently caught
            action_time_ms=10000,         # Slow (hesitation)
        )

        assert result["dataSufficient"] is True
        assert 0 <= result["score"] <= 100
        assert "featureBreakdown" in result
        assert len(result["featureBreakdown"]) > 0

    def test_high_bluff_frequency_lowers_confidence(self):
        """A player who bluffs a lot should get lower confidence (lower score)."""
        profile_bluffer = make_profile(total_hands=10, bluff_freq=0.80)
        profile_honest = make_profile(total_hands=10, bluff_freq=0.10)

        kwargs = dict(
            bet_size_ratio=0.7,
            board_texture="DRY",
            opponent_position="LATE",
            street="RIVER",
            prior_actions=[],
            opponent_stack=500,
            pot_size=100,
            rounds_since_bluff_caught=None,
        )

        result_bluffer = calculate_confidence(profile=profile_bluffer, **kwargs)
        result_honest = calculate_confidence(profile=profile_honest, **kwargs)

        # Bluffer should get lower confidence
        assert result_bluffer["score"] < result_honest["score"]


# ══════════════════════════════════════════════════════════════════════════
# ACTION SPEED TESTS
# ══════════════════════════════════════════════════════════════════════════


class TestActionSpeed:
    """Tests for action speed classification (Feature 8)."""

    def test_snap_action(self):
        assert classify_action_speed(1500) == "SNAP"
        assert classify_action_speed(2999) == "SNAP"

    def test_normal_action(self):
        assert classify_action_speed(3000) == "NORMAL"
        assert classify_action_speed(5000) == "NORMAL"
        assert classify_action_speed(8000) == "NORMAL"

    def test_slow_action(self):
        assert classify_action_speed(8001) == "SLOW"
        assert classify_action_speed(15000) == "SLOW"

    def test_none_returns_normal(self):
        assert classify_action_speed(None) == "NORMAL"


# ══════════════════════════════════════════════════════════════════════════
# HELPER TESTS
# ══════════════════════════════════════════════════════════════════════════


class TestBetSizeClassification:
    def test_small(self):
        assert classify_bet_size(0.3) == "SMALL"

    def test_medium(self):
        assert classify_bet_size(0.7) == "MEDIUM"

    def test_overbet(self):
        assert classify_bet_size(1.5) == "OVERBET"


class TestSPRClassification:
    def test_low(self):
        assert classify_spr(200, 100) == "LOW"

    def test_medium(self):
        assert classify_spr(500, 100) == "MEDIUM"

    def test_high(self):
        assert classify_spr(1000, 100) == "HIGH"


class TestActionSequenceClassification:
    def test_check_raise(self):
        actions = [
            {"playerId": "p1", "action": "CHECK"},
            {"playerId": "p1", "action": "RAISE", "amount": 50},
        ]
        assert classify_action_sequence(actions, "p1") == "CHECK_RAISE"

    def test_passive_then_raise(self):
        actions = [
            {"playerId": "p1", "action": "CALL"},
            {"playerId": "p1", "action": "RAISE", "amount": 50},
        ]
        assert classify_action_sequence(actions, "p1") == "PASSIVE_THEN_RAISE"

    def test_persistent_aggression(self):
        actions = [
            {"playerId": "p1", "action": "RAISE", "amount": 30},
            {"playerId": "p1", "action": "RAISE", "amount": 80},
        ]
        assert classify_action_sequence(actions, "p1") == "PERSISTENT_AGGR"

    def test_none_with_few_actions(self):
        actions = [{"playerId": "p1", "action": "CALL"}]
        assert classify_action_sequence(actions, "p1") == "NONE"


class TestEMAUpdate:
    def test_ema_moves_toward_observation(self):
        old = 0.5
        new = ema_update(old, 1.0)
        assert new > old  # Should move toward 1.0

    def test_ema_decay_factor(self):
        result = ema_update(0.5, 1.0)
        expected = 0.92 * 0.5 + 0.08 * 1.0
        assert abs(result - expected) < 0.001


class TestProfileUpdate:
    def test_updates_total_hands(self):
        profile = make_profile(total_hands=5)
        audit = {"tag": "BLUFF", "playerId": "opp-1"}
        updated = update_opponent_profile(
            profile, audit, "DRY", "RIVER", 1.2, True, "NONE", 5.0, True
        )
        assert updated["totalHands"] == 6

    def test_bluff_increases_bluff_frequency(self):
        profile = make_profile(total_hands=5, bluff_freq=0.30)
        audit = {"tag": "BLUFF", "playerId": "opp-1"}
        updated = update_opponent_profile(
            profile, audit, "DRY", "RIVER", 1.2, True, "NONE", 5.0, True
        )
        assert updated["bluffFrequency"] > 0.30

    def test_action_speed_updates_profile(self):
        """Action speed should update snap/slow rates in profile."""
        profile = make_profile(total_hands=5)
        audit = {"tag": "VALUE_BET", "playerId": "opp-1"}

        # Snap action
        updated = update_opponent_profile(
            profile, audit, "DRY", "RIVER", 1.0, True, "NONE", 5.0, False,
            action_time_ms=1500,
        )
        assert "snapActionValueRate" in updated

        # Slow action
        updated2 = update_opponent_profile(
            profile, audit, "DRY", "RIVER", 1.0, True, "NONE", 5.0, False,
            action_time_ms=12000,
        )
        assert "slowActionValueRate" in updated2


# ══════════════════════════════════════════════════════════════════════════
# BOARD TEXTURE TESTS
# ══════════════════════════════════════════════════════════════════════════


class TestBoardTexture:
    def test_dry_board(self):
        cards = [make_card("2", "h"), make_card("7", "c"), make_card("K", "d")]
        assert classify_board_texture(cards) == "DRY"

    def test_wet_board_flush_draw(self):
        cards = [make_card("2", "h"), make_card("7", "h"), make_card("K", "h")]
        assert classify_board_texture(cards) == "WET"

    def test_paired_board(self):
        cards = [make_card("7", "h"), make_card("7", "c"), make_card("K", "d")]
        assert classify_board_texture(cards) == "PAIRED"

    def test_preflop_returns_dry(self):
        assert classify_board_texture([]) == "DRY"
        assert classify_board_texture([make_card("A", "s")]) == "DRY"

    def test_get_board_details_returns_all_fields(self):
        cards = [make_card("A", "s"), make_card("K", "s"), make_card("Q", "s")]
        details = get_board_details(cards)
        assert "texture" in details
        assert "has_flush_draw" in details
        assert "has_straight_draw" in details
        assert "is_paired" in details
        assert "high_card" in details
        assert "is_monotone" in details
        assert "is_rainbow" in details
        assert "connected_count" in details
        # AKQ suited = monotone + flush draw + straight draw → WET
        assert details["texture"] == "WET"
        assert details["is_monotone"] is True
        assert details["has_flush_draw"] is True
