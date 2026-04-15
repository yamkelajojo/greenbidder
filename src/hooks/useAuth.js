import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "../config/supabase";

/**
 * Auth context — the single source of truth for identity in the app.
 *
 * Every screen that needs to know "who is this user?" reads from here.
 * No screen should ever query the users, farmer_profiles, or buyer_profiles
 * tables directly for identity — that's what this hook provides.
 *
 * Cached at login:
 *   - session & auth user (from Supabase Auth)
 *   - appUserId (our users table UUID — needed for all RLS queries)
 *   - userRole ("farmer" | "buyer")
 *   - profileId (farmer_profiles.id or buyer_profiles.id)
 *   - profileData (farm_name, full_name, phone, location, etc.)
 *
 * Criterion 4 — centralised auth state
 * Criterion 3 — eliminates redundant profile lookups across screens
 * Criterion 6 — Single Responsibility: identity lives here, nowhere else
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [appUserId, setAppUserId] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          loadFullIdentity(session.user.id);
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Auth session check failed:", err.message);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await loadFullIdentity(session.user.id);
      } else {
        clearIdentity();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Loads the complete user identity in one pass.
   * Called once at login — every screen reads from cache after this.
   *
   * Flow:
   *   1. Fetch users row (id, role) by auth_id
   *   2. Based on role, fetch the correct profile table
   *   3. Cache everything in state
   *
   * @param {string} authId - The auth.users.id from Supabase Auth
   */
  const loadFullIdentity = async (authId) => {
    try {
      // Step 1: Get app user record
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, role")
        .eq("auth_id", authId)
        .single();

      if (userError || !userData) {
        console.warn("User record not found:", userError?.message);
        setIsLoading(false);
        return;
      }

      setAppUserId(userData.id);
      setUserRole(userData.role);

      // Step 2: Load role-specific profile
      if (userData.role === "farmer") {
        const { data: farmerProfile } = await supabase
          .from("farmer_profiles")
          .select(
            "id, farm_name, phone, bio, avg_rating, is_verified, location, location_name",
          )
          .eq("user_id", userData.id)
          .single();

        if (farmerProfile) {
          setProfileId(farmerProfile.id);
          setProfileData({
            farmName: farmerProfile.farm_name,
            phone: farmerProfile.phone,
            bio: farmerProfile.bio,
            avgRating: farmerProfile.avg_rating,
            isVerified: farmerProfile.is_verified,
            location: farmerProfile.location,
            locationName: farmerProfile.location_name,
          });
        }
      } else if (userData.role === "buyer") {
        const { data: buyerProfile } = await supabase
          .from("buyer_profiles")
          .select(
            "id, full_name, phone, preferred_radius_km, location, location_name",
          )
          .eq("user_id", userData.id)
          .single();

        if (buyerProfile) {
          setProfileId(buyerProfile.id);
          setProfileData({
            fullName: buyerProfile.full_name,
            phone: buyerProfile.phone,
            preferredRadius: buyerProfile.preferred_radius_km,
            location: buyerProfile.location,
            locationName: buyerProfile.location_name,
          });
        }
      }
    } catch (err) {
      console.warn("Identity load failed:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clears all cached identity on logout.
   * Ensures no stale data leaks between sessions.
   */
  const clearIdentity = () => {
    setUserRole(null);
    setAppUserId(null);
    setProfileId(null);
    setProfileData(null);
    setIsLoading(false);
  };

  const value = {
    // Auth
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: !!session,

    // Identity (cached — no extra queries needed)
    userRole,
    appUserId,
    profileId,
    profileData,

    // Convenience booleans
    isFarmer: userRole === "farmer",
    isBuyer: userRole === "buyer",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth and identity state from any component.
 *
 * @returns {{
 *   session: Object|null,
 *   user: Object|null,
 *   isLoading: boolean,
 *   isAuthenticated: boolean,
 *   userRole: "farmer"|"buyer"|null,
 *   appUserId: string|null,
 *   profileId: string|null,
 *   profileData: Object|null,
 *   isFarmer: boolean,
 *   isBuyer: boolean,
 * }}
 *
 * @example
 * // In a farmer screen:
 * const { profileId, profileData } = useAuth();
 * // profileId = farmer_profiles.id (ready to use in queries)
 * // profileData.farmName = "Test Farm"
 *
 * @example
 * // In a buyer screen:
 * const { profileId, isBuyer } = useAuth();
 * // profileId = buyer_profiles.id (ready for saved_listings queries)
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
