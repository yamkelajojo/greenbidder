import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home, BarChart3, PlusCircle, User, Heart } from "lucide-react-native";
import { useAuth } from "../hooks/useAuth";
import { colors } from "../config/theme";

// Buyer screens
import BuyerFeedScreen from "../screens/buyer/BuyerFeedScreen";
import ListingDetailScreen from "../screens/shared/ListingDetailScreen";

// Farmer screens
import FarmerListingsScreen from "../screens/farmer/FarmerListingsScreen";
import CreateListingScreen from "../screens/farmer/CreateListingScreen";
import EditListingScreen from "../screens/farmer/EditListingScreen";

// Shared screens
import MarketPricesScreen from "../screens/shared/MarketPricesScreen";
import ProfileScreen from "../screens/shared/ProfileScreen";
import SavedListingsScreen from "../screens/buyer/SavedListingsScreen";
import SearchScreen from "../screens/buyer/SearchScreen";

const Tab = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const ListingsStack = createNativeStackNavigator();
const SavedStack = createNativeStackNavigator();

function FeedStackScreen() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="FeedHome" component={BuyerFeedScreen} />
      <FeedStack.Screen name="Search" component={SearchScreen} />
      <FeedStack.Screen name="ListingDetail" component={ListingDetailScreen} />
    </FeedStack.Navigator>
  );
}

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
      <ListingsStack.Screen name="EditListing" component={EditListingScreen} />
    </ListingsStack.Navigator>
  );
}

function SavedStackScreen() {
  return (
    <SavedStack.Navigator screenOptions={{ headerShown: false }}>
      <SavedStack.Screen name="SavedHome" component={SavedListingsScreen} />
      <SavedStack.Screen name="ListingDetail" component={ListingDetailScreen} />
    </SavedStack.Navigator>
  );
}

/**
 * Main tab navigator — role-aware.
 *
 * Farmer sees:  Feed | Prices | Create | Profile
 * Buyer sees:   Feed | Prices | Saved | Profile
 *
 * Stage 1a polish:
 *   • Proper hairline top border on the tab bar so it reads as a real edge,
 *     not a floating bar with a gap above it.
 *   • Tab bar uses system-default sizing (no hard-coded height) so the safe
 *     area at the bottom of the iPhone is handled natively. The previous
 *     hard-coded height=60 was causing a visible gap between the feed
 *     content and the tab bar.
 *   • Background matches app surface so there's no contrast band.
 */
export default function MainTabs() {
  const { userRole } = useAuth();
  const isFarmer = userRole === "farmer";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
          // No hard-coded height — let the system handle safe area inset
          // so there's no phantom gap between content and tab bar.
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedStackScreen}
        options={{
          tabBarLabel: "Feed",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Prices"
        component={MarketPricesScreen}
        options={{
          tabBarLabel: "Prices",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size} />
          ),
        }}
      />
      {!isFarmer ? (
        <Tab.Screen
          name="Saved"
          component={SavedStackScreen}
          options={{
            tabBarLabel: "Saved",
            tabBarIcon: ({ color, size }) => (
              <Heart color={color} size={size} />
            ),
          }}
        />
      ) : null}
      {isFarmer ? (
        <Tab.Screen
          name="Listings"
          component={ListingsStackScreen}
          options={{
            tabBarLabel: "Create",
            tabBarIcon: ({ color, size }) => (
              <PlusCircle color={color} size={size} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
