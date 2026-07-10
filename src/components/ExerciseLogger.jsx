import React, { useState } from "react";
import { Footprints, Activity, Watch } from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";

export default function ExerciseLogger({
  currentSteps,
  onUpdateSteps,
  onAddWorkout,
}) {
  const [stepsInput, setStepsInput] = useState(currentSteps || "");
  const [savingSteps, setSavingSteps] = useState(false);

  const [workoutName, setWorkoutName] = useState("");
  const [duration, setDuration] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [savingWorkout, setSavingWorkout] = useState(false);

  const handleSaveSteps = async (e) => {
    e.preventDefault();
    if (stepsInput === "" || isNaN(stepsInput)) return;
    setSavingSteps(true);
    await onUpdateSteps(parseInt(stepsInput));
    setSavingSteps(false);
  };

  const handleSaveWorkout = async (e) => {
    e.preventDefault();
    if (!workoutName.trim() || !caloriesBurned) return;
    setSavingWorkout(true);
    await onAddWorkout({
      name: workoutName.trim(),
      durationMinutes: parseInt(duration) || null,
      caloriesBurned: parseInt(caloriesBurned),
    });
    setWorkoutName("");
    setDuration("");
    setCaloriesBurned("");
    setSavingWorkout(false);
  };

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <h2 style={{ fontSize: "20px" }}>Log exercise</h2>

      {/* Steps */}
      <Card accent="var(--ember)">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <Footprints size={18} color="var(--ember)" />
          <h3 style={{ fontSize: "15px" }}>Today's steps</h3>
        </div>
        <form
          onSubmit={handleSaveSteps}
          style={{ display: "flex", gap: "10px" }}
        >
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 8500"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <Button
            type="submit"
            disabled={savingSteps}
            style={{ flexShrink: 0 }}
          >
            {savingSteps ? "Saving..." : "Save"}
          </Button>
        </form>
        <p
          style={{
            fontSize: "12px",
            color: "var(--ink-soft)",
            marginTop: "8px",
          }}
        >
          Overwrites today's count — enter your running total for the day, not
          an amount to add.
        </p>
      </Card>

      {/* Workout */}
      <Card accent="var(--plum)">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <Activity size={18} color="var(--plum)" />
          <h3 style={{ fontSize: "15px" }}>Log a workout</h3>
        </div>
        <form
          onSubmit={handleSaveWorkout}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <div>
            <label style={labelStyle}>Activity</label>
            <input
              type="text"
              placeholder="e.g. Run, Weight training, Cycling"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Duration (min)</label>
              <input
                type="number"
                placeholder="30"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Calories burned</label>
              <input
                type="number"
                placeholder="250"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <Button type="submit" fullWidth disabled={savingWorkout}>
            {savingWorkout ? "Saving..." : "Save workout"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

const labelStyle = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--ink)",
  display: "block",
  marginBottom: "5px",
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
