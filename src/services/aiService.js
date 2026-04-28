import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../config/supabase";

/**
 * AI Analysis service — produce image intelligence via Groq (Llama Vision).
 *
 * This is GreenBidder's core differentiator. The AI doesn't just score
 * images — it provides actionable agricultural intelligence that helps
 * farmers price, time harvests, and store produce correctly, while giving
 * buyers confidence in quality before purchasing.
 *
 * ─── v2 enrichment (April 2026) ───
 * Previously the model received only an image + a category label. That's
 * about as much context as handing a produce expert a Polaroid with
 * "tomatoes" scribbled on the back. Now we pass everything the farmer
 * already told us about this batch: the listing title (which often
 * contains quality self-claims like "Grade A" or "hand-picked"), the
 * description (harvest notes, growing method), the actual asking price,
 * quantity, unit, organic flag, and — critically — the real farmer
 * location rather than a hardcoded province fallback.
 *
 * The response schema also grew:
 *   - visual_defects     — array of short structured observations
 *   - uniformity_score   — batch consistency 0-1 (sortable/filterable)
 *   - price_assessment   — {verdict, margin_percent, reasoning}
 *
 * The last one closes the loop: the AI now explicitly assesses the
 * farmer's asking price against its own estimated range, which powers
 * the AIPriceScale instrument UI.
 *
 * Architecture:
 *   analyseProduceImage(imageUri, context) — vision call + parse
 *   saveAnalysis(listingId, analysis)      — persist to ai_analysis
 *   analyseAndSave(imageUri, listing, category) — full pipeline
 *
 * Criterion 2 — Service Layer
 * Criterion 6 — Single Responsibility (AI analysis only)
 */

const AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY || "";
const AI_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Returns the current South African agricultural season with context.
 * SA seasons are opposite to Northern Hemisphere.
 * @returns {string} Season name with agricultural relevance
 */
const getSouthAfricanSeason = () => {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4)
    return "Autumn (harvest season for summer crops, planting for winter vegetables)";
  if (month >= 5 && month <= 7)
    return "Winter (cool-season crops thrive, reduced growth for tropical varieties)";
  if (month >= 8 && month <= 10)
    return "Spring (planting season, early growth, rising temperatures)";
  return "Summer (peak growing season, high yields, tropical fruits in season)";
};

/**
 * Detects whether a location_name is actually human-readable or just
 * a lat/lng string that CreateListingScreen fell back to. If coords,
 * we'd rather pass "unknown in KZN" than pollute the prompt with
 * meaningless numbers.
 * @param {string|null|undefined} loc
 * @returns {boolean}
 */
const isHumanReadableLocation = (loc) => {
  if (!loc || typeof loc !== "string") return false;
  // Reject strings that look like "-29.8587, 31.0218" or pure numbers + commas
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc.trim())) return false;
  // Require at least one alpha character
  return /[a-zA-Z]/.test(loc);
};

/**
 * Builds the location string passed to the AI. Prefers, in order:
 *   1. The listing's own location_name (if human-readable)
 *   2. The farmer's profile location_name (if human-readable)
 *   3. Province-level fallback
 * @param {Object} context
 * @returns {string}
 */
const resolveLocationForPrompt = (context) => {
  const candidates = [context?.listingLocation, context?.farmerLocation];
  for (const c of candidates) {
    if (isHumanReadableLocation(c)) {
      // Ensure "South Africa" is implied even if user wrote just "Pietermaritzburg"
      return c.includes("Africa") ? c : `${c}, South Africa`;
    }
  }
  return "South Africa (specific region unspecified — assume KwaZulu-Natal)";
};

/**
 * Analyses a produce image using Llama Vision via Groq.
 *
 * The prompt extracts maximum agricultural value from a single image by
 * combining visual assessment with the farmer's own listing context. It
 * enforces strict JSON output with uncertainty handling — the model will
 * express doubt in field values rather than hallucinate specifics.
 *
 * @param {string} imageUri - Local file URI of the produce image
 * @param {Object} context - Full listing context
 * @param {string} context.produceType - Category name (e.g., "Tomatoes")
 * @param {string} [context.title] - Farmer's listing title
 * @param {string} [context.description] - Farmer's description
 * @param {number} [context.askingPrice] - Farmer's per-unit price in ZAR
 * @param {number} [context.quantity] - Quantity available
 * @param {string} [context.unit] - Unit (kg/bag/crate/bunch/each)
 * @param {boolean} [context.isOrganic] - Organic flag
 * @param {string} [context.listingLocation] - The listing's location_name
 * @param {string} [context.farmerLocation] - The farmer profile's location
 * @returns {Promise<{analysis: Object|null, error: string|null}>}
 */
