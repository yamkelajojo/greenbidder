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
 * Architecture:
 *   analyseProduceImage() — sends image + context to Groq, parses response
 *   saveAnalysis()        — persists to ai_analysis table (upsert)
 *   analyseAndSave()      — pipeline: analyse → save (called from CreateListing)
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
 * Analyses a produce image using Llama Vision via Groq.
 *
 * The prompt is designed to extract maximum agricultural value from a single
 * image, combining visual assessment with regional and seasonal knowledge.
 * It enforces strict JSON output with uncertainty handling — the model will
 * express doubt in field values rather than hallucinate specifics.
 *
 * @param {string} imageUri - Local file URI of the produce image
 * @param {string} produceType - Category name e.g. "Tomatoes"
 * @returns {Promise<{analysis: Object|null, error: string|null}>}
 */
export const analyseProduceImage = async (imageUri, produceType) => {
  try {
    if (!AI_API_KEY) {
      return { analysis: null, error: "AI API key not configured" };
    }

    // Read image as base64 for the vision model
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });

    // Context variables for the prompt
    const month = new Date().toLocaleString("en-ZA", { month: "long" });
    const season = getSouthAfricanSeason();

    const prompt = `You are GreenBidder's senior agricultural produce analyst for South Africa. You analyze photos with agricultural expertise, practical farm knowledge, and strict uncertainty management.

INPUTS:
- Location: KwaZulu-Natal, South Africa
- Current month: ${month}
- Season: ${season}
- Farmer-selected produce category: ${produceType}
- Image: JPEG (provided as base64)

TASK:
Analyze the image and context together. Estimate quality, ripeness, shelf life, storage needs, and likely market value in ZAR.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON. No markdown, no backticks, no commentary, no explanation outside the JSON structure.
- Use double quotes for all strings.
- All numeric fields must be numbers, not strings.
- If uncertain, use cautious wording and the fallback variety "Standard ${produceType}". Do not invent specific varieties from unclear images.
- Base prices on broad South African market knowledge, seasonal supply, visible condition, and typical demand. Do not claim exact real-time prices.
- Ensure the response stays consistent with the selected category and visible image.

OUTPUT JSON SCHEMA:
{
  "condition_score": <number 0.0-10.0, one decimal place, e.g., 7.2>,
  "variety_identified": "<string: specific variety if clearly visible, otherwise 'Standard ${produceType}'>",
  "ripeness_estimate": "<string: practical summary, e.g., 'Ripe and market ready'>",
  "days_to_peak": <number: days until peak ripeness; 0 if at peak, negative if past peak>,
  "shelf_life_days": <number: estimated remaining shelf life at room temperature>,
  "harvest_readiness": "<string: one of 'ready', 'soon', 'not yet', 'overdue' — the single most important signal for the farmer>",
  "confidence_level": "<string: one of 'high', 'medium', 'low' — reflects image clarity and how certain you are about this assessment>",
  "growth_insight": "<string: 2-3 sentences on visible quality, color, size consistency, blemishes, bruising, disease signs, dehydration, and how this compares to typical ${produceType} in ${season} in KZN>",
  "storage_advice": "<string: 1 concise sentence on best short-term storage for this stage>",
  "seasonal_note": "<string: 1 concise sentence on ${produceType} supply status in ${month} in KwaZulu-Natal>",
  "price_suggestion_min": <number: floor price in ZAR per kg>,
  "price_suggestion_max": <number: ceiling price in ZAR per kg>,
  "market_insight": "<string: 1 concise sentence comparing this batch to typical SA market value>"
}

FIELD-SPECIFIC GUIDELINES:
- condition_score: Evaluate overall visual quality, freshness, uniformity, damage, disease, bruising, rot, dehydration, and saleability.
- variety_identified: Only name a cultivar if the image strongly supports it. If not, stay generic.
- ripeness_estimate: Use buyer/farmer-friendly terms: "unripe", "turning", "market ready", "slightly overripe", "past peak".
- days_to_peak: Estimate days to best eating/selling condition. Positive = unripe, 0 = peak, negative = overripe.
- shelf_life_days: Estimate how long produce will hold at room temperature from current state.
- harvest_readiness: This is the farmer's key decision — should they harvest now, wait, or is it overdue?
- confidence_level: "high" if image is clear and assessment is reliable, "medium" if some uncertainty, "low" if image quality limits the assessment.
- growth_insight: Describe what is visible and how it affects marketability. Note if image quality limits assessment.
- storage_advice: Simple, actionable advice suitable for a rural farmer without cold storage.
- seasonal_note: Tie the crop to the current month and season in KZN.
- price_suggestion_min/max: Provide a realistic per-kg range in ZAR reflecting quality, ripeness, and demand.
- market_insight: State whether this batch is likely priced below, near, or above average.

SAFETY & CONSISTENCY RULES:
- Ensure min price is less than or equal to max price.
- If image is poor, reflect that in field wording and confidence_level — not outside JSON.
- If produce appears unsafe, rotten, or unfit for sale, state it clearly in relevant fields and adjust score/price accordingly.
- Do not include extra keys unless absolutely necessary.
- Ensure all string values are clean, concise, and parseable.

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
        max_tokens: 800,
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
    const cleaned = text.replace(/````json|````/g, "").trim();
    const analysis = JSON.parse(cleaned);

    // Sanity check: ensure min <= max
    if (analysis.price_suggestion_min > analysis.price_suggestion_max) {
      const temp = analysis.price_suggestion_min;
      analysis.price_suggestion_min = analysis.price_suggestion_max;
      analysis.price_suggestion_max = temp;
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
 * fields not in dedicated columns (variety, shelf life, seasonal notes).
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
 * @param {string} imageUri - Local image URI from the device
 * @param {string} listingId - UUID of the newly created listing
 * @param {string} produceType - Category name for context
 * @returns {Promise<{analysis: Object|null, error: string|null}>}
 */
export const analyseAndSave = async (imageUri, listingId, produceType) => {
  const { analysis, error: analyseError } = await analyseProduceImage(
    imageUri,
    produceType,
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
