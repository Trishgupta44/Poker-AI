# Poker AI — Project Context Document

## Overview
Texas Hold'em poker game with an AI advisor. React+TypeScript+Vite frontend communicates with a Python FastAPI backend for all AI computations. The AI tracks opponent behavior across rounds and provides real-time bluff detection, hand strength analysis, and move recommendations.

## Architecture

```
Browser (localhost:5173)          Python Server (localhost:8000)
┌─────────────────────┐           ┌─────────────────────────┐
│  React 19 + Vite    │  fetch()  │  FastAPI + Treys        │
│  Tailwind CSS v4    │ ────────► │  Monte Carlo equity     │
│  Zustand stores     │ ◄──────── │  Naive Bayes confidence │
│  Framer Motion      │   JSON    │  Bot AI personalities   │
│  Web Audio API      │           │  Post-round audit       │
└─────────────────────┘           └─────────────────────────┘
```

## Source Files (48 files, ~7,500 lines total)

### Frontend — TypeScript/React (37 files, 5,261 lines)

**Core Engine** (`src/engine/`)
| File | Lines | Purpose |
|------|-------|---------|
| `game-controller.ts` | 433 | Main game loop: deals, manages rounds, blinds, showdown, bot turns |
| `betting.ts` | 268 | Bet validation, min/max raise logic, all-in handling |
| `hand-evaluator.ts` | 143 | Pokersolver wrapper for hand ranking and comparison |
| `showdown.ts` | 122 | Determines winners, splits pots, handles side pots |
| `pot.ts` | 101 | Side pot calculation for multi-way all-ins |
| `deck.ts` | 82 | Shuffle, deal, standard 52-card deck |

**Zustand Stores** (`src/store/`)
| File | Lines | Purpose |
|------|-------|---------|
| `game-store.ts` | 132 | Game state, players, round, modal flags, turn timing |
| `profile-store.ts` | 96 | Opponent profiles persisted to localStorage via zustand/persist |
| `ai-store.ts` | 67 | Hand strength, confidence scores, equity history, computing flag |

**AI Hooks** (`src/hooks/`)
| File | Lines | Purpose |
|------|-------|---------|
| `useAIScoring.ts` | 251 | Orchestrates all AI: equity on street change, confidence on opponent action, post-round audit for ALL players (including bot-vs-bot) |
| `useBotActions.ts` | 101 | Calls Python bot-decision API when it's a bot's turn |
| `useSound.ts` | 416 | Web Audio API synthesizer — card flips, chips, fold, win sounds |
| `useGameSounds.ts` | 96 | Maps game events to sound triggers |

**Components** (`src/components/`)
| File | Lines | Purpose |
|------|-------|---------|
| `GameScreen.tsx` | 233 | Main game layout: table + AI panel sidebar |
| `InstructionsScreen.tsx` | 299 | How-to-play guide with animated examples |
| `AIAdvisorPanel.tsx` | 225 | Dual gauges (hand strength + bluff), move recommendation, opponent analysis cards |
| `ActionPanel.tsx` | 190 | Player action buttons: fold/check/call/raise with slider |
| `PokerTable.tsx` | 161 | Dynamic table shapes (square/triangle/rectangle), seat layout |
| `SetupScreen.tsx` | 156 | Game configuration: mode, player count, starting chips |
| `ConfidenceCard.tsx` | 156 | Per-opponent bluff analysis with gauge + feature breakdown |
| `RoundRevealModal.tsx` | 149 | End-of-round results: winner, hand rankings, audit tags |
| `CardComponent.tsx` | 280 | Playing card SVG with suit symbols, face cards, animations |
| `HandStrengthGauge.tsx` | 106 | Semicircular SVG gauge for equity percentage |
| `BluffGauge.tsx` | 105 | Semicircular SVG gauge for bluff likelihood |
| `PlayerSeat.tsx` | 106 | Player avatar, chips, cards, dealer button |
| `HomeScreen.tsx` | 85 | Landing page with animated title |
| `TurnHandoverModal.tsx` | 48 | "Pass the device" modal for local 2-player |
| `CommunityCards.tsx` | 33 | Community card row with animation |
| `PotDisplay.tsx` | 26 | Pot amount display |

**API Bridge** (`src/api/`)
| File | Lines | Purpose |
|------|-------|---------|
| `ai-api.ts` | 159 | All fetch() calls to Python backend — equity, confidence, bot decision, audit, profile update, board texture |

**Type Definitions** (`src/types/`)
| File | Lines | Purpose |
|------|-------|---------|
| `ai.ts` | 153 | HandStrengthResult, ConfidenceResult, AuditResult, OpponentProfile, BoardTexture |
| `player.ts` | 98 | Player interface: id, name, chips, holeCards, seatIndex, personality |
| `game.ts` | 79 | GameState, Round, RoundAction, Street, GameConfig |
| `card.ts` | 64 | Card type: rank + suit, CardBack placeholder |

### Backend — Python (11 files, 2,217 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `server.py` | 216 | FastAPI app with 7 endpoints + CORS middleware |
| `ai/confidence_score.py` | 717 | 12-feature Naive Bayes bluff detector with EMA decay (0.92) |
| `ai/bot_brain.py` | 298 | 3 bot personalities: Rex (aggressive), Cleo (balanced), Max (tight) |
| `ai/explanation_engine.py` | 197 | Natural language explanations for AI recommendations |
| `ai/monte_carlo.py` | 181 | Monte Carlo equity simulation (1000 iterations default) |
| `ai/post_round_audit.py` | 118 | Classifies hands as BLUFF/VALUE_BET/SLOW_PLAY/PASSIVE |
| `ai/hand_evaluator.py` | 116 | Treys-based hand evaluation and comparison |
| `ai/board_texture.py` | 108 | Board texture: DRY/WET/PAIRED classification |
| `ai/preflop_strategy.py` | 275 | Position-based hand tier system and preflop action recommendations |
| `ai/draw_detector.py` | 195 | Flush/straight/combo draw detection with out counting |
| `ai/blocker_detector.py` | 169 | Card blocker analysis — identifies blocked opponent hands |
| `ai/scare_card.py` | 181 | Scary runout card detection — board texture change analysis |
| `tests/test_audit.py` | 483 | Unit tests for audit, confidence, and profile systems |

