import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import { colors, fonts, spacing } from "../config/theme";

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

function FeedStackScreen() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="FeedHome" component={BuyerFeedScreen} />
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

export default function MainTabs() {
  const { userRole } = useAuth();
  const isFarmer = userRole === "farmer";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedStackScreen}
        options={{
          tabBarLabel: "Feed",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Prices"
        component={MarketPricesScreen}
        options={{
          tabBarLabel: "Prices",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
      {isFarmer ? (
        <Tab.Screen
          name="Listings"
          component={ListingsStackScreen}
          options={{
            tabBarLabel: "Create",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>➕</Text>,
          }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
