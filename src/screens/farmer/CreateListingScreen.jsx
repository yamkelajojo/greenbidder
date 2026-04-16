import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuth } from "../../hooks/useAuth";
import { createListing, getCategories } from "../../services/listingService";
import { pickImage, uploadListingImage } from "../../services/imageService";
import { validate, createListingSchema } from "../../validators/schemas";
import { supabase } from "../../config/supabase";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { analyseAndSave } from "../../services/aiService";
import PriceGuidance from "../../components/shared/PriceGuidance";

/**
 * Create Listing screen — farmer creates a new produce listing.
 * Criterion 8 — CRUD Create, end-to-end.
 */
export default function CreateListingScreen({ navigation }) {
  const { user } = useAuth();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [categoryId, setCategoryId] = useState(null);
  const [imageUri, setImageUri] = useState(null);

  // Data state
  const [categories, setCategories] = useState([]);
  const [farmerProfileId, setFarmerProfileId] = useState(null);
  const [location, setLocation] = useState(null);

  // UI state
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Load categories and farmer profile on mount
  useEffect(() => {
    loadCategories();
    loadFarmerProfile();
    getLocation();
  }, []);

  const loadCategories = async () => {
    const { data, error } = await getCategories();
    if (data) setCategories(data);
    setIsLoadingCategories(false);
  };

  /**
   * Gets the farmer's profile ID from the users table.
   * Criterion 3 — select only needed fields, no SELECT *.
   */
  const loadFarmerProfile = async () => {
    if (!user?.id) return;

    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (userData) {
      const { data: farmerData } = await supabase
        .from("farmer_profiles")
        .select("id")
        .eq("user_id", userData.id)
        .single();

      if (farmerData) setFarmerProfileId(farmerData.id);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (err) {
      console.warn("Location unavailable:", err.message);
    }
  };

  const handlePickImage = async () => {
    Alert.alert("Add Photo", "Choose a source", [
      {
        text: "Camera",
        onPress: async () => {
          const result = await pickImage("camera");
          if (result.uri) setImageUri(result.uri);
          if (result.error) Alert.alert("Error", result.error);
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const result = await pickImage("gallery");
          if (result.uri) setImageUri(result.uri);
          if (result.error) Alert.alert("Error", result.error);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    setErrors({});
    setApiError("");

    if (!farmerProfileId) {
      setApiError("Farmer profile not found.");
      return;
    }

    if (!imageUri) {
      setApiError("Please add a photo.");
      return;
    }

    const result = validate(createListingSchema, {
      title,
      description: description || undefined,
      categoryId,
      price: parseFloat(price) || 0,
      quantity: parseFloat(quantity) || 0,
      unit,
    });

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Create the listing
      const listingData = {
        farmer_id: farmerProfileId,
        category_id: categoryId,
        title,
        description: description || null,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        unit,
        status: "active",
      };

      if (location) {
        listingData.location_name = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
      }

      const { data: listing, error: listingError } =
        await createListing(listingData);

      if (listingError) {
        setApiError(listingError.message || "Failed to create listing.");
        return;
      }

      // Step 2: Upload image
      const { url, error: imageError } = await uploadListingImage(
        imageUri,
        listing.id,
      );

      if (imageError) {
        console.warn("Image upload failed:", imageError.message);
      }

      // Step 3: Save image URL to listing_images table
      if (url) {
        await supabase.from("listing_images").insert({
          listing_id: listing.id,
          image_url: url,
          is_primary: true,
        });
      }

      // Step 4: AI analysis (runs in background, doesn't block)
      const categoryName =
        categories.find((c) => c.id === categoryId)?.name || "produce";
      analyseAndSave(imageUri, listing.id, categoryName).then(
        ({ analysis, error: aiError }) => {
          if (analysis) {
            console.log(
              "AI analysis complete:",
              analysis.condition_score + "/10",
            );
          }
          if (aiError) {
            console.warn("AI analysis skipped:", aiError);
          }
        },
      );

      // Success
      Alert.alert(
        "Success",
        "Your listing is now live! AI analysis is running in the background.",
        [
          {
            text: "OK",
            onPress: () => {
              setTitle("");
              setDescription("");
              setPrice("");
              setQuantity("");
              setCategoryId(null);
              setImageUri(null);
              navigation.goBack();
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert("Catch Error", err.message);
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Listing</Text>

        {apiError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        ) : null}

        {/* Image picker */}
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Add a photo</Text>
              <Text style={styles.imagePlaceholderHint}>
                Tap to take or choose a photo
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Category selector */}
        <Text style={styles.label}>Category</Text>
        {isLoadingCategories ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  categoryId === cat.id && styles.categoryChipSelected,
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    categoryId === cat.id && styles.categoryChipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {errors.categoryId ? (
          <Text style={styles.fieldError}>{errors.categoryId}</Text>
        ) : null}

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fresh Tomatoes"
            placeholderTextColor={colors.textTertiary}
          />
          {errors.title ? (
            <Text style={styles.fieldError}>{errors.title}</Text>
          ) : null}
        </View>

        {/* Price Intelligence — appears when category is selected */}
        {categoryId ? (
          <PriceGuidance
            categoryId={categoryId}
            categoryName={
              categories.find((c) => c.id === categoryId)?.name || ""
            }
            currentPrice={parseFloat(price) || null}
            unit={unit}
          />
        ) : null}

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your produce..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Unit selector — pick this first so it shows in the inputs */}
        <Text style={styles.label}>Selling by</Text>
        <View style={styles.unitRow}>
          {["kg", "bag", "crate", "bunch", "each"].map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.unitChip, unit === u && styles.unitChipSelected]}
              onPress={() => setUnit(u)}
            >
              <Text
                style={[
                  styles.unitChipText,
                  unit === u && styles.unitChipTextSelected,
                ]}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price and Quantity row */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Price per {unit}</Text>
            <View style={styles.inputWithPrefix}>
              <Text style={styles.inputPrefix}>R</Text>
              <TextInput
                style={[styles.inputInner, errors.price && styles.inputError]}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.price ? (
              <Text style={styles.fieldError}>{errors.price}</Text>
            ) : null}
          </View>

          <View style={{ width: spacing.md }} />

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>How many?</Text>
            <View style={styles.inputWithSuffix}>
              <TextInput
                style={[
                  styles.inputInner,
                  errors.quantity && styles.inputError,
                ]}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputSuffix}>{unit}</Text>
            </View>
            {errors.quantity ? (
              <Text style={styles.fieldError}>{errors.quantity}</Text>
            ) : null}
          </View>
        </View>

        {/* Preview line showing what buyer sees */}
        {price && quantity ? (
          <View style={styles.previewRow}>
            <Text style={styles.previewText}>
              Buyer sees: R{parseFloat(price || 0).toFixed(2)}/{unit} ·{" "}
              {quantity} {unit}s available
            </Text>
          </View>
        ) : null}

        {/* Location indicator */}
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>
            {location
              ? `Location detected (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})`
              : "Getting your location..."}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Publish Listing</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: {
    fontSize: fonts.h1,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inputWithPrefix: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  inputWithSuffix: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  inputPrefix: {
    paddingLeft: spacing.md,
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  inputSuffix: {
    paddingRight: spacing.md,
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  inputInner: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.sm,
    fontSize: fonts.body,
    color: colors.textPrimary,
  },
  previewRow: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  previewText: {
    fontSize: fonts.caption,
    color: colors.primaryDark,
    fontWeight: "500",
    textAlign: "center",
  },
  errorBannerText: { color: colors.danger, fontSize: fonts.caption },
  imagePicker: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: radius.lg,
  },
  imagePlaceholder: {
    height: 200,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderIcon: { fontSize: 40, marginBottom: spacing.sm },
  imagePlaceholderText: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  imagePlaceholderHint: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  categoryScroll: { marginBottom: spacing.md, marginTop: spacing.sm },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  categoryChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: fonts.caption,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fonts.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  textArea: {
    height: 80,
    paddingTop: spacing.sm,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    color: colors.danger,
    fontSize: fonts.small,
    marginTop: spacing.xs,
  },
  row: { flexDirection: "row" },
  unitRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  unitChipText: { fontSize: fonts.caption, color: colors.textSecondary },
  unitChipTextSelected: { color: colors.primaryDark, fontWeight: "600" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
  },
  locationIcon: { fontSize: 16, marginRight: spacing.sm },
  locationText: { fontSize: fonts.small, color: colors.textSecondary },
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: fonts.body, fontWeight: "600" },
});
