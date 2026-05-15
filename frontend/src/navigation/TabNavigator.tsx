// ─────────────────────────────────────────────
// TabNavigator — Bottom Tab Navigation
// Custom dark gym-themed styling
// ─────────────────────────────────────────────
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { fontSize, fontWeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

import HomeScreen from "../screens/HomeScreen";
import MyProgressScreen from "../screens/MyProgressScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { focused: IoniconsName; unfocused: IoniconsName }> = {
    Home: { focused: "home", unfocused: "home-outline" },
    MyProgress: { focused: "analytics", unfocused: "analytics-outline" },
    Profile: { focused: "person", unfocused: "person-outline" },
};

export default function TabNavigator() {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.tabBarInactive,
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarItemStyle: styles.tabBarItem,
                tabBarIconStyle: styles.tabBarIcon,
                tabBarIcon: ({ focused, color, size }) => {
                    const icons = TAB_ICONS[route.name];
                    const iconName = focused ? icons.focused : icons.unfocused;
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: "Ana Sayfa" }}
            />
            <Tab.Screen
                name="MyProgress"
                component={MyProgressScreen}
                options={{ tabBarLabel: "Gelişimim" }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: "Profilim" }}
            />
        </Tab.Navigator>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    tabBar: {
        backgroundColor: colors.tabBarBg,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: Platform.OS === "ios" ? 88 : Platform.OS === "web" ? 72 : 68,
        paddingTop: 8,
        paddingBottom: Platform.OS === "ios" ? 28 : Platform.OS === "web" ? 12 : 10,
        elevation: 0,
        shadowOpacity: 0,
    },
    tabBarItem: {
        minHeight: 56,
        paddingTop: 2,
        paddingBottom: 4,
    },
    tabBarIcon: {
        marginTop: 2,
    },
    tabBarLabel: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        lineHeight: 16,
        marginTop: 0,
        marginBottom: 0,
    },
});
