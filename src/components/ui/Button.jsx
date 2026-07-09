import React from "react";

/**
 * Shared button primitive.
 * variant: "primary" | "secondary" | "ghost" | "danger"
 * size: "md" | "sm"
 */
export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  style,
  ...props
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 600,
    borderRadius: "var(--radius-md)",
    cursor: props.disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    transition: "transform 0.1s ease, opacity 0.15s ease",
    opacity: props.disabled ? 0.6 : 1,
    width: fullWidth ? "100%" : "auto",
    fontSize: size === "sm" ? "13px" : "15px",
    padding: size === "sm" ? "8px 14px" : "13px 20px",
  };

  const variants = {
    primary: {
      backgroundColor: "var(--ember)",
      color: "#fff",
    },
    secondary: {
      backgroundColor: "var(--card)",
      color: "var(--ink)",
      border: "1px solid var(--line)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--ember)",
    },
    danger: {
      backgroundColor: "var(--danger-soft)",
      color: "var(--danger)",
    },
  };

  return (
    <button
      {...props}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}
