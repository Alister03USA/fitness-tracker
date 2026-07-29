import React, { useState, useEffect } from "react";
import {
  Footprints,
  Flame,
  Activity,
  Pencil,
  Trash2,
  CalendarDays,
} from "lucide-react";
import Card from "./ui/Card";
import NutrientRing from "./ui/Nutrientring";

const MACRO_META = [
  {
    key: "protein",
    label: "Protein",
    color: "var(--sprout)",
    bg: "var(--sprout-soft)",
  },
  {
    key: "carbs",
    label: "Carbs",
    color: "var(--butter)",
    bg: "var(--butter-soft)",
  },
  { key: "fat", label: "Fat", color: "var(--plum)", bg: "var(--plum-soft)" },
];

export default function Dashboard({
  userStats,
  todayLogs = [],
  todayWorkouts = [],
  caloriesBurned = 0,
  onUpdateSteps,
  onDeleteWorkout,
  onDeleteMealLog,
  onOpenHistory,
}) {
  // Exercise calories add back to the daily budget, matching how most
  // macro trackers handle it: Goal − Food + Exercise = Remaining.
  const remaining =
    userStats.calorieGoal - userStats.caloriesConsumed + caloriesBurned;
  const stepPct = Math.min(
    Math.round((userStats.steps / userStats.stepGoal) * 100),
    100,
  );

  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsDraft, setStepsDraft] = useState(userStats.steps);

  useEffect(() => {
    if (!editingSteps) setStepsDraft(userStats.steps);
  }, [userStats.steps, editingSteps]);

  const saveSteps = async () => {
    if (stepsDraft !== "" && !isNaN(stepsDraft)) {
      await onUpdateSteps?.(parseInt(stepsDraft));
    }
    setEditingSteps(false);
  };

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p style={brandEyebrowStyle}>MoveCircle</p>
          <h2 style={{ fontSize: "20px" }}>Today</h2>
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: "13px",
              marginTop: "2px",
            }}
          >
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={onOpenHistory}
          style={historyBtnStyle}
          aria-label="View food history"
        >
          <CalendarDays size={15} />
          History
        </button>
      </div>

      {/* Signature nutrient ring card */}
      <Card
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <NutrientRing
          centerValue={remaining >= 0 ? remaining.toLocaleString() : 0}
          centerLabel={remaining >= 0 ? "kcal remaining" : "over goal"}
          rings={[
            {
              label: "Fat",
              color: "var(--plum)",
              consumed: userStats.fatConsumed,
              goal: userStats.fatGoal,
            },
            {
              label: "Carbs",
              color: "var(--butter)",
              consumed: userStats.carbsConsumed,
              goal: userStats.carbsGoal,
            },
            {
              label: "Protein",
              color: "var(--sprout)",
              consumed: userStats.proteinConsumed,
              goal: userStats.proteinGoal,
            },
          ]}
        />

        {caloriesBurned > 0 && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--ink-soft)",
              marginTop: "-8px",
            }}
          >
            {userStats.calorieGoal.toLocaleString()} goal −{" "}
            {userStats.caloriesConsumed.toLocaleString()} food{" "}
            <span style={{ color: "var(--plum)", fontWeight: 600 }}>
              + {caloriesBurned.toLocaleString()} exercise
            </span>
          </p>
        )}

        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
          {MACRO_META.map((m) => (
            <div
              key={m.key}
              style={{
                flex: 1,
                backgroundColor: m.bg,
                borderRadius: "var(--radius-md)",
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--ink-soft)",
                  marginBottom: "2px",
                }}
              >
                {m.label}
              </div>
              <div
                className="stat-number"
                style={{ fontSize: "16px", color: m.color }}
              >
                {userStats[`${m.key}Consumed`]}
                <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>
                  /{userStats[`${m.key}Goal`]}g
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Steps card — tap the pencil to edit today's count inline */}
      <Card style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "var(--ember-soft)",
            color: "var(--ember)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Footprints size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
              Steps
            </span>

            {editingSteps ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <input
                  type="number"
                  autoFocus
                  value={stepsDraft}
                  onChange={(e) => setStepsDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveSteps()}
                  style={stepsInputStyle}
                />
                <button
                  onClick={saveSteps}
                  style={smallSaveBtnStyle}
                  aria-label="Save steps"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingSteps(true)}
                style={editTriggerStyle}
                aria-label="Edit steps"
              >
                <span className="stat-number" style={{ fontSize: "14px" }}>
                  {userStats.steps.toLocaleString()} /{" "}
                  {userStats.stepGoal.toLocaleString()}
                </span>
                <Pencil size={12} color="var(--ink-faint)" />
              </button>
            )}
          </div>
          <div
            style={{
              height: "6px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--line)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${stepPct}%`,
                height: "100%",
                backgroundColor: "var(--ember)",
                borderRadius: "var(--radius-full)",
                transition: "width 0.6s ease-out",
              }}
            />
          </div>
        </div>
      </Card>

      {/* Today's exercise */}
      {todayWorkouts.length > 0 && (
        <div>
          <h3 style={{ fontSize: "15px", marginBottom: "10px" }}>
            Today's exercise
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {todayWorkouts.map((w) => (
              <Card
                key={w.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Activity size={16} color="var(--plum)" />
                  <div>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        display: "block",
                      }}
                    >
                      {w.name}
                    </span>
                    {w.duration_minutes ? (
                      <span
                        style={{ fontSize: "11px", color: "var(--ink-faint)" }}
                      >
                        {w.duration_minutes} min
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    className="stat-number"
                    style={{ fontSize: "14px", color: "var(--plum)" }}
                  >
                    −{w.calories_burned} kcal
                  </span>
                  <button
                    onClick={() => onDeleteWorkout?.(w.id)}
                    style={deleteBtnStyle}
                    aria-label="Delete workout"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Today's log */}
      <div>
        <h3 style={{ fontSize: "15px", marginBottom: "10px" }}>Today's log</h3>
        {todayLogs.length === 0 ? (
          <Card
            style={{
              textAlign: "center",
              color: "var(--ink-soft)",
              fontSize: "13px",
            }}
          >
            Nothing logged yet — tap the ＋ button below to add your first meal.
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {todayLogs.map((log) => (
              <Card
                key={log.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Flame size={16} color="var(--ember)" />
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>
                    {log.food_name}
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div style={{ display: "flex", gap: "3px" }}>
                    <span
                      title="Protein"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--sprout)",
                      }}
                    />
                    <span
                      title="Carbs"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--butter)",
                      }}
                    />
                    <span
                      title="Fat"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--plum)",
                      }}
                    />
                  </div>
                  <span className="stat-number" style={{ fontSize: "14px" }}>
                    {log.calories} kcal
                  </span>
                  <button
                    onClick={() => onDeleteMealLog?.(log.id)}
                    style={deleteBtnStyle}
                    aria-label="Delete food entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const historyBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--ink-soft)",
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  cursor: "pointer",
};

const brandEyebrowStyle = {
  marginBottom: "2px",
  color: "var(--ember)",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const editTriggerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px",
};

const stepsInputStyle = {
  width: "80px",
  padding: "4px 8px",
  fontSize: "13px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--ember)",
  textAlign: "right",
};

const smallSaveBtnStyle = {
  padding: "4px 10px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#fff",
  backgroundColor: "var(--ember)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
};

const deleteBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--ink-faint)",
  cursor: "pointer",
  display: "flex",
  padding: "2px",
};
