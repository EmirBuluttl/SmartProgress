// ─────────────────────────────────────────────
// AuthStack — Unauthenticated Navigation
// Login + Register screens
// ─────────────────────────────────────────────
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../hooks/ThemeContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import LegalInfoScreen from "../screens/LegalInfoScreen";
import PublicProgramPreviewScreen from "../screens/PublicProgramPreviewScreen";

export type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    ForgotPassword: { token?: string } | undefined;
    PrivacyPolicy: undefined;
    Support: undefined;
    AccountDeletion: undefined;
    TermsOfService: undefined;
    ProgramDetail: { programId: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
    const { colors } = useTheme();

    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: "fade",
            }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
                name="PrivacyPolicy"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
                name="Support"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
                name="AccountDeletion"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
                name="TermsOfService"
                component={LegalInfoScreen}
                options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
                name="ProgramDetail"
                component={PublicProgramPreviewScreen}
                options={{ animation: "slide_from_right" }}
            />
        </Stack.Navigator>
    );
}
