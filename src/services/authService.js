import { supabase } from "../config/supabase";

/**
 * Authentication service — all auth operations.
 * Components call these functions, never supabase.auth directly.
 * Criterion 2 — API Service Layer.
 */

/**
 * Registers a new user with Supabase Auth.
 * Role and name are stored in user metadata for the auth trigger.
 * @param {Object} params
 * @param {string} params.email - User's email address
 * @param {string} params.password - Password (min 8 chars, 1 uppercase, 1 number)
 * @param {"buyer"|"farmer"} params.role - User role for RBAC
 * @param {string} params.fullName - User's display name
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const registerUser = async ({ email, password, role, fullName }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName },
    },
  });
  return { data, error };
};

/**
 * Signs in an existing user with email and password.
 * @param {Object} params
 * @param {string} params.email - User's email address
 * @param {string} params.password - User's password
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const loginUser = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

/**
 * Signs out the current user and clears the session.
 * useAuth listener handles redirect to login screen.
 * @returns {Promise<{error: Object|null}>}
 */
export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
