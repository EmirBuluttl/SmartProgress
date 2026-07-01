// ─────────────────────────────────────────────
// WorkoutDetailScreen — Antrenman Detayı
// Tüm egzersizler, setler, ağırlıklar
// ─────────────────────────────────────────────
import React, { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Animated,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCachedWorkoutDetail } from "../services/workoutCacheService";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import { calculateLoadScoreFromExercises } from "../utils/workoutMetrics";
import { CARDIO_TYPE_LABELS, summarizeCardioBlock, summarizeCardioBlocks } from "../utils/cardio";
import { useScreenEnter } from "../hooks/useScreenEnter";

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

function getEffortHeader(sets: any[] = []): string {
    const modes = sets.map((set) => {
        const hasDuration = set?.effortMode === "duration" || Number(set?.durationSeconds || 0) > 0;
        const hasReps = Number(set?.reps || 0) > 0 || !hasDuration;
        return hasDuration && !hasReps ? "duration" : hasDuration && hasReps ? "mixed" : "reps";
    });
    const hasDuration = modes.some((mode) => mode === "duration" || mode === "mixed");
    const hasReps = modes.some((mode) => mode === "reps" || mode === "mixed");
    if (hasDuration && hasReps) return "TEKRAR/SURE";
    return hasDuration ? "SURE" : "TEKRAR";
}

function getDisplaySetRows(sets: any[] = []) {
    return sets.flatMap((set, index) => {
        if (set?.sideMode !== "left_right") return [{ set, sourceIndex: index }];
        return (["left", "right"] as const).flatMap((side) => {
            const sideData = set?.[side] || {};
            const hasSideData = Number(sideData.weight || 0) > 0 ||
                Number(sideData.reps || 0) > 0 ||
                Number(sideData.durationSeconds || 0) > 0 ||
                Number(sideData.rpe || 0) > 0 ||
                sideData.rir !== undefined;
            if (!hasSideData) return [];
            return [{
                sourceIndex: index,
                side,
                set: {
                    ...set,
                    ...sideData,
                    weight: sideData.weight ?? set.weight,
                    reps: sideData.reps ?? set.reps,
                    durationSeconds: sideData.durationSeconds ?? set.durationSeconds,
                    rpe: sideData.rpe ?? set.rpe,
                    rir: sideData.rir ?? set.rir,
                },
            }];
        });
    });
}

function countDisplaySets(exercises: any[] = []): number {
    return exercises.reduce((sum, exercise) => sum + getDisplaySetRows(exercise?.sets || []).length, 0);
}

export default function WorkoutDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const { workout } = route.params;
    const { animStyle } = useScreenEnter({ variant: "slide" });

    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [localWorkout, setLocalWorkout] = useState(workout);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const fetchDetails = async () => {
            if (localWorkout?.id && !localWorkout.data?.exercises) {
                setLoading(true);
                try {
                    const detailedWorkout = await getCachedWorkoutDetail(localWorkout.id, localWorkout);
                    setLocalWorkout(detailedWorkout);
                } catch (err) {
                    console.error("[WorkoutDetail] Error fetching details:", err);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchDetails();
    }, [localWorkout?.id]);

    const exercises = localWorkout?.data?.exercises || [];
    const duration = localWorkout?.data?.totalDuration || localWorkout?.data?.duration || 0;
    const notes = typeof localWorkout?.notes === "string" ? localWorkout.notes.trim() : "";
    const cardioBlocks = Array.isArray(localWorkout?.data?.cardioBlocks) ? localWorkout.data.cardioBlocks : [];

    const loadScore = calculateLoadScoreFromExercises(exercises);

    if (loading) {
        return (
            <Animated.View style={[styles.root, animStyle]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={26} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{localWorkout.title || "Antrenman"}</Text>
                        <Text style={styles.headerDate}>{formatDate(localWorkout.logDate)}</Text>
                    </View>
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={[styles.root, animStyle]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{localWorkout.title || "Antrenman"}</Text>
                    <Text style={styles.headerDate}>{formatDate(localWorkout.logDate)}</Text>
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
                            {countDisplaySets(exercises)}
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

                {cardioBlocks.length > 0 ? (
                    <GymCard elevated style={styles.cardioCard}>
                        <View style={styles.notesHeader}>
                            <Ionicons name="pulse-outline" size={18} color={colors.accent} />
                            <Text style={styles.notesTitle}>Kardiyo</Text>
                        </View>
                        <Text style={styles.notesText}>{summarizeCardioBlocks(cardioBlocks)}</Text>
                        {cardioBlocks.map((block: any) => (
                            <View key={block.id} style={styles.cardioRow}>
                                <Text style={styles.cardioTitle}>{(CARDIO_TYPE_LABELS as any)[block.type] || block.title}</Text>
                                <Text style={styles.cardioText}>{summarizeCardioBlock(block)}</Text>
                                {Array.isArray(block.stages) && block.stages.length > 0 ? (
                                    <View style={styles.cardioStageList}>
                                        {block.stages.map((stage: any, index: number) => (
                                            <Text key={stage.id || index} style={styles.cardioText}>
                                                {stage.isRest ? "Mola" : `Stage ${index + 1}`}: {stage.note ? stage.note : "Not yok"}
                                            </Text>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        ))}
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
                                    <Text style={[styles.setHeaderCell, styles.effortHeaderCell, { flex: 1.1 }]} numberOfLines={1}>{getEffortHeader(getDisplaySetRows(ex.sets || []).map((row: any) => row.set))}</Text>
                                    <Text style={[styles.setHeaderCell, { flex: 0.6 }]}>RPE</Text>
                                    <Text style={[styles.setHeaderCell, { flex: 0.6 }]}>RIR</Text>
                                </View>
                                {(() => {
                                    let warmupCount = 0;
                                    let workingCount = 0;
                                    const labelsBySource = new Map<string, string>();
                                    return getDisplaySetRows(ex.sets || []).map((row: any, sIdx: number) => {
                                        const set = row.set;
                                        const isWarmup = !!set.isWarmup;
                                        const sourceKey = `${isWarmup ? "warmup" : "working"}-${row.sourceIndex}`;
                                        let baseLabel = labelsBySource.get(sourceKey);
                                        if (!baseLabel) {
                                            if (isWarmup) {
                                                warmupCount++;
                                                baseLabel = `W${warmupCount}`;
                                            } else {
                                                workingCount++;
                                                baseLabel = `${workingCount}`;
                                            }
                                            labelsBySource.set(sourceKey, baseLabel);
                                        }
                                        const label = `${baseLabel}${row.side === "left" ? "L" : row.side === "right" ? "R" : ""}`;
                                        return (
                                    <View key={`${row.sourceIndex}-${row.side || "both"}`} style={[
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
                                        <Text style={[styles.setCell, { flex: 1.1 }]}>
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
        </Animated.View>
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
    cardioCard: {
        marginBottom: spacing.xl,
    },
    cardioRow: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cardioTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    cardioText: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        marginTop: 2,
    },
    cardioStageList: {
        marginTop: spacing.xs,
        gap: 2,
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
    effortHeaderCell: {
        minWidth: 72,
        paddingRight: spacing.xs,
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
        paddingRight: spacing.xs,
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
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
    },
});
