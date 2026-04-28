import { useState, useEffect, useCallback } from "react";
import { getCategories, FALLBACK_CATEGORIES } from "../services/categoryService";

const CATEGORY_EMOJI_MAP = {
  Fruits: "🍎",
  Vegetables: "🥕",
  Grains: "🌾",
  Dairy: "🥛",
  Herbs: "🌿",
  Nuts: "🥜",
  Flowers: "💐",
  Meat: "🥩",
  Eggs: "🥚",
  Honey: "🍯",
};

export function useCategorySelection() {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getCategories();
      if (fetchError) throw fetchError;
      
      const categoriesWithEmoji = (data || []).map((cat) => ({
        ...cat,
        emoji: CATEGORY_EMOJI_MAP[cat.name] || "🌱",
      }));
      
      setCategories(categoriesWithEmoji);
    } catch (err) {
      console.error("Failed to load categories:", err);
      setError(err.message || "Failed to load categories");
      setCategories(FALLBACK_CATEGORIES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleCategory = useCallback((categoryId) => {
    setSelectedCategories((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(categoryId)) {
        newSelection.delete(categoryId);
      } else {
        newSelection.add(categoryId);
      }
      return newSelection;
    });
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    selectedCategories,
    toggleCategory,
    isLoading,
    error,
    loadCategories,
    selectionCount: selectedCategories.size,
  };
}

export default useCategorySelection;