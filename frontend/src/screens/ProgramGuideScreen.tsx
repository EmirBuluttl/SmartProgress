import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import {
    buildGuideSections,
    normalizeProgramIntro,
    PROGRAM_GUIDE_SUMMARY_RULES,
} from "../utils/programGuide";
import { clearOnboardingTrainingPending } from "../utils/appTourEvents";

type Nav = NativeStackNavigationProp<RootStackParamList, "ProgramGuide">;
type Route = RouteProp<RootStackParamList, "ProgramGuide">;

export default function ProgramGuideScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const intro = normalizeProgramIntro(route.params.programIntro);
    const sections = buildGuideSections(intro);
    const programName = route.params.programName || "Program";
    const isOnboardingTraining = route.params.onboardingTraining === true;

    const openProgram = async () => {
        if (isOnboardingTraining) {
            await clearOnboardingTrainingPending();
        }
        if (route.params.programId) {
            navigation.replace("ProgramDetail", { programId: route.params.programId });
            return;
        }
        navigation.goBack();
    };

    const startLoggingTraining = () => {
        if (!route.params.programId || !route.params.programData) {
            openProgram();
            return;
        }
        navigation.replace("WorkoutSession", {
            programId: route.params.programId,
            programName,
            dayIndex: 0,
            programData: route.params.programData,
            trainingMode: "onboarding_demo",
        });
    };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={openProgram} activeOpacity={0.8}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.eyebrow}>PROGRAM REHBERI</Text>
                    <Text style={styles.title} numberOfLines={2}>{programName}</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroCard}>
                    <View style={styles.heroIcon}>
                        <Ionicons name="map-outline" size={24} color={colors.background} />
                    </View>
                    <Text style={styles.heroTitle}>{intro?.title || "Programini nasil kullanmalisin?"}</Text>
                    <Text style={styles.heroBody}>
                        Bu rehber programini bilincli takip etmen, setlerini dogru loglaman ve sureci aceleye getirmeden ilerletmen icin hazirlandi.
                    </Text>
                </View>

                {sections.length ? (
                    sections.map((section, index) => (
                        <View key={`${section.title}-${index}`} style={styles.sectionCard}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.stepBadge}>
                                    <Text style={styles.stepText}>{index + 1}</Text>
                                </View>
                                <View style={styles.sectionTitleWrap}>
                                    <Text style={styles.sectionTitle}>{section.title}</Text>
                                </View>
                                {section.icon ? (
                                    <Ionicons name={section.icon as any} size={18} color={colors.accent} />
                                ) : null}
                            </View>
                            <Text style={styles.sectionBody}>{section.body}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Rehber hazir degil</Text>
                        <Text style={styles.sectionBody}>
                            Bu program icin detayli rehber bulunmuyor. Program detaylarindan hareketleri ve gunleri takip edebilirsin.
                        </Text>
                    </View>
                )}

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Kisa hatirlatma</Text>
                    {PROGRAM_GUIDE_SUMMARY_RULES.map((rule) => (
                        <View key={rule} style={styles.summaryRow}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                            <Text style={styles.summaryText}>{rule}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={openProgram} activeOpacity={0.8}>
                    <Text style={styles.secondaryText}>Sonra oku</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={isOnboardingTraining ? startLoggingTraining : openProgram}
                    activeOpacity={0.85}
                >
                    <Text style={styles.primaryText}>
                        {isOnboardingTraining ? "Loglamayi ogren" : "Programi goruntule"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.background} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

function createStyles(colors: any) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        iconBtn: {
            width: 44,
            height: 44,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
        },
        headerText: { flex: 1 },
        eyebrow: {
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            color: colors.accent,
            letterSpacing: 0,
            marginBottom: 2,
        },
        title: {
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.text,
        },
        scroll: { flex: 1 },
        content: {
            padding: spacing.lg,
            paddingBottom: 120,
            gap: spacing.md,
        },
        heroCard: {
            backgroundColor: colors.card,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
        },
        heroIcon: {
            width: 48,
            height: 48,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            marginBottom: spacing.md,
        },
        heroTitle: {
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.text,
            marginBottom: spacing.sm,
        },
        heroBody: {
            fontSize: fontSize.md,
            color: colors.textSecondary,
            lineHeight: 22,
        },
        sectionCard: {
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.sm,
        },
        stepBadge: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentMuted,
        },
        stepText: {
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            color: colors.accent,
        },
        sectionTitleWrap: { flex: 1 },
        sectionTitle: {
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            color: colors.text,
        },
        sectionBody: {
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            lineHeight: 21,
        },
        summaryCard: {
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
        },
        summaryTitle: {
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            color: colors.text,
            marginBottom: spacing.xs,
        },
        summaryRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
        },
        summaryText: {
            flex: 1,
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            lineHeight: 20,
        },
        footer: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: "row",
            gap: spacing.sm,
            padding: spacing.lg,
            paddingBottom: spacing.xl,
            backgroundColor: colors.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        secondaryBtn: {
            flex: 0.85,
            minHeight: 52,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
        },
        secondaryText: {
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            color: colors.textSecondary,
        },
        primaryBtn: {
            flex: 1.3,
            minHeight: 52,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: spacing.xs,
            backgroundColor: colors.accent,
        },
        primaryText: {
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            color: colors.background,
        },
    });
}
