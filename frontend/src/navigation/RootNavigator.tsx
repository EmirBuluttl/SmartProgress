// ─────────────────────────────────────────────
// RootNavigator — Auth-aware Stack Navigation
// Shows AuthStack when logged out, AppStack when logged in
// ─────────────────────────────────────────────
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import { authApi } from "../services/api";

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
import PublicProfileScreen from "../screens/PublicProfileScreen";
import CardioSessionScreen from "../screens/CardioSessionScreen";
import PremiumDetailScreen from "../screens/PremiumDetailScreen";
import PremiumProgramWizardScreen from "../screens/PremiumProgramWizardScreen";
import PostTourNextStepScreen from "../screens/PostTourNextStepScreen";
import ProgramGuideScreen from "../screens/ProgramGuideScreen";
import CoachWeeklyReportScreen from "../screens/CoachWeeklyReportScreen";
import CoachInsightHistoryScreen from "../screens/CoachInsightHistoryScreen";
import ExerciseLibraryScreen from "../screens/ExerciseLibraryScreen";
import PreWorkoutRemindersScreen from "../screens/PreWorkoutRemindersScreen";
import TrainingLevelScreen from "../screens/TrainingLevelScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import WarmupRoutineBuilderScreen from "../screens/WarmupRoutineBuilderScreen";
import WarmupSessionScreen from "../screens/WarmupSessionScreen";
import LegalInfoScreen from "../screens/LegalInfoScreen";
import TrainingCompleteScreen from "../screens/TrainingCompleteScreen";
import OnboardingNavigator from "../screens/onboarding/OnboardingNavigator";
import OnboardingCompleteScreen from "../screens/onboarding/OnboardingCompleteScreen";
import type { OnboardingData } from "../screens/onboarding/OnboardingContext";
import { markPostOnboardingFlowPending } from "../utils/appTourEvents";

type NavigationTargetSet = {
    targetReps: string;
    targetRPE?: string;
    targetRIR?: string;
    targetWeight?: string;
    weightMode?: "kg" | "bodyweight";
    effortMode?: "reps" | "duration";
    sideMode?: "both" | "left_right";
    isWarmup?: boolean;
};

// ─── Types ───────────────────────────────────

export type RootStackParamList = {
    MainTabs: { screen?: string; switchKey?: string | number; setupComplete?: boolean } | undefined;
    WorkoutSession: {
        mode?: "free";
        trainingMode?: "onboarding_demo";
        programId?: string;
        programName?: string;
        dayIndex?: number;
        programData?: {
            frequency?: number;
            warmupRoutine?: {
                id: string;
                title: string;
                description?: string;
                durationSeconds?: number;
                completed?: boolean;
            }[];
            days?: {
                label: string;
                warmupRoutine?: any;
                exercises: {
                    id: string;
                    exerciseId?: string;
                    name: string;
                    targetSets: NavigationTargetSet[];
                }[];
            }[];
            exercises?: {
                name: string;
                sets: (Partial<NavigationTargetSet> & { targetReps?: string })[];
            }[];
        };
    };
    WarmupSession: undefined;
    CardioSession: { cardioBlockId?: string } | undefined;
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
        cardioBlocks?: any[];
        sourceWorkout?: any;
    };
    ProgramCreate: {
        editProgramId?: string;
        editProgramData?: any;
    } | undefined;
    WarmupRoutineBuilder: {
        days: { label: string; isRestDay?: boolean; warmupRoutine?: any }[];
        initialDayIndex?: number;
        returnKey: string;
    };
    WorkoutHistory: undefined;
    ProgramList: undefined;
    CommunityPrograms: undefined;
    WorkoutDetail: { workout: any };
    ProgramDetail: { programId: string };
    ProgramGuide: {
        programId?: string;
        programName?: string;
        programIntro?: any;
        programData?: any;
        onboardingTraining?: boolean;
    };
    ProgramDayDetail: {
        programId: string;
        programName: string;
        dayIndex: number;
        day: {
            label: string;
            isRestDay?: boolean;
            exercises: {
                id?: string;
                exerciseId?: string;
                name: string;
                targetSets: NavigationTargetSet[];
            }[];
        };
        programData: any;
    };
    ProfileEdit: undefined;
    Records: undefined;
    BodyMeasurements: undefined;
    Nutrition: undefined;
    PublicProfile: { userId: string };
    PremiumDetail: undefined;
    PostTourNextStep: undefined;
    TrainingComplete: { programId?: string; programName?: string } | undefined;
    PremiumProgramWizard: undefined;
    CoachWeeklyReport: undefined;
    CoachInsightHistory: undefined;
    ExerciseLibrary: undefined;
    PreWorkoutReminders: { trainingMode?: "onboarding"; programId?: string } | undefined;
    TrainingLevel: undefined;
    BlockedUsers: undefined;
    PrivacyPolicy: undefined;
    Support: undefined;
    AccountDeletion: undefined;
    TermsOfService: undefined;
};

