import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { subscribeToast } from "../../lib/toast";

const TYPE_META = {
  success: { icon: CheckCircle2, color: "var(--sprout)", bg: "#F5FAF6" },
  error: { icon: XCircle, color: "var(--danger)", bg: "#FDF3F1" },
  info: { icon: Info, color: "var(--ink)", bg: "var(--card)" },
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3800);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(440px, calc(100vw - 32px))",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 2000,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const meta = TYPE_META[t.type] || TYPE_META.info;
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: meta.bg,
              border: `1px solid ${meta.color}`,
              boxShadow: "var(--shadow-press)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--ink)",
              animation: "toast-in 0.2s ease-out",
            }}
          >
            <Icon size={16} color={meta.color} style={{ flexShrink: 0 }} />
            <span>{t.message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
