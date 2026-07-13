import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import Button from "./ui/Button";
import Card from "./ui/Card";

export default function Auth() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Step 1 State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 State (Profile Details)
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const validatePassword = (password) => {
    const re =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    return re.test(password);
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!validatePassword(password)) {
      alert(
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      );
      return;
    }
    setStep(2);
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isSigningUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        alert(signUpError.error_description || signUpError.message);
      } else if (data?.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          name: name,
          age: parseInt(age) || null,
          gender: gender,
          height_cm: parseFloat(height) || null,
          weight_kg: parseFloat(weight) || null,
        });

        await supabase.auth.signOut();
        setIsSigningUp(false);
        setStep(1);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        alert(signInError.error_description || signInError.message);
      }
    }

    setLoading(false);
  };

  const resetMode = () => {
    setIsSigningUp(!isSigningUp);
    setStep(1);
  };

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      alert(error.message);
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  };

  const backToSignIn = () => {
    setShowForgotPassword(false);
    setResetSent(false);
    setResetEmail("");
  };

  if (showForgotPassword) {
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
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "26px",
                marginBottom: "6px",
              }}
            >
              Reset your password
            </h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "14px" }}>
              {resetSent
                ? "Check your inbox for a reset link."
                : "We'll email you a link to set a new password."}
            </p>
          </div>

          <Card>
            {resetSent ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <p style={{ fontSize: "14px", color: "var(--ink)", marginBottom: "16px" }}>
                  Sent to <strong>{resetEmail}</strong>. Click the link in that email — it'll
                  bring you back here to set a new password.
                </p>
                <Button variant="secondary" fullWidth onClick={backToSignIn}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleSendResetLink}
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <Field label="Email">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Button type="submit" fullWidth disabled={resetLoading}>
                  {resetLoading ? "Sending..." : "Send reset link"}
                </Button>
                <Button type="button" variant="ghost" fullWidth onClick={backToSignIn}>
                  Back to sign in
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    );
  }

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
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "26px",
              marginBottom: "6px",
            }}
          >
            {isSigningUp ? "Create an account" : "Welcome back"}
          </h2>
          <p style={{ color: "var(--ink-soft)", fontSize: "14px" }}>
            {isSigningUp && step === 1 && "Step 1 of 2 — account details"}
            {isSigningUp &&
              step === 2 &&
              "Step 2 of 2 — personalize your profile"}
            {!isSigningUp && "Sign in to track your progress"}
          </p>

          {isSigningUp && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "6px",
                marginTop: "12px",
              }}
            >
              <span style={dotStyle(true)} />
              <span style={dotStyle(step === 2)} />
            </div>
          )}
        </div>

        <Card>
          <form
            onSubmit={
              isSigningUp && step === 1 ? handleNextStep : handleAuthAction
            }
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {(!isSigningUp || (isSigningUp && step === 1)) && (
              <>
                <Field label="Email">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    placeholder="Secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
              </>
            )}

            {isSigningUp && step === 2 && (
              <>
                <Field label="Display name">
                  <input
                    type="text"
                    placeholder="How should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Field label="Age" style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Years"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Gender" style={{ flex: 1 }}>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Field label="Height (cm)" style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="e.g. 175"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Weight (kg)" style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="e.g. 70"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
              </>
            )}

            <Button type="submit" fullWidth disabled={loading}>
              {loading
                ? "Processing..."
                : isSigningUp && step === 1
                  ? "Next step"
                  : isSigningUp
                    ? "Complete sign up"
                    : "Sign in"}
            </Button>
          </form>
        </Card>

        {!isSigningUp && (
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setShowForgotPassword(true)}
            style={{ marginTop: "10px" }}
          >
            Forgot password?
          </Button>
        )}

        <Button
          variant="ghost"
          fullWidth
          onClick={resetMode}
          style={{ marginTop: "4px" }}
        >
          {isSigningUp
            ? "Already have an account? Sign in"
            : "Don't have an account? Sign up"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const dotStyle = (filled) => ({
  width: "22px",
  height: "4px",
  borderRadius: "var(--radius-full)",
  backgroundColor: filled ? "var(--ember)" : "var(--line)",
});

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