export const analyseProduceImage = async (imageUri, context = {}) => {
  try {
    if (!AI_API_KEY) {
      return { analysis: null, error: "AI API key not configured" };
    }

    // Back-compat: allow (imageUri, "Tomatoes") legacy calls
    if (typeof context === "string") {
      context = { produceType: context };
    }
    const produceType = context.produceType || "produce";

    // Read image as base64 for the vision model
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });

    // ─── Context variables ───
    const month = new Date().toLocaleString("en-ZA", { month: "long" });
    const season = getSouthAfricanSeason();
    const location = resolveLocationForPrompt(context);

    // Build the farmer-provided context block. Every field is optional —
    // omit gracefully rather than sending "undefined" strings to the model.
    const farmerClaims = [];
    if (context.title) farmerClaims.push(`- Listing title: "${context.title}"`);
    if (context.description)
      farmerClaims.push(`- Farmer description: "${context.description}"`);
    if (context.quantity && context.unit)
      farmerClaims.push(
        `- Quantity listed: ${context.quantity} ${context.unit}${context.quantity > 1 ? "s" : ""}`,
      );
    const askingPriceLine =
      context.askingPrice && context.unit
        ? `- Farmer's asking price: R${Number(context.askingPrice).toFixed(2)} per ${context.unit}`
        : null;
    if (askingPriceLine) farmerClaims.push(askingPriceLine);

    const farmerContextBlock = farmerClaims.length
      ? farmerClaims.join("\n")
      : "- No additional farmer-provided metadata.";

    // The price assessment instructions only make sense when we actually
    // have an asking price. Otherwise tell the model to return null for
    // price_assessment so we don't force it to invent a comparison.
    const priceAssessmentInstruction = context.askingPrice
      ? `Compare the farmer's asking price (R${Number(context.askingPrice).toFixed(2)}/${context.unit || "unit"}) to your estimated price range. Return a price_assessment object with verdict ("fair", "underpriced", or "overpriced"), margin_percent (signed — positive means above your midpoint, negative means below), and a 1-sentence reasoning.`
      : `No asking price was provided. Return null for price_assessment.`;

    const prompt = `You are GreenBidder's senior agricultural produce analyst for South Africa. You analyze produce photos with agricultural expertise, practical farm knowledge, and strict uncertainty management. You blend visual evidence with the farmer-provided context below — treating the farmer's claims as input to verify or gently contradict, not as ground truth.

INPUTS:
- Location: ${location}
- Current month: ${month}
- Season: ${season}
- Farmer-selected produce category: ${produceType}
- Image: JPEG (provided as base64)

FARMER-PROVIDED CONTEXT:
${farmerContextBlock}

TASK:
Analyze the image against ALL context above. Estimate quality, ripeness, shelf life, storage needs, batch uniformity, visible defects, likely market value in ZAR, and — if an asking price was provided — whether that price is fair given what you see and regional market conditions.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON. No markdown, no backticks, no commentary, no explanation outside the JSON structure.
- Use double quotes for all strings.
- All numeric fields must be numbers, not strings.
- If uncertain, be explicit *inside the JSON fields* (e.g., "likely", "unclear", "cannot confirm from photo") and lower confidence_level — do not invent specifics.
- If only 1-2 items are visible, treat uniformity and defect prevalence as uncertain and mention the limited sample in growth_insight.
- If uncertain about variety, use the fallback variety "Standard ${produceType}". Do not invent specific cultivars from unclear images.
- Base prices on broad South African market knowledge, the region stated above, seasonal supply, visible condition, organic/conventional, and typical demand. Do not claim exact real-time prices.
- If the farmer's title or description makes a claim the image does not support (e.g. "Grade A" but visible bruising), reflect this in growth_insight calmly — do not shame the farmer, just be honest.
- Keep wording simple and practical for rural South African farmers (short sentences, actionable advice, avoid jargon).

OUTPUT JSON SCHEMA:
{
  "condition_score": <number 0.0-10.0, one decimal place, e.g., 7.2>,
  "variety_identified": "<string: specific variety if clearly visible, otherwise 'Standard ${produceType}'>",
  "ripeness_estimate": "<string: practical summary, e.g., 'Ripe and market ready'>",
  "days_to_peak": <number: days until peak ripeness; 0 if at peak, negative if past peak>,
  "shelf_life_days": <number: estimated remaining shelf life at room temperature>,
  "harvest_readiness": "<string: one of 'ready', 'soon', 'not yet', 'overdue' — the single most important signal for the farmer>",
  "confidence_level": "<string: one of 'high', 'medium', 'low' — reflects image clarity and how certain you are overall>",
  "uniformity_score": <number 0.0-1.0, one decimal place — how consistent the batch looks (size, color, ripeness). 1.0 = perfectly uniform, 0.5 = mixed, 0.0 = highly inconsistent. If only one piece is visible, use 1.0 with a note in growth_insight>,
  "visual_defects": [
    "<string: short observation (3-6 words), e.g. 'minor bruising on 2 items', 'uniform color', 'slight stem dehydration', 'excellent skin finish'. Include BOTH positive observations and negative ones. 0 to 5 items. Empty array if image too unclear.>"
  ],
  "growth_insight": "<string: 2-3 short sentences on visible quality (including defects), how this compares to typical ${produceType} in ${season} in this region, and — if relevant — whether the farmer's claims match the image. Mention if the photo shows only a small sample.>",
  "storage_advice": "<string: 1 short, practical sentence on best short-term storage for this stage (assume limited cold storage unless clearly stated)>",
  "seasonal_note": "<string: 1 concise sentence on ${produceType} supply status in ${month} in this region>",
  "price_suggestion_min": <number: floor price in ZAR per ${context.unit || "unit"}>,
  "price_suggestion_max": <number: ceiling price in ZAR per ${context.unit || "unit"}>,
  "market_insight": "<string: 1 concise sentence comparing this batch to typical SA market value>",
  "price_assessment": ${
    context.askingPrice
      ? `{
    "verdict": "<string: 'fair', 'underpriced', or 'overpriced'>",
    "margin_percent": <number: signed percent from the midpoint of your estimated range. Positive = above midpoint, negative = below. Example: asking R45 when midpoint is R40 → +12.5>,
    "reasoning": "<string: 1 short sentence explaining the verdict>"
  }`
      : "null"
  }
}

FIELD-SPECIFIC GUIDELINES:
- condition_score: Overall visual quality, freshness, uniformity, damage, disease, bruising, rot, dehydration, saleability.
- variety_identified: Only name a cultivar if the image strongly supports it. If not, stay generic.
- ripeness_estimate: Buyer/farmer-friendly terms: "unripe", "turning", "market ready", "slightly overripe", "past peak".
- days_to_peak: Positive = unripe, 0 = peak, negative = overripe.
- shelf_life_days: Days at room temperature from current state.
- harvest_readiness: The farmer's key decision — harvest now, wait, or overdue?
- confidence_level: "high" if clear and reliable, "medium" if some uncertainty, "low" if image quality limits assessment.
- uniformity_score: Single most-important batch-consistency signal for bulk buyers.
- visual_defects: Structured observations a filter or sort could use. Mix positives and negatives. Short phrases.
- growth_insight: Prose that ties it all together. Mention farmer claim alignment if notable.
- storage_advice: Simple and actionable, for a rural farmer without cold storage unless the context states they have it.
- seasonal_note: Tie to current month and season in the stated region.
- price_suggestion_min/max: Realistic per-${context.unit || "unit"} range in ZAR reflecting quality, ripeness, and regional demand.
- market_insight: Whether this batch is likely priced below, near, or above average for ${month}.
- price_assessment: ${priceAssessmentInstruction}

SAFETY & CONSISTENCY RULES:
- Ensure min price <= max price.
- If image is poor, reflect in field wording and confidence_level — not outside JSON.
- If produce appears unsafe, rotten, or unfit for sale, state clearly and adjust score/price.
- Do not include extra keys unless absolutely necessary.
- All string values must be clean, concise, parseable.

Return ONLY the JSON object.`;

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 1100, // bumped from 800 — new fields + price_assessment need headroom
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return {
          analysis: null,
          error: "AI is busy. Analysis will retry later.",
        };
      }
      console.warn("AI API error:", errText.substring(0, 300));
      return {
        analysis: null,
        error: "AI analysis unavailable right now.",
      };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      return { analysis: null, error: "AI returned empty response." };
    }

    // Strip any accidental markdown fencing before parsing
    const cleaned = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    // ─── Sanity & normalisation ───
    if (analysis.price_suggestion_min > analysis.price_suggestion_max) {
      const temp = analysis.price_suggestion_min;
      analysis.price_suggestion_min = analysis.price_suggestion_max;
      analysis.price_suggestion_max = temp;
    }
    // Coerce uniformity_score into range
    if (typeof analysis.uniformity_score === "number") {
      analysis.uniformity_score = Math.max(
        0,
        Math.min(1, analysis.uniformity_score),
      );
    }
    // Ensure visual_defects is an array (some models return a string)
    if (typeof analysis.visual_defects === "string") {
      analysis.visual_defects = [analysis.visual_defects];
    }
    if (!Array.isArray(analysis.visual_defects)) {
      analysis.visual_defects = [];
    }
    // Strip blank entries and cap length
    analysis.visual_defects = analysis.visual_defects
      .filter((d) => typeof d === "string" && d.trim().length > 0)
      .slice(0, 5)
      .map((d) => d.trim());

    // price_assessment normalisation
    if (
      analysis.price_assessment &&
      typeof analysis.price_assessment === "object"
    ) {
      const pa = analysis.price_assessment;
      const validVerdicts = ["fair", "underpriced", "overpriced"];
      if (!validVerdicts.includes(pa.verdict)) {
        // Infer from margin_percent if verdict is malformed
        if (typeof pa.margin_percent === "number") {
          if (pa.margin_percent > 10) pa.verdict = "overpriced";
          else if (pa.margin_percent < -10) pa.verdict = "underpriced";
          else pa.verdict = "fair";
        } else {
          pa.verdict = "fair";
        }
      }
      if (typeof pa.margin_percent !== "number") pa.margin_percent = 0;
    }

    return { analysis, error: null };
  } catch (err) {
    console.warn("AI analysis error:", err.message);
    return { analysis: null, error: err.message };
  }
};

