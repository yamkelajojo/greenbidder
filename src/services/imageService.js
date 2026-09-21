import * as ImagePicker from "expo-image-picker";
import { supabase } from "../config/supabase";
import * as FileSystem from "expo-file-system";

/**
 * Image service — handles image picking and uploading.
 * Components call these functions, never interact with storage directly.
 * Criterion 2 — Service Layer.
 */

/**
 * Copies a URI into the app's cache directory if it isn't already there.
 * Works around Android scoped-storage restrictions where content:// or
 * /sdcard/... URIs returned by the photo picker can't always be read
 * downstream (e.g. by expo-image-manipulator or expo-file-system).
 *
 * @param {string} uri - Source URI (file://, content://, ph://, etc.)
 * @returns {Promise<string>} A file:// URI inside the app cache.
 */
const copyToCacheIfNeeded = async (uri) => {
  if (!uri) return uri;
  const cacheDir = FileSystem.cacheDirectory || "";
  const docDir = FileSystem.documentDirectory || "";
  if (uri.startsWith(cacheDir) || uri.startsWith(docDir)) {
    return uri;
  }
  try {
    const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) ? ext : "jpg";
    const dest = `${cacheDir}picked-${Date.now()}.${safeExt}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e) {
    // If copy fails for any reason (permissions, etc.), fall back to the
    // original URI. The disease service does its own copy attempt, and
    // upload flows use FormData which typically handles content:// URIs.
    console.warn("[imageService] copyToCacheIfNeeded failed:", e);
    return uri;
  }
};

/**
 * Opens the device image picker (gallery or camera).
 * @param {"gallery"|"camera"} [source="gallery"] - Where to pick from
 * @returns {Promise<{uri: string|null, cancelled: boolean, error?: string}>}
 */
export const pickImage = async (source = "gallery") => {
  // Request permission
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return {
        uri: null,
        cancelled: true,
        error:
          "Camera permission was denied. You can enable it in your device Settings.",
      };
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return {
        uri: null,
        cancelled: true,
        error:
          "Gallery permission was denied. You can enable it in your device Settings.",
      };
    }
  }

  const options = {
    mediaTypes: ["images"],
    // Let the user crop/frame the leaf after capture. 1:1 square crop
    // encourages centering the leaf in the frame (the model is trained on
    // centered, square-cropped leaf images), and the disease service resizes
    // to the exact 384×384 the model expects.
    allowsEditing: true,
    aspect: [1, 1],
    // Higher quality preserves leaf-lesion detail that the disease model needs.
    // The preprocessing step later resizes to 384×384 regardless.
    quality: 0.9,
    exif: false,
  };

  let result;
  try {
    result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
  } catch (e) {
    return {
      uri: null,
      cancelled: true,
      error: `Could not open ${source}: ${e.message || String(e)}`,
    };
  }

  if (result.canceled) {
    return { uri: null, cancelled: true };
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    return {
      uri: null,
      cancelled: true,
      error: "No image was returned by the picker.",
    };
  }

  // Defensive copy into app cache so downstream consumers can read the file
  // regardless of Android scoped-storage restrictions.
  const safeUri = await copyToCacheIfNeeded(asset.uri);
  return { uri: safeUri, cancelled: false };
};

/**
 * Uploads an image to Supabase Storage.
 * @param {string} uri - Local file URI from image picker
 * @param {string} listingId - The listing this image belongs to
 * @returns {Promise<{url: string|null, error: Object|null}>}
 */
export const uploadListingImage = async (uri, listingId) => {
  try {
    const fileExt = uri.split(".").pop() || "jpg";
    const fileName = `${listingId}/${Date.now()}.${fileExt}`;

    const formData = new FormData();
    formData.append("", {
      uri,
      name: fileName,
      type: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
    });

    const { data, error } = await supabase.storage
      .from("listing-images")
      .upload(fileName, formData, {
        contentType: "multipart/form-data",
        upsert: false,
      });

    if (error) {
      return { url: null, error };
    }

    const { data: urlData } = supabase.storage
      .from("listing-images")
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: { message: err.message } };
  }
};
