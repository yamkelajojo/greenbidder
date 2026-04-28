import AsyncStorage from "@react-native-async-storage/async-storage";

const BUDGET_TIER_KEY = "buyerBudgetTierV1";

export async function saveBudgetTier({ tierId, min, max }) {
  const payload = { tierId, min, max };
  await AsyncStorage.setItem(BUDGET_TIER_KEY, JSON.stringify(payload));
  return payload;
}

export async function getBudgetTier() {
  const raw = await AsyncStorage.getItem(BUDGET_TIER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.tierId !== "string" ||
      typeof parsed.min !== "number" ||
      typeof parsed.max !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearBudgetTier() {
  await AsyncStorage.removeItem(BUDGET_TIER_KEY);
}
