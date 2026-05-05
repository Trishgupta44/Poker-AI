# Poker AI — Neurosymbolic Bluff Detection System

A Texas Hold'em poker game powered by a **neurosymbolic AI advisor** that combines Naive Bayes classification with symbolic poker reasoning. Play against personality-driven bots while the AI tracks 40+ opponent features — betting patterns, action speed, board texture, positional tendencies — to detect bluffs in real time and recommend optimal moves.

---

## Features

### AI & Machine Learning
- **Monte Carlo Hand Equity** — 1,000-iteration simulation calculates your win probability on every street using the Treys poker evaluation library
- **12-Feature Naive Bayes Bluff Detection** — Classifies opponent actions as bluff or value using bet sizing, street, board texture, position, action sequences, SPR, recency, action speed, polarization, donk bets, range narrowing, and narrative consistency
- **Opponent Profiling** — 40+ conditional probabilities tracked per opponent with Exponential Moving Average (EMA, decay = 0.92) updates after every showdown
- **Confidence Score** — Bayesian posterior probability (0–100) indicating how likely an opponent holds a strong hand, with 5-tier labels from "Almost certainly bluffing" to "Strong hand"
- **Post-Round Audit** — Classifies revealed hands as BLUFF, VALUE_BET, SLOW_PLAY, or PASSIVE using ground-truth hole cards, then updates opponent profiles
- **Board Texture Analysis** — Classifies community cards as DRY, WET, or PAIRED based on suit distribution, connectedness, and pairing
- **Draw Detection** — Identifies flush draws, open-ended straight draws, gutshots, combo draws, and backdoor draws with out counts
- **Blocker Detection** — Analyzes hero's hole cards for nut flush blockers, top pair blockers, set blockers, and straight blockers
- **Scare Card Detection** — Flags new community cards as SAFE, MILD, SCARY, or VERY_SCARY based on flush/straight completion and board pairing
- **Preflop Strategy** — Position-based hand tier system (Tier 1–6) recommending RAISE, CALL, or FOLD based on seat and hand strength

### Gameplay
- **3 Bot Personalities** — Viktor (tight, honest), Luna (aggressive bluffer), Rex (passive, sneaky)
- **Two Game Modes** — VS Bots (1 human + 2–3 AI) and Local 2-Player (head-to-head, only Player 1 gets AI help)
- **Oval Poker Table** — 5-layer design (dark frame → gold ring → wood rail → gold accent → green felt) with equidistant angular player placement
- **Action Badges** — Color-coded pills (RAISE=gold, CALL=green, CHECK=blue, FOLD=red, ALL-IN=purple) next to player names
- **Street Indicator Bar** — Visual tracker showing PREFLOP → FLOP → TURN → RIVER progression
- **Sound Effects** — Synthesized card, chip, and action sounds via Web Audio API (no external audio files)
- **Card Animations** — CSS keyframe deal animation with bounce effect

### Visual AI Indicators
- **Hand Strength Gauge** — SVG semicircular arc (green ≥65%, amber 40–65%, red <40%) showing live equity
- **Bluff Likelihood Gauge** — Inverted confidence score as semicircular arc showing opponent bluff probability
- **Confidence Cards** — Per-opponent breakdown with ⚠ (favours bluff) and ✔ (favours value) symbols for each of the 12 features
- **AI Move Recommendation** — FOLD / CHECK / CALL / RAISE with confidence percentage and reasoning

---

## How Texas Hold'em Works

### The Basics
Texas Hold'em is a community card poker game. Each player receives **2 private hole cards**, and **5 community cards** are dealt face-up on the table. Players make the best 5-card hand from any combination of their hole cards and the community cards.

### Betting Streets
1. **Preflop** — Each player receives 2 hole cards. Betting begins left of the big blind.
2. **Flop** — 3 community cards are dealt. Betting begins left of the dealer.
3. **Turn** — 1 additional community card is dealt. Another betting round.
4. **River** — 1 final community card is dealt. Final betting round.
5. **Showdown** — Remaining players reveal hands. Best 5-card hand wins the pot.

