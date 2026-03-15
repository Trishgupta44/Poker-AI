interface BluffGaugeProps {
  bluffPercent: number | null;
  opponentName: string | null;
}

export function BluffGauge({ bluffPercent, opponentName }: BluffGaugeProps) {
  if (bluffPercent === null) {
    return (
      <div className="flex flex-col items-center py-4">
        <div className="w-32 h-16 relative">
          <svg viewBox="0 0 120 60" className="w-full h-full">
            <path
              d="M 10 55 A 50 50 0 0 1 110 55"
              fill="none"
              stroke="#2A2A2A"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="font-[DM_Mono] text-text-muted text-xs mt-1">Waiting...</span>
      </div>
    );
  }

  const clamped = Math.min(100, Math.max(0, bluffPercent));

  // SVG arc calculation (same geometry as HandStrengthGauge)
  const totalArcLength = 157;
  const fillLength = (clamped / 100) * totalArcLength;

  // Color: red = high bluff likelihood, amber = mixed, green = likely honest
  const getColor = (bluff: number): string => {
    if (bluff >= 60) return '#DC2626'; // Red — likely bluffing
    if (bluff >= 30) return '#F59E0B'; // Amber — mixed signals
    return '#22C55E'; // Green — likely strong hand
  };

  const color = getColor(clamped);

  return (
    <div className="flex flex-col items-center">
      <div className="w-36 h-[72px] relative">
        <svg viewBox="0 0 120 65" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 58 A 50 50 0 0 1 110 58"
            fill="none"
            stroke="#2A2A2A"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Color zones (subtle) — green to red (reversed from hand strength) */}
          <path
            d="M 10 58 A 50 50 0 0 1 110 58"
            fill="none"
            stroke="url(#bluffGaugeGradient)"
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

          {/* Gradient definition — green → amber → red */}
          <defs>
            <linearGradient id="bluffGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span
            className="font-[DM_Mono] text-2xl font-bold"
            style={{ color }}
          >
            {Math.round(clamped)}%
          </span>
        </div>
      </div>

      {/* Opponent name label */}
      {opponentName && (
        <span className="font-[DM_Mono] text-[10px] text-text-muted mt-0.5 truncate max-w-full">
          {opponentName}
        </span>
      )}
    </div>
  );
}
