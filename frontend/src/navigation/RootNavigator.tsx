// ─────────────────────────────────────────────
// RootNavigator — Auth-aware Stack Navigation
// Shows AuthStack when logged out, AppStack when logged in
// ─────────────────────────────────────────────
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";

import AuthStack from "./AuthStack";
import TabNavigator from "./TabNavigator";
import WorkoutSessionScreen from "../screens/WorkoutSessionScreen";
import ProgramCreateScreen from "../screens/ProgramCreateScreen";
import WorkoutHistoryScreen from "../screens/WorkoutHistoryScreen";
import ProgramListScreen from "../screens/ProgramListScreen";
import WorkoutDetailScreen from "../screens/WorkoutDetailScreen";
import WorkoutSummaryScreen from "../screens/WorkoutSummaryScreen";
import ProgramDetailScreen from "../screens/ProgramDetailScreen";
import ProgramDayDetailScreen from "../screens/ProgramDayDetailScreen";
import ProfileEditScreen from "../screens/ProfileEditScreen";
import RecordsScreen from "../screens/RecordsScreen";
import CommunityProgramsScreen from "../screens/CommunityProgramsScreen";
import BodyMeasurementsScreen from "../screens/BodyMeasurementsScreen";
import NutritionScreen from "../screens/NutritionScreen";

// ─── Types ───────────────────────────────────

export type RootStackParamList = {
    MainTabs: undefined;
    WorkoutSession: {
        mode?: "free";
        programId?: string;
        programName?: string;
        dayIndex?: number;
        programData?: {
            frequency?: number;
            days?: {
                label: string;
                exercises: {
                    id: string;
                    name: string;
                    targetSets: { targetReps: string; targetRPE?: string; targetRIR?: string; targetWeight?: string; isWarmup?: boolean }[];
                }[];
            }[];
            exercises?: {
                name: string;
                sets: { targetReps?: string; targetRPE?: string; targetRIR?: string }[];
            }[];
        };
    };
    WorkoutSummary: {
        programId?: string;
        programName?: string;
        dayLabel?: string;
        nextDayLabel?: string;
        totalVolume: number;
        duration: number;
        exerciseCount: number;
        setCount: number;
        notes?: string;
    };
    ProgramCreate: {
        editProgramId?: string;
        editProgramData?: any;
    } | undefined;
    WorkoutHistory: undefined;
    ProgramList: undefined;
    CommunityPrograms: undefined;
    WorkoutDetail: { workout: any };
    ProgramDetail: { programId: string };
    ProgramDayDetail: {
        programId: string;
        programName: string;
        dayIndex: number;
        day: {
            label: string;
            isRestDay?: boolean;
            exercises: {
                id?: string;
                name: string;
                targetSets: { targetReps: string; targetRPE?: string; targetRIR?: string; targetWeight?: string; isWarmup?: boolean }[];
            }[];
        };
        programData: any;
    };
    ProfileEdit: undefined;
    Records: undefined;
    BodyMeasurements: undefined;
    Nutrition: undefined;
};

const AppStack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
    const { colors } = useTheme();
    return (
        <AppStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <AppStack.Screen name="MainTabs" component={TabNavigator} />
            <AppStack.Screen
                name="WorkoutSession"
                component={WorkoutSessionScreen}
                options={{
                    presentation: "fullScreenModal",
                    animation: "slide_from_bottom",
                    gestureEnabled: false,
                }}
            />
            <AppStack.Screen
                name="WorkoutSummary"
                component={WorkoutSummaryScreen}
                options={{
                    presentation: "fullScreenModal",
                    animation: "fade",
                    gestureEnabled: false,
                }}
            />
            <AppStack.Screen
                name="ProgramCreate"
                component={ProgramCreateScreen}
                options={{
                    presentation: "fullScreenModal",
                    animation: "slide_from_bottom",
                }}
            />
            <AppStack.Screen
                name="WorkoutHistory"
                component={WorkoutHistoryScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="ProgramList"
                component={ProgramListScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="CommunityPrograms"
                component={CommunityProgramsScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="WorkoutDetail"
                component={WorkoutDetailScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="ProgramDetail"
                component={ProgramDetailScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="ProgramDayDetail"
                component={ProgramDayDetailScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="ProfileEdit"
                component={ProfileEditScreen}
                options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }}
            />
            <AppStack.Screen
                name="Records"
                component={RecordsScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="BodyMeasurements"
                component={BodyMeasurementsScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="Nutrition"
                component={NutritionScreen}
                options={{ animation: "slide_from_right" }}
            />
        </AppStack.Navigator>
    );
}

// ─── Root ────────────────────────────────────

export default function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();
    const { colors } = useTheme();

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return isAuthenticated ? <AppNavigator /> : <AuthStack />;
}
