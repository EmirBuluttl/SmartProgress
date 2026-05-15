// ─────────────────────────────────────────────
// WorkoutSummaryScreen — Post-workout özeti
// Antrenman bitince gösterilen özet ekranı
// ─────────────────────────────────────────────
import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import AccentButton from "../components/AccentButton";

type SummaryRoute = RouteProp<RootStackParamList, "WorkoutSummary">;

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}sa ${m}dk`;
    if (m > 0) return `${m}dk ${s > 0 ? `${s}sn` : ""}`.trim();
    return `${s}sn`;
}

export default function WorkoutSummaryScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<SummaryRoute>();
    const {
        programName,
        dayLabel,
        nextDayLabel,
        totalVolume,
        duration,
        exerciseCount,
        setCount,
    } = route.params;

    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 80,
                friction: 6,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleGoHome = () => {
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* ─── Trophy Animation ─── */}
            <Animated.View
                style={[styles.trophyWrap, { transform: [{ scale: scaleAnim }] }]}
            >
                <View style={styles.trophyCircle}>
                    <Text style={styles.trophyEmoji}>🏆</Text>
                </View>
            </Animated.View>

            <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.congratsTitle}>Harika İş Çıkardın!</Text>
                {dayLabel ? (
                    <Text style={styles.congratsSub}>
                        {programName ? `${programName} · ` : ""}{dayLabel} tamamlandı
                    </Text>
                ) : (
                    <Text style={styles.congratsSub}>Antrenman tamamlandı</Text>
                )}
            </Animated.View>

            {/* ─── Stats Grid ─── */}
            <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
                <GymCard elevated style={styles.statCard}>
                    <Ionicons name="barbell-outline" size={24} color={colors.accent} />
                    <Text style={styles.statValue}>
                        {Number(totalVolume || 0).toFixed(1)}
                    </Text>
                    <Text style={styles.statLabel}>Yük Skoru</Text>
                </GymCard>

                <GymCard elevated style={styles.statCard}>
                    <Ionicons name="time-outline" size={24} color={colors.accent} />
                    <Text style={styles.statValue}>{formatDuration(duration)}</Text>
                    <Text style={styles.statLabel}>Süre</Text>
                </GymCard>

                <GymCard elevated style={styles.statCard}>
                    <Ionicons name="flash-outline" size={24} color={colors.accent} />
                    <Text style={styles.statValue}>{exerciseCount}</Text>
                    <Text style={styles.statLabel}>Egzersiz</Text>
                </GymCard>

                <GymCard elevated style={styles.statCard}>
                    <Ionicons name="repeat-outline" size={24} color={colors.accent} />
                    <Text style={styles.statValue}>{setCount}</Text>
                    <Text style={styles.statLabel}>Set</Text>
                </GymCard>
            </Animated.View>

            {/* ─── Next Day Preview ─── */}
            {nextDayLabel && (
                <Animated.View style={{ opacity: fadeAnim }}>
                    <GymCard elevated style={styles.nextDayCard}>
                        <View style={styles.nextDayHeader}>
                            <Ionicons name="arrow-forward-circle" size={22} color={colors.accent} />
                            <Text style={styles.nextDayTitle}>Sıradaki Antrenman</Text>
                        </View>
                        <Text style={styles.nextDayLabel}>{nextDayLabel}</Text>
                        <Text style={styles.nextDayHint}>
                            Ana sayfaya dön, yarınki antrenman hazır olacak.
                        </Text>
                    </GymCard>
                </Animated.View>
            )}

            {/* ─── Actions ─── */}
            <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
                <AccentButton
                    title="Ana Sayfaya Dön"
                    onPress={handleGoHome}
                    style={{ minHeight: 56 }}
                />
            </Animated.View>
        </ScrollView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl + spacing.xl,
        paddingBottom: spacing.xxxl,
        alignItems: "center",
    },
    trophyWrap: {
        marginBottom: spacing.xl,
    },
    trophyCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    trophyEmoji: {
        fontSize: 48,
    },
    congratsTitle: {
        fontSize: fontSize.xxl + 4,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    congratsSub: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xxl,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        justifyContent: "center",
        width: "100%",
        marginBottom: spacing.xl,
    },
    statCard: {
        width: "46%",
        alignItems: "center",
        paddingVertical: spacing.lg,
        gap: spacing.xs,
    },
    statValue: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    statLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    nextDayCard: {
        width: "100%",
        marginBottom: spacing.xl,
        borderColor: colors.accent,
        borderWidth: 1,
    },
    nextDayHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    nextDayTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    nextDayLabel: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    nextDayHint: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    actions: {
        width: "100%",
    },
});
