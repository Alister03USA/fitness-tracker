import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export default function FoodLogger({ onAddMeal }) {
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
  const [scanComplete, setScanComplete] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setSelectedImage(URL.createObjectURL(file));
      setErrorMsg("");
      setScanComplete(false);
    }
  };

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

  const handleAnalyzePhoto = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setErrorMsg("");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const imagePart = await fileToGenerativePart(imageFile);

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

      setFoodName(data.foodName || "Unrecognized Dish");
      setCalories(data.calories || 0);
      setProtein(data.proteinGrams || 0);
      setCarbs(data.carbsGrams || 0);
      setFat(data.fatGrams || 0);
      setFiber(data.fiberGrams || 0);
      setSugar(data.sugarGrams || 0);
      setSodium(data.sodiumMg || 0);
      setScanComplete(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "Couldn't read that photo. Try another angle, or enter the details manually below.",
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
    setScanComplete(false);
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
      <h2 style={{ fontSize: "20px" }}>Log a meal</h2>

      {/* HERO: AI photo scan — the app's differentiator gets first position and full weight */}
      <Card accent="var(--ember)" style={{ backgroundColor: "#FFF8F4" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          <Sparkles size={18} color="var(--ember)" />
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>
            Scan a meal
          </h3>
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--ink-soft)",
            marginBottom: "14px",
          }}
        >
          Snap a photo and Gemini fills in calories and nutrients for you.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <label style={photoBtnStyle}>
            <Camera size={18} />
            Camera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
          </label>
          <label
            style={{
              ...photoBtnStyle,
              backgroundColor: "var(--card)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
            }}
          >
            <ImageIcon size={18} />
            Gallery
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {selectedImage && (
          <div style={{ textAlign: "center" }}>
            <img
              src={selectedImage}
              alt="Selected meal"
              style={{
                width: "100%",
                maxHeight: "220px",
                objectFit: "cover",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--line)",
                marginBottom: "12px",
              }}
            />
            <Button
              type="button"
              fullWidth
              onClick={handleAnalyzePhoto}
              disabled={isAnalyzing}
            >
              <Sparkles size={16} />
              {isAnalyzing
                ? "Analyzing nutrients..."
                : "Analyze with Gemini AI"}
            </Button>
          </div>
        )}

        {scanComplete && (
          <p
            style={{
              fontSize: "13px",
              color: "var(--sprout)",
              marginTop: "10px",
              fontWeight: 500,
            }}
          >
            ✓ Filled in below — review and save, or edit anything first.
          </p>
        )}

        {errorMsg && (
          <p
            style={{
              color: "var(--danger)",
              fontSize: "13px",
              marginTop: "10px",
            }}
          >
            {errorMsg}
          </p>
        )}
      </Card>

      {/* Core fields — always visible since every entry needs these */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <Card style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Food name</label>
            <input
              type="text"
              placeholder="e.g. Salmon bowl"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Calories (kcal)</label>
            <input
              type="number"
              placeholder="e.g. 550"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              style={inputStyle}
            />
          </div>
        </Card>

        {/* Progressive disclosure: collapsed by default for manual entry,
            auto-opened once a scan has filled it in so users can review it */}
        <details open={scanComplete}>
          <summary style={summaryStyle}>
            <span>Nutrition details</span>
            <ChevronDown size={16} />
          </summary>

          <Card
            style={{
              marginTop: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <h4 style={sectionHeadingStyle("var(--sprout)")}>
                Macronutrients (g)
              </h4>
              <div style={gridStyle}>
                <MiniField
                  label="Protein"
                  value={protein}
                  onChange={setProtein}
                  placeholder="30"
                />
                <MiniField
                  label="Carbs"
                  value={carbs}
                  onChange={setCarbs}
                  placeholder="45"
                />
                <MiniField
                  label="Fat"
                  value={fat}
                  onChange={setFat}
                  placeholder="15"
                />
              </div>
            </div>
            <div>
              <h4 style={sectionHeadingStyle("var(--plum)")}>Micronutrients</h4>
              <div style={gridStyle}>
                <MiniField
                  label="Fiber (g)"
                  value={fiber}
                  onChange={setFiber}
                  placeholder="5"
                />
                <MiniField
                  label="Sugar (g)"
                  value={sugar}
                  onChange={setSugar}
                  placeholder="8"
                />
                <MiniField
                  label="Sodium (mg)"
                  value={sodium}
                  onChange={setSodium}
                  placeholder="400"
                />
              </div>
            </div>
          </Card>
        </details>

        <Button type="submit" fullWidth size="md">
          Save meal
        </Button>
      </form>
    </div>
  );
}

function MiniField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label
        style={{
          fontSize: "11px",
          color: "var(--ink-soft)",
          display: "block",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "10px",
};

const sectionHeadingStyle = (color) => ({
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color,
  margin: "0 0 10px 0",
});

const summaryStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  listStyle: "none",
};

const photoBtnStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "12px",
  backgroundColor: "var(--ember)",
  color: "#fff",
  borderRadius: "var(--radius-md)",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};
