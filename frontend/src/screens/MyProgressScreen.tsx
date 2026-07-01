// ─────────────────────────────────────────────
// MyProgressScreen — Güç Analizi & Haftalık Trend
// ESS (Estimated Strength Score) bazlı haftalık grafik
// ─────────────────────────────────────────────
import React from "react";
import {
    View,
    Text,
    ScrollView,
    Animated,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    TextInput,
    Linking,
    InteractionManager,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius, lineHeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCachedWorkouts, subscribeToWorkoutCache, getWorkoutCacheSnapshot } from "../services/workoutCacheService";
import { getPersistedWorkoutAnalyticsSnapshot, getWorkoutAnalyticsSnapshot, type WorkoutAnalyticsSnapshot } from "../services/workoutAnalyticsCacheService";
import { getCachedBodyMeasurements, subscribeToBodyMeasurementCache, getBodyMeasurementSnapshot } from "../services/bodyMeasurementCacheService";
import { getCachedNutritionLogs, subscribeToNutritionCache, getNutritionSnapshot } from "../services/nutritionCacheService";
import { useAuth } from "../store/AuthContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";
import {
    buildWeeklyExerciseTrend,
    buildWeeklyMuscleTrend,
    getPersonalRecords,
    type WeeklyPoint,
    type ExerciseSnapshot,
} from "../utils/workoutMetrics";
import { groupForExerciseName } from "../data/exerciseTaxonomy";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { useStaleDataGuard } from "../hooks/useStaleDataGuard";
import AnimatedPressable from "../components/AnimatedPressable";
import PremiumModalSurface from "../components/PremiumModalSurface";
import { navigateWithFeedback } from "../utils/navigationFeedback";
import WeeklyStrengthChart from "../components/WeeklyStrengthChart";

const SCREEN_WIDTH = Dimensions.get("window").width;
const RECORD_LINKS_KEY = "personal_record_video_links";

type TimeFilter = "1H" | "1A" | "1Y" | "Tümü";
const FILTERS: TimeFilter[] = ["1H", "1A", "1Y", "Tümü"];
const FILTER_DAYS: Record<TimeFilter, number> = { "1H": 7, "1A": 30, "1Y": 365, "Tümü": 9999 };
type ChartMetric =
    | `exercise:${string}`
    | `muscle:${string}`
    | "body:weight"
    | "nutrition:calories"
    | "nutrition:protein"
    | "nutrition:carbs"
    | "nutrition:fat";

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateLabel(value: unknown): string {
    const date = new Date(String(value || ""));
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

function recordKey(record: any): string {
    return String(record?.exercise || "").trim().toLocaleLowerCase("tr-TR");
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta, colors }: { delta: number; colors: any }) {
    const isUp = delta > 0;
    const isDown = delta < 0;
    const color = isUp ? (colors.success || "#22C55E") : isDown ? colors.error : colors.textMuted;
    const bgColor = isUp
        ? (colors.success || "#22C55E") + "18"
        : isDown
            ? colors.error + "18"
            : colors.textMuted + "18";
    const icon = isUp ? "trending-up" : isDown ? "trending-down" : "remove";

    return (
        <View style={[deltaBadgeStyles.badge, { backgroundColor: bgColor }]}>
            <Ionicons name={icon as any} size={13} color={color} />
            <Text style={[deltaBadgeStyles.text, { color }]}>
                {isUp ? "+" : ""}{delta.toFixed(1)}%
            </Text>
        </View>
    );
}

const deltaBadgeStyles = StyleSheet.create({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
    },
    text: {
        fontSize: 12,
        fontWeight: "700",
    },
});

// ─── Snapshot Row ─────────────────────────────────────────────────────────────

function SnapshotRow({ item, colors }: { item: ExerciseSnapshot; colors: any }) {
    const isUp = item.deltaPercent > 0;
    const isDown = item.deltaPercent < 0;
    const dotColor = isUp
        ? (colors.success || "#22C55E")
        : isDown
            ? colors.error
            : colors.textMuted;

    return (
        <View style={snapshotStyles.row}>
            <View style={[snapshotStyles.dot, { backgroundColor: dotColor }]} />
            <Text style={[snapshotStyles.name, { color: colors.text }]} numberOfLines={1}>
                {item.exercise}
            </Text>
            <DeltaBadge delta={item.deltaPercent} colors={colors} />
        </View>
    );
}

