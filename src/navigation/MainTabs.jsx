import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home, BarChart3, PlusCircle, User } from "@tamagui/lucide-icons-2";
import { useAuth } from "../hooks/useAuth";

// Buyer screens
import BuyerFeedScreen from "../screens/buyer/BuyerFeedScreen";
import ListingDetailScreen from "../screens/shared/ListingDetailScreen";

// Farmer screens
import FarmerListingsScreen from "../screens/farmer/FarmerListingsScreen";
import CreateListingScreen from "../screens/farmer/CreateListingScreen";

// Shared screens
import MarketPricesScreen from "../screens/shared/MarketPricesScreen";
import ProfileScreen from "../screens/shared/ProfileScreen";

const Tab = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const ListingsStack = createNativeStackNavigator();
const PricesStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

/** Buyer: Feed → Listing Detail */
function FeedStackScreen() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="FeedHome" component={BuyerFeedScreen} />
      <FeedStack.Screen name="ListingDetail" component={ListingDetailScreen} />
    </FeedStack.Navigator>
  );
}

/** Farmer: My Listings → Create Listing */
function ListingsStackScreen() {
  return (
    <ListingsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListingsStack.Screen
        name="MyListings"
        component={FarmerListingsScreen}
      />
      <ListingsStack.Screen
        name="CreateListing"
        component={CreateListingScreen}
      />
      <ListingsStack.Screen
        name="ListingDetail"
        component={ListingDetailScreen}
      />
    </ListingsStack.Navigator>
  );
}

/** Market Prices (shared) */
function PricesStackScreen() {
  return (
    <PricesStack.Navigator screenOptions={{ headerShown: false }}>
      <PricesStack.Screen name="PricesHome" component={MarketPricesScreen} />
    </PricesStack.Navigator>
  );
}

/** Profile (shared) */
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
    </ProfileStack.Navigator>
  );
}

/**
 * Main tab bar — 4 tabs.
 * Tab 1 and Tab 3 are role-aware:
 *   Buyer sees "Feed" + "Browse"
 *   Farmer sees "Feed" + "Create"
 */
export default function MainTabs() {
  const { userRole } = useAuth();
  const isFarmer = userRole === "farmer";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2D6A4F",
        tabBarInactiveTintColor: "#ADB5BD",
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          tabBarLabel: "Feed",
        }}
      />
      <Tab.Screen
        name="Prices"
        component={PricesStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size} />
          ),
          tabBarLabel: "Prices",
        }}
      />
      <Tab.Screen
        name="Listings"
        component={ListingsStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <PlusCircle color={color} size={size} />
          ),
          tabBarLabel: isFarmer ? "Create" : "Browse",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
}
