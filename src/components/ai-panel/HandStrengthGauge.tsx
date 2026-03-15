interface HandStrengthGaugeProps {
  equity: number | null;
  category: string | null;
}

export function HandStrengthGauge({ equity, category }: HandStrengthGaugeProps) {
  if (equity === null) {
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

  const clampedEquity = Math.min(100, Math.max(0, equity));

  // SVG arc calculation
  // Arc goes from 180 to 0 degrees (left to right semicircle)
  const totalArcLength = 157; // Approximate arc length for the path
  const fillLength = (clampedEquity / 100) * totalArcLength;

  // Color based on equity
  const getColor = (eq: number): string => {
    if (eq >= 65) return '#22C55E'; // Green
    if (eq >= 40) return '#F59E0B'; // Amber
    return '#DC2626'; // Red
  };

  const color = getColor(clampedEquity);

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

          {/* Color zones (subtle) */}
          <path
            d="M 10 58 A 50 50 0 0 1 110 58"
            fill="none"
            stroke="url(#gaugeGradient)"
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
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span
            className="font-[DM_Mono] text-2xl font-bold"
            style={{ color }}
          >
            {Math.round(clampedEquity)}%
          </span>
        </div>
      </div>

      {/* Category label */}
      {category && (
        <span className="font-[DM_Mono] text-[10px] text-text-muted mt-0.5">
          {category}
        </span>
      )}
    </div>
  );
}
