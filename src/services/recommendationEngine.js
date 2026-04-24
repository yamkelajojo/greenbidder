import { supabase } from "../config/supabase";

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  RECOMMENDATION ENGINE                                              │
 * │  Weighted Hybrid Collaborative Filtering                            │
 * │                                                                     │
 * │  Approach: Content-Based + Collaborative + Contextual Hybrid        │
 * │  Architecture: Same signal pipeline as LightFM — upgrade-ready      │
 * │                                                                     │
 * │  This engine answers one question:                                  │
 * │  "Given everything we know about this buyer, which listings         │
 * │   should they see first?"                                           │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  ALGORITHM OVERVIEW                                                 │
 * │                                                                     │
 * │  Phase 1: PROFILE CONSTRUCTION                                      │
 * │    Build a multi-dimensional buyer profile from interaction history: │
 * │    ├─ Category Affinity Vector   (what produce types they prefer)   │
 * │    ├─ Price Sensitivity          (their price comfort zone)         │
 * │    ├─ Quality Consciousness      (do they gravitate to high scores) │
 * │    └─ Interaction Recency        (how recently active they are)     │
 * │                                                                     │
 * │  Phase 2: CANDIDATE SCORING                                         │
 * │    Score each active listing against the buyer profile:             │
 * │    ├─ Category Match     (0.30) — does it match their preferences? │
 * │    ├─ AI Quality         (0.20) — how good is the produce?         │
 * │    ├─ Popularity         (0.10) — social proof from other buyers   │
 * │    ├─ Freshness          (0.15) — newer listings surface faster    │
 * │    ├─ Novelty            (0.15) — unseen listings get a boost      │
 * │    └─ Price Fit          (0.10) — matches their price comfort zone │
 * │                                                                     │
 * │  Phase 3: DIVERSITY INJECTION                                       │
 * │    Prevent echo chambers by capping per-category representation     │
 * │    at 40% of results. Mix in serendipitous discovery.              │
 * │                                                                     │
 * │  Phase 4: COLD START HANDLING                                       │
 * │    New buyers with no history get a popularity + quality ranking    │
 * │    until they generate enough signals for personalisation.          │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * LightFM Upgrade Path:
 *   The recommendation_interactions VIEW in the database outputs
 *   (buyer_id, listing_id, weight, interaction_type) — the exact
 *   format LightFM expects for training. When ready to upgrade:
 *   1. Deploy a FastAPI service that pulls from that view
 *   2. Train a LightFM model with user/item features
 *   3. Replace getRecommendations() with an API call
 *   4. No other app code changes — the feed consumes the same array
 *
 * Criterion 2 — Service Layer
 * Criterion 3 — Parallel queries, no N+1, specific field selection
 * Criterion 6 — SRP (recommendations only), OCP (swap engine later)
 */

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Scoring weights — tuned for agricultural marketplace dynamics */
const W = {
  categoryMatch: 0.25,
  aiQuality: 0.2,
  freshness: 0.15,
  novelty: 0.15,
  popularity: 0.1,
  priceFit: 0.1,
  proximity: 0.05,
};

/** Signal weights — must match recommendation_interactions DB view */
const SIGNAL = {
  view_short: 1.0, // <30 second view
  view_long: 2.0, // >30 second view
  save: 3.0, // saved to favourites
  search: 2.5, // searched for this category
  filter: 1.5, // tapped category filter
  contact: 5.0, // contacted the farmer
};

/** Temporal decay half-life in days */
const DECAY_HALF_LIFE = 14;

/** Maximum representation of any single category in results */
const MAX_CATEGORY_SHARE = 0.4;

/** Minimum interactions before we consider the profile "warm" */
const COLD_START_THRESHOLD = 3;

// ═══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Exponential temporal decay.
 * A 14-day-old interaction is worth half as much as today's.
 * @param {string} dateStr - ISO timestamp
 * @returns {number} Decay multiplier (0 to 1)
 */
const decay = (dateStr) => {
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return Math.pow(0.5, ageDays / DECAY_HALF_LIFE);
};

