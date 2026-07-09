import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Auth() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

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
      // Execute Sign Up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        alert(signUpError.error_description || signUpError.message);
      } else if (data?.user) {
        // Auto-populate the profiles table with Step 2 data AND Email
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          name: name,
          age: parseInt(age) || null,
          gender: gender,
          height_cm: parseFloat(height) || null,
          weight_kg: parseFloat(weight) || null,
        });

        // Sign out to maintain the route flow back to Sign In
        await supabase.auth.signOut();
        setIsSigningUp(false);
        setStep(1); // Reset for next time
      }
    } else {
      // Execute Sign In
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

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "400px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "5px" }}>
        {isSigningUp ? "Create an Account" : "Welcome Back"}
      </h2>
      <p
        style={{
          textAlign: "center",
          color: "#666",
          marginBottom: "20px",
          fontSize: "14px",
        }}
      >
        {isSigningUp && step === 1 && "Step 1: Account Details"}
        {isSigningUp && step === 2 && "Step 2: Personalize Your Profile"}
        {!isSigningUp && "Sign in to track your progress"}
      </p>

      <form
        onSubmit={isSigningUp && step === 1 ? handleNextStep : handleAuthAction}
      >
        {/* VIEW: LOGIN OR SIGNUP STEP 1 */}
        {(!isSigningUp || (isSigningUp && step === 1)) && (
          <>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="Secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          </>
        )}

        {/* VIEW: SIGNUP STEP 2 (PROFILE SETUP) */}
        {isSigningUp && step === 2 && (
          <>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Display Name</label>
              <input
                type="text"
                placeholder="How should we call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Age</label>
                <input
                  type="number"
                  placeholder="Years"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={inputStyle}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Height (cm)</label>
                <input
                  type="number"
                  placeholder="e.g. 175"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Weight (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 70"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                ...btnStyle,
                backgroundColor: "#6c757d",
                marginBottom: "10px",
              }}
            >
              Back
            </button>
          </>
        )}

        <button type="submit" disabled={loading} style={btnStyle}>
          {loading
            ? "Processing..."
            : isSigningUp && step === 1
              ? "Next Step"
              : isSigningUp
                ? "Complete Sign Up"
                : "Sign In"}
        </button>
      </form>

      <button onClick={resetMode} style={toggleBtnStyle}>
        {isSigningUp
          ? "Already have an account? Sign In"
          : "Don't have an account? Sign Up"}
      </button>
    </div>
  );
}

// UI Design Styles
const inputGroupStyle = { marginBottom: "15px", flex: 1 };
const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#333",
};
const inputStyle = {
  width: "100%",
  padding: "10px",
  boxSizing: "border-box",
  borderRadius: "6px",
  border: "1px solid #ccc",
  fontSize: "14px",
};
const btnStyle = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "15px",
};
const toggleBtnStyle = {
  width: "100%",
  marginTop: "15px",
  padding: "10px",
  backgroundColor: "transparent",
  color: "#007bff",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "500",
};
