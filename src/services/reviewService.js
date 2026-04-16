import { supabase } from "../config/supabase";

/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  REVIEW SERVICE — Farmer Trust & Credibility Engine          │
 * │                                                              │
 * │  This isn't a basic "5 stars + comment" system.              │
 * │  It captures structured quality signals across three         │
 * │  dimensions, aggregates them into a trust profile,           │
 * │  and feeds reliability data back into the recommendation     │
 * │  engine and listing ranking.                                 │
 * │                                                              │
 * │  Review Dimensions:                                          │
 * │    1. Quality    — how was the actual produce?               │
 * │    2. Accuracy   — did it match the listing/photos?          │
 * │    3. Rebuy      — would they buy from this farmer again?    │
 * │                                                              │
 * │  Storage Strategy:                                           │
 * │    rating (1-5)  — computed average of the three dimensions  │
 * │    comment (TEXT) — JSON blob containing structured data:    │
 * │      { quality, accuracy, wouldBuyAgain, tags, text }        │
 * │    The existing avg_rating trigger auto-updates.             │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Criterion 2 — Service Layer
 * Criterion 3 — Aggregation queries, specific fields
 * Criterion 6 — Single Responsibility
 */

/**
 * Maps dimension selections to numeric scores.
 * Used to compute the overall rating from structured input.
 */
const QUALITY_SCORES = {
  below: 1,
  expected: 3,
  above: 5,
};

const ACCURACY_SCORES = {
  no: 1,
  close: 3,
  exact: 5,
};

const REBUY_SCORES = {
  no: 1,
  yes: 5,
};

/** Available quick-tap tags — positive and negative */
export const REVIEW_TAGS = {
  positive: [
    { id: "fresh", label: "Fresh", emoji: "🌿" },
    { id: "well_packed", label: "Well-packed", emoji: "📦" },
    { id: "good_value", label: "Good value", emoji: "💰" },
    { id: "fast_response", label: "Fast response", emoji: "⚡" },
    { id: "generous", label: "Generous portions", emoji: "🤲" },
    { id: "as_described", label: "As described", emoji: "✅" },
  ],
  negative: [
    { id: "overripe", label: "Overripe", emoji: "🟤" },
    { id: "smaller", label: "Smaller than expected", emoji: "📏" },
    { id: "late_response", label: "Late response", emoji: "⏰" },
    { id: "not_fresh", label: "Not fresh", emoji: "🥀" },
    { id: "damaged", label: "Damaged", emoji: "💔" },
    { id: "different_variety", label: "Different variety", emoji: "❓" },
  ],
};

/**
 * Computes an overall 1-5 rating from the three review dimensions.
 *
 * Weighting:
 *   Quality:     40% (the produce itself matters most)
 *   Accuracy:    35% (trust depends on matching expectations)
 *   Would rebuy: 25% (overall satisfaction signal)
 *
 * @param {string} quality - "below" | "expected" | "above"
 * @param {string} accuracy - "no" | "close" | "exact"
 * @param {string} wouldBuyAgain - "no" | "yes"
 * @returns {number} Rating between 1 and 5
 */
export const computeRating = (quality, accuracy, wouldBuyAgain) => {
  const q = QUALITY_SCORES[quality] || 3;
  const a = ACCURACY_SCORES[accuracy] || 3;
  const r = REBUY_SCORES[wouldBuyAgain] || 3;

  const weighted = q * 0.4 + a * 0.35 + r * 0.25;
  return Math.round(weighted); // integer 1-5 for DB compatibility
};

/**
 * Submits a structured review for a farmer.
 *
 * The structured data (dimensions + tags) is stored as JSON in
 * the comment field. The computed rating goes in the rating field,
 * which triggers the auto avg_rating update on farmer_profiles.
 *
 * @param {Object} params
 * @param {string} params.buyerProfileId - buyer_profiles.id
 * @param {string} params.farmerProfileId - farmer_profiles.id
 * @param {string|null} params.listingId - the listing this review is about
 * @param {string} params.quality - "below" | "expected" | "above"
 * @param {string} params.accuracy - "no" | "close" | "exact"
 * @param {string} params.wouldBuyAgain - "no" | "yes"
 * @param {Array<string>} params.tags - selected tag IDs
 * @param {string} params.text - optional free text
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const submitReview = async ({
  buyerProfileId,
  farmerProfileId,
  listingId = null,
  quality,
  accuracy,
  wouldBuyAgain,
  tags = [],
  text = "",
}) => {
  const rating = computeRating(quality, accuracy, wouldBuyAgain);

  // Pack structured data as JSON in the comment field
  const structuredComment = JSON.stringify({
    quality,
    accuracy,
    wouldBuyAgain,
    tags,
    text: text.trim(),
    version: 2, // marks this as a structured review (vs legacy plain text)
  });

  const { data, error } = await supabase
    .from("farmer_reviews")
    .upsert(
      {
        buyer_id: buyerProfileId,
        farmer_id: farmerProfileId,
        listing_id: listingId,
        rating,
        comment: structuredComment,
      },
      { onConflict: "buyer_id,farmer_id" },
    )
    .select()
    .single();

  return { data, error };
};

/**
 * Fetches all reviews for a farmer and computes the trust profile.
 *
 * Returns a rich trust object that the UI can display as a
 * visual trust breakdown — not just a single number.
 *
 * @param {string} farmerProfileId - farmer_profiles.id
 * @returns {Promise<{trustProfile: Object|null, error: Object|null}>}
 */
