// src/context/OnboardingContext.jsx
import React, { createContext, useContext, useState, useMemo } from "react";
import { MMKV } from "react-native-mmkv";
import { useAuth } from "../hooks/useAuth";

// Persistent storage for onboarding state (faster than AsyncStorage)
export const onboardingStorage = new MMKV({
  id: "onboarding-storage",
});

const OnboardingContext = createContext(undefined);

export const OnboardingProvider = ({ children }) => {
  const { user, userRole, isLoading: authLoading } = useAuth();

  // ── SHARED STATE ─────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [location, setLocation] = useState(null);
  const [hasGrantedLocation, setHasGrantedLocation] = useState(
    onboardingStorage.getBoolean("hasGrantedLocation") || false,
  );

  // ── BUYER-SPECIFIC STATE ─────────────────────────────────────
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  const [hasSeenBuyerTutorial, setHasSeenBuyerTutorial] = useState(
    onboardingStorage.getBoolean("hasSeenBuyerTutorial") || false,
  );

  // ── FARMER-SPECIFIC STATE ────────────────────────────────────
  const [farmProfile, setFarmProfile] = useState({
    bio: "",
    photo: null,
    specializations: [],
  });
  const [hasSeenFarmerGuide, setHasSeenFarmerGuide] = useState(
    onboardingStorage.getBoolean("hasSeenFarmerGuide") || false,
  );

  // ── COMPLETION TRACKING ──────────────────────────────────────
  const [completedSteps, setCompletedSteps] = useState(() => {
    const stored = onboardingStorage.getString("completedSteps");
    return stored ? JSON.parse(stored) : [];
  });

  // ── HELPERS ──────────────────────────────────────────────────
  const markStepComplete = (stepName) => {
    if (!completedSteps.includes(stepName)) {
      const updated = [...completedSteps, stepName];
      setCompletedSteps(updated);
      onboardingStorage.set("completedSteps", JSON.stringify(updated));
    }
  };

  const isStepComplete = (stepName) => completedSteps.includes(stepName);

  const resetOnboarding = () => {
    setLocation(null);
    setSelectedCategories([]);
    setPriceRange({ min: 0, max: 100 });
    setFarmProfile({ bio: "", photo: null, specializations: [] });
    setCompletedSteps([]);
    onboardingStorage.clearAll();
  };

  // ── ONBOARDING COMPLETION CHECK ──────────────────────────────
  const isOnboardingComplete = useMemo(() => {
    if (!user || authLoading) return false;

    const requiredSteps =
      userRole === "farmer"
        ? [
            "welcome",
            "location",
            "farmProfile",
            "farmerCategories",
            "pricingGuide",
          ]
        : ["welcome", "location", "buyerPreferences", "priceRange"];

    return requiredSteps.every((step) => isStepComplete(step));
  }, [user, userRole, authLoading, completedSteps]);

  // ── PERSIST CRITICAL VALUES ──────────────────────────────────
  // Auto-save location permission status
  React.useEffect(() => {
    onboardingStorage.set("hasGrantedLocation", hasGrantedLocation);
  }, [hasGrantedLocation]);

  React.useEffect(() => {
    if (hasSeenBuyerTutorial) {
      onboardingStorage.set("hasSeenBuyerTutorial", true);
    }
  }, [hasSeenBuyerTutorial]);

  React.useEffect(() => {
    if (hasSeenFarmerGuide) {
      onboardingStorage.set("hasSeenFarmerGuide", true);
    }
  }, [hasSeenFarmerGuide]);

  // ── CONTEXT VALUE ────────────────────────────────────────────
  const value = useMemo(
    () => ({
      // Auth
      user,
      userRole,
      authLoading,

      // Shared
      currentStep,
      setCurrentStep,
      location,
      setLocation,
      hasGrantedLocation,
      setHasGrantedLocation,

      // Buyer
      selectedCategories,
      setSelectedCategories,
      priceRange,
      setPriceRange,
      hasSeenBuyerTutorial,
      setHasSeenBuyerTutorial,

      // Farmer
      farmProfile,
      setFarmProfile,
      hasSeenFarmerGuide,
      setHasSeenFarmerGuide,

      // Completion
      completedSteps,
      markStepComplete,
      isStepComplete,
      isOnboardingComplete,
      resetOnboarding,

      // Utilities
      storage: onboardingStorage,
    }),
    [
      user,
      userRole,
      authLoading,
      currentStep,
      location,
      hasGrantedLocation,
      selectedCategories,
      priceRange,
      hasSeenBuyerTutorial,
      farmProfile,
      hasSeenFarmerGuide,
      completedSteps,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

// Custom hook with error checking
export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
};
