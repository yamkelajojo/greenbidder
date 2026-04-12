import * as ImagePicker from "expo-image-picker";
import { supabase } from "../config/supabase";
import * as FileSystem from "expo-file-system";

/**
 * Image service — handles image picking and uploading.
 * Components call these functions, never interact with storage directly.
 * Criterion 2 — Service Layer.
 */

/**
 * Opens the device image picker (gallery or camera).
 * @param {"gallery"|"camera"} [source="gallery"] - Where to pick from
 * @returns {Promise<{uri: string, cancelled: boolean}|null>}
 */
export const pickImage = async (source = "gallery") => {
  // Request permission
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return { uri: null, cancelled: true, error: "Camera permission denied" };
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return { uri: null, cancelled: true, error: "Gallery permission denied" };
    }
  }

  const options = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  };

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) {
    return { uri: null, cancelled: true };
  }

  return { uri: result.assets[0].uri, cancelled: false };
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
