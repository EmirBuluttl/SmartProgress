// ─────────────────────────────────────────────
// MyProgressScreen — Data Analytics & Charts
// Zaman filtreli hacim grafiği, PR detay modal
// ─────────────────────────────────────────────
import React from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Modal,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import { workoutApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";
import { calculateWorkoutLoadScore, getPersonalRecords } from "../utils/workoutMetrics";

const SCREEN_WIDTH = Dimensions.get("window").width;

type TimeFilter = "1H" | "1A" | "1Y" | "Tümü";
const FILTERS: TimeFilter[] = ["1H", "1A", "1Y", "Tümü"];
const FILTER_DAYS: Record<TimeFilter, number> = { "1H": 7, "1A": 30, "1Y": 365, "Tümü": 9999 };

export default function MyProgressScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const isAutoSuggestEnabled = user?.settings?.is_auto_suggest_enabled !== false;

    const [filter, setFilter] = React.useState<TimeFilter>("1A");
    const [allWorkouts, setAllWorkouts] = React.useState<any[]>([]);
    const [volumeData, setVolumeData] = React.useState<{
        labels: string[];
        datasets: { data: number[] }[];
    }>({ labels: ["0"], datasets: [{ data: [0] }] });
    const [prs, setPrs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedPR, setSelectedPR] = React.useState<any | null>(null);
    const [showAllPrs, setShowAllPrs] = React.useState(false);

    const styles = React.useMemo(() => createStyles(colors), [colors]);

    // ─── Volume calculation ───────────────────

    const buildVolumeData = (workouts: any[], activeFilter: TimeFilter) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - FILTER_DAYS[activeFilter]);
        cutoff.setHours(0, 0, 0, 0);
        const filtered = workouts.filter((w: any) => new Date(w.logDate) >= cutoff);

        const volumePoints: number[] = [];
        const labels: string[] = [];

        [...filtered].reverse().forEach((wk: any, idx: number) => {
            const vol = calculateWorkoutLoadScore(wk);
            if (vol > 0) {
                volumePoints.push(vol);
                labels.push(`A${idx + 1}`);
            }
        });

        if (volumePoints.length === 0) {
            setVolumeData({ labels: ["-"], datasets: [{ data: [0] }] });
        } else {
            setVolumeData({ labels, datasets: [{ data: volumePoints }] });
        }
    };

    // ─── Load analytics ───────────────────────

    const loadAnalytics = async () => {
        try {
            const res = await workoutApi.list({ limit: 200 });
            const workouts = res.data.workouts || [];
            setAllWorkouts(workouts);
            buildVolumeData(workouts, filter);

            setPrs(getPersonalRecords(workouts));
        } catch (err) {
            console.error("Analytics Load Error", err);
        } finally {
            setLoading(false);
        }
    };

    // Re-filter when filter changes
    React.useEffect(() => {
        if (allWorkouts.length > 0) buildVolumeData(allWorkouts, filter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    useFocusEffect(
        React.useCallback(() => {
            loadAnalytics();
        }, [])
    );

    // ─── Render ───────────────────────────────

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Page Title */}
                <Text style={styles.pageTitle}>Gelişimim</Text>
                <Text style={styles.pageSubtitle}>Performans analitiğin ve akıllı öneriler</Text>

                {/* ─── Time Filter Row ─── */}
                <View style={styles.filterRow}>
                    {FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                {f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ─── Volume Chart ─── */}
                <SectionHeader title="📊 Yük Skoru" />
                <GymCard elevated style={styles.chartCard}>
                    <LineChart
                        data={volumeData}
                        width={SCREEN_WIDTH - spacing.lg * 4}
                        height={200}
                        yAxisSuffix=""
                        chartConfig={{
                            backgroundColor: colors.surface,
                            backgroundGradientFrom: colors.surfaceLight,
                            backgroundGradientTo: colors.surface,
                            decimalPlaces: 1,
                            // Convert the hex accent color to rgb for chart-kit:
                            color: (opacity = 1) => {
                                const hexMatch = colors.accent.match(/\w\w/g);
                                if (!hexMatch) return `rgba(204, 255, 0, ${opacity})`;
                                const [r, g, b] = hexMatch.map((h: string) => parseInt(h, 16));
                                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                            },
                            labelColor: () => colors.textSecondary,
                            propsForDots: { r: "5", strokeWidth: "2", stroke: colors.accent },
                            propsForBackgroundLines: {
                                strokeDasharray: "",
                                stroke: colors.border,
                                strokeWidth: 0.5,
                            },
                        }}
                        bezier
                        style={styles.chart}
                    />
                    <View style={styles.chartLegend}>
                        <View style={styles.legendDot} />
                        <Text style={styles.legendText}>Çalışma setleri ve RPE yoğunluğu</Text>
                    </View>
                </GymCard>

                {/* ─── AI Suggestion ─── */}
                {isAutoSuggestEnabled && (
                    <>
                        <SectionHeader title="🧠 Akıllı Tahmin" />
                        <GymCard elevated style={styles.suggestionCard}>
                            <View style={styles.suggestionHeader}>
                                <Ionicons name="sparkles" size={22} color={colors.accent} />
                                <Text style={styles.suggestionTitle}>Auto-Regulation Önerisi</Text>
                            </View>
                            <View style={styles.predictionRow}>
                                <View style={styles.predictionBadge}>
                                    <Text style={styles.predictionBadgeText}>Tahmini</Text>
                                </View>
                                <Text style={styles.predictionValue}>+2.5 kg</Text>
                                <Text style={styles.predictionLabel}>ilerleyin</Text>
                            </View>
                            <View style={styles.reasoningBox}>
                                <Text style={styles.reasoningText}>
                                    AI Auto-Regulation için daha fazla antrenman verisi gerekiyor. Sistemi beslemeye devam et!
                                </Text>
                            </View>
                        </GymCard>
                    </>
                )}

                {/* ─── Personal Records ─── */}
                <SectionHeader
                    title="🏆 Kişisel Rekorlar (PR)"
                    actionLabel={showAllPrs ? "Gizle" : "Tümünü Gör"}
                    onAction={() => setShowAllPrs(!showAllPrs)}
                />
                {prs.length > 0 ? (
                    (showAllPrs ? prs : prs.slice(0, 5)).map((pr, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => setSelectedPR(pr)}
                            activeOpacity={0.8}
                        >
                            <GymCard style={styles.prCard}>
                                <View style={styles.prRow}>
                                    <View style={styles.prRank}>
                                        <Text style={styles.prRankText}>#{index + 1}</Text>
                                    </View>
                                    <View style={styles.prInfo}>
                                        <Text style={styles.prExercise}>{pr.exercise}</Text>
                                        <Text style={styles.prDate}>
                                            {new Date(pr.date).toLocaleDateString("tr-TR", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </Text>
                                    </View>
                                    <View style={styles.prWeight}>
                                        <Text style={styles.prWeightValue}>{pr.weight}</Text>
                                        <Text style={styles.prWeightUnit}>{pr.unit} x {pr.reps}</Text>
                                    </View>
                                </View>
                            </GymCard>
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.emptyText}>Henüz rekor bulunamadı.</Text>
                )}

                <View style={{ height: spacing.xxxl }} />
            </ScrollView>

            {/* ─── PR Detail Modal ─── */}
            <Modal
                visible={selectedPR !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedPR(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🏆 Kişisel Rekor</Text>
                            <TouchableOpacity onPress={() => setSelectedPR(null)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {selectedPR && (
                            <>
                                <Text style={styles.modalExercise}>{selectedPR.exercise}</Text>
                                <Text style={styles.modalWeight}>
                                    {selectedPR.weight} {selectedPR.unit} x {selectedPR.reps}
                                </Text>
                                <View style={styles.modalMeta}>
                                    <Text style={styles.modalMetaText}>
                                        📅 {new Date(selectedPR.date).toLocaleDateString("tr-TR", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </Text>
                                    {selectedPR.workoutTitle && (
                                        <Text style={styles.modalMetaText}>
                                            🏋️ {selectedPR.workoutTitle}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity style={styles.videoBtn}>
                                    <Ionicons name="videocam-outline" size={18} color={colors.background} />
                                    <Text style={styles.videoBtnText}>Video Yükle (Yakında)</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

// ─── Styles ──────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    pageTitle: {
        fontSize: fontSize.xxxl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: 4,
    },
    pageSubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
    },
    filterRow: {
        flexDirection: "row",
        marginBottom: spacing.xl,
        gap: spacing.sm,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterBtnActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    filterText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        color: colors.textSecondary,
    },
    filterTextActive: {
        color: colors.background,
        fontWeight: fontWeight.bold,
    },
    chartCard: {
        marginBottom: spacing.xxl,
        overflow: "hidden",
    },
    chart: {
        marginLeft: -spacing.md,
    },
    chartLegend: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing.sm,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.accent,
        marginRight: spacing.sm,
    },
    legendText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    suggestionCard: {
        marginBottom: spacing.xxl,
    },
    suggestionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    suggestionTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        color: colors.text,
    },
    predictionRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    predictionBadge: {
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    predictionBadgeText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    predictionValue: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    predictionLabel: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    reasoningBox: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
    },
    reasoningText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    prCard: {
        marginBottom: spacing.sm,
    },
    prRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    prRank: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    prRankText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    prInfo: {
        flex: 1,
    },
    prExercise: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        color: colors.text,
    },
    prDate: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    prWeight: {
        alignItems: "flex-end",
    },
    prWeightValue: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    prWeightUnit: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    emptyText: {
        color: colors.textSecondary,
        fontStyle: "italic",
        marginTop: spacing.sm,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "flex-end",
    },
    modalCard: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    modalExercise: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    modalWeight: {
        fontSize: 42,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
        marginBottom: spacing.md,
    },
    modalMeta: {
        gap: spacing.xs,
        marginBottom: spacing.xl,
    },
    modalMetaText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    videoBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.textSecondary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    videoBtnText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
});
