import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../config/supabase";

const AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY || "";
const AI_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * AI Analysis service — analyses produce images using Groq + Llama Vision.
 * Criterion 2 — Service Layer. Criterion 6 — Single Responsibility.
 */

/**
 * Analyses a produce image using Llama Vision via Groq.
 * @param {string} imageUri - Local file URI of the produce image
 * @param {string} produceType - Category name e.g. "Tomatoes"
 * @returns {Promise<{analysis: Object|null, error: string|null}>}
 */
export const analyseProduceImage = async (imageUri, produceType) => {
  try {
    if (!AI_API_KEY) {
      return { analysis: null, error: "AI API key not configured" };
    }

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });

    const prompt = `You are an agricultural produce quality analyst for a South African farming marketplace called GreenBidder.

Analyse this image of ${produceType} and return a JSON object with exactly these fields:
{
  "condition_score": <number 1-10, where 10 is perfect condition>,
  "ripeness_estimate": "<string: e.g. 'Ripe and ready', 'Slightly underripe', 'Overripe'>",
  "growth_insight": "<string: 1-2 sentences about the visible quality, any defects, freshness indicators>",
  "price_suggestion_min": <number in ZAR, minimum fair price per kg>,
  "price_suggestion_max": <number in ZAR, maximum fair price per kg>
}

Base prices on current South African market rates for ${produceType}.
Return ONLY the JSON object, no markdown, no backticks, no explanation.`;

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
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        analysis: null,
        error: `AI error (${response.status}): ${errText.substring(0, 200)}`,
      };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      return { analysis: null, error: "AI returned empty response." };
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return { analysis, error: null };
  } catch (err) {
    console.warn("AI analysis error:", err.message);
    return { analysis: null, error: err.message };
  }
};

/**
 * Saves AI analysis results to the ai_analysis table.
 * @param {string} listingId - UUID of the listing
 * @param {Object} analysis - Parsed analysis from Gemini
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
 * Full pipeline — analyse image and save results.
 * @param {string} imageUri - Local image URI
 * @param {string} listingId - UUID of the listing
 * @param {string} produceType - Category name
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
