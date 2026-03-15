import type { ConfidenceResult } from '../../types/ai';

interface ConfidenceCardProps {
  confidence: ConfidenceResult;
}

export function ConfidenceCard({ confidence }: ConfidenceCardProps) {
  const { opponentName, score, label, explanation, dataSufficient, handsRecorded, featureBreakdown } = confidence;

  if (!dataSufficient) {
    return (
      <div className="bg-noir-elevated border border-noir-border rounded-md p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-text-muted text-xs">&#9203;</span>
          <span className="font-[Cinzel] text-xs text-text-muted">{opponentName}</span>
        </div>
        <div className="font-[DM_Mono] text-[10px] text-text-muted">
          Insufficient Data &mdash; {handsRecorded}/1 hands recorded
        </div>
        <div className="w-full h-1.5 bg-noir-border rounded-full mt-2">
          <div
            className="h-full bg-text-muted/30 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, handsRecorded * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  // Bluff likelihood = 100 - confidence score
  // Low confidence → high bluff chance → show red
  // High confidence → low bluff chance → show green
  const clampedScore = Math.min(100, Math.max(0, score ?? 50));
  const bluffPercent = 100 - clampedScore;

  // Color: red = high bluff likelihood, amber = mixed, green = likely honest
  const getColor = (bluff: number): string => {
    if (bluff >= 60) return '#DC2626'; // Red — likely bluffing
    if (bluff >= 30) return '#F59E0B'; // Amber — mixed signals
    return '#22C55E'; // Green — likely strong hand
  };

  const color = getColor(bluffPercent);

  // SVG arc calculation (same approach as HandStrengthGauge)
  const totalArcLength = 157;
  const fillLength = (bluffPercent / 100) * totalArcLength;

  return (
    <div className="bg-noir-elevated border border-noir-border rounded-md p-3">
      {/* Name header */}
      <div className="mb-1">
        <span className="font-[Cinzel] text-xs text-text-primary block">{opponentName}</span>
        <span
          className="font-[DM_Mono] text-[10px] font-bold block"
          style={{ color }}
        >
          {label}
        </span>
      </div>

      {/* Percentage Gauge — semicircular arc just like HandStrengthGauge */}
      <div className="flex flex-col items-center">
        <div className="w-28 h-[56px] relative">
          <svg viewBox="0 0 120 65" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 58 A 50 50 0 0 1 110 58"
              fill="none"
              stroke="#2A2A2A"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Color zones (subtle gradient) */}
            <path
              d="M 10 58 A 50 50 0 0 1 110 58"
              fill="none"
              stroke="url(#bluffGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.15"
            />

            {/* Filled arc */}
            <path
              d="M 10 58 A 50 50 0 0 1 110 58"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={totalArcLength}
              strokeDashoffset={totalArcLength - fillLength}
              className="gauge-transition"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="bluffGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center text — big percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
            <span
              className="font-[DM_Mono] text-xl font-bold"
              style={{ color }}
            >
              {Math.round(bluffPercent)}%
            </span>
          </div>
        </div>

        {/* Label under gauge */}
        <span className="font-[DM_Mono] text-[9px] text-text-muted mt-0.5">
          BLUFF LIKELIHOOD
        </span>
      </div>

      {/* Explanation */}
      {explanation && (
        <p className="text-text-muted text-[10px] italic leading-relaxed mt-2 mb-1">
          {explanation}
        </p>
      )}

      {/* Feature Breakdown */}
      {featureBreakdown && Object.keys(featureBreakdown).length > 0 && (
        <div className="space-y-1 border-t border-noir-border pt-2 mt-1">
          {Object.entries(featureBreakdown).map(([feature, info]) => (
            <div key={feature} className="flex items-start gap-1.5">
              <span className="text-[10px] mt-px">
                {info.favoursBluff ? '\u26A0' : '\u2714'}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className="font-[DM_Mono] text-[9px] font-bold"
                  style={{ color: info.favoursBluff ? '#F59E0B' : '#22C55E' }}
                >
                  {feature}
                </span>
                <span className="text-text-muted text-[9px] ml-1">
                  {info.note}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
