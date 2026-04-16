import { supabase } from "../config/supabase";

/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  TRACKING SERVICE — Behavioral Signal Capture               │
 * │                                                             │
 * │  Every function here is fire-and-forget. If tracking fails, │
 * │  the app continues normally. Tracking must NEVER break UX.  │
 * │                                                             │
 * │  These signals feed the recommendation engine which ranks   │
 * │  listings personally for each buyer.                        │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Signal Taxonomy:
 * ────────────────
 * TIER 1 — Explicit Intent (buyer told us what they want)
 *   Contact farmer     → weight 5.0 (strongest purchase signal)
 *   Save listing       → weight 3.0 (planning to buy)
 *   Search query       → weight 2.5 (typed exactly what they want)
 *   Category filter    → weight 1.5 (chose a category deliberately)
 *
 * TIER 2 — Behavioral (buyer showed us what they want)
 *   Long view (>30s)   → weight 2.0 (genuine interest)
 *   Short view (<30s)  → weight 1.0 (casual browse)
 *   Repeat view        → weight 3.0 (came back — very strong signal)
 *   Price range        → implicit (derived from viewed listing prices)
 *
 * TIER 3 — Negative Signals (what they DON'T want)
 *   Quick bounce (<5s) → weight -0.5 (saw it, not interested)
 *   Unsave             → weight -1.0 (changed their mind)
 *
 * Criterion 2 — Service Layer
 * Criterion 6 — Single Responsibility (tracking only)
 */

/**
 * Records a listing view with duration and source.
 *
 * This is the most common signal. Duration distinguishes casual
 * browsing from genuine interest — a 45-second view is worth 2×
 * a 10-second view in the recommendation engine.
 *
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} listingId - listings.id
 * @param {number} durationSeconds - time spent on the listing
 * @param {"feed"|"search"|"recommendation"|"saved"|"direct"} source - where they came from
 */
export const trackView = async (
  buyerProfileId,
  listingId,
  durationSeconds,
  source = "feed"
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
    // Silent — tracking never breaks UX
  }
};

/**
 * Records a contact event — the strongest purchase intent signal.
 *
 * When a buyer contacts a farmer, they've decided this produce is
 * worth pursuing. The recommendation engine treats this as 5× more
 * valuable than a casual view.
 *
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} listingId - listings.id
 * @param {"in_app"|"phone"|"whatsapp"} method - how they contacted
 */
export const trackContact = async (
  buyerProfileId,
  listingId,
  method = "in_app"
) => {
  try {
    if (!buyerProfileId || !listingId) return;

    await supabase.from("contact_events").insert({
      buyer_id: buyerProfileId,
      listing_id: listingId,
      contact_method: method,
    });
  } catch (err) {
    // Silent
  }
};

/**
 * Records a search query — explicit intent signal.
 *
 * What a buyer types into search tells us exactly what they're
 * looking for. Combined with which results they then view, this
 * creates a powerful intent signal.
 *
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} query - the search text
 * @param {string|null} categoryId - category filter if applied
 * @param {number} resultsCount - how many results were shown
 */
export const trackSearch = async (
  buyerProfileId,
  query,
  categoryId = null,
  resultsCount = 0
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
    // Silent
  }
};

/**
 * Records a category filter tap on the feed.
 *
 * When a buyer taps "Tomatoes" on the filter bar, that's a
 * deliberate category selection — stronger than just scrolling
 * past a tomato listing.
 *
 * We store this in search_history with a structured query
 * so the recommendation engine can extract category intent.
 *
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} categoryId - the category they tapped
 * @param {string} categoryName - category display name
 * @param {number} resultsCount - listings shown for this filter
 */
export const trackCategoryFilter = async (
  buyerProfileId,
  categoryId,
  categoryName,
  resultsCount = 0
) => {
  try {
    if (!buyerProfileId || !categoryId) return;

    await supabase.from("search_history").insert({
      buyer_id: buyerProfileId,
      query: `category:${categoryName}`,
      category_id: categoryId,
      results_count: resultsCount,
    });
  } catch (err) {
    // Silent
  }
};

/**
 * Records a market price category view.
 *
 * When a buyer researches prices for a specific category on the
 * Prices tab, they're expressing research intent — they're
 * thinking about buying that produce type.
 *
 * @param {string} buyerProfileId - buyer_profiles.id
 * @param {string} categoryId - category they're researching
 * @param {string} categoryName - category display name
 */
export const trackPriceResearch = async (
  buyerProfileId,
  categoryId,
  categoryName
) => {
  try {
    if (!buyerProfileId || !categoryId) return;

    await supabase.from("search_history").insert({
      buyer_id: buyerProfileId,
      query: `price_research:${categoryName}`,
      category_id: categoryId,
      results_count: 0,
    });
  } catch (err) {
    // Silent
  }
};