## Key Data Flows

### 1. Hand Strength (per street change)
```
Street changes → useAIScoring detects → POST /api/hand-equity
  → monte_carlo.py runs 1000 simulations
  → Returns equity %, tier, move recommendation
  → HandStrengthGauge renders
```

### 2. Confidence / Bluff Detection (per opponent action)
```
Opponent acts → useAIScoring detects (any action except FOLD)
  → POST /api/board-texture (classify community cards)
  → POST /api/confidence (12-feature Naive Bayes)
  → Features: bet size, position, board texture, action sequence,
              historical bluff rate, aggression, SPR, action speed
  → Returns score 0-100, label, explanation, feature breakdown
  → ConfidenceCard + BluffGauge render
```

### 3. Post-Round Audit (every round end, including when user folds)
```
showRevealModal fires → useAIScoring post-round effect
  → POST /api/audit-round (classify each player's hand)
  → For EACH non-hero player who took any action:
      → If showdown data exists: precise BLUFF/VALUE_BET/SLOW_PLAY tag
      → If no showdown (fold-out): synthetic PASSIVE tag with behavioral data
      → POST /api/update-profile (EMA-weighted profile update)
  → Profile records: bet sizes, action speed, sequences, position, SPR
  → Persisted to localStorage via zustand/persist
```

### 4. Bot Decision
```
Bot's turn → useBotActions detects → POST /api/bot-decision
  → bot_brain.py evaluates hand + personality weights
  → Returns action (FOLD/CHECK/CALL/RAISE/ALL_IN) + amount
  → game-controller applies the action
```

## AI Confidence Scoring — 12 Features

1. **Bet Size** — Ratio of bet to pot. Overbets (>1.5x) often indicate bluffs or nuts.
2. **Position** — Early position aggression is stronger. Late position gets more bluff credit.
3. **Board Texture** — Bluffs more likely on WET boards with many draws.
4. **Action Sequence** — CHECK_RAISE, PASSIVE_THEN_RAISE, PERSISTENT_AGGR each have different bluff rates.
5. **Historical Bluff Rate** — EMA-weighted rolling average from past showdowns.
6. **Aggression Frequency** — How often this opponent bets/raises vs checks/calls.
7. **Stack-to-Pot Ratio (SPR)** — Low SPR = committed to pot. High SPR = more room to bluff.
8. **Action Speed** — Snap decisions (<3s) and long tanks (>8s) are behavioral tells.
9. **Polarisation (A2)** — Bet sizing polarisation: very small or very large bets suggest bluffs.
10. **Donk Bet (A3)** — Out-of-position lead bets into the preflop raiser — often weak or bluff.
11. **Range Narrowing (A4)** — Multi-street aggression narrows opponent range; persistent aggression is less likely bluff.
12. **Narrative Consistency (A1)** — Does the opponent's action story make sense? Inconsistent narratives suggest bluffs.

## Opponent Profile (persisted fields)
- `totalHands`, `bluffCount`, `bluffRate` (EMA)
- `aggressionFrequency` (EMA), `avgBetSize` (EMA)
- `positionStats` (EARLY/MIDDLE/LATE frequencies)
- `streetAggression` (per street: PREFLOP/FLOP/TURN/RIVER)
- `actionSequences` (CHECK_RAISE, PASSIVE_THEN_RAISE, etc. counts)
- `boardTextureBluffRates` (DRY/WET/PAIRED bluff rates)
- `sprBehavior` (low/medium/high SPR bluff rates)
- `avgActionTimeMs`, `snapActionRate`, `slowActionRate`
- `lastCaughtRoundsAgo` (recency of caught bluff — affects tilt scoring)

## Table Shape System
| Players | Shape | CSS | Seat Positions |
|---------|-------|-----|----------------|
| 4 | Square | `rounded-2xl`, inset 10%/26% | Four corners |
| 3 | Triangle | `clip-path: polygon()` + drop-shadow | Three vertices |
| 2 | Rectangle | `rounded-2xl`, inset 18%/8% | Midpoints of long sides |

## API Endpoints (Python FastAPI, port 8000)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/hand-equity` | Monte Carlo equity simulation |
| POST | `/api/confidence` | 12-feature bluff confidence score |
| POST | `/api/bot-decision` | Bot personality-driven action |
| POST | `/api/audit-round` | Post-round hand classification |
| POST | `/api/update-profile` | EMA opponent profile update |
| POST | `/api/board-texture` | DRY/WET/PAIRED board classification |
| GET | `/api/health` | Server health check |

## Dependencies

**Frontend (package.json):**
- react 19, react-dom 19, react-router-dom 7
- zustand 5 (state management + localStorage persist)
- framer-motion 12 (animations)
- pokersolver 2 (JS hand evaluation)
- howler 2 (audio — imported but sounds are Web Audio synthesized)
- nanoid 5 (unique ID generation)
- Tailwind CSS 4, Vite 7, TypeScript 5.9

**Backend (requirements.txt):**
- fastapi 0.115
- uvicorn 0.30
- treys 0.1.8 (poker hand evaluation)
- pydantic 2.9
