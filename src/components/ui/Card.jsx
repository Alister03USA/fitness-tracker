import React from "react";

/**
 * Shared card surface. Pass `accent` (a CSS color) to give the card
 * a colored top border — used sparingly for "this card is the payoff" moments
 * (e.g. the BMR/TDEE card, the AI scan hero card).
 */
export default function Card({ children, accent, style, ...props }) {
  return (
    <div
      {...props}
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--line)",
        borderTop: accent ? `3px solid ${accent}` : "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
