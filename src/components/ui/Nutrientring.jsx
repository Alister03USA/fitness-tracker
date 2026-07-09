import React from "react";

/**
 * The app's signature visual: three concentric rings (protein / carbs / fat)
 * wrapped around the calorie number. Each ring's fill = consumed/goal, clamped to 100%.
 *
 * rings: [{ label, color, consumed, goal }] - outer to inner order in the array
 * centerLabel / centerValue: the big number shown in the middle (usually calories remaining)
 */
export default function NutrientRing({
  rings,
  centerValue,
  centerLabel,
  size = 168,
}) {
  const strokeWidth = 10;
  const gap = 4;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {rings.map((ring, i) => {
          const r = cx - strokeWidth / 2 - i * (strokeWidth + gap);
          const circumference = 2 * Math.PI * r;
          const pct = Math.min(
            ring.goal ? ring.consumed / ring.goal : 0,
            1,
          );
          return (
            <g key={ring.label}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="var(--line)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct)}
                style={{
                  transition: "stroke-dashoffset 0.6s ease-out",
                }}
              />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="stat-number" style={{ fontSize: "28px", lineHeight: 1 }}>
          {centerValue}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: "var(--ink-soft)",
            marginTop: "4px",
            fontWeight: 500,
          }}
        >
          {centerLabel}
        </span>
      </div>
    </div>
  );
}