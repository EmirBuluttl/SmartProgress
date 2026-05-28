// ─────────────────────────────────────────────
// OnboardingPreview — Ana proje akışına dahil
// etmeden onboarding'i test etmek için.
//
// KULLANIM:
//   package.json içinde "main" alanını
//   "src/OnboardingPreview.tsx" olarak değiştir,
//   expo start çalıştır, test et,
//   bitince "src/App.tsx" olarak geri al.
// ─────────────────────────────────────────────
import "react-native-gesture-handler";
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { registerRootComponent } from "expo";
import OnboardingNavigator from "./screens/onboarding/OnboardingNavigator";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "./constants/theme";

export default function OnboardingPreview() {
    const [started, setStarted] = useState(false);
    const [completed, setCompleted] = useState(false);

    const handleComplete = () => {
        setCompleted(true);
    };

    if (completed) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <View style={styles.completedScreen}>
                        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
                        <Text style={styles.completedEmoji}>🎉</Text>
                        <Text style={styles.completedTitle}>Onboarding Tamamlandı!</Text>
                        <Text style={styles.completedSub}>
                            Gerçek uygulamada bu noktada kullanıcı Ana Sayfa'ya yönlendirilir.
                        </Text>
                        <TouchableOpacity
                            style={styles.restartBtn}
                            onPress={() => { setStarted(false); setCompleted(false); }}
                        >
                            <Text style={styles.restartText}>Baştan Test Et</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        );
    }

    if (started) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <StatusBar barStyle="light-content" backgroundColor={colors.background} />
                    <OnboardingNavigator
                        firstName="Emir"
                        onComplete={handleComplete}
                    />
                </SafeAreaProvider>
            </GestureHandlerRootView>
        );
    }

    // Başlangıç ekranı — test talimatları
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <View style={styles.launchScreen}>
                    <StatusBar barStyle="light-content" backgroundColor={colors.background} />
                    <View style={styles.logoCircle}>
                        <Text style={{ fontSize: 32 }}>🏋️</Text>
                    </View>
                    <Text style={styles.launchTitle}>SmartProgress</Text>
                    <Text style={styles.launchSub}>Onboarding Preview Modu</Text>

                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>📋 Bu nedir?</Text>
                        <Text style={styles.infoText}>
                            Bu ekran, onboarding akışını ana proje akışına dahil etmeden
                            test etmeni sağlar. 6 sayfalık animasyonlu kullanıcı karşılama
                            ve bilgi toplama akışını görebilirsin.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.startBtn}
                        onPress={() => setStarted(true)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.startText}>Onboarding'i Başlat →</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    launchScreen: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.xl,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
        elevation: 12,
    },
    launchTitle: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy as any,
        color: colors.text,
    },
    launchSub: {
        fontSize: fontSize.sm,
        color: colors.accent,
        fontWeight: fontWeight.semibold as any,
    },
    infoCard: {
        width: "100%",
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    infoTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold as any,
        color: colors.text,
    },
    infoText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    startBtn: {
        width: "100%",
        height: 56,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    startText: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.heavy as any,
        color: colors.background,
    },
    completedScreen: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.xl,
    },
    completedEmoji: { fontSize: 64 },
    completedTitle: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy as any,
        color: colors.text,
    },
    completedSub: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 22,
    },
    restartBtn: {
        height: 52,
        paddingHorizontal: spacing.xxl,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    restartText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold as any,
        color: colors.accent,
    },
});

registerRootComponent(OnboardingPreview);
