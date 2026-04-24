import { supabase } from "../config/supabase";

/**
 * Listing service — all listing-related database operations.
 * Components call these functions, never supabase.from("listings") directly.
 * Criterion 2 — Service Layer | Criterion 3 — Query Optimisation.
 */

/**
 * Fetch active listings with farmer info and AI analysis.
 * Uses Supabase joins to avoid N+1 — one query fetches all related data.
 * @param {Object} [filters] - Optional filters
 * @param {string} [filters.categoryId] - Filter by category
 * @param {string} [filters.search] - Search term for title
 * @param {number} [filters.limit=20] - Max results
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getActiveListings = async (filters = {}) => {
  let query = supabase
    .from("listings")
    .select(
      `
      id, title, description, price, quantity, unit, 
      location_name, is_organic, view_count, save_count, created_at,
      farmer_profiles ( id, farm_name, avg_rating, is_verified ),
      produce_categories ( id, name, icon_url ),
      ai_analysis ( condition_score, ripeness_estimate ),
      listing_images ( id, image_url, is_primary )
    `,
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(20);
  }

  const { data, error } = await query;
  return { data, error };
};

/**
 * Fetch a single listing by ID with full details.
 * Includes all images, full AI analysis, and farmer profile.
 * @param {string} listingId - UUID of the listing
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const getListingById = async (listingId) => {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id, title, description, price, quantity, unit, status,
      location_name, location, is_organic, view_count, save_count,
      created_at, updated_at,
      farmer_profiles ( id, farm_name, avg_rating, is_verified, bio, phone, location_name ),
      produce_categories ( id, name ),
      ai_analysis ( condition_score, ripeness_estimate, growth_insight, price_suggestion_min, price_suggestion_max ),
      listing_images ( id, image_url, is_primary )
    `,
    )
    .eq("id", listingId)
    .single();

  return { data, error };
};

/**
 * Create a new listing (farmer only — RLS enforced).
 * @param {Object} listing - Listing data
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const createListing = async (listing) => {
  const { data, error } = await supabase
    .from("listings")
    .insert(listing)
    .select()
    .single();

  return { data, error };
};

/**
 * Update a listing (farmer own only — RLS enforced).
 * @param {string} listingId - UUID of the listing
 * @param {Object} updates - Fields to update
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const updateListing = async (listingId, updates) => {
  const { data, error } = await supabase
    .from("listings")
    .update(updates)
    .eq("id", listingId)
    .select()
    .single();

  return { data, error };
};

/**
 * Soft-delete a listing by setting status to "archived".
 * No actual DELETE — Criterion 3 integrity.
 * @param {string} listingId
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const archiveListing = async (listingId) => {
  return updateListing(listingId, { status: "archived" });
};

/**
 * Fetch nearby listings using PostGIS function.
 * @param {number} lat - Buyer latitude
 * @param {number} lng - Buyer longitude
 * @param {number} [radiusMeters=50000] - Search radius in meters
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getNearbyListings = async (lat, lng, radiusMeters = 50000) => {
  const { data, error } = await supabase.rpc("get_nearby_listings", {
    lat,
    lng,
    radius_meters: radiusMeters,
  });

  return { data, error };
};

/**
 * Fetch all produce categories.
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getCategories = async () => {
  const { data, error } = await supabase
    .from("produce_categories")
    .select("id, name, description, icon_url")
    .order("name");

  return { data, error };
};
