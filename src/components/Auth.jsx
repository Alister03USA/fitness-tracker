import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Auth() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const validatePassword = (password) => {
    // Min 8 characters, at least one uppercase, one lowercase, one special character
    const re =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    return re.test(password);
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();

    if (isSigningUp) {
      // Sign Up Logic
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
    }

    setLoading(true);

    let error;
    if (isSigningUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      error = signUpError;
      if (!error) {
        alert(
          "Sign up successful! Please check your email to confirm your account, then you can log in.",
        );
        // Switch to the login view after successful signup
        setIsSigningUp(false);
      }
    } else {
      // Sign In Logic
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = signInError;
    }

    if (error) {
      alert(error.error_description || error.message);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ textAlign: "center" }}>
        {isSigningUp ? "Create an Account" : "Fitness Tracker Login"}
      </h2>
      <p style={{ textAlign: "center" }}>
        {isSigningUp
          ? "Join us to track your fitness journey!"
          : "Sign in to continue"}
      </p>
      <form onSubmit={handleAuthAction}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {loading ? "Loading..." : isSigningUp ? "Sign Up" : "Sign In"}
        </button>
      </form>
      <button
        onClick={() => setIsSigningUp(!isSigningUp)}
        style={{
          width: "100%",
          marginTop: "10px",
          padding: "10px",
          backgroundColor: "transparent",
          color: "#007bff",
          border: "none",
          cursor: "pointer",
        }}
      >
        {isSigningUp
          ? "Already have an account? Sign In"
          : "Don't have an account? Sign Up"}
      </button>
    </div>
  );
}
