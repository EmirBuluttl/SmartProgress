// ─────────────────────────────────────────────
// ProgramDetailScreen — Program detay sayfası
// Döngüsel (Cycle-based) program: Gün listesi, silme, antrenman başlat
// ─────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { parseApiError, programApi, workoutApi } from "../services/api";
import { confirmDialog, showAlert } from "../utils/confirm";

type Nav = NativeStackNavigationProp<RootStackParamList, "ProgramDetail">;
type Route = RouteProp<RootStackParamList, "ProgramDetail">;

interface ProgramDay {
    label: string;
    isRestDay?: boolean;
    exercises: {
        id?: string;
        name: string;
        targetSets: { targetReps: string; targetRPE?: string; targetRIR?: string; targetWeight?: string; isWarmup?: boolean }[];
    }[];
}

interface ProgramData {
    id: string;
    name: string;
    description?: string;
    frequency: number;
    currentDayIndex: number;
    isPublic: boolean;
    data: {
        days: ProgramDay[];
    } | null;
    createdAt: string;
}

export default function ProgramDetailScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { programId } = route.params;
    const { colors } = useTheme();

    const [program, setProgram] = useState<ProgramData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [workoutCount, setWorkoutCount] = useState(0);

    const s = React.useMemo(() => createStyles(colors), [colors]);

    const fetchProgram = useCallback(async () => {
        try {
            const [progRes, workoutRes] = await Promise.all([
                programApi.getById(programId),
                workoutApi.list({ limit: 200 }),
            ]);
            setProgram(progRes.data as ProgramData);
            const allWorkouts = workoutRes.data?.workouts || [];
            const count = allWorkouts.filter((w: any) => w.data?.programId === programId).length;
            setWorkoutCount(count);
        } catch (err: any) {
            console.error("[ProgramDetail] fetch error:", err?.message);
            Alert.alert("Hata", "Program yüklenemedi.");
            navigation.goBack();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [programId]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchProgram();
        }, [fetchProgram]),
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchProgram();
    };

    const handleDelete = async () => {
        const confirmed = await confirmDialog(
            "Programı Sil",
            `"${program?.name}" programını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
        );
        if (confirmed) {
            setDeleting(true);
            try {
                await programApi.deleteProgram(programId);
                navigation.goBack();
            } catch (err: any) {
                const apiError = parseApiError(err);
                showAlert("Hata", apiError.message || "Silme islemi basarisiz.");
                setDeleting(false);
            }
        }
    };

    const handleStartWorkout = () => {
        if (!program?.data?.days) return;
        const dayIndex = program.currentDayIndex;
        const currentDay = program.data.days[dayIndex];

        if (currentDay?.isRestDay) {
            Alert.alert(
                "Dinlenme Günü",
                "Bugün dinlenme günü! Yine de antrenman başlatmak ister misiniz?",
                [
                    { text: "Hayır", style: "cancel" },
                    {
                        text: "Evet, Başlat",
                        onPress: () => navigateToSession(dayIndex),
                    },
                ],
            );
            return;
        }

        navigateToSession(dayIndex);
    };

    const navigateToSession = (dayIndex: number) => {
        navigation.navigate("WorkoutSession", {
            programId: program!.id,
            programName: program!.name,
            dayIndex,
            programData: program!.data as any,
        });
    };

    const handleEdit = () => {
        if (!program) return;
        navigation.navigate("ProgramCreate", {
            editProgramId: program.id,
            editProgramData: program,
        });
    };

    const handleDayTap = (dayIndex: number) => {
        if (!program) return;
        navigation.navigate("ProgramCreate", {
            editProgramId: program.id,
            editProgramData: program,
        });
    };

    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (!program) return null;

    const days = program.data?.days || [];
    const currentDayIndex = program.currentDayIndex;

    return (
        <View style={s.container}>
            {/* ─── Header ─── */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <Text style={s.headerTitle} numberOfLines={1}>
                    {program.name}
                </Text>

                <View style={s.headerActions}>
                    <TouchableOpacity
                        onPress={handleEdit}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.headerIconBtn}
                    >
                        <Ionicons name="create-outline" size={20} color={colors.accent} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleDelete}
                        disabled={deleting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.headerIconBtn}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={20}
                            color={deleting ? colors.textMuted : colors.error}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleStartWorkout}
                        style={s.startBtn}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="play" size={16} color={colors.background} />
                        <Text style={s.startBtnText}>Başlat</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
            >
                {/* ─── Info Card ─── */}
                <View style={s.infoCard}>
                    {program.description ? (
                        <Text style={s.description}>{program.description}</Text>
                    ) : null}

                    <View style={s.metaRow}>
                        <View style={s.metaItem}>
                            <Ionicons name="repeat-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>Frekans: {program.frequency} gün/döngü</Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>{days.length} gün tanımlı</Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="time-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                Oluşturulma: {new Date(program.createdAt).toLocaleDateString("tr-TR")}
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {Math.max(0, Math.floor((Date.now() - new Date(program.createdAt).getTime()) / 86400000))} gündür kullanılıyor
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons
                                name={program.isPublic ? "globe-outline" : "lock-closed-outline"}
                                size={16}
                                color={colors.accent}
                            />
                            <Text style={s.metaText}>
                                {program.isPublic ? "Herkese açık" : "Özel"}
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="barbell-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {workoutCount} antrenman tamamlandı
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ─── Current Day Highlight ─── */}
                {days.length > 0 && (
                    <View style={s.currentDayBanner}>
                        <View style={s.currentDayDot} />
                        <Text style={s.currentDayLabel}>
                            Sıradaki:{" "}
                            <Text style={{ fontWeight: fontWeight.bold as any }}>
                                {days[currentDayIndex]?.label || `Gün ${currentDayIndex + 1}`}
                            </Text>
                        </Text>
                    </View>
                )}

                {/* ─── Day List ─── */}
                <Text style={s.sectionTitle}>Program Takvimi</Text>

                {days.map((day, idx) => {
                    const isCurrent = idx === currentDayIndex;
                    const isRest = day.isRestDay;

                    return (
                        <View
                            key={idx}
                            style={[s.dayCard, isCurrent && s.dayCardActive]}
                        >
                            <TouchableOpacity onPress={() => handleDayTap(idx)}>
                            <View style={s.dayHeader}>
                                <View
                                    style={[
                                        s.dayIndexCircle,
                                        isCurrent && s.dayIndexCircleActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.dayIndexText,
                                            isCurrent && s.dayIndexTextActive,
                                        ]}
                                    >
                                        {idx + 1}
                                    </Text>
                                </View>
                                <Text style={[s.dayLabel, isRest && s.restLabel]}>
                                    {day.label || `Gün ${idx + 1}`}
                                </Text>
                                {isCurrent && (
                                    <View style={s.currentBadge}>
                                        <Text style={s.currentBadgeText}>Sıradaki</Text>
                                    </View>
                                )}
                                {isRest && (
                                    <View style={s.restBadge}>
                                        <Ionicons name="bed-outline" size={14} color={colors.textMuted} />
                                        <Text style={s.restBadgeText}>Dinlenme</Text>
                                    </View>
                                )}
                            </View>

                            {!isRest && day.exercises.length > 0 && (
                                <View style={s.exerciseList}>
                                    {day.exercises.map((ex, exIdx) => (
                                        <View key={exIdx} style={s.exerciseRow}>
                                            <Text style={s.exerciseDot}>•</Text>
                                            <Text style={s.exerciseName}>{ex.name}</Text>
                                            <Text style={s.exerciseSets}>
                                                {ex.targetSets.length} set
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!isRest && day.exercises.length === 0 && (
                                <Text style={s.noExercises}>Egzersiz tanımlı değil</Text>
                            )}
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {days.length === 0 && (
                    <View style={s.emptyState}>
                        <Ionicons name="document-outline" size={48} color={colors.border} />
                        <Text style={s.emptyText}>Bu programda henüz gün tanımlı değil.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
    },
    headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    headerIconBtn: { padding: spacing.xs },
    startBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    startBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.background },

    // Content
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

    // Info card
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    description: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    metaText: { fontSize: fontSize.xs, color: colors.textMuted },

    // Current day banner
    currentDayBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(204,255,0,0.08)",
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: "rgba(204,255,0,0.2)",
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    currentDayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    currentDayLabel: { fontSize: fontSize.sm, color: colors.text },

    // Section
    sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },

    // Day cards
    dayCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    dayCardActive: { borderColor: colors.accent, backgroundColor: "rgba(204,255,0,0.04)" },
    dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dayIndexCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
    },
    dayIndexCircleActive: { backgroundColor: colors.accent },
    dayIndexText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted },
    dayIndexTextActive: { color: colors.background },
    dayLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
    restLabel: { color: colors.textMuted },
    currentBadge: { backgroundColor: colors.accent, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    currentBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.background },
    restBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        gap: 4,
    },
    restBadgeText: { fontSize: fontSize.xs, color: colors.textMuted },

    // Exercises
    exerciseList: { marginTop: spacing.sm, paddingLeft: 36 },
    exerciseRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3, gap: spacing.xs },
    exerciseDot: { fontSize: 10, color: colors.textMuted },
    exerciseName: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
    exerciseSets: { fontSize: fontSize.xs, color: colors.textMuted },
    noExercises: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs, paddingLeft: 36 },

    // Empty state
    emptyState: { alignItems: "center", paddingTop: spacing.xxxl, gap: spacing.md },
    emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" },
});

