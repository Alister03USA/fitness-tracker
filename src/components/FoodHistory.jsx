import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trash2,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import Card from "./ui/Card";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const toDateString = (d) => {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
};

export default function FoodHistory({ session, onBack }) {
  const userId = session?.user?.id;
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [monthSummary, setMonthSummary] = useState({}); // { 'YYYY-MM-DD': { calories, count } }
  const [dayLogs, setDayLogs] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);

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

  useEffect(() => {
    fetchMonthSummary();
  }, [fetchMonthSummary]);

  useEffect(() => {
    fetchDayLogs();
  }, [fetchDayLogs]);

  const handleDeleteEntry = async (id) => {
    if (!window.confirm("Remove this entry?")) return;
    const { error } = await supabase.from("logs").delete().eq("id", id);
    if (error) {
      alert("Failed to delete: " + error.message);
    } else {
      fetchDayLogs();
      fetchMonthSummary();
    }
  };

  const changeMonth = (delta) => {
    const next = new Date(monthCursor);
    next.setMonth(next.getMonth() + delta);
    setMonthCursor(next);
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