### Hand Rankings (Strongest to Weakest)
| Rank | Hand | Example |
|------|------|---------|
| 1 | Royal Flush | A♠ K♠ Q♠ J♠ 10♠ |
| 2 | Straight Flush | 9♥ 8♥ 7♥ 6♥ 5♥ |
| 3 | Four of a Kind | K♣ K♦ K♥ K♠ 3♦ |
| 4 | Full House | Q♠ Q♥ Q♦ 8♣ 8♠ |
| 5 | Flush | A♦ J♦ 8♦ 6♦ 2♦ |
| 6 | Straight | 10♣ 9♦ 8♠ 7♥ 6♣ |
| 7 | Three of a Kind | 7♠ 7♥ 7♦ K♣ 2♠ |
| 8 | Two Pair | J♣ J♠ 4♦ 4♥ A♣ |
| 9 | Pair | 10♥ 10♦ A♠ 8♣ 5♦ |
| 10 | High Card | A♠ K♦ 9♣ 7♥ 3♠ |

### Player Actions
- **Fold** — Discard your hand and forfeit the pot
- **Check** — Pass without betting (only when no bet to match)
- **Call** — Match the current bet
- **Raise** — Increase the bet (forces others to act again)
- **All-In** — Push all remaining chips into the pot

### Blinds
Two forced bets posted before cards are dealt: the **small blind** (left of dealer) and the **big blind** (2× the small blind). These ensure there's always something to play for.

---

## Confidence Score — How It Works

The confidence score uses a **12-feature Naive Bayes classifier** to estimate the probability that an opponent's action represents a genuine strong hand versus a bluff.

### The 12 Features

| # | Feature | What It Measures |
|---|---------|-----------------|
| 1 | **Bet Sizing** | Small (<0.5× pot), medium (0.5–1×), or overbet (>1×) |
| 2 | **Street** | Bluff frequency varies: flop > turn > river |
| 3 | **Board Texture** | Dry boards invite more bluffs; wet boards fewer |
| 4 | **Position** | In-position players bluff more (55% vs 45%) |
| 5 | **Action Sequence** | Check-raise, passive-then-raise, persistent aggression |
| 6 | **Stack-to-Pot Ratio** | Low SPR (<3) = committed, fewer bluffs |
| 7 | **Recency** | Recently caught bluffing → opponent plays tighter |
| 8 | **Action Speed** | Snap (<3s) = strong; slow (>8s) = hesitation/bluff tell |
| 9 | **Polarization** | Polarized ranges reduce bet-size signal weight |
| 10 | **Donk Bet** | Out-of-position lead into raiser = weak hand signal |
| 11 | **Range Narrowing** | Multi-street commitment narrows range toward value |
| 12 | **Narrative Consistency** | Incoherent betting story across streets = bluff signal |

### Calculation
```
P(bluff|evidence) = P(bluff) × ∏P(feature_i|bluff) / [P(bluff) × ∏P(f_i|bluff) + P(value) × ∏P(f_i|value)]

Confidence = (1 - P(bluff|evidence)) × 100
```

### Score Interpretation
| Score | Label | Meaning |
|-------|-------|---------|
| 80–100 | Strong hand | High confidence opponent has a real hand |
| 60–80 | Likely value | Probably a genuine hand |
| 40–60 | Mixed signals | Could go either way |
| 20–40 | Likely bluffing | Proceed with caution |
| 0–20 | Almost certainly bluffing | Strong bluff signal detected |

---

## Opponent Profiling

Each opponent has a persistent profile (stored in localStorage) tracking **40+ conditional probabilities** that update after every showdown using Exponential Moving Average:

```
new_value = 0.92 × old_value + 0.08 × new_observation
```

### Tracked Features
| Category | Features |
|----------|----------|
| **Core Frequencies** | bluffFrequency, overbetBluffRate, slowPlayFrequency, passivePlayRate |
| **Street Conditionals** | flopBluffRate, turnBluffRate, riverBluffRate + value counterparts |
| **Board Texture** | dryBoardBluffRate (0.45), wetBoardBluffRate (0.35) |
| **Bet Sizing** | smallBetBluffRate, medBetBluffRate, overbetValueRate + counterparts |
| **Position** | inPosBluffRate (0.55), inPosValueRate (0.50) |
| **Action Sequences** | checkRaiseBluffRate, passiveRaiseBluffRate, persistentAggrBluffRate |
| **SPR** | lowSprBluffRate, highSprBluffRate + value counterparts |
| **Action Speed** | snapActionBluffRate, slowActionBluffRate (0.55) |
| **Donk Bets** | donkBetBluffRate (0.45), donkBetValueRate (0.55) |
| **Recency** | lastCaughtRoundsAgo — adjusts bluff prior dynamically |

Profiles improve over time as the system observes more showdowns, making bluff detection increasingly accurate across rounds.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS v4 |
| State Management | Zustand (with localStorage persistence for profiles) |
| Animation | CSS Keyframes + Framer Motion |
| AI Backend | Python 3.10+, FastAPI, Uvicorn |
| Hand Evaluation | pokersolver (JS) + Treys (Python) |
| Audio | Web Audio API (synthesized sounds) |

