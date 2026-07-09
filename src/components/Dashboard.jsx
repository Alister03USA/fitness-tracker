import React from "react";
import { Footprints, Flame } from "lucide-react";
import Card from "./ui/Card";
import NutrientRing from "./ui/NutrientRing";

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

export default function Dashboard({ userStats, todayLogs = [] }) {
  const remaining = userStats.calorieGoal - userStats.caloriesConsumed;
  const stepPct = Math.min(
    Math.round((userStats.steps / userStats.stepGoal) * 100),
    100,
  );

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
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

      {/* Steps card */}
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
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
              Steps
            </span>
            <span className="stat-number" style={{ fontSize: "14px" }}>
              {userStats.steps.toLocaleString()} /{" "}
              {userStats.stepGoal.toLocaleString()}
            </span>
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
