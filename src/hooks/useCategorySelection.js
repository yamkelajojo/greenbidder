import { useState, useEffect, useCallback } from "react";
import { getCategories, FALLBACK_CATEGORIES } from "../services/categoryService";
import { CATEGORY_ICONS } from "../services/marketPriceService";

const DEFAULT_CATEGORY_ICON = "🌱";

export function useCategorySelection() {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const withIcons = (rows) =>
    (rows || []).map((cat) => ({
      ...cat,
      icon: CATEGORY_ICONS[cat.name] || DEFAULT_CATEGORY_ICON,
    }));

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getCategories();
      if (fetchError) throw fetchError;
      setCategories(withIcons(data));
    } catch (err) {
      console.error("Failed to load categories:", err);
      setError(err.message || "Failed to load categories");
      setCategories(withIcons(FALLBACK_CATEGORIES));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleCategory = useCallback((categoryId) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
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
