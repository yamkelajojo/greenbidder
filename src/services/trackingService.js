import { supabase } from "../config/supabase";

/**
 * Tracking service — silently records user interactions.
 *
 * Every function here is fire-and-forget. If tracking fails,
 * the app continues normally — tracking must never break UX.
 *
 * These interactions feed the recommendation_interactions view
 * which powers personalised discovery for buyers.
 *
 * Signal weights (defined in the DB view):
 *   - View (<30s):  1.0
 *   - View (>30s):  2.0  (deeper interest)
 *   - Save:         3.0
 *   - Contact:      5.0  (strongest purchase intent)
 *
 * Criterion 2 — Service Layer
 * Criterion 6 — Single Responsibility (tracking only)
 */

/**
 * Records a listing view with duration.
 * Called when the buyer leaves the listing detail screen.
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} listingId - listings.id
 * @param {number} durationSeconds - time spent viewing
 * @param {"feed"|"search"|"recommendation"|"direct"} [source="feed"]
 */
export const trackView = async (
  buyerProfileId,
  listingId,
  durationSeconds,
  source = "feed",
) => {
  try {
    if (!buyerProfileId || !listingId) return;

    await supabase.from("browsing_history").insert({
      buyer_id: buyerProfileId,
      listing_id: listingId,
      duration_seconds: Math.max(Math.floor(durationSeconds), 1),
      source,
    });
  } catch (err) {
    // Silent fail — tracking never breaks UX
    console.warn("Track view failed:", err.message);
  }
};

/**
 * Records a contact event (call, WhatsApp, in-app).
 * Strongest purchase intent signal — weight 5.0 in recommendations.
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} listingId - listings.id
 * @param {"in_app"|"phone"|"whatsapp"} [method="in_app"]
 */
export const trackContact = async (
  buyerProfileId,
  listingId,
  method = "in_app",
) => {
  try {
    if (!buyerProfileId || !listingId) return;

    await supabase.from("contact_events").insert({
      buyer_id: buyerProfileId,
      listing_id: listingId,
      contact_method: method,
    });
  } catch (err) {
    console.warn("Track contact failed:", err.message);
  }
};

/**
 * Records a search query for recommendation tuning.
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} query - search text
 * @param {string|null} categoryId - filtered category if any
 * @param {number} resultsCount - how many results were shown
 */
export const trackSearch = async (
  buyerProfileId,
  query,
  categoryId = null,
  resultsCount = 0,
) => {
  try {
    if (!buyerProfileId || !query) return;

    await supabase.from("search_history").insert({
      buyer_id: buyerProfileId,
      query,
      category_id: categoryId,
      results_count: resultsCount,
    });
  } catch (err) {
    console.warn("Track search failed:", err.message);
  }
};
