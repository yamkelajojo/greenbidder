import { supabase } from "../config/supabase";

/**
 * Disease scan history — Supabase operations for the `disease_scans` table
 * and `disease-scans` storage bucket.
 *
 * Platform-agnostic (supabase-js only — no native modules), so it works
 * identically on Android, iOS and web. The on-device inference lives in
 * `diseaseService.native.js` / `diseaseService.web.js`.
 *
 * Components call these functions, never Supabase directly.
 * Criterion 2 — Service Layer.
 */

export const BUCKET = "disease-scans";

/**
 * Builds a public URL for a stored scan image.
 * @param {string} imagePath - Storage object path (userId/....jpg)
 * @returns {string}
 */
export const getScanImageUrl = (imagePath) =>
  supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;

/**
 * Saves a scan: uploads the original image to storage, then inserts the row.
 *
 * @param {Object} result - `data` from a successful `diagnose` call
 * @param {string} imageUri - Local file URI of the picked image
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 *   data: the inserted row plus `image_url`
 */
export const saveScan = async (result, imageUri) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return { data: null, error: { message: "Not signed in." } };
    }
    const userId = session.user.id;
    const fileName = `${userId}/${Date.now()}.jpg`;

    const formData = new FormData();
    formData.append("", {
      uri: imageUri,
      name: fileName,
      type: "image/jpeg",
    });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, formData, {
        contentType: "multipart/form-data",
        upsert: false,
      });
    if (uploadError) {
      return { data: null, error: uploadError };
    }

    const { data: row, error: insertError } = await supabase
      .from("disease_scans")
      .insert({
        user_id: userId,
        image_path: fileName,
        disease_key: result.diseaseKey,
        disease_label: result.diseaseLabel,
        confidence: result.confidence,
        is_cabbage: result.isCabbage,
        advisory: result.advisory,
      })
      .select()
      .single();
    if (insertError) {
      return { data: null, error: insertError };
    }

    return {
      data: { ...row, image_url: getScanImageUrl(fileName) },
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: err?.message || "Failed to save scan." } };
  }
};

/**
 * Fetches the current user's scan history, newest first (paginated).
 *
 * @param {Object} [params]
 * @param {number} [params.limit=10] - Page size
 * @param {string|null} [params.before] - Fetch scans older than this created_at
 * @returns {Promise<{data: Array|null, error: Object|null, hasMore: boolean}>}
 */
export const getScanHistory = async ({ limit = 10, before = null } = {}) => {
  // When paginating with .lt(created_at, before), Supabase returns the
  // count for the *filtered* query (i.e. only older rows), not the total.
  // So we can't rely on `count > rows.length` across page boundaries.
  // Instead, we determine hasMore by whether we got a full page back:
  // if we got exactly `limit` rows, there's probably more; if fewer,
  // we've reached the end. This avoids a separate count query and is
  // standard cursor-pagination behavior.
  //
  // We still request count: 'exact' on the first page (no `before`) for
  // a nice initial `hasMore` value; on subsequent pages we derive it
  // from the returned page length.
  const useExactCount = !before;
  let query = supabase
    .from("disease_scans")
    .select(
      "id, image_path, disease_key, disease_label, confidence, is_cabbage, advisory, created_at",
      useExactCount ? { count: "exact" } : undefined
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error, count } = await query;
  const rows = (data || []).map((row) => ({
    ...row,
    image_url: getScanImageUrl(row.image_path),
  }));

  // Fetch one extra row to definitively know whether more pages exist.
  // That avoids showing "Scroll for more…" forever when we're at the end.
  // We achieve this cleanly by requesting limit+1 and slicing.
  //
  // (Simpler alternative: if we got exactly `limit` rows, assume more.
  // That's what we do below because the +1 approach complicates the
  // `before` cursor arithmetic with minimal UX benefit.)
  const hasMore = useExactCount
    ? typeof count === "number" && count > rows.length
    : rows.length >= limit;

  return { data: rows, error, hasMore };
};

/**
 * Deletes one scan: storage object first, then the row.
 * Order matters — an orphaned object is worse than an orphaned row (PRD §7.3).
 *
 * @param {string} id - Scan row id
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const deleteScan = async (id) => {
  try {
    const { data: row, error: selectError } = await supabase
      .from("disease_scans")
      .select("image_path")
      .eq("id", id)
      .single();
    if (selectError) {
      return { data: null, error: selectError };
    }

    if (row?.image_path) {
      await supabase.storage.from(BUCKET).remove([row.image_path]);
    }

    const { error: deleteError } = await supabase
      .from("disease_scans")
      .delete()
      .eq("id", id);
    if (deleteError) {
      return { data: null, error: deleteError };
    }
    return { data: { id }, error: null };
  } catch (err) {
    return { data: null, error: { message: err?.message || "Failed to delete scan." } };
  }
};

/**
 * Deletes all of the user's scans: objects first, then rows.
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const clearAllScans = async () => {
  try {
    const { data: rows, error: selectError } = await supabase
      .from("disease_scans")
      .select("id, image_path");
    if (selectError) {
      return { data: null, error: selectError };
    }
    if (!rows || rows.length === 0) {
      return { data: { deleted: 0 }, error: null };
    }

    const objectPaths = rows.map((r) => r.image_path).filter(Boolean);
    await supabase.storage.from(BUCKET).remove(objectPaths);

    const { error: deleteError } = await supabase
      .from("disease_scans")
      .delete()
      .in("id", rows.map((r) => r.id));
    if (deleteError) {
      return { data: null, error: deleteError };
    }
    return { data: { deleted: rows.length }, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err?.message || "Failed to clear scans." },
    };
  }
};
