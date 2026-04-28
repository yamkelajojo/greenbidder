import { supabase } from "../config/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BUYER_PREFERENCES_KEY = "buyer_preferred_categories";

export const getCategories = async () => {
  const { data, error } = await supabase
    .from("produce_categories")
    .select("id, name, description, icon_url")
    .order("name");

  return { data, error };
};

export const FALLBACK_CATEGORIES = [
  { id: "1", name: "Fruits", emoji: "🍎", description: "Fresh fruits" },
  { id: "2", name: "Vegetables", emoji: "🥕", description: "Fresh vegetables" },
  { id: "3", name: "Grains", emoji: "🌾", description: "Grains and cereals" },
];

export const saveFarmerSpecializations = async (farmerProfileId, categoryIds) => {
  if (!farmerProfileId || !categoryIds || categoryIds.length === 0) {
    return { data: null, error: null };
  }

  const inserts = categoryIds.map((categoryId) => ({
    farmer_profile_id: farmerProfileId,
    category_id: categoryId,
  }));

  const { data, error } = await supabase
    .from("farmer_specializations")
    .upsert(inserts, { onConflict: "farmer_profile_id,category_id" })
    .select();

  return { data, error };
};

export const getFarmerSpecializations = async (farmerProfileId) => {
  const { data, error } = await supabase
    .from("farmer_specializations")
    .select("category_id")
    .eq("farmer_profile_id", farmerProfileId);

  return { data, error };
};

export const saveBuyerPreferences = async (buyerProfileId, categoryIds) => {
  if (!buyerProfileId || !categoryIds || categoryIds.length === 0) {
    return { data: null, error: null };
  }

  const { error: deleteError } = await supabase
    .from("buyer_preferred_categories")
    .delete()
    .eq("buyer_profile_id", buyerProfileId);

  if (deleteError) {
    console.warn("Failed to delete existing preferences:", deleteError);
  }

  const inserts = categoryIds.map((categoryId) => ({
    buyer_profile_id: buyerProfileId,
    category_id: categoryId,
  }));

  const { data, error } = await supabase
    .from("buyer_preferred_categories")
    .upsert(inserts, { onConflict: "buyer_profile_id,category_id" })
    .select();

  if (error) {
    await saveBuyerPreferencesLocally(categoryIds);
  }

  return { data, error };
};

export const getBuyerPreferences = async (buyerProfileId) => {
  const { data, error } = await supabase
    .from("buyer_preferred_categories")
    .select("category_id")
    .eq("buyer_profile_id", buyerProfileId);

  if (error) {
    const localData = await getBuyerPreferencesLocally();
    return { data: localData, error: null };
  }

  return { data, error };
};

const saveBuyerPreferencesLocally = async (categoryIds) => {
  try {
    await AsyncStorage.setItem(BUYER_PREFERENCES_KEY, JSON.stringify(categoryIds));
  } catch (e) {
    console.warn("Failed to save preferences locally:", e);
  }
};

const getBuyerPreferencesLocally = async () => {
  try {
    const stored = await AsyncStorage.getItem(BUYER_PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};