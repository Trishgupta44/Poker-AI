"""
Optional XGBoost bot-decision adapter.

The game ships with a deterministic heuristic bot brain. If a trained XGBoost
model is available, this module turns the current hand state into features and
returns an action suggestion. Missing dependency or missing model simply means
"no suggestion" so local development keeps working.
"""

from __future__ import annotations

import os
import json
import sqlite3
from functools import lru_cache
from pathlib import Path
from typing import Optional


ACTION_LABELS = ["FOLD", "CHECK", "CALL", "RAISE", "ALL_IN"]
STREET_INDEX = {
    "PREFLOP": 0,
    "FLOP": 1,
    "TURN": 2,
    "RIVER": 3,
    "SHOWDOWN": 4,
}


def suggest_xgboost_action(
    bot: dict,
    round_state: dict,
    all_players: list[dict],
    equity: float,
    legal_actions: list[str],
) -> Optional[dict]:
    """Return an XGBoost action suggestion, or None when unavailable."""
    model = _load_model()
    if model is None:
        return None

    try:
        import xgboost as xgb

        features = _build_features(bot, round_state, all_players, equity)
        matrix = xgb.DMatrix([features], feature_names=_feature_names())
        prediction = model.predict(matrix)[0]
        return _prediction_to_suggestion(prediction, legal_actions)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _load_model():
    try:
        import xgboost as xgb
    except Exception:
        return None

    model_path = Path(
        os.environ.get(
            "POKER_AI_XGBOOST_MODEL",
            Path(__file__).resolve().parents[1] / "models" / "bot_decision.json",
        )
    )
    if not model_path.exists() or _model_is_stale(model_path):
        _auto_train_model(model_path, xgb)

    try:
        model = xgb.Booster()
        model.load_model(str(model_path))
        return model
    except Exception:
        return None


def _auto_train_model(model_path: Path, xgb) -> bool:
    examples = _load_seed_examples() + _load_sqlite_examples()
    if len(examples) < 5:
        return False

    rows = [features for features, _target in examples]
    labels = [target for _features, target in examples]
    matrix = xgb.DMatrix(rows, label=labels, feature_names=_feature_names())
    params = {
        "objective": "multi:softprob",
        "num_class": len(ACTION_LABELS),
        "max_depth": 3,
        "eta": 0.15,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "eval_metric": "mlogloss",
        "seed": 42,
    }
    rounds = 30 if len(examples) < 200 else 55

    try:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model = xgb.train(params, matrix, num_boost_round=rounds)
        model.save_model(str(model_path))
        return True
    except Exception:
        return False


def _model_is_stale(model_path: Path) -> bool:
    try:
        model_mtime = model_path.stat().st_mtime
    except OSError:
        return True

    for source in (_brain_path(), _sqlite_path()):
        if source.exists() and source.stat().st_mtime > model_mtime:
            return True
    return False


def _load_seed_examples() -> list[tuple[list[float], int]]:
    path = _brain_path()
    if not path.exists():
        return []

    try:
        records = json.loads(path.read_text())
    except Exception:
        return []

    examples: list[tuple[list[float], int]] = []
    for record in records:
        target = _target_from_audit_tag(record.get("tag"), record.get("betSizeRatio", 0))
        if target is None:
            continue
        examples.append((_features_from_brain_record(record), target))
    return examples


