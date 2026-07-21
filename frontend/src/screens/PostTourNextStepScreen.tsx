import React from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useAuth } from "../store/AuthContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearPostOnboardingFlowPending, markOnboardingTrainingPending } from "../utils/appTourEvents";

type Nav = NativeStackNavigationProp<RootStackParamList, "PostTourNextStep">;

const LEVEL_LABELS: Record<string, string> = {
    beginner: "Baslangic",
    intermediate: "Orta seviye",
    advanced: "Ileri seviye",
};

const GOAL_LABELS: Record<string, string> = {
    muscle: "Kas kazanimi",
    strength: "Guc artisi",
    fat_loss: "Yag yakma",
    fitness: "Genel fitness",
    performance: "Sportif performans",
};

export default function PostTourNextStepScreen() {
    const navigation = useNavigation<Nav>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const profile = (user?.settings?.onboarding_profile || user?.settings?.onboardingProfile || {}) as any;
    const guidanceEnabled = profile.guidanceEnabled !== false;
    const level = LEVEL_LABELS[String(profile.experienceLevel || user?.settings?.training_level || "beginner")] || "Baslangic";
    const goal = GOAL_LABELS[String(profile.workoutGoal || "muscle")] || "Kas kazanimi";
    const frequency = Number(profile.weeklyFrequency || 4);

    const goHome = React.useCallback(async () => {
        await clearPostOnboardingFlowPending();
        navigation.replace("MainTabs");
    }, [navigation]);

    const openWizard = React.useCallback(async () => {
        await clearPostOnboardingFlowPending();
        await markOnboardingTrainingPending();
        navigation.replace("PremiumProgramWizard");
    }, [navigation]);

    return (
        <View style={styles.root}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="map-outline" size={28} color={colors.background} />
                </View>
                <Text style={styles.eyebrow}>UYGULAMA TURU TAMAMLANDI</Text>
                <Text style={styles.title}>
                    {guidanceEnabled ? "Ilk programini birlikte kuralim" : "Istersen ornek program kurabiliriz"}
                </Text>
                <Text style={styles.body}>
                    Uygulamanin ana bolumlerini gordun. Onboarding cevaplarina gore baslangic noktan hazir; wizard bu bilgilerle takip edilebilir bir program taslagi olusturur.
                </Text>

                <View style={styles.summary}>
                    <SummaryRow icon="speedometer-outline" label="Seviye" value={level} colors={colors} />
                    <SummaryRow icon="flag-outline" label="Hedef" value={goal} colors={colors} />
                    <SummaryRow icon="calendar-outline" label="Haftalik siklik" value={`${Number.isFinite(frequency) ? frequency : 4} gun`} colors={colors} />
                </View>

                <TouchableOpacity
                    style={[styles.primaryBtn, !guidanceEnabled && styles.softPrimaryBtn]}
                    onPress={openWizard}
                    activeOpacity={0.84}
                >
                    <Text style={styles.primaryText}>
                        {guidanceEnabled ? "Programimi birlikte kuralim" : "Ornek program kur"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.background} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={goHome} activeOpacity={0.78}>
                    <Text style={[styles.secondaryText, !guidanceEnabled && styles.secondaryStrongText]}>
                        Simdilik ana sayfaya don
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function SummaryRow({ icon, label, value, colors }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string; colors: any }) {
    return (
        <View style={[rowStyles.row, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name={icon} size={18} color={colors.accent} />
            <Text style={[rowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[rowStyles.value, { color: colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const rowStyles = StyleSheet.create({
    row: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    label: {
        flex: 1,
        fontSize: fontSize.sm,
    },
    value: {
        maxWidth: "45%",
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
});

function createStyles(colors: any) {
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
            padding: spacing.lg,
            justifyContent: "center",
        },
        card: {
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: spacing.lg,
            gap: spacing.md,
        },
        iconWrap: {
            width: 58,
            height: 58,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.xs,
        },
        eyebrow: {
            color: colors.accent,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            letterSpacing: 0,
        },
        title: {
            color: colors.text,
            fontSize: fontSize.xxl,
            fontWeight: fontWeight.bold,
            lineHeight: 32,
        },
        body: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
            lineHeight: 23,
        },
        summary: {
            gap: spacing.sm,
            marginTop: spacing.xs,
        },
        primaryBtn: {
            minHeight: 54,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        softPrimaryBtn: {
            opacity: 0.88,
        },
        primaryText: {
            color: colors.background,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
        },
        secondaryBtn: {
            minHeight: 48,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        secondaryText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
        },
        secondaryStrongText: {
            color: colors.text,
        },
    });
}
