"""
Local SQLite training-data store for Poker AI.

The database is intentionally local and append-only-ish: every audited hand can
be inspected later, converted into model features, and used to train XGBoost.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from pathlib import Path
from typing import Any


DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "poker_training.sqlite"


def get_db_path() -> Path:
    return Path(os.environ.get("POKER_AI_TRAINING_DB", DEFAULT_DB_PATH))


def record_audited_round(
    round_state: dict,
    players: list[dict],
    community_cards: list[dict],
    audit_results: list[dict],
) -> None:
    """Persist a completed audited hand and model-ready action examples."""
    conn = _connect()
    try:
        _ensure_schema(conn)
        hand_key = _hand_key(round_state, players, community_cards)
        actions = round_state.get("actions", [])
        pot = float(round_state.get("pot", 0) or 0)
        round_number = int(round_state.get("roundNumber", 0) or 0)

        conn.execute(
            """
            INSERT OR IGNORE INTO hands (
                hand_key, round_number, street, pot_total, community_cards_json,
                player_count, action_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                hand_key,
                round_number,
                round_state.get("currentStreet", "UNKNOWN"),
                pot,
                _json(community_cards),
                len(players),
                len(actions),
            ),
        )
        hand_id = conn.execute(
            "SELECT id FROM hands WHERE hand_key = ?",
            (hand_key,),
        ).fetchone()["id"]

        audit_by_player = {result.get("playerId"): result for result in audit_results}
        for player in players:
            audit = audit_by_player.get(player.get("id"))
            player_actions = [
                action for action in actions if action.get("playerId") == player.get("id")
            ]
            final_action = _final_action(player_actions)
            conn.execute(
                """
                INSERT OR IGNORE INTO player_results (
                    hand_id, player_id, player_name, final_action, audit_tag,
                    hand_strength_percentile, chips_after, committed_this_round,
                    is_bot, won_showdown
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    hand_id,
                    player.get("id"),
                    player.get("name", "Unknown"),
                    final_action,
                    audit.get("tag") if audit else None,
                    audit.get("handStrengthPercentile") if audit else None,
                    float(player.get("chips", 0) or 0),
                    float(player.get("totalBetThisRound", 0) or 0),
                    1 if player.get("type") == "BOT" else 0,
                    1 if audit and audit.get("tag") in ("VALUE_BET", "SLOW_PLAY") else 0,
                ),
            )

        for index, action in enumerate(actions):
            player = _player_by_id(players, action.get("playerId"))
            audit = audit_by_player.get(action.get("playerId"))
            features = _features_for_action(round_state, players, player, action, index)

            conn.execute(
                """
                INSERT OR IGNORE INTO actions (
                    hand_id, action_index, player_id, player_name, street, action,
                    amount, pot_before, timestamp, features_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    hand_id,
                    index,
                    action.get("playerId"),
                    action.get("playerName", player.get("name", "Unknown")),
                    action.get("street", round_state.get("currentStreet", "UNKNOWN")),
                    action.get("action"),
                    float(action.get("amount", 0) or 0),
                    float(action.get("potBefore", 0) or 0),
                    float(action.get("timestamp", 0) or 0),
                    _json(features),
                ),
            )

            if action.get("action") == "POST_BLIND":
                continue

            reward = _reward_for_player(player)
            conn.execute(
                """
                INSERT OR IGNORE INTO training_examples (
                    hand_id, action_index, player_id, street, features_json,
                    target_action, target_tag, reward
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    hand_id,
                    index,
                    action.get("playerId"),
                    action.get("street", round_state.get("currentStreet", "UNKNOWN")),
                    _json(features),
                    action.get("action"),
                    audit.get("tag") if audit else None,
                    reward,
                ),
            )

        conn.commit()
    finally:
        conn.close()


def get_training_stats() -> dict:
    """Return dashboard-friendly learning stats from local SQLite."""
    conn = _connect()
    try:
        _ensure_schema(conn)
        summary = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM hands) AS hands,
                (SELECT COUNT(*) FROM actions) AS actions,
                (SELECT COUNT(*) FROM training_examples) AS examples,
                (SELECT COUNT(*) FROM training_examples WHERE target_tag IS NOT NULL) AS labelled
            """
        ).fetchone()

        action_distribution = _rows_to_points(
            conn.execute(
                """
                SELECT target_action AS label, COUNT(*) AS value
                FROM training_examples
                GROUP BY target_action
                ORDER BY value DESC
                """
            ).fetchall()
        )
        tag_distribution = _rows_to_points(
            conn.execute(
                """
                SELECT COALESCE(target_tag, 'UNLABELLED') AS label, COUNT(*) AS value
                FROM training_examples
                GROUP BY COALESCE(target_tag, 'UNLABELLED')
                ORDER BY value DESC
                """
            ).fetchall()
        )
        street_distribution = _rows_to_points(
            conn.execute(
                """
                SELECT street AS label, COUNT(*) AS value
                FROM training_examples
                GROUP BY street
                ORDER BY CASE street
                    WHEN 'PREFLOP' THEN 1
                    WHEN 'FLOP' THEN 2
                    WHEN 'TURN' THEN 3
                    WHEN 'RIVER' THEN 4
                    ELSE 5
                END
                """
            ).fetchall()
        )
        recent_hands = [
            dict(row)
            for row in conn.execute(
                """
                SELECT
                    h.round_number AS roundNumber,
                    h.pot_total AS potTotal,
                    h.action_count AS actionCount,
                    COUNT(te.id) AS examples,
                    SUM(CASE WHEN te.target_tag IS NOT NULL THEN 1 ELSE 0 END) AS labelled,
                    SUM(CASE WHEN te.target_action IN ('RAISE', 'ALL_IN') THEN 1 ELSE 0 END) AS aggressiveActions
                FROM hands h
                LEFT JOIN training_examples te ON te.hand_id = h.id
                GROUP BY h.id
                ORDER BY h.id DESC
                LIMIT 12
                """
            ).fetchall()
        ]

        learning_curve = []
        total_examples = 0
        total_labelled = 0
        for row in reversed(recent_hands):
            total_examples += int(row["examples"] or 0)
            total_labelled += int(row["labelled"] or 0)
            learning_curve.append(
                {
                    "label": f"R{row['roundNumber']}",
                    "value": total_examples,
                    "labelled": total_labelled,
                }
            )

        labelled = int(summary["labelled"] or 0)
        examples = int(summary["examples"] or 0)
        return {
            "dbPath": str(get_db_path()),
            "hands": int(summary["hands"] or 0),
            "actions": int(summary["actions"] or 0),
            "trainingExamples": examples,
            "labelledExamples": labelled,
            "labelCoverage": round((labelled / examples) * 100, 1) if examples else 0,
            "actionDistribution": action_distribution,
            "tagDistribution": tag_distribution,
            "streetDistribution": street_distribution,
            "learningCurve": learning_curve,
            "recentHands": recent_hands,
        }
    finally:
        conn.close()


