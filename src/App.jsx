import React, { useState, useEffect, useCallback } from "react";
import {
  Home,
  PlusCircle,
  Users,
  MessageCircle,
  User,
  LogOut,
  UtensilsCrossed,
  Activity,
  Bell,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { showToast } from "./lib/toast";
import Auth from "./components/Auth";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
import ToastHost from "./components/ui/Toasthost";
import ConfirmHost from "./components/ui/Confirmhost";
import Dashboard from "./components/Dashboard";
import FoodLogger from "./components/FoodLogger";
import ExerciseLogger from "./components/ExerciseLogger";
import FoodHistory from "./components/FoodHistory";
import SocialFeed from "./components/SocialFeed";
import Profile from "./components/Profile";
import Chat from "./components/Chat";

const NAV_ITEMS = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "log", label: "Log", icon: PlusCircle, isPrimary: true },
  { key: "feed", label: "Feed", icon: Users },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "profile", label: "Profile", icon: User },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [logMode, setLogMode] = useState("meal"); // "meal" | "exercise"
  const [avatarUrl, setAvatarUrl] = useState("");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifTrigger, setNotifTrigger] = useState(0);

  const [userStats, setUserStats] = useState({
    stepGoal: 10000,
    steps: 0,
    calorieGoal: 2200,
    caloriesConsumed: 0,
    // Standard macro split (30% protein / 40% carbs / 30% fat) derived from
    // the calorie goal, expressed in grams (protein/carbs = 4 kcal/g, fat = 9 kcal/g)
    proteinGoal: Math.round((2200 * 0.3) / 4),
    carbsGoal: Math.round((2200 * 0.4) / 4),
    fatGoal: Math.round((2200 * 0.3) / 9),
    proteinConsumed: 0,
    carbsConsumed: 0,
    fatConsumed: 0,
  });

  const [todayLogs, setTodayLogs] = useState([]);
  const [todayWorkouts, setTodayWorkouts] = useState([]);

  // Local YYYY-MM-DD (not UTC) so a workout logged at 11pm doesn't roll into tomorrow
  const todayDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
  };

  const handleUpdateGoals = (newCalorieGoal, newAvatarUrl) => {
    setUserStats((prev) => ({
      ...prev,
      calorieGoal: newCalorieGoal,
      proteinGoal: Math.round((newCalorieGoal * 0.3) / 4),
      carbsGoal: Math.round((newCalorieGoal * 0.4) / 4),
      fatGoal: Math.round((newCalorieGoal * 0.3) / 9),
    }));
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
      if (_event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Filter logs explicitly for the current calendar day to reset stats at midnight
  const fetchTodayLogs = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("logs")
      .select("id, food_name, calories, protein, carbs, fat, created_at")
      .eq("user_id", session.user.id)
      .eq("log_date", todayDateString())
      .order("created_at", { ascending: false });

    if (!error && data) {
      const totals = data.reduce(
        (sum, item) => ({
          calories: sum.calories + (item.calories || 0),
          protein: sum.protein + (item.protein || 0),
          carbs: sum.carbs + (item.carbs || 0),
          fat: sum.fat + (item.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

      setUserStats((prev) => ({
        ...prev,
        caloriesConsumed: totals.calories,
        proteinConsumed: totals.protein,
        carbsConsumed: totals.carbs,
        fatConsumed: totals.fat,
      }));
      setTodayLogs(data);
    }
  }, [session]);

  const fetchTodaySteps = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("daily_steps")
      .select("steps")
      .eq("user_id", session.user.id)
      .eq("log_date", todayDateString())
      .maybeSingle();

    setUserStats((prev) => ({ ...prev, steps: data?.steps || 0 }));
  }, [session]);

  const fetchTodayWorkouts = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("workouts")
      .select("id, name, calories_burned, duration_minutes, created_at")
      .eq("user_id", session.user.id)
      .eq("workout_date", todayDateString())
      .order("created_at", { ascending: false });

    setTodayWorkouts(data || []);
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchTodayLogs();
      fetchTodaySteps();
      fetchTodayWorkouts();
    }
  }, [session, fetchTodayLogs, fetchTodaySteps, fetchTodayWorkouts]);

  // Notification bell — lives at the App level (not inside SocialFeed) so the
  // unread badge and a toast for new activity show up no matter which tab
  // you're on, instead of being hidden until you happen to open Feed.
  const fetchUnreadNotifCount = useCallback(async () => {
    if (!session?.user?.id) return;

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("is_read", false);

    setUnreadNotifCount(count || 0);
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetchUnreadNotifCount();

    const channel = supabase
      .channel("app-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        async (payload) => {
          setUnreadNotifCount((prev) => prev + 1);

          const { data } = await supabase
            .from("notifications")
            .select("message, actor:profiles!notifications_actor_id_fkey(name)")
            .eq("id", payload.new.id)
            .single();

          showToast(
            `${data?.actor?.name || "Someone"} ${data?.message || "sent you a notification."}`,
            "info",
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchUnreadNotifCount]);

  const handleOpenNotifications = () => {
    setActiveTab("feed");
    setNotifTrigger((prev) => prev + 1);
    setUnreadNotifCount(0);
  };

  // --- Daily reminder ---------------------------------------------------
  // IMPORTANT LIMITATION: this only fires while the app is open in a
  // browser tab (foreground or background). There is no backend here to
  // push a notification if the app/browser is fully closed — that needs a
  // service worker + Web Push subscription + a server-side scheduler
  // (see README for the full path). This is the honest, "works right now
  // with no new infrastructure" version: a client-side clock check.
  const [reminderSettings, setReminderSettings] = useState({
    reminder_time: "18:00",
    enabled: true,
  });

  const handleUpdateReminder = (reminderTime, enabled) => {
    setReminderSettings({ reminder_time: reminderTime, enabled });
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from("reminder_settings")
      .select("reminder_time, enabled")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setReminderSettings({
            reminder_time: data.reminder_time?.slice(0, 5) || "18:00",
            enabled: data.enabled,
          });
        }
      });
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id || !reminderSettings.enabled) return;

    const checkReminder = () => {
      const now = new Date();
      const nowHHMM = now.toTimeString().slice(0, 5);
      const todayStr = todayDateString();
      const lastFired = localStorage.getItem("reminderLastFiredDate");

      if (
        nowHHMM === reminderSettings.reminder_time &&
        lastFired !== todayStr
      ) {
        localStorage.setItem("reminderLastFiredDate", todayStr);
        showToast("Time to log your meals and activity for today!", "info");

        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("Fitness Tracker", {
            body: "Time to log your meals and activity for today!",
          });
        }
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 30000);
    return () => clearInterval(interval);
  }, [session, reminderSettings]);

  const handleUpdateSteps = useCallback(
    async (newSteps) => {
      if (!session?.user?.id) return;

      const { error } = await supabase.from("daily_steps").upsert(
        {
          user_id: session.user.id,
          log_date: todayDateString(),
          steps: newSteps,
          source: "manual",
          updated_at: new Date(),
        },
        { onConflict: "user_id,log_date" },
      );

      if (error) {
        showToast("Failed to save steps: " + error.message, "error");
      } else {
        setUserStats((prev) => ({ ...prev, steps: newSteps }));
      }
    },
    [session],
  );

  const handleAddWorkout = useCallback(
    async (workout) => {
      if (!session?.user?.id) return;

      const { error } = await supabase.from("workouts").insert([
        {
          user_id: session.user.id,
          name: workout.name,
          calories_burned: workout.caloriesBurned,
          duration_minutes: workout.durationMinutes,
          workout_date: todayDateString(),
          source: "manual",
        },
      ]);

      if (error) {
        showToast("Failed to save workout: " + error.message, "error");
      } else {
        await fetchTodayWorkouts();
        setActiveTab("dashboard");
      }
    },
    [session, fetchTodayWorkouts],
  );

  const handleDeleteWorkout = useCallback(
    async (workoutId) => {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);
      if (error) {
        showToast("Failed to delete workout: " + error.message, "error");
      } else {
        fetchTodayWorkouts();
      }
    },
    [fetchTodayWorkouts],
  );

  const caloriesBurned = todayWorkouts.reduce(
    (sum, w) => sum + (w.calories_burned || 0),
    0,
  );

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
          log_date: todayDateString(),
        },
      ]);

      if (error) {
        showToast("Failed to save log to database: " + error.message, "error");
      } else {
        fetchTodayLogs();
        setActiveTab("dashboard");
      }
    },
    [session, fetchTodayLogs],
  );

  if (loading) {
    return (
      <>
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            fontFamily: "var(--font-body)",
            color: "var(--ink-soft)",
          }}
        >
          Loading Fitness Tracker...
        </div>
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  if (isPasswordRecovery) {
    return (
      <>
        <ResetPasswordScreen onDone={() => setIsPasswordRecovery(false)} />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Auth />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        border: "1px solid var(--line)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--paper)",
        position: "relative",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          backgroundColor: "var(--paper)",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="User Avatar"
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid var(--ember-soft)",
              }}
            />
          ) : (
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "var(--ember-soft)",
              }}
            />
          )}
          <h1 style={{ fontSize: "17px" }}>Fitness Tracker</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={handleOpenNotifications}
            aria-label={`Notifications${unreadNotifCount > 0 ? ` (${unreadNotifCount} unread)` : ""}`}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              backgroundColor: "transparent",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: "50%",
              cursor: "pointer",
            }}
          >
            <Bell size={16} />
            {unreadNotifCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-3px",
                  right: "-3px",
                  minWidth: "17px",
                  height: "17px",
                  padding: "0 4px",
                  borderRadius: "999px",
                  backgroundColor: "var(--ember)",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--paper)",
                  animation: "bell-pulse 1.8s ease-in-out infinite",
                }}
              >
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </span>
            )}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            aria-label="Sign out"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              backgroundColor: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>
      <style>{`
        @keyframes bell-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "dashboard" && (
          <Dashboard
            userStats={userStats}
            todayLogs={todayLogs}
            todayWorkouts={todayWorkouts}
            caloriesBurned={caloriesBurned}
            onUpdateSteps={handleUpdateSteps}
            onDeleteWorkout={handleDeleteWorkout}
            onOpenHistory={() => setActiveTab("history")}
          />
        )}
        {activeTab === "history" && (
          <FoodHistory
            session={session}
            onBack={() => setActiveTab("dashboard")}
          />
        )}
        {activeTab === "log" && (
          <div>
            <div
              style={{ display: "flex", gap: "8px", padding: "20px 20px 0" }}
            >
              <button
                onClick={() => setLogMode("meal")}
                style={logModeBtnStyle(logMode === "meal")}
              >
                <UtensilsCrossed size={15} />
                Meal
              </button>
              <button
                onClick={() => setLogMode("exercise")}
                style={logModeBtnStyle(logMode === "exercise")}
              >
                <Activity size={15} />
                Exercise
              </button>
            </div>
            {logMode === "meal" ? (
              <FoodLogger onAddMeal={handleAddMeal} />
            ) : (
              <ExerciseLogger
                currentSteps={userStats.steps}
                onUpdateSteps={handleUpdateSteps}
                onAddWorkout={handleAddWorkout}
              />
            )}
          </div>
        )}
        {activeTab === "feed" && (
          <SocialFeed session={session} jumpToNotifications={notifTrigger} />
        )}
        {activeTab === "chat" && <Chat session={session} />}
        {activeTab === "profile" && (
          <Profile
            session={session}
            onUpdateGoals={handleUpdateGoals}
            onUpdateReminder={handleUpdateReminder}
          />
        )}
      </div>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: "1px solid var(--line)",
          backgroundColor: "var(--card)",
          padding: "8px 6px",
          position: "sticky",
          bottom: 0,
        }}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon, isPrimary }) => {
          const isActive = activeTab === key;

          if (isPrimary) {
            return (
              <div
                key={key}
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
              >
                <button
                  onClick={() => setActiveTab(key)}
                  aria-label={label}
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    backgroundColor: "var(--ember)",
                    color: "#fff",
                    border: "4px solid var(--card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transform: "translateY(-14px)",
                    boxShadow: "var(--shadow-press)",
                  }}
                >
                  <Icon size={26} strokeWidth={2.25} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "6px 2px",
                border: "none",
                background: "none",
                color: isActive ? "var(--ember)" : "var(--ink-faint)",
                cursor: "pointer",
              }}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}

const logModeBtnStyle = (active) => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "9px",
  border: active ? "1px solid var(--ember)" : "1px solid var(--line)",
  backgroundColor: active ? "var(--ember-soft)" : "var(--card)",
  color: active ? "var(--ember)" : "var(--ink-soft)",
  borderRadius: "var(--radius-md)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
});