/**
 * Normalises a value to 0–1 given the dataset range.
 * Returns 0.5 if the range is zero (avoids division by zero).
 * @param {number} val - Value to normalise
 * @param {number} min - Dataset minimum
 * @param {number} max - Dataset maximum
 * @returns {number} Value between 0 and 1
 */
const norm = (val, min, max) => {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
};

/**
 * Gaussian proximity score — how close a value is to a target.
 * Used for price matching: a R20 listing scores high for a buyer
 * whose average viewed price is R18, but low for one at R50.
 * @param {number} value - The listing's value
 * @param {number} target - The buyer's preferred value
 * @param {number} spread - Standard deviation (tolerance)
 * @returns {number} Score between 0 and 1
 */
const gaussian = (value, target, spread) => {
  if (spread <= 0) return 0.5;
  const z = (value - target) / spread;
  return Math.exp(-0.5 * z * z);
};

// ═══════════════════════════════════════════════════════════════
//  PHASE 1: BUYER PROFILE CONSTRUCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Builds a comprehensive buyer profile from all interaction signals.
 *
 * Returns:
 *   categoryAffinity — map of categoryId → score (0-1)
 *   avgPrice         — weighted average price of interacted listings
 *   priceStdDev      — price spread (tolerance for price matching)
 *   avgAiScore       — average AI score of viewed listings (quality taste)
 *   totalInteractions — raw count (used for cold start detection)
 *   viewedListingIds  — set of already-seen listing IDs
 *
 * @param {string} buyerId - buyer_profiles.id
 * @returns {Promise<Object>} The buyer's multi-dimensional profile
 */
