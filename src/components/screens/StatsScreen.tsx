import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend as RechartsLegend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useGameStore } from '../../store/game-store';
import { useAIStore } from '../../store/ai-store';
import { useProfileStore } from '../../store/profile-store';
import { deriveGameStats, type DerivedGameStats } from '../../utils/stats';
import { getTrainingStats } from '../../api/ai-api';
import type { TrainingStatsResult } from '../../types/ai';

type ChartPoint = { label: string; value: number };
type EnhancedChartPoint = { label: string; value: number; labelled?: number };
type RecentBatchPoint = {
  label: string;
  examples: number;
  labelled: number;
  aggressive: number;
};
type FeatureSignal = { feature: string; score: number; note: string };
type RadarPoint = { metric: string; value: number; fullMark: number };
type PiePoint = { label: string; value: number };

const CHART_COLORS = ['#DFC589', '#7FA1D9', '#5F8CCB', '#6FA7B4', '#C8A45B', '#4E6A95'];
const CHART_GRID = 'rgba(155,175,210,.16)';
const CHART_AXIS = 'rgba(130,152,189,.34)';
const CHART_TICK = '#AAB7CF';
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8,13,22,0.95)',
  border: '1px solid rgba(206,177,113,.42)',
  borderRadius: '12px',
  color: '#E6ECF8',
  fontSize: '12px',
};