def _load_sqlite_examples() -> list[tuple[list[float], int]]:
    db_path = _sqlite_path()
    if not db_path.exists():
        return []

    examples: list[tuple[list[float], int]] = []
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT features_json, target_action
            FROM training_examples
            WHERE target_action IS NOT NULL
            """
        ).fetchall()
        conn.close()
    except Exception:
        return []

    for row in rows:
        action = row["target_action"]
        if action not in ACTION_LABELS:
            continue
        try:
            features = json.loads(row["features_json"])
        except Exception:
            continue
        examples.append((_features_from_sqlite_record(features), ACTION_LABELS.index(action)))
    return examples


def _features_from_brain_record(record: dict) -> list[float]:
    equity = float(record.get("handStrengthPercentile", 50) or 50) / 100.0
    bet_size_ratio = float(record.get("betSizeRatio", 0) or 0)
    street = record.get("street", "PREFLOP")
    community_cards = record.get("communityCards", []) or []
    personality = _personality_priors(record.get("playerName", ""))

    pot = 100.0
    current_bet = min(250.0, max(0.0, bet_size_ratio * pot))
    chips = 1000.0
    return [
        equity,
        pot,
        current_bet,
        0.0,
        0.0,
        chips,
        current_bet / max(pot + current_bet, 1.0),
        pot / chips,
        float(STREET_INDEX.get(street, 0)),
        float(len(community_cards)),
        2.0,
        1.0 if record.get("tag") in ("BLUFF", "VALUE_BET") else 0.0,
        personality["aggressiveness"],
        personality["bluffFrequency"],
        personality["tightness"],
    ]


def _features_from_sqlite_record(features: dict) -> list[float]:
    amount = float(features.get("amount", 0) or 0)
    pot = float(features.get("pot_before", 0) or 0)
    chips = float(features.get("player_stack", 1000) or 1000)
    current_bet = float(features.get("current_bet", 0) or 0)
    to_call = float(features.get("to_call", 0) or 0)

    return [
        float(features.get("hand_strength_percentile", 50) or 50) / 100.0,
        pot,
        current_bet,
        max(0.0, current_bet - to_call),
        to_call,
        chips,
        to_call / max(pot + to_call, 1.0),
        pot / max(chips, 1.0),
        float(STREET_INDEX.get(features.get("street", "PREFLOP"), 0)),
        float(features.get("community_count", 0) or 0),
        float(features.get("active_players", 2) or 2),
        float(features.get("aggressive_actions_before", 0) or 0),
        float(features.get("aggressiveness", 0.5) or 0.5),
        float(features.get("bluff_frequency", 0.3) or 0.3),
        float(features.get("tightness", 0.5) or 0.5),
    ]


def _target_from_audit_tag(tag: str | None, bet_size_ratio: float) -> Optional[int]:
    if tag == "FOLD":
        return ACTION_LABELS.index("FOLD")
    if tag in ("BLUFF", "VALUE_BET"):
        return ACTION_LABELS.index("RAISE")
    if tag == "SLOW_PLAY":
        return ACTION_LABELS.index("CHECK")
    if tag == "PASSIVE":
        return ACTION_LABELS.index("CALL")
    if tag == "NO_TAG":
        return ACTION_LABELS.index("CHECK")
    if float(bet_size_ratio or 0) > 0.75:
        return ACTION_LABELS.index("RAISE")
    return None


def _personality_priors(player_name: str) -> dict[str, float]:
    priors = {
        "Viktor": {"aggressiveness": 0.7, "bluffFrequency": 0.15, "tightness": 0.75},
        "Luna": {"aggressiveness": 0.85, "bluffFrequency": 0.55, "tightness": 0.3},
        "Rex": {"aggressiveness": 0.3, "bluffFrequency": 0.65, "tightness": 0.35},
    }
    return priors.get(
        player_name,
        {"aggressiveness": 0.5, "bluffFrequency": 0.3, "tightness": 0.5},
    )


def _brain_path() -> Path:
    return Path(__file__).resolve().parent / "brain.json"


def _sqlite_path() -> Path:
    return Path(
        os.environ.get(
            "POKER_AI_TRAINING_DB",
            Path(__file__).resolve().parents[1] / "data" / "poker_training.sqlite",
        )
    )


def _build_features(
    bot: dict,
    round_state: dict,
    all_players: list[dict],
    equity: float,
) -> list[float]:
    personality = bot.get("botPersonality", {}) or {}
    pot = float(round_state.get("pot", 0) or 0)
    current_bet = float(round_state.get("currentBet", 0) or 0)
    bot_current_bet = float(bot.get("currentBet", 0) or 0)
    chips = float(bot.get("chips", 0) or 0)
    to_call = max(0.0, current_bet - bot_current_bet)
    active_opponents = sum(
        1
        for player in all_players
        if not player.get("isFolded")
        and not player.get("isSittingOut")
        and player.get("id") != bot.get("id")
    )
    aggressive_actions = sum(
        1
        for action in round_state.get("actions", [])
        if action.get("action") in ("RAISE", "ALL_IN")
    )

    return [
        float(equity) / 100.0,
        pot,
        current_bet,
        bot_current_bet,
        to_call,
        chips,
        to_call / max(pot + to_call, 1.0),
        pot / max(chips, 1.0),
        float(STREET_INDEX.get(round_state.get("currentStreet", "PREFLOP"), 0)),
        float(len(round_state.get("communityCards", []))),
        float(active_opponents),
        float(aggressive_actions),
        float(personality.get("aggressiveness", 0.5)),
        float(personality.get("bluffFrequency", 0.3)),
        float(personality.get("tightness", 0.5)),
    ]


def _feature_names() -> list[str]:
    return [
        "equity",
        "pot",
        "current_bet",
        "bot_current_bet",
        "to_call",
        "chips",
        "pot_odds",
        "spr_inverse",
        "street_index",
        "community_count",
        "active_opponents",
        "aggressive_actions",
        "aggressiveness",
        "bluff_frequency",
        "tightness",
    ]


def _prediction_to_suggestion(prediction, legal_actions: list[str]) -> Optional[dict]:
    legal = set(legal_actions)

    try:
        values = list(prediction)
    except TypeError:
        values = [float(prediction)]

    if len(values) >= len(ACTION_LABELS):
        ranked = sorted(
            zip(ACTION_LABELS, values[: len(ACTION_LABELS)]),
            key=lambda item: item[1],
            reverse=True,
        )
        for action, confidence in ranked:
            if action in legal:
                return {"action": action, "confidence": float(confidence)}
        return None

    score = float(values[0])
    if score >= 0.78 and "RAISE" in legal:
        return {"action": "RAISE", "confidence": score}
    if score >= 0.68 and "ALL_IN" in legal:
        return {"action": "ALL_IN", "confidence": score}
    if score <= 0.22 and "FOLD" in legal:
        return {"action": "FOLD", "confidence": 1 - score}
    if "CALL" in legal:
        return {"action": "CALL", "confidence": 0.5}
    if "CHECK" in legal:
        return {"action": "CHECK", "confidence": 0.5}
    return None
