import { useNavigate } from 'react-router-dom';

const HAND_RANKINGS = [
  { name: 'Royal Flush', example: 'A K Q J 10 (same suit)', strength: 10 },
  { name: 'Straight Flush', example: '5 6 7 8 9 (same suit)', strength: 9 },
  { name: 'Four of a Kind', example: 'K K K K 3', strength: 8 },
  { name: 'Full House', example: 'J J J 5 5', strength: 7 },
  { name: 'Flush', example: '2 5 7 T K (same suit)', strength: 6 },
  { name: 'Straight', example: '4 5 6 7 8', strength: 5 },
  { name: 'Three of a Kind', example: '9 9 9 4 2', strength: 4 },
  { name: 'Two Pair', example: 'Q Q 6 6 3', strength: 3 },
  { name: 'One Pair', example: 'A A 8 5 2', strength: 2 },
  { name: 'High Card', example: 'A K 9 7 3', strength: 1 },
];

export function InstructionsScreen() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8 overflow-y-auto"
      style={{ background: 'radial-gradient(ellipse at center, #1A1A1A 0%, #0A0A0A 70%)' }}
    >
      {/* Header */}
      <div className="w-full max-w-3xl">
        <button
          onClick={() => navigate('/')}
          className="font-[DM_Mono] text-xs text-text-muted hover:text-gold-light transition-colors cursor-pointer mb-6"
        >
          &larr; Back to Menu
        </button>

        <h1 className="font-[Cinzel] text-3xl md:text-4xl font-bold text-gold-gradient mb-2 text-center">
          HOW TO PLAY
        </h1>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-gold-primary to-transparent mx-auto mb-10" />
      </div>

      <div className="w-full max-w-3xl space-y-10">
        {/* ── Section 1: Hand Rankings ── */}
        <section className="bg-noir-card border border-noir-border rounded-lg p-6">
          <h2 className="font-[Cinzel] text-lg text-gold-light tracking-wider mb-4 flex items-center gap-2">
            <span className="text-gold-primary">{'\u2726'}</span>
            HAND RANKINGS
          </h2>
          <p className="text-text-secondary text-sm mb-4">
            Poker hands ranked from strongest to weakest. The best 5-card combination wins.
          </p>
          <div className="space-y-2">
            {HAND_RANKINGS.map((hand, i) => (
              <div
                key={hand.name}
                className="flex items-center gap-3 py-2 px-3 rounded-md"
                style={{
                  background: i === 0
                    ? 'linear-gradient(90deg, rgba(201,168,76,0.1) 0%, transparent 100%)'
                    : i < 3
                    ? 'rgba(201,168,76,0.04)'
                    : 'transparent',
                }}
              >
                <span className="font-[DM_Mono] text-gold-muted text-xs w-5 text-right flex-shrink-0">
                  {i + 1}.
                </span>
                <span className="font-[Cinzel] text-sm text-text-primary w-36 flex-shrink-0">
                  {hand.name}
                </span>
                <span className="font-[DM_Mono] text-xs text-text-muted flex-1">
                  {hand.example}
                </span>
                {/* Strength bar */}
                <div className="w-20 h-1.5 bg-noir-border rounded-full overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${hand.strength * 10}%`,
                      background: hand.strength >= 8
                        ? '#C9A84C'
                        : hand.strength >= 5
                        ? '#22C55E'
                        : hand.strength >= 3
                        ? '#F59E0B'
                        : '#DC2626',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: Game Flow ── */}
        <section className="bg-noir-card border border-noir-border rounded-lg p-6">
          <h2 className="font-[Cinzel] text-lg text-gold-light tracking-wider mb-4 flex items-center gap-2">
            <span className="text-gold-primary">{'\u2726'}</span>
            GAME FLOW
          </h2>
          <div className="space-y-4">
            {[
              {
                step: 'Blinds',
                desc: 'Two forced bets are posted to start the pot. The small blind is half the big blind.',
                icon: '\uD83D\uDCB0',
              },
              {
                step: 'Preflop',
                desc: 'Each player receives 2 hole cards (face down). First round of betting begins.',
                icon: '\uD83C\uDCA0',
              },
              {
                step: 'Flop',
                desc: '3 community cards are dealt face up. Second round of betting.',
                icon: '\uD83C\uDCA1',
              },
              {
                step: 'Turn',
                desc: '1 more community card is dealt. Third round of betting.',
                icon: '\uD83C\uDCA2',
              },
              {
                step: 'River',
                desc: 'Final community card is dealt. Last round of betting.',
                icon: '\uD83C\uDCA3',
              },
              {
                step: 'Showdown',
                desc: 'Remaining players reveal their hands. Best 5-card combination wins the pot.',
                icon: '\uD83C\uDFC6',
              },
            ].map((phase, i, arr) => (
              <div key={phase.step} className="flex gap-4">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-noir-elevated border border-gold-primary/30 flex items-center justify-center text-sm">
                    {phase.icon}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px flex-1 bg-gradient-to-b from-gold-primary/30 to-transparent mt-1" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-4">
                  <h3 className="font-[Cinzel] text-sm text-text-primary mb-1">{phase.step}</h3>
                  <p className="text-text-muted text-xs leading-relaxed">{phase.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Betting Actions ── */}
        <section className="bg-noir-card border border-noir-border rounded-lg p-6">
          <h2 className="font-[Cinzel] text-lg text-gold-light tracking-wider mb-4 flex items-center gap-2">
            <span className="text-gold-primary">{'\u2726'}</span>
            BETTING ACTIONS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                action: 'Fold',
                desc: 'Give up your hand and forfeit any chips in the pot.',
                color: '#DC2626',
                icon: '\u270B',
              },
              {
                action: 'Check',
                desc: 'Pass the action without betting (only when no bet to face).',
                color: '#F59E0B',
                icon: '\uD83D\uDC41',
              },
              {
                action: 'Call',
                desc: 'Match the current bet to stay in the hand.',
                color: '#22C55E',
                icon: '\u2705',
              },
              {
                action: 'Raise',
                desc: 'Increase the bet, forcing others to match or fold.',
                color: '#22C55E',
                icon: '\uD83D\uDE80',
              },
              {
                action: 'All-In',
                desc: 'Bet all remaining chips. You can still win even if others bet more.',
                color: '#F59E0B',
                icon: '\uD83D\uDCA5',
              },
            ].map(item => (
              <div
                key={item.action}
                className="rounded-md border border-noir-border p-3 flex gap-3 items-start"
                style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="font-[Cinzel] text-sm text-text-primary mb-0.5">{item.action}</h3>
                  <p className="text-text-muted text-xs leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: AI Advisor ── */}
        <section className="bg-noir-card border border-noir-border rounded-lg p-6">
          <h2 className="font-[Cinzel] text-lg text-gold-light tracking-wider mb-4 flex items-center gap-2">
            <span className="text-gold-primary">{'\u2726'}</span>
            AI ADVISOR
          </h2>
          <p className="text-text-secondary text-sm mb-4">
            Your AI assistant provides real-time analysis to help you make better decisions.
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-noir-elevated border border-gold-primary/20 flex items-center justify-center text-lg flex-shrink-0">
                {'\uD83C\uDFAF'}
              </div>
              <div>
                <h3 className="font-[Cinzel] text-sm text-text-primary mb-1">Hand Strength Gauge</h3>
                <p className="text-text-muted text-xs leading-relaxed">
                  Shows your win probability as a percentage. Uses Monte Carlo simulation to estimate
                  your equity against opponents. Updates as community cards are revealed.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-noir-elevated border border-gold-primary/20 flex items-center justify-center text-lg flex-shrink-0">
                {'\uD83D\uDD0D'}
              </div>
              <div>
                <h3 className="font-[Cinzel] text-sm text-text-primary mb-1">Opponent Analysis</h3>
                <p className="text-text-muted text-xs leading-relaxed">
                  Tracks opponent behavior over multiple rounds. Builds profiles to estimate bluff likelihood
                  using 8 features including bet sizing, board texture, and action speed.
                  Requires at least 2 showdowns to activate.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-noir-elevated border border-gold-primary/20 flex items-center justify-center text-lg flex-shrink-0">
                {'\uD83D\uDCA1'}
              </div>
              <div>
                <h3 className="font-[Cinzel] text-sm text-text-primary mb-1">Move Recommendation</h3>
                <p className="text-text-muted text-xs leading-relaxed">
                  Suggests the optimal action (Fold, Check, Call, Raise, or All-In) based on
                  your hand strength, pot odds, and position. The recommendation updates
                  on every street.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick Tips ── */}
        <section className="bg-noir-card border border-noir-border rounded-lg p-6">
          <h2 className="font-[Cinzel] text-lg text-gold-light tracking-wider mb-4 flex items-center gap-2">
            <span className="text-gold-primary">{'\u2726'}</span>
            QUICK TIPS
          </h2>
          <ul className="space-y-2 text-text-muted text-sm">
            <li className="flex gap-2">
              <span className="text-gold-primary flex-shrink-0">&bull;</span>
              <span>Play tight in early rounds. Fold weak hands and wait for strong starting cards.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-primary flex-shrink-0">&bull;</span>
              <span>Pay attention to position. Acting last gives you more information to make decisions.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-primary flex-shrink-0">&bull;</span>
              <span>Watch the AI bluff likelihood gauge. When it shows high bluff chance, consider calling.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-primary flex-shrink-0">&bull;</span>
              <span>Manage your chip stack. Avoid risking too many chips on marginal hands.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-primary flex-shrink-0">&bull;</span>
              <span>The AI opponent profiles improve over time. Play more rounds for better reads.</span>
            </li>
          </ul>
        </section>

        {/* Back to Menu button */}
        <div className="text-center pb-8">
          <button
            onClick={() => navigate('/')}
            className="font-[Cinzel] text-sm text-gold-muted hover:text-gold-light transition-colors cursor-pointer
                       border border-gold-primary/30 rounded-lg px-8 py-3 hover:border-gold-primary/60"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
