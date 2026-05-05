"""
Bot Brain — personality-driven decision engine for bot opponents.

Each bot has a personality with:
  - aggressiveness: 0-1 (tendency to raise vs call)
  - bluffFrequency: 0-1 (how often to bluff)
  - tightness: 0-1 (hand range tightness)

Bot personalities:
  Viktor: Honest — rarely bluffs, plays strong hands hard
  Luna:   Aggressive + bluffy — big bets, overbets as bluffs, check-raises
  Rex:    Passive + bluffy — calls a lot, then surprise-bluffs with weird sizing

Bots intentionally create detectable bluff patterns:
  - Overbets with weak hands (triggers bet sizing feature)
  - Check-raise bluffs (triggers action sequence feature)
  - Slow play then bomb river (triggers narrative consistency)
  - Hesitation before bluffs (triggers action speed feature)
"""

import random
from .monte_carlo import calculate_hand_equity


def decide_bot_action(
    bot: dict,
    round_state: dict,
    all_players: list[dict],
) -> dict:
    personality = bot.get("botPersonality", {})
    aggressiveness = personality.get("aggressiveness", 0.5)
    bluff_freq = personality.get("bluffFrequency", 0.3)
    tightness = personality.get("tightness", 0.5)

    hole_cards = bot.get("holeCards", [])
    community_cards = round_state.get("communityCards", [])
    current_bet = round_state.get("currentBet", 0)
    bot_current_bet = bot.get("currentBet", 0)
    pot = round_state.get("pot", 0)
    chips = bot.get("chips", 0)
    min_raise = round_state.get("minRaise", round_state.get("lastRaiseAmount", 20))

    to_call = current_bet - bot_current_bet

    num_opponents = sum(
        1 for p in all_players
        if not p.get("isFolded") and not p.get("isSittingOut") and p["id"] != bot["id"]
    )
    num_opponents = max(1, num_opponents)

    equity_result = calculate_hand_equity(
        hole_cards, community_cards, num_opponents,
        round_state.get("currentStreet", "PREFLOP"),
        iterations=300
    )
    equity = equity_result["equity"]

    # Personality-modulated thresholds
    fold_threshold = 20 + tightness * 15
    raise_threshold = 65 - aggressiveness * 15

    can_check = to_call == 0
    can_call = to_call > 0 and chips >= to_call
    can_raise = chips > to_call + min_raise
    can_all_in = chips > 0 and chips <= to_call

    # ALL_IN shortcut (facing bet bigger than stack)
    if can_all_in and not can_call and not can_check:
        pot_odds = chips / (pot + chips) if (pot + chips) > 0 else 0.5
        equity_decimal = equity / 100.0
        call_threshold = pot_odds * (1.2 - aggressiveness * 0.4)

        if equity_decimal >= call_threshold:
            action, amount = "ALL_IN", int(chips)
        elif random.random() < bluff_freq * 0.3:
            action, amount = "ALL_IN", int(chips)
        else:
            action, amount = "FOLD", 0

        return {
            "action": action,
            "amount": int(amount),
            "thinkTimeMs": calculate_think_time(equity, action, aggressiveness, is_bluff=equity < 40),
        }

    is_preflop = len(community_cards) == 0

    if is_preflop:
        action, amount = _decide_preflop(
            equity, fold_threshold, bluff_freq, aggressiveness,
            to_call, pot, chips, min_raise,
            can_check, can_call, can_raise,
        )
    else:
        action, amount = _decide_postflop(
            equity, fold_threshold, raise_threshold,
            aggressiveness, bluff_freq,
            to_call, pot, chips, min_raise,
            can_check, can_call, can_raise,
            round_state,
        )

    is_bluff = equity < 40 and action in ("RAISE", "ALL_IN")
    think_time = calculate_think_time(equity, action, aggressiveness, is_bluff)

    return {
        "action": action,
        "amount": int(amount),
        "thinkTimeMs": think_time,
    }


