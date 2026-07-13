import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "../supabaseClient";
import Button from "./ui/Button";
import Card from "./ui/Card";

const validatePassword = (password) => {
  const re =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return re.test(password);
};

export default function ResetPasswordScreen({ onDone }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword(newPassword)) {
      alert(
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      alert("Failed to update password: " + error.message);
      return;
    }

    alert("Password updated!! You're signed in.");
    onDone();
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        backgroundColor: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "var(--ember-soft)",
              color: "var(--ember)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <KeyRound size={22} />
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "26px",
              marginBottom: "6px",
            }}
          >
            Set a new password
          </h2>
          <p style={{ color: "var(--ink-soft)", fontSize: "14px" }}>
            Choose a new password for your account.
          </p>
        </div>

        <Card>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                placeholder="Secure password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--ink)",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  fontSize: "14px",
  backgroundColor: "var(--card)",
  color: "var(--ink)",
};
