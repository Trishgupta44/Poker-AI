"""
Poker AI — Python Backend Server

FastAPI server that provides all AI computation endpoints.
The React frontend calls these endpoints via fetch().

Run: python server.py
Or:  uvicorn server:app --reload --port 8000

Endpoints:
  POST /api/hand-equity       — Monte Carlo equity simulation
  POST /api/confidence        — 12-feature Naive Bayes bluff detection
  POST /api/bot-decision      — Personality-driven bot action
  POST /api/audit-round       — Post-round hand classification
  POST /api/update-profile    — EMA opponent profile update
  POST /api/board-texture     — Board texture classification
  POST /api/preflop-strategy  — Position-based preflop hand recommendation
  POST /api/detect-draws      — Flush/straight draw detection
  POST /api/detect-blockers   — Card blocker analysis
  POST /api/detect-scare-cards — Board scare card detection
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from ai.monte_carlo import calculate_hand_equity
from ai.confidence_score import calculate_confidence, update_opponent_profile
from ai.bot_brain import decide_bot_action
from ai.post_round_audit import audit_round
from ai.board_texture import classify_board_texture
from ai.preflop_strategy import get_preflop_strategy_action
from ai.draw_detector import detect_draws
from ai.blocker_detector import detect_blockers
from ai.scare_card import detect_scare_cards
from ai.training_store import get_training_stats, record_audited_round

# ── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Poker AI Backend", version="1.0.0")

# Allow frontend (Vite dev server) to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ──────────────────────────────────────────────────

class Card(BaseModel):
    rank: str   # '2'-'9', 'T', 'J', 'Q', 'K', 'A'
    suit: str   # 'h', 'd', 'c', 's'


class HandEquityRequest(BaseModel):
    holeCards: list[Card]
    communityCards: list[Card]
    numOpponents: int
    street: str
    iterations: int = 1000
    currentBet: float = 0
    pot: float = 0
    facingRaise: bool = False


class PlayerAction(BaseModel):
    playerId: str
    playerName: str
    street: str
    action: str
    amount: float
    timestamp: float


class ConfidenceRequest(BaseModel):
    profile: dict
    betSizeRatio: float
    boardTexture: str
    opponentPosition: str
    street: str
    priorActions: list[dict]
    opponentStack: float
    potSize: float
    roundsSinceBluffCaught: Optional[int] = None
    actionTimeMs: Optional[float] = None


class BotDecisionRequest(BaseModel):
    bot: dict
    round: dict
    allPlayers: list[dict]


class AuditRoundRequest(BaseModel):
    round: dict
    players: list[dict]
    communityCards: list[Card]


class UpdateProfileRequest(BaseModel):
    profile: dict
    auditResult: dict
    boardTexture: str
    street: str
    betSizeRatio: float
    wasInPosition: bool
    actionSequence: str
    spr: float
    wasCaughtBluffing: bool
    actionTimeMs: Optional[float] = None


class BoardTextureRequest(BaseModel):
    communityCards: list[Card]


class PreflopStrategyRequest(BaseModel):
    holeCards: list[Card]
    position: str            # 'UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'
    isFacingRaise: bool = False
    isOpenAction: bool = True
    foldedToPlayer: bool = False
    heroStack: float = 1000
    currentBet: float = 0
    pot: float = 0


class DrawDetectionRequest(BaseModel):
    holeCards: list[Card]
    communityCards: list[Card]


class BlockerDetectionRequest(BaseModel):
    holeCards: list[Card]
    communityCards: list[Card]


class ScareCardRequest(BaseModel):
    communityCards: list[Card]
    newCard: Optional[Card] = None
    holeCards: Optional[list[Card]] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/hand-equity")
async def hand_equity_endpoint(req: HandEquityRequest):
    """Calculate hand equity via Monte Carlo simulation."""
    hole = [c.model_dump() for c in req.holeCards]
    community = [c.model_dump() for c in req.communityCards]

    result = calculate_hand_equity(
        hole_cards=hole,
        community_cards=community,
        num_opponents=req.numOpponents,
        street=req.street,
        iterations=req.iterations,
        current_bet=req.currentBet,
        pot=req.pot,
        facing_raise=req.facingRaise,
    )
    return result


@app.post("/api/confidence")
async def confidence_endpoint(req: ConfidenceRequest):
    """Calculate 8-feature Naive Bayes confidence score."""
    result = calculate_confidence(
        profile=req.profile,
        bet_size_ratio=req.betSizeRatio,
        board_texture=req.boardTexture,
        opponent_position=req.opponentPosition,
        street=req.street,
        prior_actions=req.priorActions,
        opponent_stack=req.opponentStack,
        pot_size=req.potSize,
        rounds_since_bluff_caught=req.roundsSinceBluffCaught,
        action_time_ms=req.actionTimeMs,
    )
    return result


@app.post("/api/bot-decision")
async def bot_decision_endpoint(req: BotDecisionRequest):
    """Get personality-driven bot action."""
    result = decide_bot_action(
        bot=req.bot,
        round_state=req.round,
        all_players=req.allPlayers,
    )
    return result


@app.post("/api/audit-round")
async def audit_round_endpoint(req: AuditRoundRequest):
    """Audit completed round — classify hands as BLUFF/VALUE/etc."""
    community = [c.model_dump() for c in req.communityCards]
    results = audit_round(
        round_state=req.round,
        players=req.players,
        community_cards=community,
    )
    record_audited_round(
        round_state=req.round,
        players=req.players,
        community_cards=community,
        audit_results=results,
    )
    return results


@app.get("/api/training-stats")
async def training_stats_endpoint():
    """Read local SQLite training-data stats for the dashboard."""
    return get_training_stats()


@app.post("/api/update-profile")
async def update_profile_endpoint(req: UpdateProfileRequest):
    """Update opponent profile with EMA decay."""
    updated = update_opponent_profile(
        profile=req.profile,
        audit_result=req.auditResult,
        board_texture=req.boardTexture,
        street=req.street,
        bet_size_ratio=req.betSizeRatio,
        was_in_position=req.wasInPosition,
        action_sequence=req.actionSequence,
        spr=req.spr,
        was_caught_bluffing=req.wasCaughtBluffing,
        action_time_ms=req.actionTimeMs,
    )
    return updated


@app.post("/api/board-texture")
async def board_texture_endpoint(req: BoardTextureRequest):
    """Classify board texture as DRY/WET/PAIRED."""
    cards = [c.model_dump() for c in req.communityCards]
    texture = classify_board_texture(cards)
    return {"texture": texture}


@app.post("/api/preflop-strategy")
async def preflop_strategy_endpoint(req: PreflopStrategyRequest):
    """Get position-based preflop hand recommendation."""
    hole = [c.model_dump() for c in req.holeCards]
    result = get_preflop_strategy_action(
        hole_cards=hole,
        position=req.position,
        is_facing_raise=req.isFacingRaise,
        is_open_action=req.isOpenAction,
        folded_to_player=req.foldedToPlayer,
        hero_stack=req.heroStack,
        current_bet=req.currentBet,
        pot=req.pot,
    )
    return result


@app.post("/api/detect-draws")
async def draw_detection_endpoint(req: DrawDetectionRequest):
    """Detect flush/straight draws in hole + community cards."""
    hole = [c.model_dump() for c in req.holeCards]
    community = [c.model_dump() for c in req.communityCards]
    result = detect_draws(hole_cards=hole, community_cards=community)
    return result


@app.post("/api/detect-blockers")
async def blocker_detection_endpoint(req: BlockerDetectionRequest):
    """Analyze card blockers — which opponent hands are blocked."""
    hole = [c.model_dump() for c in req.holeCards]
    community = [c.model_dump() for c in req.communityCards]
    result = detect_blockers(hole_cards=hole, community_cards=community)
    return result


@app.post("/api/detect-scare-cards")
async def scare_card_endpoint(req: ScareCardRequest):
    """Detect scary board cards that change texture."""
    community = [c.model_dump() for c in req.communityCards]
    new_card = req.newCard.model_dump() if req.newCard else None
    hole = [c.model_dump() for c in req.holeCards] if req.holeCards else None
    result = detect_scare_cards(community_cards=community, new_card=new_card, hole_cards=hole)
    return result


@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify the server is running."""
    return {"status": "ok", "message": "Poker AI Python backend is running"}


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Poker AI -- Python Backend")
    print("  Server:   http://127.0.0.1:8000")
    print("  API Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000)
