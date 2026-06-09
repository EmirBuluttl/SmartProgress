// ─────────────────────────────────────────────
// SmartProgress — App Entry Point
// ─────────────────────────────────────────────
import React from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { registerRootComponent } from "expo";
import { AuthProvider } from "./store/AuthContext";
import RootNavigator from "./navigation/RootNavigator";
import { useSync } from "./hooks/useSync";
import { ThemeProvider } from "./hooks/ThemeContext";
import { colors } from "./constants/theme";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { registerLocalNotificationResponseHandler, setupLocalNotificationChannels } from "./services/localNotificationService";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./services/queryClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const linking: any = {
    prefixes: ["https://app.smartprogress.online", "http://localhost:8082", "smartprogress://"],
    config: {
        screens: {
            Login: "login",
            Register: "register",
            ForgotPassword: "reset-password",
            PrivacyPolicy: "privacy",
            Support: "support",
            AccountDeletion: "account-deletion",
            MainTabs: {
                screens: {
                    Home: "",
                    MyProgress: "progress",
                    Profile: "profile",
                },
            },
            WorkoutSession: "workout",
        },
    },
};

const navigationRef = createNavigationContainerRef<any>();

function AppContent() {
    // Auto-sync pending workouts on mount & connectivity change
    useSync();

    React.useEffect(() => {
        setupLocalNotificationChannels().catch(() => undefined);
        const navigateWhenReady = (screen: any, params?: any, attempt = 0) => {
            if (navigationRef.isReady()) {
                navigationRef.navigate(screen, params);
                return;
            }
            if (attempt >= 10) return;
            setTimeout(() => navigateWhenReady(screen, params, attempt + 1), 250);
        };
        const unregister = registerLocalNotificationResponseHandler({
            navigate: navigateWhenReady,
        });
        return unregister;
    }, []);

    return (
        <View style={styles.appShell}>
            <NavigationContainer
                ref={navigationRef}
                linking={linking}
                documentTitle={{ enabled: false }}
            >
                <StatusBar style="light" />
                <RootNavigator />
            </NavigationContainer>
        </View>
    );
}

function App() {
    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider>
                        <AppErrorBoundary>
                            <AuthProvider>
                                <AppContent />
                            </AuthProvider>
                        </AppErrorBoundary>
                    </ThemeProvider>
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    appShell: {
        flex: 1,
    },
});

export default App;
registerRootComponent(App);
