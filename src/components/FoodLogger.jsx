import React, { useEffect, useState } from "react";
import {
  Bookmark,
  Camera,
  Clock3,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  Star,
  X,
} from "lucide-react";
import { analyzeFoodPhoto } from "../lib/logmeal";
import { resizeImageFile } from "../lib/imageResize";
import Card from "./ui/Card";
import Button from "./ui/Button";

const SAVED_FOODS_KEY = "fitnessTrackerSavedFoods";
const RECENT_FOODS_KEY = "fitnessTrackerRecentFoods";
const FOOD_FIELDS = [
  "name",
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
];

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
  const [savedFoods, setSavedFoods] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);

  useEffect(() => {
    setSavedFoods(readStoredFoods(SAVED_FOODS_KEY));
    setRecentFoods(readStoredFoods(RECENT_FOODS_KEY));
  }, []);

  const currentFood = () => ({
    name: foodName.trim(),
    calories: parseInt(calories) || 0,
    protein: parseInt(protein) || 0,
    carbs: parseInt(carbs) || 0,
    fat: parseInt(fat) || 0,
    fiber: parseInt(fiber) || 0,
    sugar: parseInt(sugar) || 0,
    sodium: parseInt(sodium) || 0,
  });

  const updateStoredFoods = (key, setter, foods) => {
    setter(foods);
    window.localStorage?.setItem(key, JSON.stringify(foods));
  };

  const rememberRecentFood = (food) => {
    if (!food.name) return;
    const next = dedupeFoods([food, ...recentFoods]).slice(0, 6);
    updateStoredFoods(RECENT_FOODS_KEY, setRecentFoods, next);
  };

  const handleSaveFood = () => {
    const food = currentFood();
    if (!food.name) return;
    const next = dedupeFoods([food, ...savedFoods]).slice(0, 12);
    updateStoredFoods(SAVED_FOODS_KEY, setSavedFoods, next);
  };

  const handleRemoveSavedFood = (food) => {
    const next = savedFoods.filter(
      (item) => item.name.toLowerCase() !== food.name.toLowerCase(),
    );
    updateStoredFoods(SAVED_FOODS_KEY, setSavedFoods, next);
  };

  const fillFromFood = (food) => {
    setFoodName(food.name || "");
    setCalories(food.calories || "");
    setProtein(food.protein || "");
    setCarbs(food.carbs || "");
    setFat(food.fat || "");
    setFiber(food.fiber || "");
    setSugar(food.sugar || "");
    setSodium(food.sodium || "");
    setScanComplete(true);
    setErrorMsg("");
  };

  const clearMealForm = () => {
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setSelectedImage(URL.createObjectURL(file));
      setErrorMsg("");
      setScanComplete(false);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setErrorMsg("");

    try {
      const resized = await resizeImageFile(imageFile);
      const data = await analyzeFoodPhoto(resized);

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
        err.message ||
          "Couldn't read that photo. Enter the details manually below.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!foodName || !calories) return;

    const meal = currentFood();
    onAddMeal(meal);
    rememberRecentFood(meal);
    clearMealForm();
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

      {(savedFoods.length > 0 || recentFoods.length > 0) && (
        <Card style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {savedFoods.length > 0 && (
            <FoodShortcutSection
              title="Saved foods"
              icon={<Bookmark size={16} color="var(--sprout)" />}
              foods={savedFoods}
              onUse={fillFromFood}
              onRemove={handleRemoveSavedFood}
              removable
            />
          )}

          {recentFoods.length > 0 && (
            <FoodShortcutSection
              title="Recent foods"
              icon={<Clock3 size={16} color="var(--ember)" />}
              foods={recentFoods}
              onUse={fillFromFood}
            />
          )}
        </Card>
      )}

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
          Snap a photo and LogMeal's food AI fills in calories and nutrients for
          you.
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
              {isAnalyzing ? "Analyzing photo..." : "Analyze with Food AI"}
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
        <Button
          type="button"
          variant="secondary"
          fullWidth
          size="sm"
          onClick={handleSaveFood}
          disabled={!foodName.trim()}
        >
          <Star size={15} />
          Save food shortcut
        </Button>
      </form>
    </div>
  );
}

function FoodShortcutSection({
  title,
  icon,
  foods,
  onUse,
  onRemove,
  removable = false,
}) {
  return (
    <div>
      <div style={shortcutHeaderStyle}>
        {icon}
        <h3 style={{ fontSize: "14px" }}>{title}</h3>
      </div>
      <div style={shortcutListStyle}>
        {foods.map((food) => (
          <div key={`${title}-${food.name}`} style={shortcutRowStyle}>
            <button
              type="button"
              onClick={() => onUse(food)}
              style={shortcutBtnStyle}
            >
              <span style={shortcutNameStyle}>{food.name}</span>
              <span style={shortcutMetaStyle}>
                {FOOD_FIELDS.slice(1, 5)
                  .map((field) =>
                    field === "calories"
                      ? `${food[field] || 0} kcal`
                      : `${food[field] || 0}g ${field}`,
                  )
                  .join(" · ")}
              </span>
            </button>
            {removable && (
              <button
                type="button"
                aria-label={`Remove ${food.name}`}
                onClick={() => onRemove(food)}
                style={removeShortcutStyle}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
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

function readStoredFoods(key) {
  try {
    return JSON.parse(window.localStorage?.getItem(key) || "[]")
      .map(normalizeStoredFood)
      .filter((food) => food.name);
  } catch {
    return [];
  }
}

function normalizeStoredFood(food) {
  return FOOD_FIELDS.reduce((acc, field) => {
    if (field === "name") {
      acc.name = String(food?.name || "").trim();
    } else {
      acc[field] = Number(food?.[field]) || 0;
    }
    return acc;
  }, {});
}

function dedupeFoods(foods) {
  const seen = new Set();
  return foods.map(normalizeStoredFood).filter((food) => {
    const key = food.name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

const shortcutHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginBottom: "8px",
};

const shortcutListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const shortcutRowStyle = {
  display: "flex",
  alignItems: "stretch",
  gap: "6px",
};

const shortcutBtnStyle = {
  flex: 1,
  minWidth: 0,
  display: "block",
  padding: "10px 12px",
  textAlign: "left",
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  color: "var(--ink)",
  cursor: "pointer",
};

const shortcutNameStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const shortcutMetaStyle = {
  display: "block",
  fontSize: "11px",
  color: "var(--ink-faint)",
  marginTop: "2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const removeShortcutStyle = {
  width: "34px",
  borderRadius: "var(--radius-md)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ink-faint)",
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  flexShrink: 0,
  cursor: "pointer",
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
