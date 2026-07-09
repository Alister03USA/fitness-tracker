import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export default function FoodLogger({ onAddMeal }) {
  const [logMethod, setLogMethod] = useState("photo");
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");

  // Macronutrients State
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // Micronutrients State
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Handle Image File Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setSelectedImage(URL.createObjectURL(file));
      setErrorMsg("");
    }
  };

  // Convert File to Base64
  const fileToGenerativePart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(",")[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Analyze Photo for Calories + Macros + Micros
  const handleAnalyzePhoto = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setErrorMsg("");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const imagePart = await fileToGenerativePart(imageFile);

      // Prompt asking for detailed Macro & Micro nutrient breakdown
      const prompt = `
        Analyze this food image. Identify the meal and estimate its total calories, macronutrients, and key micronutrients.
        Respond STRICTLY in JSON format without markdown wrapping, matching this exact schema:
        {
          "foodName": "Name of dish",
          "calories": 500,
          "proteinGrams": 30,
          "carbsGrams": 45,
          "fatGrams": 15,
          "fiberGrams": 6,
          "sugarGrams": 5,
          "sodiumMg": 450
        }
      `;

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();

      const cleanJson = responseText.replace(/```json|```/g, "").trim();
      const data = JSON.parse(cleanJson);

      // Auto-fill form state
      setFoodName(data.foodName || "Unrecognized Dish");
      setCalories(data.calories || 0);
      setProtein(data.proteinGrams || 0);
      setCarbs(data.carbsGrams || 0);
      setFat(data.fatGrams || 0);
      setFiber(data.fiberGrams || 0);
      setSugar(data.sugarGrams || 0);
      setSodium(data.sodiumMg || 0);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "Failed to analyze image. Please try again or enter details manually.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!foodName || !calories) return;

    onAddMeal({
      name: foodName,
      calories: parseInt(calories),
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
      fiber: parseInt(fiber) || 0,
      sugar: parseInt(sugar) || 0,
      sodium: parseInt(sodium) || 0,
    });

    // Reset Form
    setFoodName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFiber("");
    setSugar("");
    setSodium("");
    setSelectedImage(null);
    setImageFile(null);
    alert(`Logged ${foodName} with full nutrient breakdown!`);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Log Activity & Nutrition</h2>

      {/* Mode Switcher */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setLogMethod("photo")}
          style={toggleBtnStyle(logMethod === "photo")}
        >
          📷 AI Photo Scan
        </button>
        <button
          onClick={() => setLogMethod("manual")}
          style={toggleBtnStyle(logMethod === "manual")}
        >
          ✍️ Manual Input
        </button>
      </div>

      {/* Photo Mode */}
      {logMethod === "photo" && (
        <div style={cardStyle}>
          <h3>Capture or Upload Meal Photo</h3>

          {/* Buttons to select Camera vs Gallery */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <label style={cameraBtnStyle}>
              📸 Take Photo (Camera)
              <input
                type="file"
                accept="image/*"
                capture="environment" /* Forces rear camera on mobile devices */
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
            </label>

            <label style={galleryBtnStyle}>
              🖼️ Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {/* Selected/Captured Image Preview */}
          {selectedImage && (
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <img
                src={selectedImage}
                alt="Captured Meal"
                style={{
                  width: "100%",
                  maxHeight: "250px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
              />
              <button
                onClick={handleAnalyzePhoto}
                disabled={isAnalyzing}
                style={actionBtnStyle}
              >
                {isAnalyzing
                  ? "⚡ Gemini AI Analyzing Nutrients..."
                  : "✨ Analyze Meal with Gemini AI"}
              </button>
            </div>
          )}

          {errorMsg && (
            <p style={{ color: "red", fontSize: "14px", marginTop: "10px" }}>
              {errorMsg}
            </p>
          )}
        </div>
      )}

      {/* Meal & Nutrient Form */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <div>
          <label>
            <strong>Food Name:</strong>
          </label>
          <input
            type="text"
            placeholder="e.g. Salmon Bowl"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label>
            <strong>Total Calories (kcal):</strong>
          </label>
          <input
            type="number"
            placeholder="e.g. 550"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* MACRONUTRIENTS SECTION */}
        <div style={sectionBoxStyle}>
          <h4 style={{ margin: "0 0 10px 0", color: "#007bff" }}>
            📊 Macronutrients (g)
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label style={subLabelStyle}>Protein (g)</label>
              <input
                type="number"
                placeholder="30"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={subLabelStyle}>Carbs (g)</label>
              <input
                type="number"
                placeholder="45"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={subLabelStyle}>Fat (g)</label>
              <input
                type="number"
                placeholder="15"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* MICRONUTRIENTS SECTION */}
        <div style={sectionBoxStyle}>
          <h4 style={{ margin: "0 0 10px 0", color: "#28a745" }}>
            🥗 Micronutrients
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label style={subLabelStyle}>Fiber (g)</label>
              <input
                type="number"
                placeholder="5"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={subLabelStyle}>Sugar (g)</label>
              <input
                type="number"
                placeholder="8"
                value={sugar}
                onChange={(e) => setSugar(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={subLabelStyle}>Sodium (mg)</label>
              <input
                type="number"
                placeholder="400"
                value={sodium}
                onChange={(e) => setSodium(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <button type="submit" style={saveBtnStyle}>
          💾 Save Full Meal Log
        </button>
      </form>
    </div>
  );
}

// Inline Styles
const cardStyle = {
  border: "1px dashed #007bff",
  borderRadius: "8px",
  padding: "15px",
  marginBottom: "15px",
  backgroundColor: "#f0f7ff",
};
const sectionBoxStyle = {
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "12px",
  backgroundColor: "#fafafa",
};
const subLabelStyle = {
  fontSize: "12px",
  color: "#555",
  display: "block",
  marginBottom: "4px",
};
const inputStyle = {
  width: "100%",
  padding: "10px",
  fontSize: "15px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  marginTop: "2px",
  boxSizing: "border-box",
};
const toggleBtnStyle = (isActive) => ({
  flex: 1,
  padding: "10px",
  border: "1px solid #007bff",
  borderRadius: "6px",
  backgroundColor: isActive ? "#007bff" : "#fff",
  color: isActive ? "#fff" : "#007bff",
  fontWeight: "bold",
  cursor: "pointer",
});
const actionBtnStyle = {
  marginTop: "10px",
  padding: "12px",
  width: "100%",
  backgroundColor: "#28a745",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "pointer",
};
const saveBtnStyle = {
  padding: "14px",
  backgroundColor: "#333",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "16px",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "10px",
};

const cameraBtnStyle = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#28a745",
  color: "white",
  textAlign: "center",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "14px",
};

const galleryBtnStyle = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#6c757d",
  color: "white",
  textAlign: "center",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "14px",
};
