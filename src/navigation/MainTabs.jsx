import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home, BarChart3, PlusCircle, User } from "lucide-react-native";
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

const Tab = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const ListingsStack = createNativeStackNavigator();

/**
 * Buyer flow: Feed → Listing Detail
 * Tapping a listing card in the feed navigates to its full detail view.
 */
function FeedStackScreen() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="FeedHome" component={BuyerFeedScreen} />
      <FeedStack.Screen name="ListingDetail" component={ListingDetailScreen} />
    </FeedStack.Navigator>
  );
}

/**
 * Farmer flow: My Listings → Create / Edit / Detail
 * Farmer manages their own listings from this stack.
 */
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

/**
 * Main tab navigator — role-aware.
 *
 * Farmer sees:  Feed | Prices | Create | Profile
 * Buyer sees:   Feed | Prices | Profile
 *
 * The Create tab is only available to farmers — buyers browse
 * listings from the Feed tab. This enforces RBAC at the UI level
 * (Criterion 4) while RLS enforces it at the database level.
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
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
          borderTopColor: colors.borderLight,
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
