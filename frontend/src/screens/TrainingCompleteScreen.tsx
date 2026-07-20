import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearOnboardingTrainingPending } from "../utils/appTourEvents";

type Nav = NativeStackNavigationProp<RootStackParamList, "TrainingComplete">;
type Route = RouteProp<RootStackParamList, "TrainingComplete">;

export default function TrainingCompleteScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const programId = route.params?.programId;
    const programName = route.params?.programName || "programin";

    const finishFlow = React.useCallback(async () => {
        await clearOnboardingTrainingPending();
        navigation.replace("MainTabs");
    }, [navigation]);

    const openReminders = React.useCallback(() => {
        navigation.replace("PreWorkoutReminders", {
            trainingMode: "onboarding",
            programId,
        });
    }, [navigation, programId]);

    return (
        <View style={styles.root}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="checkmark-circle-outline" size={34} color={colors.background} />
                </View>
                <Text style={styles.eyebrow}>Egitim tamamlandi</Text>
                <Text style={styles.title}>Ilk loglama akisini ogrendin</Text>
                <Text style={styles.body}>
                    {programName} icin bir antrenmani nasil baslatacagini, setlerini nasil loglayacagini ve antrenmani nasil bitirecegini gordun. Bu demo gercek kayit olusturmadi.
                </Text>

                <View style={styles.noteCard}>
                    <Ionicons name="notifications-outline" size={20} color={colors.accent} />
                    <Text style={styles.noteText}>
                        Siradaki iyi adim: antrenman gunlerin icin kisa hatirlaticilar kur. Ekipman, isinma veya o gune ozel notlarini buraya yazabilirsin.
                    </Text>
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={openReminders} activeOpacity={0.84}>
                    <Text style={styles.primaryText}>Hatirlatici kur</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.background} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={finishFlow} activeOpacity={0.78}>
                    <Text style={styles.secondaryText}>Simdilik bitir</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function createStyles(colors: any) {
    return StyleSheet.create({
        root: {
            flex: 1,
            justifyContent: "center",
            backgroundColor: colors.background,
            padding: spacing.lg,
        },
        card: {
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
        },
        iconWrap: {
            width: 60,
            height: 60,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
        },
        eyebrow: {
            color: colors.accent,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            textTransform: "uppercase",
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
        noteCard: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
        },
        noteText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            lineHeight: 20,
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
    });
}
