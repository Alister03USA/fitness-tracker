import React, { useState, useEffect } from "react";
import {
  Camera,
  Flame,
  Lock,
  KeyRound,
  BellRing,
  Footprints,
  Scale,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { showToast } from "../lib/toast";
import Button from "./ui/Button";
import Card from "./ui/Card";
import PasswordInput from "./ui/PassportInput";

const toDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().split("T")[0];
};

const formatDateLabel = (dateString) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const formatWeightChange = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  if (Math.abs(value) < 0.05) return "No change";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} kg`;
};

export default function Profile({ session, onUpdateGoals, onUpdateReminder }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState("1.375");
  const [privacySetting, setPrivacySetting] = useState("private");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [bmr, setBmr] = useState(0);
  const [tdeeGoal, setTdeeGoal] = useState(2000);
  const [stepGoal, setStepGoal] = useState(10000);
  const [weightLogs, setWeightLogs] = useState([]);
  const [weightLogDate, setWeightLogDate] = useState(toDateString());
  const [weightEntry, setWeightEntry] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [loadingWeights, setLoadingWeights] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    if (session) {
      getProfile();
      fetchWeightLogs();
    }
  }, [session]);

  useEffect(() => {
    if (age && heightCm && weightKg) {
      calculateMetrics();
    }
  }, [age, gender, heightCm, weightKg, activityLevel]);

  const getProfile = async () => {
    try {
      setLoading(true);
      const { user } = session;

      const { data, error, status } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setName(data.name || "");
        setAge(data.age || "");
        setGender(data.gender || "male");
        setHeightCm(data.height_cm || "");
        setWeightKg(data.weight_kg || "");
        setWeightEntry(data.weight_kg || "");
        setActivityLevel(data.activity_level || "1.375");
        setPrivacySetting(data.privacy_setting || "private");
        setAvatarUrl(data.avatar_url || "");
        setStepGoal(data.step_goal || 10000);
      }

      const { data: reminderData } = await supabase
        .from("reminder_settings")
        .select("reminder_time, enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (reminderData) {
        setReminderTime(reminderData.reminder_time?.slice(0, 5) || "18:00");
        setReminderEnabled(reminderData.enabled);
      }
    } catch (error) {
      console.error("Error loading profile:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeightLogs = async () => {
    try {
      setLoadingWeights(true);
      const { user } = session;

      const { data, error } = await supabase
        .from("weight_logs")
        .select("id, log_date, weight_kg")
        .eq("user_id", user.id)
        .order("log_date", { ascending: true });

      if (error) throw error;
      setWeightLogs(data || []);

      const latest = data?.[data.length - 1];
      if (latest) {
        setWeightLogDate(latest.log_date || toDateString());
        setWeightEntry(latest.weight_kg || "");
      }
    } catch (error) {
      console.error("Error loading weight history:", error.message);
    } finally {
      setLoadingWeights(false);
    }
  };

  const calculateMetrics = () => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    const a = parseInt(age);

    let calculatedBmr = 0;
    if (gender === "male") {
      calculatedBmr = 88.362 + 13.397 * w + 4.799 * h - 5.677 * a;
    } else {
      calculatedBmr = 447.593 + 9.247 * w + 3.098 * h - 4.33 * a;
    }

    const calculatedTdee = Math.round(
      calculatedBmr * parseFloat(activityLevel),
    );
    setBmr(Math.round(calculatedBmr));
    setTdeeGoal(calculatedTdee);
  };

  const uploadAvatar = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error("Avatar upload failed:", error);
      showToast("Error uploading avatar: " + error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { user } = session;

      const updates = {
        id: user.id,
        name,
        age: parseInt(age),
        gender,
        height_cm: parseFloat(heightCm),
        weight_kg: parseFloat(weightKg),
        privacy_setting: privacySetting,
        activity_level: parseFloat(activityLevel),
        avatar_url: avatarUrl,
        step_goal: parseInt(stepGoal) || 10000,
        updated_at: new Date(),
      };

      const { error } = await supabase.from("profiles").upsert(updates);

      if (error) throw error;

      if (!Number.isNaN(parseFloat(weightKg))) {
        const { error: weightLogError } = await supabase.from("weight_logs").upsert(
          {
            user_id: user.id,
            log_date: toDateString(),
            weight_kg: parseFloat(weightKg),
            updated_at: new Date(),
          },
          { onConflict: "user_id,log_date" },
        );

        if (weightLogError) {
          console.warn("Weight history update failed:", weightLogError.message);
        } else {
          fetchWeightLogs();
        }
      }

      if (onUpdateGoals) {
        onUpdateGoals(tdeeGoal, avatarUrl, parseInt(stepGoal) || 10000);
      }

      showToast("Profile updated!", "success");
    } catch (error) {
      showToast("Error updating profile: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (password) => {
    const re =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    return re.test(password);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!validatePassword(newPassword)) {
      showToast(
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
        "error",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords don't match.", "error");
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      showToast("Failed to update password: " + error.message, "error");
    } else {
      showToast("Password updated!", "success");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSaveReminder = async (e) => {
    e.preventDefault();
    setSavingReminder(true);

    const { error } = await supabase.from("reminder_settings").upsert(
      {
        user_id: session.user.id,
        reminder_time: reminderTime,
        enabled: reminderEnabled,
        updated_at: new Date(),
      },
      { onConflict: "user_id" },
    );

    setSavingReminder(false);

    if (error) {
      showToast("Failed to save reminder: " + error.message, "error");
    } else {
      showToast("Reminder saved!", "success");
      onUpdateReminder?.(reminderTime, reminderEnabled);
    }
  };

  const handleRequestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      showToast("Notifications enabled!", "success");
    } else if (result === "denied") {
      showToast("Notifications blocked — you can re-enable them in your browser's site settings.", "error");
    }
  };

  const handleSaveWeightEntry = async (e) => {
    e.preventDefault();
    const parsedWeight = parseFloat(weightEntry);

    if (!weightLogDate || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      showToast("Enter a valid date and weight.", "error");
      return;
    }

    try {
      setSavingWeight(true);
      const { user } = session;
      const { error: logError } = await supabase.from("weight_logs").upsert(
        {
          user_id: user.id,
          log_date: weightLogDate,
          weight_kg: parsedWeight,
          updated_at: new Date(),
        },
        { onConflict: "user_id,log_date" },
      );

      if (logError) throw logError;

      const latestLogDate = weightLogs[weightLogs.length - 1]?.log_date;
      if (!latestLogDate || weightLogDate >= latestLogDate) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ weight_kg: parsedWeight, updated_at: new Date() })
          .eq("id", user.id);

        if (profileError) throw profileError;
        setWeightKg(parsedWeight);
      }

      await fetchWeightLogs();
      showToast("Weight entry saved.", "success");
    } catch (error) {
      showToast("Failed to save weight entry: " + error.message, "error");
    } finally {
      setSavingWeight(false);
    }
  };

  const latestWeight = weightLogs[weightLogs.length - 1];
  const previousWeight =
    weightLogs.length > 1 ? weightLogs[weightLogs.length - 2] : null;
  const firstWeight = weightLogs[0];
  const latestChange =
    latestWeight && previousWeight
      ? latestWeight.weight_kg - previousWeight.weight_kg
      : null;
  const totalChange =
    latestWeight && firstWeight && latestWeight.id !== firstWeight.id
      ? latestWeight.weight_kg - firstWeight.weight_kg
      : null;
  const chartLogs = weightLogs.slice(-12);
  const chartPath = buildWeightChartPath(chartLogs);

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "var(--ink-soft)",
        }}
      >
        Loading profile...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <h2 style={{ fontSize: "20px" }}>Profile</h2>

      {/* Avatar */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: "10px",
                border: "3px solid var(--ember-soft)",
              }}
            />
          ) : (
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                backgroundColor: "var(--ember-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px auto",
                color: "var(--ember)",
              }}
            >
              <Camera size={28} />
            </div>
          )}
          <label style={uploadBtnStyle}>
            <Camera size={14} />
            {uploading ? "Uploading..." : "Change photo"}
            <input
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      {/* BMR/TDEE — the payoff of filling in the form, given the strongest visual treatment */}
      <Card accent="var(--sprout)" style={{ backgroundColor: "#F5FAF6" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <Flame size={18} color="var(--sprout)" />
          <h3 style={{ fontSize: "15px" }}>Your daily target</h3>
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          <div>
            <div
              className="stat-number"
              style={{ fontSize: "26px", color: "var(--ink)" }}
            >
              {bmr}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
              BMR (kcal/day)
            </div>
          </div>
          <div>
            <div
              className="stat-number"
              style={{ fontSize: "26px", color: "var(--sprout)" }}
            >
              {tdeeGoal}
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
              TDEE goal (kcal/day)
            </div>
          </div>
        </div>
      </Card>

      <Card accent="var(--ember)">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <Scale size={18} color="var(--ember)" />
          <h3 style={{ fontSize: "15px" }}>Weight trend</h3>
        </div>

        <form
          onSubmit={handleSaveWeightEntry}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: "8px",
            alignItems: "end",
            marginBottom: "14px",
          }}
        >
          <Field label="Date">
            <input
              type="date"
              value={weightLogDate}
              max={toDateString()}
              onChange={(e) => setWeightLogDate(e.target.value)}
              style={inputStyle}
              required
            />
          </Field>
          <Field label="Weight (kg)">
            <input
              type="number"
              min="1"
              step="0.1"
              value={weightEntry}
              onChange={(e) => setWeightEntry(e.target.value)}
              placeholder="e.g. 70"
              style={inputStyle}
              required
            />
          </Field>
          <Button type="submit" size="sm" disabled={savingWeight}>
            {savingWeight ? "Saving..." : "Save"}
          </Button>
        </form>

        {loadingWeights ? (
          <p style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            Loading weight history...
          </p>
        ) : weightLogs.length === 0 ? (
          <div style={emptyTrendStyle}>
            Add your first dated entry to start seeing change over time.
          </div>
        ) : (
          <>
            <div style={weightStatsGridStyle}>
              <WeightStat
                label="Latest"
                value={`${Number(latestWeight.weight_kg).toFixed(1)} kg`}
                sublabel={formatDateLabel(latestWeight.log_date)}
              />
              <WeightStat
                label="Last entry"
                value={formatWeightChange(latestChange)}
                sublabel={previousWeight ? "since previous log" : "needs 2 logs"}
              />
              <WeightStat
                label="Overall"
                value={formatWeightChange(totalChange)}
                sublabel={
                  firstWeight && latestWeight && firstWeight.id !== latestWeight.id
                    ? `${formatDateLabel(firstWeight.log_date)} to ${formatDateLabel(
                        latestWeight.log_date,
                      )}`
                    : "needs 2 logs"
                }
              />
            </div>

            <div style={chartFrameStyle}>
              {chartLogs.length > 1 ? (
                <svg
                  viewBox="0 0 280 120"
                  role="img"
                  aria-label="Weight trend line chart"
                  style={{ width: "100%", height: "130px", display: "block" }}
                >
                  <line x1="24" y1="96" x2="260" y2="96" stroke="var(--line)" />
                  <line x1="24" y1="20" x2="24" y2="96" stroke="var(--line)" />
                  <path
                    d={chartPath}
                    fill="none"
                    stroke="var(--ember)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartLogs.map((log, index) => {
                    const point = getWeightChartPoint(chartLogs, index);
                    return (
                      <circle
                        key={`${log.log_date}-${log.id || index}`}
                        cx={point.x}
                        cy={point.y}
                        r="3.5"
                        fill="var(--card)"
                        stroke="var(--ember)"
                        strokeWidth="2"
                      >
                        <title>
                          {formatDateLabel(log.log_date)}:{" "}
                          {Number(log.weight_kg).toFixed(1)} kg
                        </title>
                      </circle>
                    );
                  })}
                </svg>
              ) : (
                <div style={singlePointStyle}>
                  Add one more entry to draw a trend line.
                </div>
              )}
            </div>

            <div style={recentListStyle}>
              {weightLogs
                .slice(-4)
                .reverse()
                .map((log) => (
                  <div key={log.id || log.log_date} style={recentRowStyle}>
                    <span>{formatDateLabel(log.log_date)}</span>
                    <strong>{Number(log.weight_kg).toFixed(1)} kg</strong>
                  </div>
                ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <form
          onSubmit={updateProfile}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <Field label="Display name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: "10px" }}>
            <Field label="Age" style={{ flex: 1 }}>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 25"
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Biological sex" style={{ flex: 1 }}>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={inputStyle}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Field label="Height (cm)" style={{ flex: 1 }}>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="e.g. 175"
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Weight (kg)" style={{ flex: 1 }}>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 70"
                style={inputStyle}
                required
              />
            </Field>
          </div>

          <Field label="Activity level">
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              style={inputStyle}
            >
              <option value="1.2">Sedentary (little to no exercise)</option>
              <option value="1.375">
                Lightly active (exercise 1–3 days/week)
              </option>
              <option value="1.55">
                Moderately active (exercise 3–5 days/week)
              </option>
              <option value="1.725">
                Very active (hard exercise 6–7 days/week)
              </option>
            </select>
          </Field>

          <Field label="Daily step goal">
            <div style={{ position: "relative" }}>
              <Footprints
                size={15}
                color="var(--ink-faint)"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="number"
                min="1000"
                step="500"
                value={stepGoal}
                onChange={(e) => setStepGoal(e.target.value)}
                placeholder="e.g. 10000"
                style={{ ...inputStyle, paddingLeft: "34px" }}
              />
            </div>
          </Field>

          <div
            style={{
              backgroundColor: "var(--paper)",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
              }}
            >
              <Lock size={13} color="var(--ink-soft)" />
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Profile visibility
              </label>
            </div>
            <select
              value={privacySetting}
              onChange={(e) => setPrivacySetting(e.target.value)}
              style={inputStyle}
            >
              <option value="private">
                Private — only confirmed friends can view activity
              </option>
              <option value="public">
                Public — searchable and visible to everyone
              </option>
            </select>
          </div>

          <Button type="submit" fullWidth>
            Save profile
          </Button>
        </form>
      </Card>

      {/* Daily reminder */}
      <Card accent="var(--ember)">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <BellRing size={18} color="var(--ember)" />
          <h3 style={{ fontSize: "15px" }}>Daily reminder</h3>
        </div>
        <p style={{ fontSize: "13px", color: "var(--ink-soft)", marginBottom: "14px" }}>
          Get a nudge to log your meals and activity at a time that works for you.
        </p>

        <form onSubmit={handleSaveReminder} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              backgroundColor: "var(--paper)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
            }}
          >
            <label htmlFor="reminder-enabled" style={{ fontSize: "14px", fontWeight: 500 }}>
              Remind me daily
            </label>
            <input
              id="reminder-enabled"
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "var(--ember)" }}
            />
          </div>

          <Field label="Reminder time">
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              disabled={!reminderEnabled}
              style={{ ...inputStyle, opacity: reminderEnabled ? 1 : 0.5 }}
            />
          </Field>

          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--ink-soft)",
                backgroundColor: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span>
                {notifPermission === "denied"
                  ? "Browser notifications are blocked — reminders will still appear in-app while it's open."
                  : "Enable browser notifications so reminders reach you even in another tab."}
              </span>
              {notifPermission === "default" && (
                <Button type="button" size="sm" variant="secondary" onClick={handleRequestNotifPermission}>
                  Enable notifications
                </Button>
              )}
            </div>
          )}

          <Button type="submit" variant="secondary" fullWidth disabled={savingReminder}>
            {savingReminder ? "Saving..." : "Save reminder"}
          </Button>
        </form>
      </Card>

      {/* Change password */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <KeyRound size={18} color="var(--ink-soft)" />
          <h3 style={{ fontSize: "15px" }}>Change password</h3>
        </div>
        <form
          onSubmit={handleChangePassword}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <Field label="New password">
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Secure password"
              style={inputStyle}
            />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              style={inputStyle}
            />
          </Field>
          <Button type="submit" variant="secondary" fullWidth disabled={changingPassword}>
            {changingPassword ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Card>
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

function WeightStat({ label, value, sublabel }) {
  return (
    <div style={weightStatStyle}>
      <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>{label}</div>
      <div className="stat-number" style={{ fontSize: "17px" }}>
        {value}
      </div>
      <div style={{ fontSize: "10px", color: "var(--ink-faint)" }}>
        {sublabel}
      </div>
    </div>
  );
}

const getWeightChartPoint = (logs, index) => {
  const width = 236;
  const height = 76;
  const left = 24;
  const top = 20;
  const weights = logs.map((log) => Number(log.weight_kg));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const x =
    logs.length === 1 ? left + width / 2 : left + (index / (logs.length - 1)) * width;
  const y = top + height - ((weights[index] - min) / range) * height;

  return { x, y };
};

const buildWeightChartPath = (logs) =>
  logs
    .map((log, index) => {
      const point = getWeightChartPoint(logs, index);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");

const uploadBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 14px",
  backgroundColor: "var(--card)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  fontWeight: 600,
  fontSize: "13px",
  display: "block",
  marginBottom: "5px",
  color: "var(--ink)",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  boxSizing: "border-box",
  backgroundColor: "var(--card)",
  color: "var(--ink)",
};

const weightStatsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "8px",
  marginBottom: "12px",
};

const weightStatStyle = {
  backgroundColor: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  padding: "10px 8px",
  textAlign: "center",
};

const chartFrameStyle = {
  backgroundColor: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  padding: "8px",
  marginBottom: "10px",
};

const emptyTrendStyle = {
  backgroundColor: "var(--paper)",
  border: "1px dashed var(--line)",
  borderRadius: "var(--radius-md)",
  color: "var(--ink-soft)",
  fontSize: "13px",
  padding: "14px",
  textAlign: "center",
};

const singlePointStyle = {
  minHeight: "96px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ink-soft)",
  fontSize: "13px",
};

const recentListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const recentRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "12px",
  color: "var(--ink-soft)",
};