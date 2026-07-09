import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function Profile({ session, onUpdateGoals }) {
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
        setPrivacySetting(data.privacy_setting || "private");
        setAvatarUrl(data.avatar_url || "");
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

  // Upload Profile Avatar to Supabase Storage
  const uploadAvatar = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      // Clean file path using simple unique identifier
      const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;

      // 1. Upload file to 'avatars' bucket with content type options
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
      alert("Avatar uploaded successfully!");
    } catch (error) {
      console.error("Avatar upload failed:", error);
      alert("Error uploading avatar: " + error.message);
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
        avatar_url: avatarUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase.from("profiles").upsert(updates);

      if (error) throw error;

      if (onUpdateGoals) {
        onUpdateGoals(tdeeGoal, avatarUrl);
      }

      alert("Profile updated successfully!");
    } catch (error) {
      alert("Error updating profile: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Loading profile...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>User Demographics & Profile</h2>

      {/* Avatar Image Picker Card */}
      <div style={avatarCardStyle}>
        <div style={{ textAlign: "center" }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: "10px",
              }}
            />
          ) : (
            <div style={avatarPlaceholderStyle}>👤 No Pic</div>
          )}
          <div>
            <label style={uploadBtnStyle}>
              {uploading ? "Uploading..." : "📷 Change Profile Picture"}
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
      </div>

      {/* Target Summary */}
      <div style={summaryCardStyle}>
        <h3>🎯 Dynamic Daily Target</h3>
        <p>
          Estimated BMR: <strong>{bmr} kcal/day</strong>
        </p>
        <p>
          Calculated Daily Target (TDEE): <strong>{tdeeGoal} kcal/day</strong>
        </p>
      </div>

      <form
        onSubmit={updateProfile}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <div>
          <label style={labelStyle}>Display Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            style={inputStyle}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>Age:</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 25"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Biological Sex:</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={inputStyle}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>Height (cm):</label>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="e.g. 175"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Weight (kg):</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 70"
              style={inputStyle}
              required
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Activity Level:</label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            style={inputStyle}
          >
            <option value="1.2">Sedentary (Little to no exercise)</option>
            <option value="1.375">
              Lightly Active (Exercise 1-3 days/week)
            </option>
            <option value="1.55">
              Moderately Active (Exercise 3-5 days/week)
            </option>
            <option value="1.725">
              Very Active (Hard exercise 6-7 days/week)
            </option>
          </select>
        </div>

        <div style={privacyBoxStyle}>
          <label style={labelStyle}>🔒 Profile Visibility:</label>
          <select
            value={privacySetting}
            onChange={(e) => setPrivacySetting(e.target.value)}
            style={inputStyle}
          >
            <option value="private">
              Private (Only confirmed friends can view activity)
            </option>
            <option value="public">
              Public (Searchable and visible to everyone)
            </option>
          </select>
        </div>

        <button type="submit" style={submitBtnStyle}>
          💾 Save Profile
        </button>
      </form>
    </div>
  );
}

// Styles
const avatarCardStyle = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "20px",
};
const avatarPlaceholderStyle = {
  width: "100px",
  height: "100px",
  borderRadius: "50%",
  backgroundColor: "#eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 10px auto",
  color: "#666",
  fontSize: "14px",
};
const uploadBtnStyle = {
  padding: "8px 14px",
  backgroundColor: "#6c757d",
  color: "white",
  borderRadius: "20px",
  fontSize: "13px",
  cursor: "pointer",
  display: "inline-block",
};
const summaryCardStyle = {
  border: "1px solid #28a745",
  borderRadius: "8px",
  padding: "15px",
  marginBottom: "20px",
  backgroundColor: "#f4fbf6",
};
const privacyBoxStyle = {
  border: "1px solid #ccc",
  borderRadius: "8px",
  padding: "12px",
  backgroundColor: "#f9f9f9",
};
const labelStyle = {
  fontWeight: "bold",
  fontSize: "14px",
  display: "block",
  marginBottom: "5px",
};
const inputStyle = {
  width: "100%",
  padding: "10px",
  fontSize: "15px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
};
const submitBtnStyle = {
  padding: "14px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "16px",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "10px",
};