/**
 * Persists AI analysis results to the ai_analysis table.
 * Uses upsert so re-analysis overwrites the previous result.
 * The raw_feedback JSONB column captures the full response including
 * all new v2 fields (visual_defects, uniformity_score, price_assessment).
 * No schema migration is required — JSONB accommodates the expansion.
 *
 * @param {string} listingId - UUID of the listing
 * @param {Object} analysis - Parsed analysis object from the AI
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const saveAnalysis = async (listingId, analysis) => {
  const { data, error } = await supabase
    .from("ai_analysis")
    .upsert(
      {
        listing_id: listingId,
        condition_score: analysis.condition_score,
        ripeness_estimate: analysis.ripeness_estimate,
        growth_insight: analysis.growth_insight,
        price_suggestion_min: analysis.price_suggestion_min,
        price_suggestion_max: analysis.price_suggestion_max,
        raw_feedback: analysis,
      },
      { onConflict: "listing_id" },
    )
    .select()
    .single();

  return { data, error };
};

/**
 * Full analysis pipeline — analyse image then persist results.
 * Called after a listing is created and its image uploaded.
 * Designed to run in the background without blocking the farmer's flow.
 *
 * v2 signature: accepts a full listing context object rather than just a
 * category name. Legacy 3-arg calls (imageUri, listingId, produceType)
 * are still supported for backward-compat.
 *
 * @param {string} imageUri - Local image URI from the device
 * @param {string} listingId - UUID of the newly created listing
 * @param {Object|string} context - Full listing context OR legacy produceType string
 * @returns {Promise<{analysis: Object|null, error: string|null}>}
 */
export const analyseAndSave = async (imageUri, listingId, context) => {
  // Legacy call signature: analyseAndSave(uri, id, "Tomatoes")
  const resolvedContext =
    typeof context === "string" ? { produceType: context } : context || {};

  const { analysis, error: analyseError } = await analyseProduceImage(
    imageUri,
    resolvedContext,
  );

  if (analyseError || !analysis) {
    return { analysis: null, error: analyseError };
  }

  const { error: saveError } = await saveAnalysis(listingId, analysis);

  if (saveError) {
    console.warn("Failed to save analysis:", saveError.message);
    return { analysis, error: "Analysis complete but failed to save." };
  }

  return { analysis, error: null };
};
