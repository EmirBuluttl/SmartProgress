// ─────────────────────────────────────────────
// WorkoutDetailScreen — Antrenman Detayı
// Tüm egzersizler, setler, ağırlıklar
// ─────────────────────────────────────────────
import React from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import { calculateLoadScoreFromExercises } from "../utils/workoutMetrics";

type Route = RouteProp<RootStackParamList, "WorkoutDetail">;

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}dk ${s > 0 ? `${s}s` : ""}`;
}

function formatSetDuration(seconds: number): string {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total <= 0) return "—";
    if (total < 60) return `${total}sn`;
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function WorkoutDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const { workout } = route.params;

    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const exercises = workout?.data?.exercises || [];
    const duration = workout?.data?.totalDuration || workout?.data?.duration || 0;
    const notes = typeof workout?.notes === "string" ? workout.notes.trim() : "";

    const loadScore = calculateLoadScoreFromExercises(exercises);

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{workout.title || "Antrenman"}</Text>
                    <Text style={styles.headerDate}>{formatDate(workout.logDate)}</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Summary Stats ─── */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                        <Text style={styles.statValue}>{exercises.length}</Text>
                        <Text style={styles.statLabel}>Egzersiz</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Ionicons name="layers-outline" size={20} color={colors.accent} />
                        <Text style={styles.statValue}>
                            {exercises.reduce((sum: number, ex: any) => sum + (ex.sets?.length || 0), 0)}
                        </Text>
                        <Text style={styles.statLabel}>Set</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Ionicons name="time-outline" size={20} color={colors.accent} />
                        <Text style={styles.statValue}>{formatDuration(duration)}</Text>
                        <Text style={styles.statLabel}>Süre</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Ionicons name="trending-up-outline" size={20} color={colors.accent} />
                        <Text style={styles.statValue}>{loadScore > 0 ? loadScore.toFixed(1) : "—"}</Text>
                        <Text style={styles.statLabel}>Yük Skoru</Text>
                    </View>
                </View>

                {notes ? (
                    <GymCard elevated style={styles.notesCard}>
                        <View style={styles.notesHeader}>
                            <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                            <Text style={styles.notesTitle}>Antrenman Notu</Text>
                        </View>
                        <Text style={styles.notesText}>{notes}</Text>
                    </GymCard>
                ) : null}

                {/* ─── Exercise List ─── */}
                {exercises.length === 0 ? (
                    <Text style={styles.emptyText}>Egzersiz verisi bulunamadı.</Text>
                ) : (
                    exercises.map((ex: any, exIdx: number) => (
                        <GymCard key={exIdx} elevated style={styles.exerciseCard}>
                            {/* Exercise Name */}
                            <View style={styles.exerciseHeader}>
                                <View style={styles.exerciseIndex}>
                                    <Text style={styles.exerciseIndexText}>{exIdx + 1}</Text>
                                </View>
                                <Text style={styles.exerciseName}>{ex.name}</Text>
                            </View>

                            {/* Sets Table */}
                            <View style={styles.setTable}>
                                {/* Header */}
                                <View style={styles.setHeaderRow}>
                                    <Text style={[styles.setHeaderCell, { flex: 0.4 }]}>SET</Text>
                                    <Text style={[styles.setHeaderCell, { flex: 1 }]}>AĞIRLIK</Text>
                                    <Text style={[styles.setHeaderCell, { flex: 0.8 }]}>TEKRAR/SÜRE</Text>
                                    <Text style={[styles.setHeaderCell, { flex: 0.6 }]}>RPE</Text>
                                    <Text style={[styles.setHeaderCell, { flex: 0.6 }]}>RIR</Text>
                                </View>
                                {(() => {
                                    let warmupCount = 0;
                                    let workingCount = 0;
                                    return (ex.sets || []).map((set: any, sIdx: number) => {
                                        const isWarmup = !!set.isWarmup;
                                        if (isWarmup) warmupCount++;
                                        else workingCount++;
                                        const label = isWarmup ? `W${warmupCount}` : `${workingCount}`;
                                        return (
                                    <View key={sIdx} style={[
                                        styles.setRow,
                                        sIdx % 2 === 0 ? styles.setRowEven : styles.setRowOdd,
                                        isWarmup && { opacity: 0.7 },
                                    ]}>
                                        <Text style={[styles.setCell, { flex: 0.4 }, isWarmup && { fontStyle: "italic" as const, color: colors.textMuted }]}>
                                            {label}
                                        </Text>
                                        <Text style={[styles.setCell, styles.setCellAccent, { flex: 1 }]}>
                                            {set.weightMode === "bodyweight" ? "BW" : set.weight > 0 ? `${set.weight} ${set.unit || "kg"}` : "—"}
                                        </Text>
                                        <Text style={[styles.setCell, { flex: 0.8 }]}>
                                            {set.effortMode === "duration"
                                                ? formatSetDuration(set.durationSeconds)
                                                : set.reps > 0 ? `${set.reps}` : "—"}
                                        </Text>
                                        <Text style={[styles.setCell, { flex: 0.6 }]}>
                                            {set.rpe ? set.rpe : "—"}
                                        </Text>
                                        <Text style={[styles.setCell, { flex: 0.6 }]}>
                                            {set.rir ? set.rir : "—"}
                                        </Text>
                                    </View>
                                        );
                                    });
                                })()}
                            </View>
                        </GymCard>
                    ))
                )}

                <View style={{ height: spacing.xxxl }} />
            </ScrollView>
        </View>
    );
}

// ─── Styles ──────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 52,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
        gap: spacing.md,
    },
    backBtn: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    headerDate: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: 2,
        textTransform: "capitalize",
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    statsRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        alignItems: "center",
        paddingVertical: spacing.md,
        gap: 4,
    },
    statValue: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.heavy,
        color: colors.text,
    },
    statLabel: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
    },
    notesCard: {
        marginBottom: spacing.xl,
    },
    notesHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    notesTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    notesText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    exerciseCard: {
        marginBottom: spacing.md,
    },
    exerciseHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    exerciseIndex: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
    },
    exerciseIndexText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    exerciseName: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        flex: 1,
    },
    setTable: {
        gap: 2,
    },
    setHeaderRow: {
        flexDirection: "row",
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 2,
    },
    setHeaderCell: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.textMuted,
        letterSpacing: 0.5,
    },
    setRow: {
        flexDirection: "row",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    setRowEven: {
        backgroundColor: "transparent",
    },
    setRowOdd: {
        backgroundColor: colors.surfaceLight,
    },
    setCell: {
        fontSize: fontSize.md,
        color: colors.text,
    },
    setCellAccent: {
        color: colors.accent,
        fontWeight: fontWeight.semibold,
    },
    emptyText: {
        color: colors.textMuted,
        fontStyle: "italic",
        textAlign: "center",
        marginTop: spacing.xl,
    },
});
