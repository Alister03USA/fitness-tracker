import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import FoodLogger from "./components/FoodLogger";
import SocialFeed from "./components/SocialFeed";
import Profile from "./components/Profile";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [userStats, setUserStats] = useState({
    stepGoal: 10000,
    steps: 7420,
    calorieGoal: 2200,
    caloriesConsumed: 0,
  });

  const handleUpdateGoals = (newCalorieGoal) => {
    setUserStats((prev) => ({ ...prev, calorieGoal: newCalorieGoal }));
  };

  // 1. Force logout on load if you want Sign In to be default, OR check active session cleanly
  useEffect(() => {
    // Force sign out on fresh page loads so the Sign In page is ALWAYS the default starting view:
    supabase.auth.signOut().then(() => {
      setSession(null);
      setLoading(false);
    });

    // Listen for login / logout auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 2. Fetch logged calories from Supabase cloud when user is logged in
  const fetchTodayLogs = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("logs")
      .select("calories")
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Error fetching today's logs:", error);
    } else if (data) {
      const total = data.reduce((sum, item) => sum + (item.calories || 0), 0);
      setUserStats((prev) => ({ ...prev, caloriesConsumed: total }));
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchTodayLogs();
    }
  }, [session, fetchTodayLogs]);

  // 3. Save meal log to Supabase
  const handleAddMeal = useCallback(
    async (meal) => {
      if (!session?.user?.id) return;

      const { error } = await supabase.from("logs").insert([
        {
          user_id: session.user.id,
          food_name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          fiber: meal.fiber,
          sugar: meal.sugar,
          sodium: meal.sodium,
        },
      ]);

      if (error) {
        alert("Failed to save log to database: " + error.message);
      } else {
        fetchTodayLogs();
      }
    },
    [session, fetchTodayLogs],
  );

  // Show quick loading text while verifying auth status
  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          fontFamily: "sans-serif",
        }}
      >
        Loading Fitness Tracker...
      </div>
    );
  }

  // Render Sign In screen as default if no session
  if (!session) {
    return <Auth />;
  }

  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        border: "1px solid #ccc",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          padding: "15px",
          backgroundColor: "#333",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>
          Fitness Tracker
        </h1>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            padding: "6px 12px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </header>

      {/* Main Screen Content */}
      <div style={{ flex: 1, color: "#333" }}>
        {activeTab === "dashboard" && <Dashboard userStats={userStats} />}
        {activeTab === "log" && <FoodLogger onAddMeal={handleAddMeal} />}
        {activeTab === "feed" && <SocialFeed />}
        {activeTab === "profile" && (
          <Profile session={session} onUpdateGoals={handleUpdateGoals} />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav
        style={{
          display: "flex",
          borderTop: "1px solid #ccc",
          backgroundColor: "#fff",
        }}
      >
        <button
          onClick={() => setActiveTab("dashboard")}
          style={navBtnStyle(activeTab === "dashboard")}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("log")}
          style={navBtnStyle(activeTab === "log")}
        >
          Log Food
        </button>
        <button
          onClick={() => setActiveTab("feed")}
          style={navBtnStyle(activeTab === "feed")}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          style={navBtnStyle(activeTab === "profile")}
        >
          Profile
        </button>
      </nav>
    </div>
  );
}

const navBtnStyle = (isActive) => ({
  flex: 1,
  padding: "15px",
  border: "none",
  backgroundColor: isActive ? "#007bff" : "#fff",
  color: isActive ? "#fff" : "#333",
  fontWeight: "bold",
  cursor: "pointer",
});