const AppStack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
    const { colors } = useTheme();
    const { user, updateUser } = useAuth();
    const [showOnboardingComplete, setShowOnboardingComplete] = React.useState(false);
    const needsOnboarding = user?.settings?.onboarding_completed === false;

    const completeOnboarding = async (data: OnboardingData) => {
        const settings = {
            ...user?.settings,
            onboarding_completed: true,
            onboarding_profile: data,
            training_level: data.experienceLevel || user?.settings?.training_level || "beginner",
        };
        try {
            await authApi.updateProfile({ settings });
        } catch (error) {
            console.warn("[RootNavigator] Failed to persist onboarding profile:", error);
        }
        try {
            await markPostOnboardingFlowPending();
        } catch (error) {
            console.warn("[RootNavigator] Failed to mark post onboarding flow:", error);
        }
        setShowOnboardingComplete(true);
        updateUser({ settings });
    };

    if (needsOnboarding) {
        return (
            <OnboardingNavigator
                firstName={user?.firstName || "Sporcu"}
                onComplete={completeOnboarding}
            />
        );
    }

    if (showOnboardingComplete) {
        return (
            <OnboardingCompleteScreen
                firstName={user?.firstName || "Sporcu"}
                onContinue={() => setShowOnboardingComplete(false)}
            />
        );
    }

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
                name="CardioSession"
                component={CardioSessionScreen}
                options={{
                    presentation: "fullScreenModal",
                    animation: "slide_from_right",
                    gestureEnabled: false,
                }}
            />
            <AppStack.Screen
                name="WarmupSession"
                component={WarmupSessionScreen}
                options={{
                    presentation: "fullScreenModal",
                    animation: "slide_from_right",
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
                name="WarmupRoutineBuilder"
                component={WarmupRoutineBuilderScreen}
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
                name="ProgramGuide"
                component={ProgramGuideScreen}
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
            <AppStack.Screen
                name="PublicProfile"
                component={PublicProfileScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="PremiumDetail"
                component={PremiumDetailScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="PostTourNextStep"
                component={PostTourNextStepScreen}
                options={{ animation: "fade" }}
            />
            <AppStack.Screen
                name="TrainingComplete"
                component={TrainingCompleteScreen}
                options={{ animation: "fade" }}
            />
            <AppStack.Screen
                name="PremiumProgramWizard"
                component={PremiumProgramWizardScreen}
                options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }}
            />
            <AppStack.Screen
                name="CoachWeeklyReport"
                component={CoachWeeklyReportScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="CoachInsightHistory"
                component={CoachInsightHistoryScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="ExerciseLibrary"
                component={ExerciseLibraryScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="PreWorkoutReminders"
                component={PreWorkoutRemindersScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="TrainingLevel"
                component={TrainingLevelScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="BlockedUsers"
                component={BlockedUsersScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="PrivacyPolicy"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="Support"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="AccountDeletion"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <AppStack.Screen
                name="TermsOfService"
                component={LegalInfoScreen}
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