const snapshotStyles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    name: {
        flex: 1,
        fontSize: 14,
        fontWeight: "500",
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyProgressScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const isAutoSuggestEnabled = user?.settings?.is_auto_suggest_enabled === true;
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { animStyle } = useScreenEnter();
    const { animStyle: filtersAnimStyle } = useScreenEnter({ delay: 80 });
    const { animStyle: chartAnimStyle } = useScreenEnter({ delay: 150 });
    const { animStyle: prsAnimStyle } = useScreenEnter({ delay: 220 });

    const [filter, setFilter] = React.useState<TimeFilter>("1A");
    const [chartMetric, setChartMetric] = React.useState<ChartMetric>("body:weight");
    const [splitFilter, setSplitFilter] = React.useState("Tümü");
    const [allWorkouts, setAllWorkouts] = React.useState<any[]>([]);
    const [bodyMeasurements, setBodyMeasurements] = React.useState<any[]>([]);
    const [nutritionLogs, setNutritionLogs] = React.useState<any[]>([]);
    const [weeklyPoints, setWeeklyPoints] = React.useState<WeeklyPoint[]>([]);
    const [weeklySnapshot, setWeeklySnapshot] = React.useState<ExerciseSnapshot[]>([]);
    const [analyticsSnapshot, setAnalyticsSnapshot] = React.useState<WorkoutAnalyticsSnapshot | null>(null);
    const [animationProgress, setAnimationProgress] = React.useState(0);
    const chartAnimationTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const chartRequestIdRef = React.useRef(0);
    const hasSetDefaultMetric = React.useRef(false);

    // 3 dakika TTL: stack ekrandan dönüşte sadece bayatlamış veri yeniden yüklenir
    const { shouldReload: shouldReloadAnalytics, markLoaded: markAnalyticsLoaded } = useStaleDataGuard(3 * 60 * 1000);

    const [prs, setPrs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedPR, setSelectedPR] = React.useState<any | null>(null);
    const [recordLinks, setRecordLinks] = React.useState<Record<string, string>>({});
    const [isEditingPrLink, setIsEditingPrLink] = React.useState(false);
    const [linkDraft, setLinkDraft] = React.useState("");
    const [linkError, setLinkError] = React.useState("");
    const [filterModalVisible, setFilterModalVisible] = React.useState(false);

    const styles = React.useMemo(() => createStyles(colors), [colors]);

    // ── Chart animation ───────────────────────────────────────────────────────

    const startChartAnimation = () => {
        if (chartAnimationTimerRef.current) clearInterval(chartAnimationTimerRef.current);
        setAnimationProgress(0);
        // 20 adım × 50ms = 1000ms — 3x daha az setState, mobil bridge baskısını azaltır
        const duration = 1000;
        const steps = 20;
        const interval = duration / steps;
        let step = 0;
        chartAnimationTimerRef.current = setInterval(() => {
            step++;
            const p = step / steps;
            const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
            if (step >= steps) {
                setAnimationProgress(1);
                if (chartAnimationTimerRef.current) clearInterval(chartAnimationTimerRef.current);
            } else {
                setAnimationProgress(eased);
            }
        }, interval);
    };


    React.useEffect(() => {
        return () => {
            if (chartAnimationTimerRef.current) clearInterval(chartAnimationTimerRef.current);
        };
    }, []);

    // ── Default metric (most-trained exercise) ────────────────────────────────

    const defaultMetric = React.useMemo((): ChartMetric => {
        const topExercise = analyticsSnapshot?.exerciseCounts?.[0]?.original;
        return topExercise ? (`exercise:${topExercise}` as ChartMetric) : "body:weight";
    }, [analyticsSnapshot]);

    React.useEffect(() => {
        if (analyticsSnapshot && !hasSetDefaultMetric.current) {
            hasSetDefaultMetric.current = true;
            setChartMetric(defaultMetric);
        }
    }, [analyticsSnapshot, defaultMetric]);

    // ── Metric options ────────────────────────────────────────────────────────

    const metricOptions = React.useMemo(() => {
        const records = analyticsSnapshot?.personalRecords || [];
        const exercises = records.map((pr) => pr.exercise).slice(0, 12);
        const muscleGroups = (analyticsSnapshot?.muscleGroups || []).slice(0, 8);
        return [
            ...exercises.map((e) => ({ key: `exercise:${e}` as ChartMetric, label: e })),
            ...muscleGroups.map((g) => ({ key: `muscle:${g}` as ChartMetric, label: `${g} (kas grubu)` })),
            { key: "body:weight" as ChartMetric, label: "Vücut Ağırlığı" },
            { key: "nutrition:calories" as ChartMetric, label: "Kalori" },
            { key: "nutrition:protein" as ChartMetric, label: "Protein" },
            { key: "nutrition:carbs" as ChartMetric, label: "Karbonhidrat" },
            { key: "nutrition:fat" as ChartMetric, label: "Yağ" },
        ];
    }, [analyticsSnapshot]);

    const splitOptions = React.useMemo(() => {
        const labels = Array.from(new Set(allWorkouts.map((w) => String(w.title || "Genel"))));
        return ["Tümü", ...labels];
    }, [allWorkouts]);

    // ── Build chart data ──────────────────────────────────────────────────────

    const buildChartData = (
        workouts: any[],
        measurements: any[],
        nutrition: any[],
        activeFilter: TimeFilter,
        metric: ChartMetric,
    ) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - FILTER_DAYS[activeFilter]);
        cutoff.setHours(0, 0, 0, 0);

        const scopedWorkouts = (
            splitFilter === "Tümü"
                ? workouts
                : workouts.filter((w) => String(w.title || "Genel") === splitFilter)
        ).filter((w) => new Date(w.logDate || 0) >= cutoff);

        if (metric.startsWith("exercise:")) {
            const exerciseName = metric.replace("exercise:", "");
            setWeeklyPoints(buildWeeklyExerciseTrend(scopedWorkouts, exerciseName));
        } else if (metric.startsWith("muscle:")) {
            const muscleGroup = metric.replace("muscle:", "");
            const exerciseNames = getPersonalRecords(scopedWorkouts)
                .filter((r) => (groupForExerciseName(r.exercise)?.beginnerLabel || "Genel") === muscleGroup)
                .map((r) => r.exercise);
            setWeeklyPoints(buildWeeklyMuscleTrend(scopedWorkouts, exerciseNames));
        } else if (metric === "body:weight") {
            const sorted = [...measurements]
                .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                .filter((r) => new Date(r.date || 0) >= cutoff && toNumber(r.weight) > 0);
            const pts: WeeklyPoint[] = sorted.map((r, i) => {
                const prevW = i > 0 ? toNumber(sorted[i - 1].weight) : null;
                const w = toNumber(r.weight);
                return {
                    weekKey: String(r.date || i),
                    weekLabel: formatDateLabel(r.date),
                    ess: w,
                    deltaPercent:
                        prevW != null && prevW > 0
                            ? Math.round(((w - prevW) / prevW) * 1000) / 10
                            : 0,
                    comparable: prevW !== null,
                };
            });
            setWeeklyPoints(pts);
        } else {
            const field = metric.replace("nutrition:", "");
            const sorted = [...nutrition]
                .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                .filter((r) => new Date(r.date || 0) >= cutoff && toNumber(r[field]) > 0);
            const pts: WeeklyPoint[] = sorted.map((r, i) => {
                const prevV = i > 0 ? toNumber(sorted[i - 1][field]) : null;
                const v = toNumber(r[field]);
                return {
                    weekKey: String(r.date || i),
                    weekLabel: formatDateLabel(r.date),
                    ess: v,
                    deltaPercent:
                        prevV != null && prevV > 0
                            ? Math.round(((v - prevV) / prevV) * 1000) / 10
                            : 0,
                    comparable: prevV !== null,
                };
            });
            setWeeklyPoints(pts);
        }

        startChartAnimation();
    };

    const scheduleChartData = (
        workouts: any[],
        measurements: any[],
        nutrition: any[],
        activeFilter: TimeFilter,
        metric: ChartMetric,
    ) => {
        const requestId = ++chartRequestIdRef.current;
        InteractionManager.runAfterInteractions(() => {
            if (requestId !== chartRequestIdRef.current) return;
            buildChartData(workouts, measurements, nutrition, activeFilter, metric);
        });
    };

    // ── Derived chart info ────────────────────────────────────────────────────

    const chartTitle = React.useMemo(() => {
        const opt = metricOptions.find((o) => o.key === chartMetric);
        return opt?.label || "Progress";
    }, [chartMetric, metricOptions]);

    const latestPoint = weeklyPoints[weeklyPoints.length - 1] ?? null;

    const isESSMetric =
        chartMetric.startsWith("exercise:") || chartMetric.startsWith("muscle:");

    const formatLatestValue = (ess: number): string => {
        if (isESSMetric) return ess.toFixed(1);
        if (chartMetric === "body:weight") return `${ess.toFixed(1)} kg`;
        if (chartMetric === "nutrition:calories") return `${Math.round(ess)} kcal`;
        return `${ess.toFixed(1)} g`;
    };

    const yLabel = chartMetric === "body:weight"
        ? "kg"
        : chartMetric === "nutrition:calories"
            ? "kcal"
            : chartMetric.startsWith("nutrition:")
                ? "g"
                : "ESS";

    const chartLegendText = isESSMetric
        ? "Haftalık en iyi set — ESS (Estimated Strength Score)"
        : chartMetric === "body:weight"
            ? "Profilde kaydettiğin vücut ağırlık ölçümleri"
            : "Günlük beslenme kaydın";

    // ── Load analytics ────────────────────────────────────────────────────────

    const loadAnalytics = async () => {
        getPersistedWorkoutAnalyticsSnapshot()
            .then((analytics) => {
                if (!analytics) return;
                setAnalyticsSnapshot(analytics);
                setWeeklySnapshot(analytics.weeklySnapshot || []);
                setPrs(analytics.personalRecords || []);
                setLoading(false);
            })
            .catch(() => undefined);

        // Load from caches instantly if available!
        const cachedWorkouts = getWorkoutCacheSnapshot(200);
        const cachedMeasurements = getBodyMeasurementSnapshot();
        const cachedNutrition = getNutritionSnapshot();
        if (cachedWorkouts.length > 0 || cachedMeasurements.length > 0 || cachedNutrition.length > 0) {
            setAllWorkouts(cachedWorkouts);
            setBodyMeasurements(cachedMeasurements);
            setNutritionLogs(cachedNutrition);
            InteractionManager.runAfterInteractions(() => {
                const analytics = getWorkoutAnalyticsSnapshot(cachedWorkouts);
                setAnalyticsSnapshot(analytics);
                setWeeklySnapshot(analytics.weeklySnapshot);
                setPrs(analytics.personalRecords);
            });
            scheduleChartData(cachedWorkouts, cachedMeasurements, cachedNutrition, filter, chartMetric);
            setLoading(false);
        }

        try {
            const [workoutRes, measurements, nutrition] = await Promise.all([
                getCachedWorkouts(200),
                getCachedBodyMeasurements(180),
                getCachedNutritionLogs(180),
            ]);
            const workouts = workoutRes || [];

            setAllWorkouts(workouts);
            setBodyMeasurements(measurements);
            setNutritionLogs(nutrition);
            const rawLinks = await AsyncStorage.getItem(RECORD_LINKS_KEY);
            setRecordLinks(rawLinks ? JSON.parse(rawLinks) : {});

            InteractionManager.runAfterInteractions(() => {
                const analytics = getWorkoutAnalyticsSnapshot(workouts);
                setAnalyticsSnapshot(analytics);
                setWeeklySnapshot(analytics.weeklySnapshot);
                setPrs(analytics.personalRecords);
            });
            scheduleChartData(workouts, measurements, nutrition, filter, chartMetric);
        } catch (err) {
            console.error("Analytics Load Error", err);
        } finally {
            setLoading(false);
        }
    };

    // ── Re-build on filter change ─────────────────────────────────────────────

    React.useEffect(() => {
        if (allWorkouts.length > 0 || bodyMeasurements.length > 0 || nutritionLogs.length > 0) {
            scheduleChartData(allWorkouts, bodyMeasurements, nutritionLogs, filter, chartMetric);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, chartMetric, splitFilter]);

    useFocusEffect(
        React.useCallback(() => {
            if (shouldReloadAnalytics()) {
                markAnalyticsLoaded();
                loadAnalytics();
            }
        }, []),
    );

    React.useEffect(() => {
        const unsubWorkouts = subscribeToWorkoutCache(() => {
            loadAnalytics().catch(() => undefined);
        });
        const unsubMeasurements = subscribeToBodyMeasurementCache(() => {
            loadAnalytics().catch(() => undefined);
        });
        const unsubNutrition = subscribeToNutritionCache(() => {
            loadAnalytics().catch(() => undefined);
        });
        return () => {
            unsubWorkouts();
            unsubMeasurements();
            unsubNutrition();
        };
    }, []);

    // ── PR Modal helpers ──────────────────────────────────────────────────────

    const selectedPrLink = selectedPR ? recordLinks[recordKey(selectedPR)] : "";

    const isAllowedVideoUrl = (value: string) => {
        if (!value.trim()) return true;
        try {
            const host = new URL(value.trim()).hostname.replace(/^www\./, "");
            return ["youtube.com", "youtu.be", "instagram.com"].includes(host);
        } catch {
            return false;
        }
    };

    const openPrLinkEditor = () => {
        setLinkDraft(selectedPrLink || "");
        setLinkError("");
        setIsEditingPrLink(true);
    };

    const savePrLink = async () => {
        if (!selectedPR) return;
        if (!isAllowedVideoUrl(linkDraft)) {
            setLinkError("Sadece YouTube veya Instagram bağlantısı ekleyebilirsin.");
            return;
        }
        const next = { ...recordLinks };
        const key = recordKey(selectedPR);
        if (linkDraft.trim()) next[key] = linkDraft.trim();
        else delete next[key];
        setRecordLinks(next);
        await AsyncStorage.setItem(RECORD_LINKS_KEY, JSON.stringify(next));
        setIsEditingPrLink(false);
        setLinkDraft("");
        setLinkError("");
    };

    const closePrModal = () => {
        setSelectedPR(null);
        setIsEditingPrLink(false);
        setLinkDraft("");
        setLinkError("");
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    const chartWidth = SCREEN_WIDTH - spacing.lg * 2 - spacing.lg * 2;

    return (
        <>
            <Animated.ScrollView
                style={[styles.container, animStyle]}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Page Title */}
                <Text style={styles.pageTitle}>MyProgress</Text>
                <Text style={styles.pageSubtitle}>Güç trendlerin ve kişisel rekorların</Text>

                {/* ── Bu hafta snapshot ── */}
                {weeklySnapshot.length > 0 && (
                    <Animated.View style={[styles.snapshotCard, filtersAnimStyle]}>
                        <View style={styles.snapshotHeader}>
                            <View style={styles.snapshotTitleRow}>
                                <View style={[styles.snapshotDot, { backgroundColor: colors.accent }]} />
                                <Text style={styles.snapshotTitle}>Bu Hafta</Text>
                            </View>
                            <Text style={styles.snapshotSubtitle}>Geçen haftaya göre</Text>
                        </View>
                        {weeklySnapshot.slice(0, 4).map((item, i) => (
                            <SnapshotRow key={i} item={item} colors={colors} />
                        ))}
                    </Animated.View>
                )}

                {/* ── Filtre özeti ── */}
                <Animated.View style={[styles.filterSummaryCard, filtersAnimStyle]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.filterSummaryLabel}>Görünüm</Text>
                        <Text style={styles.filterSummaryValue} numberOfLines={1}>
                            {chartTitle} · {splitFilter} · {filter}
                        </Text>
                    </View>
                    <AnimatedPressable
                        style={styles.filterOpenBtn}
                        onPress={() => setFilterModalVisible(true)}
                        pressedScale={0.96}
                    >
                        <Ionicons name="options-outline" size={16} color={colors.accent} />
                        <Text style={styles.filterOpenText}>Filtre</Text>
                    </AnimatedPressable>
                </Animated.View>

                {/* ── Progress Chart ── */}
                <Animated.View style={chartAnimStyle}>
                    <SectionHeader title={chartTitle} />
                    <GymCard elevated style={styles.chartCard}>
                        {/* Score summary row */}
                        <View style={styles.scoreSummaryRow}>
                            <View style={styles.scoreSummaryLeft}>
                                <Text style={styles.scoreSummaryLabel}>
                                    {isESSMetric ? "Güç Skoru" : "Son Kayıt"}
                                </Text>
                                {latestPoint ? (
                                    <Text style={styles.scoreSummaryValue}>
                                        {formatLatestValue(latestPoint.ess)}
                                    </Text>
                                ) : (
                                    <Text style={styles.scoreSummaryEmpty}>—</Text>
                                )}
                            </View>
                            <View style={styles.scoreSummaryRight}>
                                {latestPoint?.comparable && (
                                    <>
                                        <DeltaBadge delta={latestPoint.deltaPercent} colors={colors} />
                                        <Text style={styles.deltaHint}>geçen haftaya göre</Text>
                                    </>
                                )}
                                {latestPoint && !latestPoint.comparable && (
                                    <Text style={styles.baselineLabel}>Baz hafta</Text>
                                )}
                            </View>
                        </View>

                        {/* Chart */}
                        <WeeklyStrengthChart
                            data={weeklyPoints}
                            animationProgress={animationProgress}
                            width={chartWidth}
                            height={220}
                            colors={colors}
                            yLabel={yLabel}
                        />

                        {/* Legend */}
                        <View style={styles.chartLegend}>
                            <View style={styles.legendRow}>
                                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                                <Text style={styles.legendText}>{chartLegendText}</Text>
                            </View>
                            {isESSMetric && (
                                <View style={styles.legendRow}>
                                    <View style={[styles.legendDot, { backgroundColor: colors.error || "#EF4444" }]} />
                                    <Text style={styles.legendText}>Kırmızı nokta → o hafta düşüş var</Text>
                                </View>
                            )}
                        </View>
                    </GymCard>
                </Animated.View>

                {/* ── AI Suggestion ── */}
                {isAutoSuggestEnabled && (
                    <>
                        <SectionHeader title="Akıllı Tahmin" />
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

                {/* ── Personal Records ── */}
                <Animated.View style={prsAnimStyle}>
                    <SectionHeader
                        title="En İyi Setlerim"
                        actionLabel="Tümünü Gör"
                        onAction={() => navigateWithFeedback(() => (navigation as any).navigate("Records"))}
                    />
                    {prs.length > 0 ? (
                        prs.slice(0, 5).map((pr, index) => (
                            <AnimatedPressable
                                key={index}
                                onPress={() => setSelectedPR(pr)}
                                pressedScale={0.99}
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
                            </AnimatedPressable>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>Henüz rekor bulunamadı.</Text>
                    )}
                </Animated.View>

                <View style={{ height: spacing.xxxl }} />
            </Animated.ScrollView>

            {/* ── PR Detail Modal ── */}
            <PremiumModalSurface visible={selectedPR !== null} onDismiss={closePrModal} containerStyle={styles.modalCard}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>En İyi Set</Text>
                    <AnimatedPressable onPress={closePrModal} pressedScale={0.9}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </AnimatedPressable>
                </View>
                {selectedPR && (
                    <>
                        <Text style={styles.modalExercise}>{selectedPR.exercise}</Text>
                        <Text style={styles.modalWeight}>
                            {selectedPR.weight} {selectedPR.unit} x {selectedPR.reps}
                        </Text>
                        <View style={styles.modalMeta}>
                            <Text style={styles.modalMetaText}>
                                {new Date(selectedPR.date).toLocaleDateString("tr-TR", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </Text>
                            {selectedPR.workoutTitle && (
                                <Text style={styles.modalMetaText}>{selectedPR.workoutTitle}</Text>
                            )}
                        </View>
                        {isEditingPrLink ? (
                            <View style={styles.linkEditor}>
                                <Text style={styles.linkEditorTitle}>PR video bağlantısı</Text>
                                <TextInput
                                    value={linkDraft}
                                    onChangeText={setLinkDraft}
                                    placeholder="https://youtube.com/... veya https://instagram.com/..."
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                    style={styles.linkInput}
                                />
                                {!!linkError && <Text style={styles.errorText}>{linkError}</Text>}
                                <View style={styles.linkActions}>
                                    <AnimatedPressable style={styles.secondaryAction} onPress={() => setIsEditingPrLink(false)} pressedScale={0.98}>
                                        <Text style={styles.secondaryActionText}>İptal</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable style={styles.primaryAction} onPress={savePrLink} pressedScale={0.98}>
                                        <Text style={styles.primaryActionText}>Kaydet</Text>
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ) : (
                            <AnimatedPressable
                                style={[styles.videoBtn, selectedPrLink && styles.videoBtnActive]}
                                onPress={() => selectedPrLink ? Linking.openURL(selectedPrLink) : openPrLinkEditor()}
                                onLongPress={openPrLinkEditor}
                                pressedScale={0.985}
                            >
                                <Ionicons name={selectedPrLink ? "play-circle" : "link-outline"} size={18} color={colors.background} />
                                <Text style={styles.videoBtnText}>{selectedPrLink ? "PR Videosunu Aç" : "Video Bağlantısı Ekle"}</Text>
                            </AnimatedPressable>
                        )}
                    </>
                )}
            </PremiumModalSurface>

            {/* ── Filter Modal ── */}
            <PremiumModalSurface visible={filterModalVisible} onDismiss={() => setFilterModalVisible(false)} containerStyle={styles.filterModalCard}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Grafik Filtresi</Text>
                    <AnimatedPressable onPress={() => setFilterModalVisible(false)} pressedScale={0.9}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </AnimatedPressable>
                </View>

                <Text style={styles.filterModalLabel}>Metrik</Text>
                <ScrollView style={styles.filterModalList} contentContainerStyle={styles.metricFilterRow}>
                    {metricOptions.map((option) => (
                        <AnimatedPressable
                            key={option.key}
                            style={[styles.metricFilterBtn, chartMetric === option.key && styles.metricFilterBtnActive]}
                            onPress={() => setChartMetric(option.key)}
                            pressedScale={0.96}
                        >
                            <Text style={[styles.metricFilterText, chartMetric === option.key && styles.metricFilterTextActive]}>
                                {option.label}
                            </Text>
                        </AnimatedPressable>
                    ))}
                </ScrollView>

                <Text style={styles.filterModalLabel}>Antrenman</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricFilterRow}>
                    {splitOptions.map((option) => (
                        <AnimatedPressable
                            key={option}
                            style={[styles.splitFilterBtn, splitFilter === option && styles.metricFilterBtnActive]}
                            onPress={() => setSplitFilter(option)}
                            pressedScale={0.96}
                        >
                            <Text style={[styles.metricFilterText, splitFilter === option && styles.metricFilterTextActive]}>
                                {option}
                            </Text>
                        </AnimatedPressable>
                    ))}
                </ScrollView>

                <Text style={styles.filterModalLabel}>Zaman</Text>
                <View style={styles.filterRow}>
                    {FILTERS.map((f) => (
                        <AnimatedPressable
                            key={f}
                            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                            onPress={() => setFilter(f)}
                            pressedScale={0.96}
                        >
                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                        </AnimatedPressable>
                    ))}
                </View>

                <AnimatedPressable style={styles.primaryAction} onPress={() => setFilterModalVisible(false)} pressedScale={0.98}>
                    <Text style={styles.primaryActionText}>Uygula</Text>
                </AnimatedPressable>
            </PremiumModalSurface>
        </>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            paddingHorizontal: spacing.lg,
            paddingTop: 0,
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
        // ── Snapshot card ──
        snapshotCard: {
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.accent + "30",
            backgroundColor: colors.surface,
            padding: spacing.md,
            marginBottom: spacing.md,
        },
        snapshotHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
        },
        snapshotTitleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        snapshotDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        snapshotTitle: {
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            color: colors.text,
        },
        snapshotSubtitle: {
            fontSize: fontSize.xs,
            color: colors.textMuted,
        },
        // ── Filter summary ──
        filterSummaryCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginBottom: spacing.lg,
        },
        filterSummaryLabel: {
            color: colors.textMuted,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            textTransform: "uppercase",
            letterSpacing: 0.8,
        },
        filterSummaryValue: {
            color: colors.text,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            marginTop: 2,
        },
        filterOpenBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        filterOpenText: {
            color: colors.accent,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
        },
        // ── Chart card ──
        chartCard: {
            marginBottom: spacing.xxl,
            overflow: "hidden",
        },
        scoreSummaryRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: spacing.md,
        },
        scoreSummaryLeft: {
            gap: 4,
        },
        scoreSummaryLabel: {
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.8,
        },
        scoreSummaryValue: {
            fontSize: fontSize.xxxl,
            fontWeight: fontWeight.heavy,
            color: colors.text,
            letterSpacing: -0.5,
        },
        scoreSummaryEmpty: {
            fontSize: fontSize.xxxl,
            fontWeight: fontWeight.heavy,
            color: colors.textMuted,
        },
        scoreSummaryRight: {
            alignItems: "flex-end",
            gap: 4,
        },
        deltaHint: {
            fontSize: 10,
            color: colors.textMuted,
        },
        baselineLabel: {
            fontSize: fontSize.xs,
            color: colors.textMuted,
            fontWeight: fontWeight.semibold,
        },
        // ── Chart legend ──
        chartLegend: {
            marginTop: spacing.sm,
            gap: 6,
        },
        legendRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        legendDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        legendText: {
            fontSize: 11,
            color: colors.textMuted,
            flex: 1,
        },
        // ── AI suggestion ──
        suggestionCard: { marginBottom: spacing.xxl },
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
            paddingVertical: spacing.xs,
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
        // ── PR cards ──
        prCard: { marginBottom: spacing.sm },
        prRow: { flexDirection: "row", alignItems: "center" },
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
        prInfo: { flex: 1 },
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
        prWeight: { alignItems: "flex-end" },
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
        // ── Modals ──
        modalCard: {
            width: "100%",
            maxWidth: 520,
            maxHeight: "86%",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
        },
        filterModalCard: {
            width: "100%",
            maxWidth: 430,
            maxHeight: "86%",
            padding: spacing.xl,
            borderRadius: borderRadius.xl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        filterModalLabel: {
            color: colors.text,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            marginTop: spacing.md,
            marginBottom: spacing.sm,
        },
        filterModalList: { maxHeight: 210 },
        filterRow: {
            flexDirection: "row",
            marginBottom: spacing.xl,
            gap: spacing.sm,
        },
        metricFilterRow: {
            gap: spacing.sm,
            paddingBottom: spacing.md,
            marginBottom: spacing.sm,
        },
        metricFilterBtn: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        splitFilterBtn: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        metricFilterBtnActive: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        metricFilterText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
        },
        metricFilterTextActive: { color: colors.accent },
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
        videoBtnActive: { backgroundColor: colors.accent },
        videoBtnText: {
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            color: colors.background,
        },
        linkEditor: {
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            padding: spacing.md,
            gap: spacing.sm,
        },
        linkEditorTitle: {
            color: colors.text,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
        },
        linkInput: {
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            fontSize: fontSize.sm,
        },
        errorText: {
            color: "#EF4444",
            fontSize: fontSize.xs,
            fontWeight: fontWeight.semibold,
        },
        linkActions: {
            flexDirection: "row",
            gap: spacing.sm,
        },
        secondaryAction: {
            flex: 1,
            minHeight: 42,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        secondaryActionText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
        },
        primaryAction: {
            flex: 1,
            minHeight: 42,
            borderRadius: borderRadius.md,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
        },
        primaryActionText: {
            color: colors.background,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.heavy,
        },
    });
