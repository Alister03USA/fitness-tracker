import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";
import Card from "./Card";
import { registerConfirmHandler } from "../../lib/confirmDialog";

export default function ConfirmHost() {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger, resolve }

  const handle = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  useEffect(() => {
    registerConfirmHandler(handle);
  }, [handle]);

  if (!state) return null;

  const close = (result) => {
    state.resolve(result);
    setState(null);
  };

  return (
    <div
      onClick={() => close(false)}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(36, 31, 26, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2100,
        padding: "20px",
      }}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "320px" }}
        accent={state.danger ? "var(--danger)" : undefined}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          {state.danger && (
            <AlertTriangle
              size={18}
              color="var(--danger)"
              style={{ flexShrink: 0, marginTop: "2px" }}
            />
          )}
          <div>
            {state.title && (
              <h3 style={{ fontSize: "15px", marginBottom: "4px" }}>
                {state.title}
              </h3>
            )}
            <p
              style={{
                fontSize: "13px",
                color: "var(--ink-soft)",
                lineHeight: 1.5,
              }}
            >
              {state.message}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <Button
            variant="secondary"
            fullWidth
            size="sm"
            onClick={() => close(false)}
          >
            {state.cancelLabel || "Cancel"}
          </Button>
          <Button
            variant={state.danger ? "danger" : "primary"}
            fullWidth
            size="sm"
            onClick={() => close(true)}
          >
            {state.confirmLabel || "Confirm"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