---

## Project Structure

```
poker-ai/
├── src/
│   ├── components/
│   │   ├── ai-panel/        # AI advisor gauges, confidence cards, recommendations
│   │   ├── table/           # Poker table, player seats, card components
│   │   ├── screens/         # Home, Setup, Game, Instructions screens
│   │   └── modals/          # Turn handover, reveal, game over modals
│   ├── engine/              # Game controller, betting, deck, showdown, pot
│   ├── hooks/               # useAIScoring, useBotActions, useSound
│   ├── store/               # Zustand stores (game, AI, profiles)
│   ├── api/                 # Frontend → Python API bridge
│   ├── types/               # TypeScript type definitions
│   ├── audio/               # Sound effect synthesizer
│   └── styles/              # Global CSS with animations
├── python-ai/
│   ├── server.py            # FastAPI server (port 8000)
│   ├── ai/
│   │   ├── confidence_score.py   # 12-feature Naive Bayes classifier
│   │   ├── monte_carlo.py        # Hand equity simulation
│   │   ├── bot_brain.py          # Bot personality-driven decisions
│   │   ├── post_round_audit.py   # Showdown hand classification
│   │   ├── board_texture.py      # DRY/WET/PAIRED classification
│   │   ├── preflop_strategy.py   # Position-based hand tiers
│   │   ├── draw_detector.py      # Flush/straight draw detection
│   │   ├── blocker_detector.py   # Card blocker analysis
│   │   ├── scare_card.py         # Scare card evaluation
│   │   └── hand_evaluator.py     # Treys hand evaluation wrapper
│   ├── tests/               # Python unit tests
│   └── requirements.txt     # Python dependencies
├── package.json
├── vite.config.ts
└── README.md
```

---

## Requirements

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **Python** 3.10 or higher — [Download](https://www.python.org/downloads/)
- **pip** (included with Python)
- **npm** (included with Node.js)

---

## Setup & Run

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/poker-ai.git
cd poker-ai
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install Python backend dependencies

```bash
cd python-ai
pip install -r requirements.txt
cd ..
```

### 4. Start the Python AI server (Terminal 1)

```bash
cd python-ai
python server.py
```

This starts the FastAPI backend on **http://localhost:8000**. Keep this terminal open.

### 5. Start the frontend dev server (Terminal 2)

```bash
npm run dev
```

This starts Vite on **http://localhost:5173**. Open this URL in your browser.

---

## How to Play

1. Open **http://localhost:5173** in your browser
2. Click **VS Bots** to play against AI opponents, or **Local 2P** for head-to-head
3. Choose 2–4 players and set starting chips / blind levels
4. The **AI Advisor Panel** on the right shows:
   - **Hand Strength Gauge** — your win equity as a semicircular arc
   - **Bluff Likelihood Gauge** — opponent bluff probability
   - **Move Recommendation** — suggested action with confidence and reasoning
   - **Opponent Analysis** — per-opponent confidence cards with 12-feature breakdowns
5. Play rounds — the AI learns opponent patterns over time, even from rounds where you fold early

---

## API Endpoints

The Python backend exposes these FastAPI endpoints on `http://localhost:8000`:

| Endpoint | Description |
|----------|-------------|
| `POST /api/hand-equity` | Monte Carlo equity simulation |
| `POST /api/confidence` | 12-feature Naive Bayes bluff scoring |
| `POST /api/bot-decision` | Personality-driven bot action selection |
| `POST /api/audit-round` | Post-showdown hand classification |
| `POST /api/update-profile` | EMA-weighted opponent profile update |
| `POST /api/board-texture` | DRY/WET/PAIRED board classification |
| `POST /api/preflop-strategy` | Position-based preflop recommendation |
| `POST /api/detect-draws` | Flush/straight draw detection |
| `POST /api/detect-blockers` | Card blocker analysis |
| `POST /api/detect-scare-cards` | Scare card evaluation |

---

## Troubleshooting

- **AI panel shows "Waiting..."** — Make sure the Python server is running on port 8000
- **No opponent analysis data** — Play at least 1 full round to showdown. Profiles build from ALL rounds including when you fold
- **Port 8000 already in use** — Kill the existing process or change the port in `python-ai/server.py`
- **Python import errors** — Make sure you ran `pip install -r requirements.txt` from the `python-ai/` directory
- **Bot actions timeout** — The Python server has a 10-second timeout; ensure it's running and responsive

---

## License

This project is for educational and research purposes.
