import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "../config/supabase";

/**
 * Auth context and hook — provides session, user, and role to the entire app.
 * Components access auth state via useAuth() — never by querying Supabase directly.
 * Criterion 4 — centralised authentication state.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          fetchUserRole(session.user.id);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Auth session check failed:", err.message);
        setIsLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Fetches user role from our users table.
   * @param {string} authId - The auth.users.id from Supabase Auth
   */
  const fetchUserRole = async (authId) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", authId)
        .single();

      if (error) throw error;
      setUserRole(data?.role ?? null);
    } catch (err) {
      console.warn("Failed to fetch user role:", err.message);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    session,
    user: session?.user ?? null,
    userRole,
    isLoading,
    isAuthenticated: !!session,
    isFarmer: userRole === "farmer",
    isBuyer: userRole === "buyer",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth state from any component.
 * @returns {{ session, user, userRole, isLoading, isAuthenticated, isFarmer, isBuyer }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
