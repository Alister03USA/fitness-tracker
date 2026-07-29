import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trash2,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { showToast } from "../lib/toast";
import { confirmDialog } from "../lib/confirmDialog";
import Card from "./ui/Card";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const toDateString = (d) => {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
};

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export default function FoodHistory({ session, onBack, onLogsChanged }) {
  const userId = session?.user?.id;
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [weekStart, setWeekStart] = useState(() =>
    toDateString(startOfWeek(new Date())),
  );
  const [monthSummary, setMonthSummary] = useState({}); // { 'YYYY-MM-DD': { calories, count } }
  const [dayLogs, setDayLogs] = useState([]);
  const [weekLogs, setWeekLogs] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const fetchMonthSummary = useCallback(async () => {
    if (!userId) return;

    const firstDay = toDateString(monthCursor);
    const lastDayDate = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + 1,
      0,
    );
    const lastDay = toDateString(lastDayDate);

    const { data } = await supabase
      .from("logs")
      .select("log_date, calories")
      .eq("user_id", userId)
      .gte("log_date", firstDay)
      .lte("log_date", lastDay);

    const summary = {};
    (data || []).forEach((row) => {
      if (!summary[row.log_date])
        summary[row.log_date] = { calories: 0, count: 0 };
      summary[row.log_date].calories += row.calories || 0;
      summary[row.log_date].count += 1;
    });
    setMonthSummary(summary);
  }, [userId, monthCursor]);

  const fetchDayLogs = useCallback(async () => {
    if (!userId || !selectedDate) return;
    setLoadingDay(true);

    const { data } = await supabase
      .from("logs")
      .select("id, food_name, calories, protein, carbs, fat, created_at")
      .eq("user_id", userId)
      .eq("log_date", selectedDate)
      .order("created_at", { ascending: true });

    setDayLogs(data || []);
    setLoadingDay(false);
  }, [userId, selectedDate]);

  const fetchWeekLogs = useCallback(async () => {
    if (!userId || !weekStart) return;
    setLoadingWeek(true);

    const weekEnd = toDateString(addDays(new Date(weekStart + "T00:00:00"), 6));

    const { data } = await supabase
      .from("logs")
      .select("id, log_date, food_name, protein, carbs, fat, created_at")
      .eq("user_id", userId)
      .gte("log_date", weekStart)
      .lte("log_date", weekEnd)
      .order("log_date", { ascending: true })
      .order("created_at", { ascending: true });

    setWeekLogs(data || []);
    setLoadingWeek(false);
  }, [userId, weekStart]);

  useEffect(() => {
    fetchMonthSummary();
  }, [fetchMonthSummary]);

  useEffect(() => {
    fetchDayLogs();
  }, [fetchDayLogs]);

  useEffect(() => {
    fetchWeekLogs();
  }, [fetchWeekLogs]);

  const handleDeleteEntry = async (id) => {
    const confirmed = await confirmDialog({
      title: "Remove entry?",
      message: "This food entry will be permanently removed from your log.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;

    const { error } = await supabase
      .from("logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      showToast("Failed to delete: " + error.message, "error");
    } else {
      fetchDayLogs();
      fetchMonthSummary();
      fetchWeekLogs();
      onLogsChanged?.();
    }
  };

  const changeMonth = (delta) => {
    const next = new Date(monthCursor);
    next.setMonth(next.getMonth() + delta);
    setMonthCursor(next);
  };

  const changeWeek = (delta) => {
    const next = addDays(new Date(weekStart + "T00:00:00"), delta * 7);
    setWeekStart(toDateString(next));
  };

  // Build calendar grid cells (leading blanks + days of month)
  const firstWeekday = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth() + 1,
    0,
  ).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayStr = toDateString(new Date());
  const dayTotal = dayLogs.reduce(
    (sum, l) => ({
      calories: sum.calories + (l.calories || 0),
      protein: sum.protein + (l.protein || 0),
      carbs: sum.carbs + (l.carbs || 0),
      fat: sum.fat + (l.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const selectedDateLabel = new Date(
    selectedDate + "T00:00:00",
  ).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const weekEnd = toDateString(addDays(new Date(weekStart + "T00:00:00"), 6));
  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  )} - ${new Date(weekEnd + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

  const weeklySummary = buildWeeklySummary(weekLogs, weekStart);

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={onBack}
          style={backBtnStyle}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ fontSize: "18px" }}>Food history</h2>
      </div>

      <Card style={{ padding: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={17} color="var(--sprout)" />
            <div>
              <h3 style={{ fontSize: "15px" }}>Weekly summary</h3>
              <p style={mutedSmallStyle}>{weekLabel}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => changeWeek(-1)}
              style={monthNavBtnStyle}
              aria-label="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => changeWeek(1)}
              style={monthNavBtnStyle}
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {loadingWeek ? (
          <p style={emptySummaryStyle}>Loading weekly summary...</p>
        ) : weekLogs.length === 0 ? (
          <p style={emptySummaryStyle}>
            No meals logged this week yet. Saved and recent foods will make the
            next entries faster.
          </p>
        ) : (
          <>
            <div style={summaryGridStyle}>
              <SummaryMetric label="Meals" value={weeklySummary.mealCount} />
              <SummaryMetric
                label="Logged days"
                value={`${weeklySummary.loggedDays}/7`}
              />
              <SummaryMetric
                label="Avg meals/day"
                value={weeklySummary.avgMealsPerLoggedDay}
              />
            </div>

            <div style={weekStripStyle}>
              {weeklySummary.days.map((day) => (
                <div key={day.date} style={weekDayStyle(day.count > 0)}>
                  <span style={{ fontSize: "10px", fontWeight: 700 }}>
                    {day.label}
                  </span>
                  <span className="stat-number" style={{ fontSize: "13px" }}>
                    {day.count}
                  </span>
                </div>
              ))}
            </div>

            <div style={macroSummaryStyle}>
              <MacroPill
                label="Protein"
                value={weeklySummary.protein}
                color="var(--sprout)"
                bg="var(--sprout-soft)"
              />
              <MacroPill
                label="Carbs"
                value={weeklySummary.carbs}
                color="var(--butter)"
                bg="var(--butter-soft)"
              />
              <MacroPill
                label="Fat"
                value={weeklySummary.fat}
                color="var(--plum)"
                bg="var(--plum-soft)"
              />
            </div>

            {weeklySummary.topFoods.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <h4 style={smallSectionTitleStyle}>Most logged</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {weeklySummary.topFoods.map((food) => (
                    <span key={food.name} style={topFoodStyle}>
                      {food.name} ×{food.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Month navigation */}
      <Card style={{ padding: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <button
            onClick={() => changeMonth(-1)}
            style={monthNavBtnStyle}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <strong style={{ fontSize: "14px" }}>
            {monthCursor.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <button
            onClick={() => changeMonth(1)}
            style={monthNavBtnStyle}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
            marginBottom: "4px",
          }}
        >
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: "11px",
                color: "var(--ink-faint)",
                fontWeight: 600,
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />;

            const dateStr = toDateString(
              new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day),
            );
            const hasLogs = !!monthSummary[dateStr];
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                style={dayCellStyle(isSelected, isToday)}
              >
                <span>{day}</span>
                {hasLogs && <span style={dotStyle(isSelected)} />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected day detail */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "10px",
          }}
        >
          <h3 style={{ fontSize: "15px" }}>{selectedDateLabel}</h3>
          {dayLogs.length > 0 && (
            <span
              className="stat-number"
              style={{ fontSize: "15px", color: "var(--ember)" }}
            >
              {dayTotal.calories.toLocaleString()} kcal
            </span>
          )}
        </div>

        {dayLogs.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <MacroPill
              label="Protein"
              value={dayTotal.protein}
              color="var(--sprout)"
              bg="var(--sprout-soft)"
            />
            <MacroPill
              label="Carbs"
              value={dayTotal.carbs}
              color="var(--butter)"
              bg="var(--butter-soft)"
            />
            <MacroPill
              label="Fat"
              value={dayTotal.fat}
              color="var(--plum)"
              bg="var(--plum-soft)"
            />
          </div>
        )}

        {loadingDay ? (
          <Card
            style={{
              textAlign: "center",
              color: "var(--ink-soft)",
              fontSize: "13px",
            }}
          >
            Loading...
          </Card>
        ) : dayLogs.length === 0 ? (
          <Card
            style={{
              textAlign: "center",
              color: "var(--ink-soft)",
              fontSize: "13px",
            }}
          >
            No food logged on this day.
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {dayLogs.map((log) => (
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
                  <div>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        display: "block",
                      }}
                    >
                      {log.food_name}
                    </span>
                    <span
                      style={{ fontSize: "11px", color: "var(--ink-faint)" }}
                    >
                      {new Date(log.created_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span className="stat-number" style={{ fontSize: "14px" }}>
                    {log.calories} kcal
                  </span>
                  <button
                    onClick={() => handleDeleteEntry(log.id)}
                    style={deleteBtnStyle}
                    aria-label="Delete entry"
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

function MacroPill({ label, value, color, bg }) {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: "var(--radius-md)",
        padding: "8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "10px", color: "var(--ink-soft)" }}>{label}</div>
      <div className="stat-number" style={{ fontSize: "13px", color }}>
        {value}g
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }) {
  return (
    <div style={summaryMetricStyle}>
      <div style={{ fontSize: "10px", color: "var(--ink-soft)" }}>{label}</div>
      <div className="stat-number" style={{ fontSize: "16px" }}>
        {value}
      </div>
    </div>
  );
}

function buildWeeklySummary(logs, weekStart) {
  const dayMap = new Map();
  Array.from({ length: 7 }, (_, i) => {
    const date = toDateString(addDays(new Date(weekStart + "T00:00:00"), i));
    dayMap.set(date, {
      date,
      label: WEEKDAYS[i],
      count: 0,
    });
  });

  const topFoodMap = new Map();
  const totals = logs.reduce(
    (sum, log) => {
      const day = dayMap.get(log.log_date);
      if (day) day.count += 1;

      const name = log.food_name || "Meal";
      topFoodMap.set(name, (topFoodMap.get(name) || 0) + 1);

      return {
        protein: sum.protein + (log.protein || 0),
        carbs: sum.carbs + (log.carbs || 0),
        fat: sum.fat + (log.fat || 0),
      };
    },
    { protein: 0, carbs: 0, fat: 0 },
  );

  const loggedDays = Array.from(dayMap.values()).filter(
    (day) => day.count > 0,
  ).length;

  const topFoods = Array.from(topFoodMap, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);

  return {
    days: Array.from(dayMap.values()),
    mealCount: logs.length,
    loggedDays,
    avgMealsPerLoggedDay:
      loggedDays > 0 ? (logs.length / loggedDays).toFixed(1) : "0",
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    topFoods,
  };
}

const backBtnStyle = {
  background: "none",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  width: "34px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--ink)",
};

const monthNavBtnStyle = {
  background: "none",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  width: "28px",
  height: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--ink)",
};

const dayCellStyle = (isSelected, isToday) => ({
  aspectRatio: "1",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  border:
    isToday && !isSelected ? "1px solid var(--ember)" : "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  backgroundColor: isSelected ? "var(--ember)" : "transparent",
  color: isSelected ? "#fff" : "var(--ink)",
  fontSize: "13px",
  fontWeight: isToday || isSelected ? 700 : 500,
  cursor: "pointer",
});

const dotStyle = (isSelected) => ({
  width: "4px",
  height: "4px",
  borderRadius: "50%",
  backgroundColor: isSelected ? "#fff" : "var(--ember)",
});

const deleteBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--ink-faint)",
  cursor: "pointer",
  display: "flex",
  padding: "2px",
};

const mutedSmallStyle = {
  fontSize: "11px",
  color: "var(--ink-faint)",
  marginTop: "2px",
};

const emptySummaryStyle = {
  color: "var(--ink-soft)",
  fontSize: "13px",
  textAlign: "center",
  margin: "4px 0",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "8px",
  marginBottom: "10px",
};

const summaryMetricStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  padding: "9px 8px",
  textAlign: "center",
};

const weekStripStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: "5px",
  marginBottom: "10px",
};

const weekDayStyle = (active) => ({
  minHeight: "42px",
  borderRadius: "var(--radius-sm)",
  backgroundColor: active ? "var(--sprout-soft)" : "var(--card)",
  color: active ? "var(--sprout)" : "var(--ink-faint)",
  border: active ? "1px solid var(--sprout)" : "1px solid var(--line)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
});

const macroSummaryStyle = {
  display: "flex",
  gap: "8px",
};

const smallSectionTitleStyle = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ink-soft)",
  margin: "0 0 7px 0",
};

const topFoodStyle = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--ink)",
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  padding: "6px 9px",
};