export function StatsScreen() {
  const navigate = useNavigate();
  const gameState = useGameStore(s => s.gameState);
  const equityHistory = useAIStore(s => s.equityHistory);
  const confidenceScores = useAIStore(s => s.confidenceScores);
  const profiles = useProfileStore(s => s.profiles);
  const [trainingStats, setTrainingStats] = useState<TrainingStatsResult | null>(null);
  const [trainingStatsError, setTrainingStatsError] = useState(false);

  const stats = useMemo<DerivedGameStats>(() => {
    if (gameState) {
      return deriveGameStats(gameState, profiles, confidenceScores, equityHistory);
    }

    return {
      roundsPlayed: 0,
      totalPot: 0,
      averagePot: 0,
      largestPot: 0,
      potTrend: [],
      actionBreakdown: [],
      profileBluffRates: [],
      profileExperience: [],
      confidenceScores: [],
      playerStats: [],
      profileStats: [],
      equityHistory: [],
      recentRounds: [],
    };
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
         style={{
           background: `
             radial-gradient(ellipse at 50% 8%, rgba(224,191,124,.15) 0%, rgba(224,191,124,.05) 25%, transparent 52%),
             radial-gradient(ellipse at 12% 20%, rgba(88,110,154,.12) 0%, transparent 36%),
             radial-gradient(ellipse at 84% 14%, rgba(82,103,145,.1) 0%, transparent 34%),
             radial-gradient(ellipse at center, #1a2232 0%, #101725 48%, #090f18 76%, #060b12 100%)
           `,
         }}>
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

      <StatsContent stats={stats} trainingStats={trainingStats} trainingStatsError={trainingStatsError} />
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
  const learningCurveEnhanced: EnhancedChartPoint[] = (trainingStats?.learningCurve ?? []).map(point => ({
    label: point.label,
    value: point.value,
    labelled: point.labelled ?? 0,
  }));
  const topProfile = stats.profileStats[0] ?? null;
  const topProfileRadar: RadarPoint[] = topProfile ? [
    { metric: 'Bluffing', value: topProfile.bluffFrequency, fullMark: 100 },
    { metric: 'Overbet', value: topProfile.overbetBluffRate, fullMark: 100 },
    { metric: 'River', value: topProfile.riverBluffRate, fullMark: 100 },
    { metric: 'Slow Action', value: topProfile.slowActionBluffRate, fullMark: 100 },
    { metric: 'Snap Action', value: topProfile.snapActionBluffRate, fullMark: 100 },
    { metric: 'Passive', value: topProfile.passivePlayRate, fullMark: 100 },
  ] : [];
  const featureSignals: FeatureSignal[] = [
    {
      feature: 'Bet Sizing Bayesian Signal',
      score: Math.round(
        stats.profileStats.length > 0
          ? stats.profileStats.reduce((sum, profile) => sum + profile.overbetBluffRate, 0) / stats.profileStats.length
          : 0
      ),
      note: 'P(bluff | sizing) from confidence model',
    },
    {
      feature: 'Street Coverage (PREFLOP-RIVER)',
      score: scoreStreetCoverage(trainingStats),
      note: 'XGBoost learns better with full-street examples',
    },
    {
      feature: 'Action Label Supervision',
      score: trainingStats?.labelCoverage ?? 0,
      note: 'Audit tags: BLUFF / VALUE / SLOW_PLAY / PASSIVE',
    },
    {
      feature: 'Opponent Memory Bank',
      score: Math.min(100, totalProfileHands * 8),
      note: 'Profile history used for adaptive exploitation',
    },
    {
      feature: 'Confidence Model Signal Strength',
      score: signalStrength,
      note: 'Distance from unknown priors across features',
    },
  ];
  const momentum = learningCurveEnhanced.length > 1
    ? learningCurveEnhanced[learningCurveEnhanced.length - 1].value - learningCurveEnhanced[0].value
    : learningCurveEnhanced[0]?.value ?? 0;
  const tagPieData: PiePoint[] = trainingStats?.tagDistribution ?? [];
  const actionPieData: PiePoint[] = trainingStats?.actionDistribution ?? [];

  return (
    <main className="mx-auto grid max-w-7xl gap-4">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-3xl border border-gold-border/35 bg-gradient-to-br from-[#1d2738] via-[#141d2c] to-[#0d131f] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.48)]">
          <div className="pointer-events-none absolute inset-0 opacity-70"
               style={{ background: 'radial-gradient(circle at 18% 0%, rgba(201,168,76,.2), transparent 32%), radial-gradient(circle at 92% 20%, rgba(108,136,201,.16), transparent 30%)' }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-light/70 to-transparent" />
          <div className="relative">
            <div>
              <StatusPill label={trainingStatsError ? 'Backend offline' : 'Live training feed'} tone={trainingStatsError ? 'warn' : 'ready'} />
              <h2 className="mt-2 font-[Cinzel] text-3xl text-gold-light">
                Model Readiness
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                Judge view: this dashboard shows training quality, Bayesian confidence features,
                and opponent adaptation signals used by the poker AI stack.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="Readiness" value={`${readiness}%`} sub="overall score" />
                <MetricCard label="Examples" value={(trainingStats?.trainingExamples ?? 0).toLocaleString()} sub="model rows" />
                <MetricCard label="Coverage" value={`${trainingStats?.labelCoverage ?? 0}%`} sub="labelled data" />
                <MetricCard label="Signals" value={`${signalStrength}%`} sub="opponent reads" />
              </div>
              <ReadinessDial readiness={readiness} />
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
        <Panel title="AI Algorithm Signals" subtitle="What powers bluff detection and adaptation">
          <AlgorithmSignalBoard data={featureSignals} />
        </Panel>
        <Panel title="Recent Learning Trend" subtitle="Training + audit throughput by round">
          <RecentBatchGraph data={recentLearningBatches} emptyText="Recent training batches appear after audited hands." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Learning Curve" subtitle="Cumulative examples and supervised labels">
          {trainingStatsError ? (
            <EmptyPanel text="Start the Python backend to read local SQLite training stats." />
          ) : (
            <LineChart data={learningCurveEnhanced} emptyText="Audited hands will create model training examples." />
          )}
          <div className="mt-3 rounded-xl border border-noir-border/80 bg-[#0b1320]/55 px-3 py-2 font-[DM_Mono] text-xs text-text-muted">
            Training momentum: <span className="text-gold-light">{momentum >= 0 ? '+' : ''}{momentum} examples</span> over the visible rounds.
          </div>
        </Panel>
        <Panel title="Label Quality" subtitle="Audit tags that supervise the model">
          <DonutChart data={tagPieData} emptyText="No audited labels recorded yet." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Decision Target Balance" subtitle="Fold, call, raise, and all-in examples">
          <DonutChart data={actionPieData} emptyText="Action targets appear after audited hands." />
        </Panel>
        <Panel title="Street Coverage" subtitle="Does training data cover the full hand?">
          <BarChart data={trainingStats?.streetDistribution ?? []} emptyText="No street-level examples recorded yet." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Opponent Model Maturity" subtitle="How much memory each opponent profile has">
          <BarChart data={profileMaturity} emptyText="Opponent profiles build after completed hands." />
        </Panel>
        <Panel title="Top Opponent Radar" subtitle="High-level personality fingerprint">
          <TopProfileRadar
            profileName={topProfile?.name ?? null}
            data={topProfileRadar}
            emptyText="Play more rounds to build a radar profile."
          />
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
          <ExploitabilityChart data={exploitabilitySignals} emptyText="Behavioral signals appear after profiles update." />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Advisor Equity Signal" subtitle="Monte Carlo equity trace from in-game calls">
          <LineChart data={stats.equityHistory} valueSuffix="%" maxValue={100} emptyText="Equity appears after AI scoring runs." />
        </Panel>
        <Panel title="Live Bluff Confidence" subtitle="Current read strength by opponent">
          <BarChart data={stats.confidenceScores} emptyText="Confidence reads appear when opponents bet or raise." />
        </Panel>
      </section>

    </main>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gold-border/25 bg-[#121b2a]/90 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5">
      <div className="font-[DM_Mono] text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="mt-2 font-[Cinzel] text-2xl text-gold-light">{value}</div>
      {sub && <div className="mt-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.14em] text-text-muted">{sub}</div>}
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'ready' | 'warn' }) {
  const color = tone === 'ready' ? '#7FD08A' : '#E8B45F';
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gold-border/35 bg-[#0b1320]/65 px-3 py-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.2em] text-text-muted">
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
          className="h-full rounded-full bg-gradient-to-r from-[#4f658f] via-[#7d9fd8] to-[#dcc283]"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
      <div className="mt-1 font-[DM_Mono] text-[10px] text-text-muted">{detail}</div>
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
    <section className="rounded-2xl border border-noir-border/85 bg-[#111a2a]/74 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.4)]">
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
  data: EnhancedChartPoint[];
  maxValue?: number;
  valueSuffix?: string;
  emptyText: string;
}) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;
  const last = data[data.length - 1];
  const hasLabelled = data.some(point => point.labelled != null);

  return (
    <div>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="examplesFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#E8D5A3" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#E8D5A3" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={{ fill: CHART_TICK, fontSize: 11 }} axisLine={{ stroke: CHART_AXIS }} />
            <YAxis
              tick={{ fill: CHART_TICK, fontSize: 11 }}
              axisLine={{ stroke: CHART_AXIS }}
              domain={maxValue ? [0, maxValue] : ['auto', 'auto']}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(232,213,163,.28)' }} />
            <RechartsLegend wrapperStyle={{ fontSize: '11px', color: CHART_TICK }} />
            <Area type="monotone" dataKey="value" name="Examples" stroke="#E8D5A3" strokeWidth={2.6} fill="url(#examplesFill)" />
            {hasLabelled && (
              <Line type="monotone" dataKey="labelled" name="Labelled" stroke="#7DA8FF" strokeWidth={2.1} dot={false} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="font-[DM_Mono] text-xs text-text-muted">
        Latest: <span className="text-gold-light">{Math.round(last.value).toLocaleString()}{valueSuffix}</span>
        {hasLabelled && last.labelled != null && (
          <span> · Labelled <span className="text-gold-light">{Math.round(last.labelled).toLocaleString()}</span></span>
        )}
      </div>
    </div>
  );
}

function BarChart({ data, emptyText }: { data: ChartPoint[]; emptyText: string }) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 4" />
          <XAxis type="number" tick={{ fill: CHART_TICK, fontSize: 11 }} axisLine={{ stroke: CHART_AXIS }} />
          <YAxis
            type="category"
            dataKey="label"
            width={95}
            tick={{ fill: CHART_TICK, fontSize: 11 }}
            axisLine={{ stroke: CHART_AXIS }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(232,213,163,0.05)' }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {data.map((point, index) => (
              <Cell key={point.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
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
  const latest = data[data.length - 1];

  return (
    <div>
      <div className="h-64 w-full rounded-2xl border border-noir-border/80 bg-[#0b1320]/55 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={{ fill: CHART_TICK, fontSize: 11 }} axisLine={{ stroke: CHART_AXIS }} />
            <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} axisLine={{ stroke: CHART_AXIS }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="examples" stroke="#E8D5A3" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="labelled" stroke="#A9B8FF" strokeWidth={2.3} dot={false} />
            <Bar dataKey="aggressive" fill="#F0A28E" radius={[6, 6, 0, 0]} barSize={18} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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

function DonutChart({ data, emptyText }: { data: PiePoint[]; emptyText: string }) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;
  const total = data.reduce((sum, point) => sum + point.value, 0);

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={96}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <RechartsLegend
              wrapperStyle={{ fontSize: '11px', color: CHART_TICK }}
              formatter={(value) => <span className="text-text-secondary">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="font-[DM_Mono] text-xs text-text-muted">
        Total labelled points: <span className="text-gold-light">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ExploitabilityChart({ data, emptyText }: { data: ChartPoint[]; emptyText: string }) {
  if (data.length === 0) return <EmptyPanel text={emptyText} />;

  const cleaned = data.map(point => ({
    ...point,
    shortLabel: point.label.length > 18 ? `${point.label.slice(0, 18)}...` : point.label,
  }));

  return (
    <div className="h-80 w-full rounded-2xl border border-noir-border/80 bg-[#0b1320]/55 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={cleaned} layout="vertical" margin={{ left: 18, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 4" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: CHART_TICK, fontSize: 11 }}
            axisLine={{ stroke: CHART_AXIS }}
          />
          <YAxis
            type="category"
            dataKey="shortLabel"
            width={140}
            tick={{ fill: CHART_TICK, fontSize: 11 }}
            axisLine={{ stroke: CHART_AXIS }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(232,213,163,0.05)' }}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {cleaned.map((point, index) => (
              <Cell key={point.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-noir-border/80 bg-[#0b1320]/58 px-3 py-1 font-[DM_Mono] text-[10px] uppercase tracking-[0.14em] text-text-muted">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ReadinessDial({ readiness }: { readiness: number }) {
  const safe = Math.max(0, Math.min(100, readiness));
  const data = [
    { name: 'Readiness', value: safe },
    { name: 'Remaining', value: 100 - safe },
  ];

  return (
    <div className="flex min-w-40 flex-col items-center justify-center rounded-2xl border border-gold-border/30 bg-[#0b1320]/55 p-3">
      <div className="h-24 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              innerRadius={28}
              outerRadius={42}
              stroke="none"
            >
              <Cell fill="#E8D5A3" />
              <Cell fill="rgba(255,255,255,0.1)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-14 font-[Cinzel] text-2xl text-gold-light">{safe}%</div>
      <div className="mt-6 font-[DM_Mono] text-[10px] uppercase tracking-[0.14em] text-text-muted">Readiness Dial</div>
    </div>
  );
}

function AlgorithmSignalBoard({ data }: { data: FeatureSignal[] }) {
  return (
    <div className="space-y-3">
      {data.map((signal) => (
        <div key={signal.feature} className="rounded-xl border border-noir-border/80 bg-[#0b1320]/55 p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="font-[DM_Mono] text-xs text-text-secondary">{signal.feature}</div>
            <div className="font-[DM_Mono] text-xs text-gold-light">{signal.score}%</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-noir-card">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4f658f] via-[#7d9fd8] to-[#dcc283]"
              style={{ width: `${Math.max(6, signal.score)}%` }}
            />
          </div>
          <div className="mt-1 font-[DM_Mono] text-[10px] text-text-muted">{signal.note}</div>
        </div>
      ))}
    </div>
  );
}

function TopProfileRadar({
  profileName,
  data,
  emptyText,
}: {
  profileName: string | null;
  data: RadarPoint[];
  emptyText: string;
}) {
  if (!profileName || data.length === 0) return <EmptyPanel text={emptyText} />;

  return (
    <div>
      <div className="mb-2 font-[DM_Mono] text-xs text-text-muted">
        Profile focus: <span className="text-gold-light">{profileName}</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(255,255,255,.14)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#B8B0A0', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Radar dataKey="value" stroke="#E8D5A3" fill="#E8D5A3" fillOpacity={0.32} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: DerivedGameStats['profileStats'][number] }) {
  return (
    <div className="rounded-xl border border-noir-border/80 bg-[#0b1320]/58 p-4">
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
    <div className="rounded-lg border border-noir-border/80 bg-[#111a2a] px-2 py-2">
      <div className="font-[DM_Mono] text-[9px] uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className="mt-1 font-[DM_Mono] text-xs text-gold-light">{value}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-noir-border/90 bg-[#0b1320]/5 p-6 text-center font-[DM_Mono] text-xs text-text-muted">
      {text}
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