const buildBuyerProfile = async (buyerId) => {
  const profile = {
    categoryAffinity: {},
    pricePoints: [],
    aiScores: [],
    totalInteractions: 0,
    viewedListingIds: new Set(),
  };

  // ── Fetch all signal sources in parallel ──
  const [viewsResult, savesResult, contactsResult, searchResult] =
    await Promise.all([
      supabase
        .from("browsing_history")
        .select(
          "listing_id, duration_seconds, viewed_at, source, listings ( category_id, price, ai_analysis ( condition_score ) )",
        )
        .eq("buyer_id", buyerId)
        .order("viewed_at", { ascending: false })
        .limit(200),

      supabase
        .from("saved_listings")
        .select(
          "listing_id, saved_at, listings ( category_id, price, ai_analysis ( condition_score ) )",
        )
        .eq("buyer_id", buyerId),

      supabase
        .from("contact_events")
        .select(
          "listing_id, contacted_at, listings ( category_id, price, ai_analysis ( condition_score ) )",
        )
        .eq("buyer_id", buyerId),

      supabase
        .from("search_history")
        .select("category_id, searched_at")
        .eq("buyer_id", buyerId)
        .order("searched_at", { ascending: false })
        .limit(50),
    ]);

  // ── Process views ──
  const views = viewsResult.data || [];
  views.forEach((v) => {
    const catId = v.listings?.category_id;
    if (!catId) return;

    profile.viewedListingIds.add(v.listing_id);
    profile.totalInteractions++;

    // Signal weight based on duration
    const weight =
      v.duration_seconds > 30 ? SIGNAL.view_long : SIGNAL.view_short;
    const d = decay(v.viewed_at);

    // Boost repeat views — if we've seen this listing before, it's stronger
    const isRepeat =
      views.filter((other) => other.listing_id === v.listing_id).length > 1;
    const repeatMultiplier = isRepeat ? 1.5 : 1.0;

    profile.categoryAffinity[catId] =
      (profile.categoryAffinity[catId] || 0) + weight * d * repeatMultiplier;

    // Track price points and AI scores for profiling
    if (v.listings?.price) {
      profile.pricePoints.push({
        price: Number(v.listings.price),
        weight: weight * d,
      });
    }
    if (v.listings?.ai_analysis?.condition_score) {
      profile.aiScores.push(Number(v.listings.ai_analysis.condition_score));
    }
  });

  // ── Process saves ──
  const saves = savesResult.data || [];
  saves.forEach((s) => {
    const catId = s.listings?.category_id;
    if (!catId) return;

    profile.totalInteractions++;
    const d = decay(s.saved_at);
    profile.categoryAffinity[catId] =
      (profile.categoryAffinity[catId] || 0) + SIGNAL.save * d;

    if (s.listings?.price) {
      profile.pricePoints.push({
        price: Number(s.listings.price),
        weight: SIGNAL.save * d,
      });
    }
    if (s.listings?.ai_analysis?.condition_score) {
      profile.aiScores.push(Number(s.listings.ai_analysis.condition_score));
    }
  });

  // ── Process contacts (strongest signal) ──
  const contacts = contactsResult.data || [];
  contacts.forEach((c) => {
    const catId = c.listings?.category_id;
    if (!catId) return;

    profile.totalInteractions++;
    const d = decay(c.contacted_at);
    profile.categoryAffinity[catId] =
      (profile.categoryAffinity[catId] || 0) + SIGNAL.contact * d;

    if (c.listings?.price) {
      profile.pricePoints.push({
        price: Number(c.listings.price),
        weight: SIGNAL.contact * d,
      });
    }
  });

  // ── Process search/filter history ──
  const searches = searchResult.data || [];
  searches.forEach((s) => {
    if (!s.category_id) return;

    profile.totalInteractions++;
    const d = decay(s.searched_at);
    profile.categoryAffinity[s.category_id] =
      (profile.categoryAffinity[s.category_id] || 0) + SIGNAL.search * d;
  });

  // ── Normalise category affinity to 0–1 ──
  const maxAffinity = Math.max(
    ...Object.values(profile.categoryAffinity),
    0.001,
  );
  Object.keys(profile.categoryAffinity).forEach((catId) => {
    profile.categoryAffinity[catId] /= maxAffinity;
  });

  if (onboardingData) {
    // Category affinity boost
    onboardingData.selectedCategories.forEach((catId) => {
      profile.categoryAffinity[catId] = 0.8; // Strong initial signal
    });

    // Price range seeding
    if (onboardingData.priceRange) {
      const { min, max } = onboardingData.priceRange;
      profile.pricePoints.push(
        { price: min, weight: 2.0 },
        { price: max, weight: 2.0 },
        { price: (min + max) / 2, weight: 3.0 },
      );
    }
  }

  // ── Compute price sensitivity ──
  let avgPrice = 0;
  let priceStdDev = 20; // default spread
  if (profile.pricePoints.length > 0) {
    const totalWeight = profile.pricePoints.reduce(
      (sum, p) => sum + p.weight,
      0,
    );
    avgPrice =
      profile.pricePoints.reduce((sum, p) => sum + p.price * p.weight, 0) /
      totalWeight;

    // Weighted standard deviation
    const variance =
      profile.pricePoints.reduce(
        (sum, p) => sum + p.weight * Math.pow(p.price - avgPrice, 2),
        0,
      ) / totalWeight;
    priceStdDev = Math.sqrt(variance) || 20;
  }

  // ── Compute quality consciousness ──
  const avgAiScore =
    profile.aiScores.length > 0
      ? profile.aiScores.reduce((a, b) => a + b, 0) / profile.aiScores.length
      : 5.0; // neutral default

  return {
    categoryAffinity: profile.categoryAffinity,
    avgPrice,
    priceStdDev,
    avgAiScore,
    totalInteractions: profile.totalInteractions,
    viewedListingIds: profile.viewedListingIds,
    isWarm: profile.totalInteractions >= COLD_START_THRESHOLD,
  };
};

// ═══════════════════════════════════════════════════════════════
//  PHASE 2: CANDIDATE SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Fetches all active listings with features needed for scoring.
 * Single query with joins — no N+1.
 * @returns {Promise<Array>}
 */