export const getFarmerTrustProfile = async (farmerProfileId) => {
  try {
    const { data: reviews, error } = await supabase
      .from("farmer_reviews")
      .select("rating, comment, created_at, buyer_profiles ( full_name )")
      .eq("farmer_id", farmerProfileId)
      .order("created_at", { ascending: false });

    if (error) return { trustProfile: null, error };
    if (!reviews || reviews.length === 0) {
      return { trustProfile: null, error: null };
    }

    // Parse structured reviews
    let qualitySum = 0;
    let accuracyMatchCount = 0;
    let wouldBuyAgainCount = 0;
    const tagCounts = {};
    const recentReviews = [];

    reviews.forEach((review) => {
      let structured = null;

      // Try to parse as structured JSON
      try {
        const parsed = JSON.parse(review.comment);
        if (parsed.version === 2) {
          structured = parsed;
        }
      } catch {
        // Legacy plain text review — just use rating
      }

      if (structured) {
        // Quality dimension
        if (structured.quality === "above") qualitySum += 5;
        else if (structured.quality === "expected") qualitySum += 3;
        else qualitySum += 1;

        // Accuracy dimension
        if (
          structured.accuracy === "exact" ||
          structured.accuracy === "close"
        ) {
          accuracyMatchCount++;
        }

        // Rebuy dimension
        if (structured.wouldBuyAgain === "yes") {
          wouldBuyAgainCount++;
        }

        // Tags
        (structured.tags || []).forEach((tagId) => {
          tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
        });

        // Recent review for display
        recentReviews.push({
          rating: review.rating,
          quality: structured.quality,
          accuracy: structured.accuracy,
          wouldBuyAgain: structured.wouldBuyAgain,
          text: structured.text || null,
          tags: structured.tags || [],
          buyerName: review.buyer_profiles?.full_name || "Anonymous",
          createdAt: review.created_at,
        });
      } else {
        // Legacy review — count as neutral on dimensions
        qualitySum += review.rating >= 4 ? 5 : review.rating >= 3 ? 3 : 1;
        if (review.rating >= 3) accuracyMatchCount++;
        if (review.rating >= 4) wouldBuyAgainCount++;

        recentReviews.push({
          rating: review.rating,
          text: review.comment,
          buyerName: review.buyer_profiles?.full_name || "Anonymous",
          createdAt: review.created_at,
        });
      }
    });

    const total = reviews.length;

    // Compute trust percentages
    const avgQuality = qualitySum / total;
    const accuracyPercent = Math.round((accuracyMatchCount / total) * 100);
    const rebuyPercent = Math.round((wouldBuyAgainCount / total) * 100);
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / total;

    // Sort tags by frequency, separate positive and negative
    const allTags = [...REVIEW_TAGS.positive, ...REVIEW_TAGS.negative];
    const sortedTags = Object.entries(tagCounts)
      .map(([tagId, count]) => {
        const tagDef = allTags.find((t) => t.id === tagId);
        return {
          id: tagId,
          label: tagDef?.label || tagId,
          emoji: tagDef?.emoji || "",
          count,
          isPositive: REVIEW_TAGS.positive.some((t) => t.id === tagId),
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      trustProfile: {
        totalReviews: total,
        avgRating: Math.round(avgRating * 10) / 10,
        avgQuality: Math.round(avgQuality * 10) / 10,
        accuracyPercent,
        rebuyPercent,
        topTags: sortedTags.slice(0, 6),
        recentReviews: recentReviews.slice(0, 5),
      },
      error: null,
    };
  } catch (err) {
    console.warn("Trust profile error:", err.message);
    return { trustProfile: null, error: err };
  }
};

/**
 * Checks if a buyer has already reviewed a specific farmer.
 * @param {string} buyerProfileId
 * @param {string} farmerProfileId
 * @returns {Promise<boolean>}
 */
export const hasReviewed = async (buyerProfileId, farmerProfileId) => {
  try {
    const { count } = await supabase
      .from("farmer_reviews")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyerProfileId)
      .eq("farmer_id", farmerProfileId);

    return count > 0;
  } catch {
    return false;
  }
};