def _decide_preflop(
    equity, fold_threshold, bluff_freq, aggressiveness,
    to_call, pot, chips, min_raise,
    can_check, can_call, can_raise,
):
    """Pre-flop decision logic."""
    # Strong hand — raise
    if equity > 70:
        if can_raise:
            raise_amount = _calculate_raise_amount(pot, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        if can_call:
            return "CALL", to_call
        return "CHECK", 0

    # Medium hand — call or check
    if equity > fold_threshold:
        if to_call > 0 and can_call:
            if to_call <= pot * 0.5:
                return "CALL", to_call
            if random.random() < 0.3:
                return "FOLD", 0
            return "CALL", to_call
        return "CHECK", 0

    # Weak hand — fold or bluff-raise
    if to_call > 0:
        # Bluff raise with weak hand preflop
        if random.random() < bluff_freq * 0.35 and can_raise:
            raise_amount = _calculate_raise_amount(pot, aggressiveness * 0.6, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "FOLD", 0

    # Free check — sometimes bluff-raise
    if random.random() < bluff_freq * 0.25 and can_raise:
        raise_amount = _calculate_raise_amount(pot, 0.5, chips, min_raise, to_call)
        return "RAISE", raise_amount
    return "CHECK", 0


def _decide_postflop(
    equity, fold_threshold, raise_threshold,
    aggressiveness, bluff_freq,
    to_call, pot, chips, min_raise,
    can_check, can_call, can_raise,
    round_state,
):
    """Post-flop decision logic — bots create detectable bluff patterns."""

    # Get action history for pattern-aware decisions
    actions = round_state.get("actions", [])
    street = round_state.get("currentStreet", "FLOP")

    # ── Monster (>85%) — value bet big (or slow-play 20%) ──
    if equity > 85:
        if random.random() < 0.20:
            # Slow-play trap
            return ("CHECK", 0) if can_check else ("CALL", to_call)
        if can_raise:
            raise_amount = _calculate_raise_amount(pot, aggressiveness + 0.2, chips, min_raise, to_call)
            return "RAISE", raise_amount
        if can_call:
            return "CALL", to_call
        return "CHECK", 0

    # ── Strong (raise_threshold-85%) — value bet ──
    if equity > raise_threshold:
        if can_raise and random.random() < aggressiveness:
            raise_amount = _calculate_raise_amount(pot, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        if can_call:
            return "CALL", to_call
        return "CHECK", 0

    # ── Medium (40-raise_threshold%) — check/call, occasional semi-bluff ──
    if equity > 40:
        if to_call > 0:
            if to_call <= pot * 0.6:
                return "CALL", to_call
            return "FOLD", 0
        # Semi-bluff bet with medium hands
        if can_raise and random.random() < aggressiveness * 0.4:
            raise_amount = _calculate_raise_amount(pot, aggressiveness * 0.5, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "CHECK", 0

    # ── Weak (20-40%) — THE BLUFF ZONE ──
    if equity > fold_threshold:
        if to_call > 0:
            # Facing a bet with weak hand
            if random.random() < bluff_freq * 0.5:
                # Bluff-raise! (detectable pattern: raising with nothing)
                if can_raise:
                    raise_amount = _calculate_bluff_raise(pot, bluff_freq, aggressiveness, chips, min_raise, to_call)
                    return "RAISE", raise_amount
            if to_call <= pot * 0.3:
                return "CALL", to_call
            return "FOLD", 0
        # Check or bluff-bet
        if can_raise and random.random() < bluff_freq * 0.6:
            raise_amount = _calculate_bluff_raise(pot, bluff_freq, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "CHECK", 0

    # ── Very weak (<fold_threshold%) — fold or big bluff ──
    if to_call > 0:
        # Big bluff with air!
        if can_raise and random.random() < bluff_freq * 0.35:
            raise_amount = _calculate_bluff_raise(pot, bluff_freq, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "FOLD", 0

    # Can check for free — often bluff-bet
    if random.random() < bluff_freq * 0.45 and can_raise:
        raise_amount = _calculate_bluff_raise(pot, bluff_freq, aggressiveness, chips, min_raise, to_call)
        return "RAISE", raise_amount
    return "CHECK", 0


def _calculate_raise_amount(
    pot: float, aggressiveness: float, chips: float, min_raise: float, to_call: float
) -> int:
    """Calculate value raise amount — standard 50-100% pot sizing."""
    base_ratio = 0.4 + aggressiveness * 0.6
    base_amount = pot * base_ratio
    jitter = random.uniform(0.85, 1.15)
    amount = base_amount * jitter
    amount = max(amount, min_raise + to_call)
    amount = min(amount, chips)
    return int(round(amount))


def _calculate_bluff_raise(
    pot: float, bluff_freq: float, aggressiveness: float,
    chips: float, min_raise: float, to_call: float
) -> int:
    """
    Calculate bluff raise amount — deliberately uses detectable sizing patterns.
    High bluff_freq bots use overbets; aggressive bots use big sizing.
    """
    # Bluffers tend to overbet (triggers bet sizing feature in detector)
    if random.random() < bluff_freq * 0.6:
        # Overbet bluff: 1.2x-2x pot
        base_ratio = 1.2 + bluff_freq * 0.8
    elif random.random() < aggressiveness:
        # Big bet: 0.8x-1.2x pot
        base_ratio = 0.8 + aggressiveness * 0.4
    else:
        # Small suspicious bet: 0.3x-0.5x pot
        base_ratio = 0.3 + random.random() * 0.2

    base_amount = pot * base_ratio
    jitter = random.uniform(0.9, 1.1)
    amount = base_amount * jitter
    amount = max(amount, min_raise + to_call)
    amount = min(amount, chips)
    return int(round(amount))


def calculate_think_time(equity: float, action: str, aggressiveness: float, is_bluff: bool = False) -> int:
    """
    Calculate simulated think time in milliseconds.
    Bluffs intentionally take longer (triggers action speed feature).
    """
    base = 800

    # Equity-based: medium equity = harder = longer think
    if 30 < equity < 70:
        base += 1200
    elif 20 < equity < 80:
        base += 600

    # Bluffs take extra time (hesitation signal)
    if is_bluff:
        base += random.randint(2000, 5000)  # 2-5 extra seconds for bluffs

    # Action-based
    if action == "FOLD":
        base -= 200
    elif action == "RAISE":
        base += 400
    elif action == "ALL_IN":
        base += 800

    # Personality: aggressive players are faster
    base -= int(aggressiveness * 300)

    # Random variance
    variance = random.randint(-200, 400)
    think_time = max(500, base + variance)
    think_time = min(8000, think_time)

    return think_time
