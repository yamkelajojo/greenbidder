import { supabase } from "../config/supabase";

/**
 * Authentication service — all auth operations.
 * Components call these functions, never supabase.auth directly.
 * Criterion 2 — API Service Layer.
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

export const loginUser = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