def _connect() -> sqlite3.Connection:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS hands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hand_key TEXT NOT NULL UNIQUE,
            round_number INTEGER NOT NULL,
            street TEXT NOT NULL,
            pot_total REAL NOT NULL,
            community_cards_json TEXT NOT NULL,
            player_count INTEGER NOT NULL,
            action_count INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hand_id INTEGER NOT NULL,
            action_index INTEGER NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            street TEXT NOT NULL,
            action TEXT NOT NULL,
            amount REAL NOT NULL,
            pot_before REAL NOT NULL,
            timestamp REAL NOT NULL,
            features_json TEXT NOT NULL,
            UNIQUE(hand_id, action_index),
            FOREIGN KEY(hand_id) REFERENCES hands(id)
        );

        CREATE TABLE IF NOT EXISTS player_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hand_id INTEGER NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            final_action TEXT NOT NULL,
            audit_tag TEXT,
            hand_strength_percentile REAL,
            chips_after REAL NOT NULL,
            committed_this_round REAL NOT NULL,
            is_bot INTEGER NOT NULL,
            won_showdown INTEGER NOT NULL,
            UNIQUE(hand_id, player_id),
            FOREIGN KEY(hand_id) REFERENCES hands(id)
        );

        CREATE TABLE IF NOT EXISTS training_examples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hand_id INTEGER NOT NULL,
            action_index INTEGER NOT NULL,
            player_id TEXT NOT NULL,
            street TEXT NOT NULL,
            features_json TEXT NOT NULL,
            target_action TEXT NOT NULL,
            target_tag TEXT,
            reward REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(hand_id, action_index, player_id),
            FOREIGN KEY(hand_id) REFERENCES hands(id)
        );
        """
    )


def _hand_key(round_state: dict, players: list[dict], community_cards: list[dict]) -> str:
    raw = {
        "round": round_state.get("roundNumber"),
        "community": community_cards,
        "players": sorted(player.get("id", "") for player in players),
        "actions": round_state.get("actions", []),
    }
    return hashlib.sha256(_json(raw).encode("utf-8")).hexdigest()


def _features_for_action(
    round_state: dict,
    players: list[dict],
    player: dict,
    action: dict,
    action_index: int,
) -> dict:
    pot_before = float(action.get("potBefore", round_state.get("pot", 0)) or 0)
    amount = float(action.get("amount", 0) or 0)
    player_stack = float(player.get("chips", 0) or 0)
    current_bet = float(round_state.get("currentBet", 0) or 0)
    player_bet = float(player.get("currentBet", 0) or 0)
    active_players = [
        p for p in players if not p.get("isFolded") and not p.get("isSittingOut")
    ]
    aggressive_before = sum(
        1
        for prior in round_state.get("actions", [])[:action_index]
        if prior.get("action") in ("RAISE", "ALL_IN")
    )

    personality = player.get("botPersonality") or {}
    return {
        "street": action.get("street", round_state.get("currentStreet")),
        "pot_before": pot_before,
        "amount": amount,
        "bet_size_ratio": amount / max(pot_before, 1),
        "player_stack": player_stack,
        "current_bet": current_bet,
        "to_call": max(0, current_bet - player_bet),
        "active_players": len(active_players),
        "community_count": len(round_state.get("communityCards", [])),
        "aggressive_actions_before": aggressive_before,
        "is_bot": player.get("type") == "BOT",
        "aggressiveness": personality.get("aggressiveness", 0.5),
        "bluff_frequency": personality.get("bluffFrequency", 0.3),
        "tightness": personality.get("tightness", 0.5),
    }


def _rows_to_points(rows: list[sqlite3.Row]) -> list[dict]:
    return [{"label": row["label"], "value": int(row["value"] or 0)} for row in rows]


def _player_by_id(players: list[dict], player_id: str | None) -> dict:
    return next((player for player in players if player.get("id") == player_id), {})


def _final_action(actions: list[dict]) -> str:
    meaningful = [action for action in actions if action.get("action") != "POST_BLIND"]
    if not meaningful:
        return "POST_BLIND"
    return meaningful[-1].get("action", "UNKNOWN")


def _reward_for_player(player: dict) -> float:
    return float(player.get("chips", 0) or 0) - float(player.get("totalBetThisRound", 0) or 0)


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))
