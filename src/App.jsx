import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import FoodLogger from "./components/FoodLogger";
import SocialFeed from "./components/SocialFeed";
import Profile from "./components/Profile";
import Chat from "./components/Chat";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [userStats, setUserStats] = useState({
    stepGoal: 10000,
    steps: 7420,
    calorieGoal: 2200,
    caloriesConsumed: 0,
  });

  const handleUpdateGoals = (newCalorieGoal, newAvatarUrl) => {
    setUserStats((prev) => ({ ...prev, calorieGoal: newCalorieGoal }));
    if (newAvatarUrl) setAvatarUrl(newAvatarUrl);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

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

  // Filter logs explicitly for the current calendar day to reset stats at midnight
  const fetchTodayLogs = useCallback(async () => {
    if (!session?.user?.id) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("logs")
      .select("calories")
      .eq("user_id", session.user.id)
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    if (!error && data) {
      const total = data.reduce((sum, item) => sum + (item.calories || 0), 0);
      setUserStats((prev) => ({ ...prev, caloriesConsumed: total }));
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchTodayLogs();
    }
  }, [session, fetchTodayLogs]);

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
        position: "relative",
      }}
    >
      <header
        style={{
          padding: "12px 15px",
          backgroundColor: "#333",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="User Avatar"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}
          <h1 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>
            Fitness Tracker
          </h1>
        </div>
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

      <div style={{ flex: 1, color: "#333", overflowY: "auto" }}>
        {activeTab === "dashboard" && <Dashboard userStats={userStats} />}
        {activeTab === "log" && <FoodLogger onAddMeal={handleAddMeal} />}
        {activeTab === "feed" && <SocialFeed session={session} />}
        {activeTab === "chat" && <Chat session={session} />}
        {activeTab === "profile" && (
          <Profile session={session} onUpdateGoals={handleUpdateGoals} />
        )}
      </div>

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
          Home
        </button>
        <button
          onClick={() => setActiveTab("log")}
          style={navBtnStyle(activeTab === "log")}
        >
          Log
        </button>
        <button
          onClick={() => setActiveTab("feed")}
          style={navBtnStyle(activeTab === "feed")}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          style={navBtnStyle(activeTab === "chat")}
        >
          Chat
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
  padding: "12px 5px",
  border: "none",
  backgroundColor: isActive ? "#007bff" : "#fff",
  color: isActive ? "#fff" : "#333",
  fontWeight: "bold",
  fontSize: "13px",
  cursor: "pointer",
});
