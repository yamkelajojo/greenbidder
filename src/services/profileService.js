import { supabase } from "../config/supabase";

/**
 * Profile service — handles profile creation after registration.
 * Criterion 2 — Service Layer. Criterion 3 — select specific fields.
 */

/**
 * Creates a farmer profile after registration.
 * @param {Object} params
 * @param {string} params.userId - The users table id
 * @param {string} params.farmName - Farm name
 * @param {string} [params.phone] - Phone number
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const createFarmerProfile = async ({ userId, farmName, phone }) => {
  const { data, error } = await supabase
    .from("farmer_profiles")
    .insert({ user_id: userId, farm_name: farmName, phone })
    .select("id, farm_name")
    .single();

  return { data, error };
};
/**
 * Creates a buyer profile after registration.
 * @param {Object} params
 * @param {string} params.userId - The users table id
 * @param {string} params.fullName - Buyer's full name
 * @param {string} [params.phone] - Phone number
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const createBuyerProfile = async ({ userId, fullName, phone }) => {
  const { data, error } = await supabase
    .from("buyer_profiles")
    .insert({ user_id: userId, full_name: fullName, phone })
    .select("id, full_name")
    .single();

  return { data, error };
};
