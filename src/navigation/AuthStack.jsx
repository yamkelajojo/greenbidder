import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import OnboardingStack from "./OnboardingStack"; // NEW

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { completedSteps } = useOnboarding();

  if (isLoading) return <LoadingScreen />;

  // NEW: Check onboarding completion
  const isOnboardingComplete = user
    ? checkOnboardingComplete(user, completedSteps)
    : false;

  return (
    <NavigationContainer>
      {!user ? (
        <OnboardingStack /> // Welcome carousel + location
      ) : !isOnboardingComplete ? (
        <OnboardingStack /> // Role-specific onboarding
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}
