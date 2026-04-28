// src/context/OnboardingContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../hooks/useAuth";
import { getBudgetTier } from "../services/buyerPreferenceStore";

// Async storage wrapper for Expo Go compatibility
export const onboardingStorage = {
  getBoolean: async (key) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value === "true";
    } catch {
      return false;
    }
  },
  set: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (error) {
      console.warn("Storage error:", error);
    }
  },
  getString: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  clearAll: async () => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.warn("Clear error:", error);
    }
  },
};

const OnboardingContext = createContext(undefined);

export const OnboardingProvider = ({ children }) => {
  const { user, userRole, isLoading: authLoading } = useAuth();

  // ── SHARED STATE ─────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [location, setLocation] = useState(null);
  const [hasGrantedLocation, setHasGrantedLocation] = useState(false);

  // ── BUYER-SPECIFIC STATE ─────────────────────────────────────
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  const [hasSeenBuyerTutorial, setHasSeenBuyerTutorial] = useState(false);

  // ── FARMER-SPECIFIC STATE ────────────────────────────────────
  const [farmProfile, setFarmProfile] = useState({
    bio: "",
    photo: null,
    specializations: [],
  });
  const [hasSeenFarmerGuide, setHasSeenFarmerGuide] = useState(false);

  // ── COMPLETION TRACKING ──────────────────────────────────────
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // ── LOAD PERSISTED STATE ON MOUNT ────────────────────────────
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const [grantedLocation, buyerTutorial, farmerGuide, steps, budgetTier] =
          await Promise.all([
            onboardingStorage.getBoolean("hasGrantedLocation"),
            onboardingStorage.getBoolean("hasSeenBuyerTutorial"),
            onboardingStorage.getBoolean("hasSeenFarmerGuide"),
            onboardingStorage.getString("completedSteps"),
            getBudgetTier(),
          ]);

        setHasGrantedLocation(grantedLocation || false);
        setHasSeenBuyerTutorial(buyerTutorial || false);
        setHasSeenFarmerGuide(farmerGuide || false);
        setCompletedSteps(steps ? JSON.parse(steps) : []);
        if (budgetTier) {
          setPriceRange({ min: budgetTier.min, max: budgetTier.max });
        }
      } catch (error) {
        console.warn("Failed to load onboarding state:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadPersistedState();
  }, []);

  // ── HELPERS ──────────────────────────────────────────────────
  const markStepComplete = async (stepName) => {
    if (completedSteps.includes(stepName)) return;

    const updated = [...completedSteps, stepName];
    setCompletedSteps(updated);
    await onboardingStorage.set("completedSteps", JSON.stringify(updated));
  };

  // Temporary buyer shortcut to prevent onboarding deadlock while flow is being stabilized.
  const completeBuyerOnboardingMock = async () => {
    const buyerRequiredSteps = [
      "welcome",
      "location",
      "buyerPreferences",
      "priceRange",
    ];
    const updated = Array.from(new Set([...completedSteps, ...buyerRequiredSteps]));
    setCompletedSteps(updated);
    await onboardingStorage.set("completedSteps", JSON.stringify(updated));
  };

  const isStepComplete = (stepName) => completedSteps.includes(stepName);

  const resetOnboarding = async () => {
    setLocation(null);
    setSelectedCategories([]);
    setPriceRange({ min: 0, max: 100 });
    setFarmProfile({ bio: "", photo: null, specializations: [] });
    setCompletedSteps([]);
    await onboardingStorage.clearAll();
  };

  // ── ONBOARDING COMPLETION CHECK ──────────────────────────────
  const isOnboardingComplete = useMemo(() => {
    if (!user || authLoading || !isInitialized) return false;

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
  }, [user, userRole, authLoading, completedSteps, isInitialized]);

  // ── PERSIST CRITICAL VALUES ──────────────────────────────────
  useEffect(() => {
    if (isInitialized) {
      onboardingStorage.set("hasGrantedLocation", hasGrantedLocation);
    }
  }, [hasGrantedLocation, isInitialized]);

  useEffect(() => {
    if (isInitialized && hasSeenBuyerTutorial) {
      onboardingStorage.set("hasSeenBuyerTutorial", true);
    }
  }, [hasSeenBuyerTutorial, isInitialized]);

  useEffect(() => {
    if (isInitialized && hasSeenFarmerGuide) {
      onboardingStorage.set("hasSeenFarmerGuide", true);
    }
  }, [hasSeenFarmerGuide, isInitialized]);

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
      completeBuyerOnboardingMock,
      isStepComplete,
      isOnboardingComplete,
      resetOnboarding,
      isInitialized,

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
      isInitialized,
    ],
  );

  // Show nothing until initialized
  if (!isInitialized) {
    return null;
  }

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
