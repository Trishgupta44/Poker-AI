import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/game-store';
import { useAIStore } from '../../store/ai-store';
import { useProfileStore } from '../../store/profile-store';
import { deriveGameStats, type DerivedGameStats } from '../../utils/stats';
import { getTrainingStats } from '../../api/ai-api';
import type { TrainingStatsResult } from '../../types/ai';

type ChartPoint = { label: string; value: number };
type RecentBatchPoint = {
  label: string;
  examples: number;
  labelled: number;
  aggressive: number;
};

export function StatsScreen() {
  const navigate = useNavigate();
  const gameState = useGameStore(s => s.gameState);
  const equityHistory = useAIStore(s => s.equityHistory);
  const confidenceScores = useAIStore(s => s.confidenceScores);
  const profiles = useProfileStore(s => s.profiles);
  const [trainingStats, setTrainingStats] = useState<TrainingStatsResult | null>(null);
  const [trainingStatsError, setTrainingStatsError] = useState(false);

  const stats = useMemo(() => {
    if (!gameState) return null;
    return deriveGameStats(gameState, profiles, confidenceScores, equityHistory);
  }, [confidenceScores, equityHistory, gameState, profiles]);

  useEffect(() => {
    let isMounted = true;
    getTrainingStats()
      .then(result => {
        if (!isMounted) return;
        setTrainingStats(result);
        setTrainingStatsError(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setTrainingStatsError(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen px-4 py-5 md:px-8"
         style={{ background: 'radial-gradient(ellipse at center top, #1A1A1A 0%, #0A0A0A 58%)' }}>
      <header className="mx-auto mb-6 flex max-w-7xl items-center justify-between gap-4">
        <button
          onClick={() => navigate(gameState ? '/game' : '/')}
          className="font-[DM_Mono] text-xs text-text-muted hover:text-gold-light transition-colors cursor-pointer"
        >
          &larr; {gameState ? 'Back to Game' : 'Back Home'}
        </button>
        <div className="text-center">
          <h1 className="font-[Cinzel] text-2xl md:text-4xl text-gold-gradient font-bold">
            AI Learning Stats
          </h1>
          <p className="font-[DM_Mono] text-[10px] md:text-xs text-text-muted tracking-[0.22em] uppercase">
            Training data, model targets, and opponent adaptation
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="font-[DM_Mono] text-xs text-text-muted hover:text-gold-light transition-colors cursor-pointer"
        >
          Menu
        </button>
      </header>

      {!stats
        ? <EmptyState onStart={() => navigate('/setup')} />
        : <StatsContent stats={stats} trainingStats={trainingStats} trainingStatsError={trainingStatsError} />}
    </div>
  );
}

function StatsContent({
  stats,
  trainingStats,
  trainingStatsError,
}: {
  stats: DerivedGameStats;
  trainingStats: TrainingStatsResult | null;
  trainingStatsError: boolean;
}) {
  const totalProfileHands = stats.profileStats.reduce((sum, profile) => sum + profile.hands, 0);
  const readiness = getModelReadiness(trainingStats, totalProfileHands);
  const signalStrength = getSignalStrength(stats.profileStats);
  const profileMaturity = stats.profileStats.map(profile => ({
    label: profile.name,
    value: Math.min(100, profile.hands * 12),
  }));
  const exploitabilitySignals = stats.profileStats.flatMap(profile => ([
    { label: `${profile.name} bluff`, value: profile.bluffFrequency },
    { label: `${profile.name} overbet`, value: profile.overbetBluffRate },
    { label: `${profile.name} river`, value: profile.riverBluffRate },
    { label: `${profile.name} slow`, value: profile.slowActionBluffRate },
  ]));
  const readinessSignals = [
    { label: 'Dataset', value: scoreDatasetSize(trainingStats) },
    { label: 'Labels', value: trainingStats?.labelCoverage ?? 0 },
    { label: 'Streets', value: scoreStreetCoverage(trainingStats) },
    { label: 'Memory', value: Math.min(100, totalProfileHands * 8) },
    { label: 'Reads', value: signalStrength },
  ];
  const recentLearningBatches = (trainingStats?.recentHands ?? [])
    .slice()
    .reverse()
    .map(hand => ({
      label: `R${hand.roundNumber}`,
      examples: hand.examples,
      labelled: hand.labelled,
      aggressive: hand.aggressiveActions,
    }));

  return (
    <main className="mx-auto grid max-w-7xl gap-4">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-3xl border border-gold-border/35 bg-gradient-to-br from-noir-card via-noir-surface to-noir-bg p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 opacity-70"
               style={{ background: 'radial-gradient(circle at 18% 0%, rgba(201,168,76,.22), transparent 32%), radial-gradient(circle at 92% 20%, rgba(82,113,255,.14), transparent 30%)' }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-light/70 to-transparent" />
          <div className="relative">
            <div>
              <StatusPill label={trainingStatsError ? 'Backend offline' : 'Live training feed'} tone={trainingStatsError ? 'warn' : 'ready'} />
              <h2 className="mt-2 font-[Cinzel] text-3xl text-gold-light">
                Model Readiness
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                This page tracks whether the AI is collecting enough labelled,
                balanced examples to improve its decision model and opponent reads.
              </p>
            </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Readiness" value={`${readiness}%`} sub="overall score" />
            <MetricCard label="Examples" value={(trainingStats?.trainingExamples ?? 0).toLocaleString()} sub="model rows" />
            <MetricCard label="Coverage" value={`${trainingStats?.labelCoverage ?? 0}%`} sub="labelled data" />
            <MetricCard label="Signals" value={`${signalStrength}%`} sub="opponent reads" />
          </div>
          </div>
        </div>

        <Panel title="Readiness Breakdown" subtitle="Simple progress bars">
          <div className="grid gap-3">
            {readinessSignals.map(signal => (
              <HealthRow
                key={signal.label}
                label={signal.label}
                value={signal.value}
                detail={`${signal.value}%`}
              />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Training Health" subtitle="What the AI still needs">
          <div className="grid gap-3 md:grid-cols-2">
            <HealthRow label="Dataset Size" value={scoreDatasetSize(trainingStats)} detail={`${trainingStats?.trainingExamples ?? 0} examples`} />
            <HealthRow label="Label Quality" value={trainingStats?.labelCoverage ?? 0} detail={`${trainingStats?.labelledExamples ?? 0} labelled`} />
            <HealthRow label="Opponent Memory" value={Math.min(100, totalProfileHands * 8)} detail={`${totalProfileHands} profiled hands`} />
            <HealthRow label="Street Coverage" value={scoreStreetCoverage(trainingStats)} detail="preflop to river mix" />
          </div>
        </Panel>
        <Panel title="Recent Learning Trend" subtitle="Useful replacement for game records">
          <RecentBatchGraph data={recentLearningBatches} emptyText="Recent training batches appear after audited hands." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Learning Curve" subtitle="Cumulative model examples from SQLite">
          {trainingStatsError ? (
            <EmptyPanel text="Start the Python backend to read local SQLite training stats." />
          ) : (
            <LineChart data={trainingStats?.learningCurve ?? []} emptyText="Audited hands will create model training examples." />
          )}
        </Panel>
        <Panel title="Label Quality" subtitle="Audit tags the model can learn from">
          <BarChart data={trainingStats?.tagDistribution ?? []} emptyText="No audited labels recorded yet." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Decision Target Balance" subtitle="Fold, call, raise, and all-in examples">
          <BarChart data={trainingStats?.actionDistribution ?? []} emptyText="Action targets appear after audited hands." />
        </Panel>
        <Panel title="Street Coverage" subtitle="Does training data cover the full hand?">
          <BarChart data={trainingStats?.streetDistribution ?? []} emptyText="No street-level examples recorded yet." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Opponent Model Maturity" subtitle="How much memory each opponent profile has">
          <BarChart data={profileMaturity} emptyText="Opponent profiles build after completed hands." />
        </Panel>
        <Panel title="Live Bluff Confidence" subtitle="Current read strength by opponent">
          <BarChart data={stats.confidenceScores} emptyText="Confidence reads appear when opponents bet or raise." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Opponent Profiles" subtitle="Condensed learned behavior">
          {stats.profileStats.length > 0 ? (
            <div className="grid gap-3">
              {stats.profileStats.map(profile => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <EmptyPanel text="Opponent profiles build after completed hands." />
          )}
        </Panel>
        <Panel title="Exploitability Signals" subtitle="Patterns the AI can use against each opponent">
          <BarChart data={exploitabilitySignals} emptyText="Behavioral signals appear after profiles update." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Advisor Equity Signal" subtitle="Still useful, but secondary to learning">
          <LineChart data={stats.equityHistory} valueSuffix="%" maxValue={100} emptyText="Equity appears after AI scoring runs." />
        </Panel>
        <Panel title="Action Mix" subtitle="Current fold, call, raise, and all-in volume">
          <BarChart data={stats.actionBreakdown} emptyText="Action mix appears after completed hands." />
        </Panel>
      </section>

      <section className="grid gap-4">
        <Panel title="What Improves Next" subtitle="Practical interpretation">
          <div className="grid gap-3 md:grid-cols-3">
            <InsightCard
              title="More Labels"
              text="Showdowns and audits teach the model which actions were bluffs, value bets, folds, or passive lines."
            />
            <InsightCard
              title="Better Balance"
              text="The model becomes safer when folds, calls, raises, streets, and opponent styles are all represented."
            />
            <InsightCard
              title="Opponent Adaptation"
              text="Profiles improve as the AI sees repeated betting patterns from the same bots or players."
            />
          </div>
        </Panel>
      </section>
    </main>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gold-border/25 bg-noir-card/80 p-4 shadow-card transition-transform hover:-translate-y-0.5">
      <div className="font-[DM_Mono] text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="mt-2 font-[Cinzel] text-2xl text-gold-light">{value}</div>
      {sub && <div className="mt-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.14em] text-text-muted">{sub}</div>}
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'ready' | 'warn' }) {
  const color = tone === 'ready' ? '#7FD08A' : '#E8B45F';
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gold-border/35 bg-noir-bg/60 px-3 py-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.2em] text-text-muted">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}` }} />
      {label}
    </div>
  );
}

function HealthRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-[DM_Mono] text-xs text-text-secondary">{label}</span>
        <span className="font-[DM_Mono] text-xs text-gold-light">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-noir-bg">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
      <div className="mt-1 font-[DM_Mono] text-[10px] text-text-muted">{detail}</div>
    </div>
  );
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-noir-border bg-noir-bg/45 p-4">
      <h3 className="font-[Cinzel] text-base text-gold-light">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{text}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-noir-border bg-noir-card/70 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.36)]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-[Cinzel] text-lg text-text-primary">{title}</h2>
          <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.18em] text-text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function LineChart({
  data,
  maxValue,
  valueSuffix = '',
  emptyText,
}: {
  data: ChartPoint[];
  maxValue?: number;
  valueSuffix?: string;
  emptyText: string;
}) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;

  const width = 520;
  const height = 190;
  const padding = 24;
  const values = data.map(point => point.value);
  const max = maxValue ?? Math.max(...values, 1);
  const min = maxValue ? 0 : Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const points = data.map((point, index) => {
    const x = data.length === 1
      ? width / 2
      : padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = points.map(point => `${point.x},${point.y}`).join(' ');
  const last = points[points.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="lineGold" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8B7332" />
            <stop offset="100%" stopColor="#E8D5A3" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,.08)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,.08)" />
        <polyline points={path} fill="none" stroke="url(#lineGold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(point => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#C9A84C" />
            <text x={point.x} y={height - 5} textAnchor="middle" fill="rgba(245,240,232,.42)" fontSize="10">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="font-[DM_Mono] text-xs text-text-muted">
        Latest: <span className="text-gold-light">{Math.round(last.value).toLocaleString()}{valueSuffix}</span>
      </div>
    </div>
  );
}

function BarChart({ data, emptyText }: { data: ChartPoint[]; emptyText: string }) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;
  const max = Math.max(...data.map(point => point.value), 1);

  return (
    <div className="grid gap-3">
      {data.map(point => (
        <div key={point.label}>
          <div className="mb-1 flex items-center justify-between font-[DM_Mono] text-xs">
            <span className="text-text-secondary">{point.label}</span>
            <span className="text-gold-light">{point.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-noir-bg">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light"
              style={{ width: `${Math.max(7, (point.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentBatchGraph({
  data,
  emptyText,
}: {
  data: RecentBatchPoint[];
  emptyText: string;
}) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;

  const width = 640;
  const height = 230;
  const padding = 30;
  const max = Math.max(...data.flatMap(point => [point.examples, point.labelled, point.aggressive]), 1);
  const getX = (index: number) => data.length === 1
    ? width / 2
    : padding + (index / (data.length - 1)) * (width - padding * 2);
  const getY = (value: number) => height - padding - (value / max) * (height - padding * 2);
  const buildPath = (key: keyof Omit<RecentBatchPoint, 'label'>) => data
    .map((point, index) => `${getX(index)},${getY(point[key])}`)
    .join(' ');
  const latest = data[data.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible rounded-2xl border border-noir-border bg-noir-bg/35">
        <defs>
          <linearGradient id="batchExamples" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8B7332" />
            <stop offset="100%" stopColor="#E8D5A3" />
          </linearGradient>
          <linearGradient id="batchLabels" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#5F7DFF" />
            <stop offset="100%" stopColor="#A9B8FF" />
          </linearGradient>
          <linearGradient id="batchAggro" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#B85C52" />
            <stop offset="100%" stopColor="#F0A28E" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(mark => (
          <line
            key={mark}
            x1={padding}
            y1={getY(max * mark)}
            x2={width - padding}
            y2={getY(max * mark)}
            stroke="rgba(255,255,255,.06)"
          />
        ))}
        <polyline points={buildPath('examples')} fill="none" stroke="url(#batchExamples)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={buildPath('labelled')} fill="none" stroke="url(#batchLabels)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={buildPath('aggressive')} fill="none" stroke="url(#batchAggro)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => (
          <g key={point.label}>
            <text x={getX(index)} y={height - 9} textAnchor="middle" fill="rgba(245,240,232,.48)" fontSize="10">
              {point.label}
            </text>
            <circle cx={getX(index)} cy={getY(point.examples)} r="4" fill="#E8D5A3" />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Legend color="#E8D5A3" label="Examples" />
          <Legend color="#A9B8FF" label="Labelled" />
          <Legend color="#F0A28E" label="Aggressive" />
        </div>
        <div className="font-[DM_Mono] text-xs text-text-muted">
          Latest {latest.label}: <span className="text-gold-light">{latest.examples} rows</span>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-noir-border bg-noir-bg/45 px-3 py-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.14em] text-text-muted">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ProfileCard({ profile }: { profile: DerivedGameStats['profileStats'][number] }) {
  return (
    <div className="rounded-xl border border-noir-border bg-noir-bg/45 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-[Cinzel] text-base text-text-primary">{profile.name}</div>
          <div className="font-[DM_Mono] text-[10px] uppercase tracking-[0.15em] text-text-muted">
            {profile.hands} hands recorded
          </div>
        </div>
        <div className="rounded-full border border-gold-border/40 bg-gold-primary/10 px-3 py-1 font-[DM_Mono] text-xs text-gold-light">
          {profile.confidenceScore == null ? 'Learning' : `${profile.confidenceScore}%`}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center md:grid-cols-4">
        <MiniStat label="Bluff" value={`${profile.bluffFrequency}%`} />
        <MiniStat label="Overbet" value={`${profile.overbetBluffRate}%`} />
        <MiniStat label="River Bluff" value={`${profile.riverBluffRate}%`} />
        <MiniStat label="Slow Action" value={`${profile.slowActionBluffRate}%`} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Passive" value={`${profile.passivePlayRate}%`} />
        <MiniStat label="Slow Play" value={`${profile.slowPlayFrequency}%`} />
        <MiniStat label="Snap Bluff" value={`${profile.snapActionBluffRate}%`} />
      </div>
      {profile.confidenceLabel && (
        <div className="mt-3 font-[DM_Mono] text-xs text-text-muted">{profile.confidenceLabel}</div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-noir-border bg-noir-card px-2 py-2">
      <div className="font-[DM_Mono] text-[9px] uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className="mt-1 font-[DM_Mono] text-xs text-gold-light">{value}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-noir-border bg-noir-bg/35 p-6 text-center font-[DM_Mono] text-xs text-text-muted">
      {text}
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center rounded-2xl border border-noir-border bg-noir-card/70 p-8 text-center">
      <h2 className="font-[Cinzel] text-2xl text-gold-light">No game data yet</h2>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        Start a game and complete a few audited hands to unlock model readiness,
        training labels, opponent reads, and XGBoost learning charts.
      </p>
      <button
        onClick={onStart}
        className="mt-6 rounded-lg border border-gold-primary/45 bg-gold-primary/10 px-6 py-3 font-[Cinzel] text-sm text-gold-light transition-colors hover:bg-gold-primary/20 cursor-pointer"
      >
        Start Game
      </button>
    </div>
  );
}

function getModelReadiness(trainingStats: TrainingStatsResult | null, profileHands: number): number {
  const dataset = scoreDatasetSize(trainingStats);
  const labels = trainingStats?.labelCoverage ?? 0;
  const streets = scoreStreetCoverage(trainingStats);
  const memory = Math.min(100, profileHands * 8);
  return Math.round(dataset * 0.35 + labels * 0.3 + streets * 0.2 + memory * 0.15);
}

function scoreDatasetSize(trainingStats: TrainingStatsResult | null): number {
  const examples = trainingStats?.trainingExamples ?? 0;
  if (examples <= 0) return 0;
  return Math.min(100, Math.round((examples / 250) * 100));
}

function scoreStreetCoverage(trainingStats: TrainingStatsResult | null): number {
  const streets = new Set((trainingStats?.streetDistribution ?? []).filter(point => point.value > 0).map(point => point.label));
  const covered = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].filter(street => streets.has(street)).length;
  return Math.round((covered / 4) * 100);
}

function getSignalStrength(profiles: DerivedGameStats['profileStats']): number {
  if (profiles.length === 0) return 0;
  const total = profiles.reduce((sum, profile) => {
    const signals = [
      profile.bluffFrequency,
      profile.overbetBluffRate,
      profile.riverBluffRate,
      profile.slowActionBluffRate,
      profile.snapActionBluffRate,
    ];
    const distanceFromUnknown = signals.reduce((innerSum, value) => innerSum + Math.abs(value - 50), 0) / signals.length;
    return sum + Math.min(100, distanceFromUnknown * 4);
  }, 0);
  return Math.round(total / profiles.length);
}
