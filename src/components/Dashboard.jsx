import React from "react";

export default function Dashboard({ userStats }) {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Daily Overview</h2>

      {/* Calorie Card */}
      <div style={cardStyle}>
        <h3>🔥 Calories</h3>
        <p>
          Goal: <strong>{userStats.calorieGoal} kcal</strong>
        </p>
        <p>
          Consumed: <strong>{userStats.caloriesConsumed} kcal</strong>
        </p>
        <p>
          Remaining:{" "}
          <strong>
            {userStats.calorieGoal - userStats.caloriesConsumed} kcal
          </strong>
        </p>
      </div>

      {/* Steps & Activity Card */}
      <div style={cardStyle}>
        <h3>🚶 Daily Steps</h3>
        <p>
          <strong>{userStats.steps.toLocaleString()}</strong> /{" "}
          {userStats.stepGoal.toLocaleString()} steps
        </p>
      </div>
    </div>
  );
}

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "15px",
  marginBottom: "15px",
  backgroundColor: "#f9f9f9",
};