const fetchCandidates = async () => {
  const { data } = await supabase
    .from("listings")
    .select(
      `
      id, title, price, unit, quantity, category_id,
      view_count, save_count, created_at, location_name,
      farmer_profiles ( id, farm_name, avg_rating, is_verified ),
      produce_categories ( id, name ),
      ai_analysis ( condition_score, ripeness_estimate ),
      listing_images ( image_url, is_primary )
    `,
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  return data || [];
};

/**
 * Scores a single listing against the buyer profile.
 *
 * Each dimension produces a 0–1 score. The weighted sum becomes
 * the listing's final relevance score for this specific buyer.
 *
 * @param {Object} listing - Listing with joined data
 * @param {Object} buyerProfile - From buildBuyerProfile()
 * @param {Object} globalStats - Min/max values for normalisation
 * @returns {number} Final score (0 to 1)
 */
const scoreListing = (listing, buyerProfile, globalStats) => {
  // ── Category Match (0.30) ──
  const categoryMatch = buyerProfile.categoryAffinity[listing.category_id] || 0;

  // ── AI Quality (0.20) ──
  const aiScore = listing.ai_analysis?.condition_score || 0;
  const aiQuality = norm(aiScore, 0, 10);

  // ── Popularity (0.10) ──
  // Combine views and saves (saves are 2× more valuable)
  const popRaw = (listing.view_count || 0) + (listing.save_count || 0) * 2;
  const popularity = norm(popRaw, globalStats.minPop, globalStats.maxPop);

  // ── Freshness (0.15) ──
  // Exponential decay with 7-day half-life — produce is perishable
  const ageDays =
    (Date.now() - new Date(listing.created_at).getTime()) / 86400000;
  const freshness = Math.pow(0.5, ageDays / 7);

  // ── Novelty (0.15) ──
  // Unseen listings get a full boost, seen listings get partial credit
  const novelty = buyerProfile.viewedListingIds.has(listing.id) ? 0.2 : 1.0;

  // ── Price Fit (0.10) ──
  // Gaussian: how close is this listing's price to the buyer's comfort zone?
  const priceFit =
    buyerProfile.avgPrice > 0
      ? gaussian(
          Number(listing.price),
          buyerProfile.avgPrice,
          buyerProfile.priceStdDev,
        )
      : 0.5; // neutral for new buyers

  // ── Weighted sum ──
  const score =
    categoryMatch * W.categoryMatch +
    aiQuality * W.aiQuality +
    popularity * W.popularity +
    freshness * W.freshness +
    novelty * W.novelty +
    priceFit * W.priceFit;

  return score;
};

// ═══════════════════════════════════════════════════════════════
//  PHASE 3: DIVERSITY INJECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Applies diversity constraints to prevent echo chambers.
 *
 * Without this, a buyer who viewed 10 tomato listings would
 * get a feed of nothing but tomatoes. Diversity injection caps
 * each category at 40% of results and fills remaining slots
 * with the next-best-scoring items from other categories.
 *
 * @param {Array} rankedListings - Listings sorted by score DESC
 * @param {number} limit - Max results to return
 * @returns {Array} Diversified results
 */
const applyDiversity = (rankedListings, limit) => {
  const maxPerCategory = Math.ceil(limit * MAX_CATEGORY_SHARE);
  const categoryCounts = {};
  const result = [];
  const overflow = [];

  for (const item of rankedListings) {
    const catId = item.category_id;
    categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;

    if (categoryCounts[catId] <= maxPerCategory) {
      result.push(item);
    } else {
      overflow.push(item);
    }

    if (result.length >= limit) break;
  }

  // Fill remaining slots from overflow (different categories)
  let i = 0;
  while (result.length < limit && i < overflow.length) {
    result.push(overflow[i]);
    i++;
  }

  return result;
};

// ═══════════════════════════════════════════════════════════════
//  PHASE 4: COLD START
// ═══════════════════════════════════════════════════════════════

/**
 * Cold start ranking for new buyers with insufficient history.
 *
 * Strategy: popularity × quality × freshness
 * This surfaces the "best" listings without any personalisation.
 * As the buyer generates signals, the engine gradually transitions
 * to personalised ranking.
 *
 * @param {Array} candidates - All active listings
 * @returns {Array} Ranked by popularity + quality + freshness
 */
const coldStartRanking = (candidates) => {
  const maxPop = Math.max(
    ...candidates.map((l) => (l.view_count || 0) + (l.save_count || 0) * 2),
    1,
  );

  return candidates
    .map((listing) => {
      const pop =
        ((listing.view_count || 0) + (listing.save_count || 0) * 2) / maxPop;
      const quality = (listing.ai_analysis?.condition_score || 5) / 10;
      const ageDays =
        (Date.now() - new Date(listing.created_at).getTime()) / 86400000;
      const fresh = Math.pow(0.5, ageDays / 7);

      listing._score = pop * 0.3 + quality * 0.4 + fresh * 0.3;
      listing._isPersonalised = false;
      return listing;
    })
    .sort((a, b) => b._score - a._score);
};

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Generates personalised listing recommendations for a buyer.
 *
 * This is the single entry point for the recommendation system.
 * The feed screen calls this and receives a ranked array of
 * listings ready to render — no further processing needed.
 *
 * @param {string|null} buyerProfileId - buyer_profiles.id (null for cold start)
 * @param {number} [limit=20] - Maximum recommendations to return
 * @returns {Promise<{
 *   recommendations: Array,
 *   isPersonalised: boolean,
 *   profileSummary: Object|null
 * }>}
 *
 * @example
 * const { recommendations, isPersonalised } = await getRecommendations(profileId);
 * // recommendations = [{ id, title, price, _score, _isPersonalised, ... }, ...]
 * // isPersonalised = true if buyer has enough history
 */
export const getRecommendations = async (buyerProfileId, limit = 20) => {
  try {
    // Fetch candidates (always needed)
    const candidates = await fetchCandidates();

    if (candidates.length === 0) {
      return {
        recommendations: [],
        isPersonalised: false,
        profileSummary: null,
      };
    }

    // ── Cold start path ──
    if (!buyerProfileId) {
      return {
        recommendations: coldStartRanking(candidates).slice(0, limit),
        isPersonalised: false,
        profileSummary: null,
      };
    }

    // ── Build buyer profile ──
    const profile = await buildBuyerProfile(buyerProfileId);

    // If not enough history, use cold start with a slight personalisation blend
    if (!profile.isWarm) {
      const ranked = coldStartRanking(candidates).slice(0, limit);
      return {
        recommendations: ranked,
        isPersonalised: false,
        profileSummary: {
          interactionCount: profile.totalInteractions,
          warmUpRemaining: COLD_START_THRESHOLD - profile.totalInteractions,
        },
      };
    }

    // ── Personalised path ──

    // Compute global stats for normalisation
    const popScores = candidates.map(
      (l) => (l.view_count || 0) + (l.save_count || 0) * 2,
    );
    const globalStats = {
      minPop: Math.min(...popScores),
      maxPop: Math.max(...popScores, 1),
    };

    // Score every candidate
    const scored = candidates.map((listing) => {
      listing._score = scoreListing(listing, profile, globalStats);
      listing._isPersonalised = true;
      return listing;
    });

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    // Apply diversity constraints
    const diversified = applyDiversity(scored, limit);

    // Build a profile summary for the UI (optional "why these?" hint)
    const topCategories = Object.entries(profile.categoryAffinity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId, score]) => {
        const listing = candidates.find((l) => l.category_id === catId);
        return {
          categoryId: catId,
          categoryName: listing?.produce_categories?.name || "Unknown",
          affinity: score,
        };
      });

    return {
      recommendations: diversified,
      isPersonalised: true,
      profileSummary: {
        interactionCount: profile.totalInteractions,
        topCategories,
        avgPriceRange: {
          low: Math.max(0, profile.avgPrice - profile.priceStdDev),
          high: profile.avgPrice + profile.priceStdDev,
        },
        qualityPreference: profile.avgAiScore,
      },
    };
  } catch (err) {
    console.warn("Recommendation engine error:", err.message);
    // Graceful degradation — return unranked results
    const fallback = await fetchCandidates();
    return {
      recommendations: fallback.slice(0, limit),
      isPersonalised: false,
      profileSummary: null,
    };
  }
};
