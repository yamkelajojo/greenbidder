import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getListingById,
  updateListing,
  archiveListing,
} from "../../services/listingService";
import { validate, editListingSchema } from "../../validators/schemas";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { Image } from "react-native";
import { pickImage, uploadListingImage } from "../../services/imageService";
import { supabase } from "../../config/supabase";

/**
 * Edit Listing screen — farmer updates an existing listing.
 * Criterion 8 — CRUD Update + Delete (soft-delete via archive).
 */
export default function EditListingScreen({ route, navigation }) {
  const { listingId } = route.params;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [status, setStatus] = useState("active");

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [existingImage, setExistingImage] = useState(null);

  useEffect(() => {
    loadListing();
  }, []);

  /**
   * Pre-fill form with existing listing data.
   * Criterion 3 — single query with joins.
   */
  const loadListing = async () => {
    const { data, error } = await getListingById(listingId);
    if (data) {
      setTitle(data.title || "");
      setDescription(data.description || "");
      setPrice(String(data.price));
      setQuantity(String(data.quantity));
      setUnit(data.unit || "kg");
      setStatus(data.status || "active");
      const primaryImg = data.listing_images?.find((img) => img.is_primary);
      setExistingImage(
        primaryImg?.image_url || data.listing_images?.[0]?.image_url || null,
      );
    }
    if (error) {
      setApiError("Could not load listing.");
    }
    setIsLoading(false);
  };

  const handlePickImage = async () => {
    const result = await pickImage("camera", "camera_only");
    if (result.uri) setImageUri(result.uri);
    if (result.error) Alert.alert("Camera Required", result.error);
  };

  const handleSave = async () => {
    setErrors({});
    setApiError("");

    const result = validate(editListingSchema, {
      title,
      description: description || undefined,
      price: parseFloat(price) || 0,
      quantity: parseFloat(quantity) || 0,
      unit,
    });

    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await updateListing(listingId, {
        title,
        description: description || null,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        unit,
      });

      if (error) {
        setApiError(error.message || "Failed to update listing.");
        return;
      }

      if (imageUri) {
        const { url } = await uploadListingImage(imageUri, listingId);
        if (url) {
          await supabase.from("listing_images").insert({
            listing_id: listingId,
            image_url: url,
            is_primary: true,
          });
        }
      }

      Alert.alert("Updated", "Your listing has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setApiError("Network error. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Soft-delete — sets status to 'archived'.
   * Criterion 8 — CRUD Delete (no hard delete, preserves data integrity).
   */
  const handleArchive = () => {
    Alert.alert(
      "Archive Listing",
      "This will remove the listing from the marketplace. You can't undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            const { error } = await archiveListing(listingId);
            if (error) {
              Alert.alert("Error", "Could not archive listing.");
              return;
            }
            Alert.alert("Archived", "Listing removed from marketplace.", [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Listing</Text>
          <View style={{ width: 50 }} />
        </View>

        {apiError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        ) : null}

        {/* Status indicator */}
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View
            style={[
              styles.statusBadge,
              status === "active" ? styles.statusActive : styles.statusOther,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                status === "active"
                  ? styles.statusTextActive
                  : styles.statusTextOther,
              ]}
            >
              {status}
            </Text>
          </View>
        </View>

        {/* Image */}
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : existingImage ? (
            <Image
              source={{ uri: existingImage }}
              style={styles.imagePreview}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>+ Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>

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

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
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

        {/* Unit selector */}
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

        {/* Price and Quantity */}
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

        {/* Preview */}
        {price && quantity ? (
          <View style={styles.previewRow}>
            <Text style={styles.previewText}>
              Buyer sees: R{parseFloat(price || 0).toFixed(2)}/{unit} ·{" "}
              {quantity} {unit}s available
            </Text>
          </View>
        ) : null}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Archive button */}
        <TouchableOpacity
          style={styles.archiveButton}
          onPress={handleArchive}
          activeOpacity={0.8}
        >
          <Text style={styles.archiveButtonText}>Archive Listing</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backText: {
    fontSize: fonts.caption,
    fontWeight: "600",
    color: colors.primary,
  },
  headerTitle: {
    fontSize: fonts.h2,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: { color: colors.danger, fontSize: fonts.caption },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  statusLabel: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusActive: { backgroundColor: colors.primaryLight },
  statusOther: { backgroundColor: colors.backgroundTertiary },
  statusText: { fontSize: fonts.small, fontWeight: "600" },
  statusTextActive: { color: colors.primaryDark },
  statusTextOther: { color: colors.textSecondary },
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
  textArea: { height: 80, paddingTop: spacing.sm },
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
  saveButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: fonts.body, fontWeight: "600" },
  archiveButton: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  archiveButtonText: {
    color: colors.danger,
    fontSize: fonts.body,
    fontWeight: "600",
  },
  imagePicker: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: 180, borderRadius: radius.lg },
  imagePlaceholder: {
    height: 180,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: fonts.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
