import React, { useState, useEffect } from "react";
import { Camera, Flame, Lock, KeyRound, BellRing } from "lucide-react";
import { supabase } from "../supabaseClient";
import { showToast } from "../lib/toast";
import Button from "./ui/Button";
import Card from "./ui/Card";
import PasswordInput from "./ui/PassportInput";

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

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [savingReminder, setSavingReminder] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported",
  );

  useEffect(() => {
    if (session) {
      getProfile();
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
        setActivityLevel(data.activity_level || "1.375");
        setPrivacySetting(data.privacy_setting || "private");
        setAvatarUrl(data.avatar_url || "");
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
        updated_at: new Date(),
      };

      const { error } = await supabase.from("profiles").upsert(updates);

      if (error) throw error;

      if (onUpdateGoals) {
        onUpdateGoals(tdeeGoal, avatarUrl);
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
      showToast(
        "Notifications blocked — you can re-enable them in your browser's site settings.",
        "error",
      );
    }
  };

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <BellRing size={18} color="var(--ember)" />
          <h3 style={{ fontSize: "15px" }}>Daily reminder</h3>
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--ink-soft)",
            marginBottom: "14px",
          }}
        >
          Get a nudge to log your meals and activity at a time that works for
          you.
        </p>

        <form
          onSubmit={handleSaveReminder}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
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
            <label
              htmlFor="reminder-enabled"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              Remind me daily
            </label>
            <input
              id="reminder-enabled"
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                accentColor: "var(--ember)",
              }}
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

          {notifPermission !== "granted" &&
            notifPermission !== "unsupported" && (
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
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleRequestNotifPermission}
                  >
                    Enable notifications
                  </Button>
                )}
              </div>
            )}

          <Button
            type="submit"
            variant="secondary"
            fullWidth
            disabled={savingReminder}
          >
            {savingReminder ? "Saving..." : "Save reminder"}
          </Button>
        </form>
      </Card>

      {/* Change password */}
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
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
          <Button
            type="submit"
            variant="secondary"
            fullWidth
            disabled={changingPassword}
          >
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
