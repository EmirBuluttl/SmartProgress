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
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToWorkoutCache, getCachedWorkouts, getWorkoutCacheSnapshot } from "../services/workoutCacheService";
import {
    getPersistedWorkoutAnalyticsSnapshot,
    getWorkoutAnalyticsSnapshot,
    isWorkoutAnalyticsStale,
    type WorkoutAnalyticsSnapshot,
} from "../services/workoutAnalyticsCacheService";
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
import { KeyboardAwareScrollView } from "../components/KeyboardSafeScreen";
import WeeklyStrengthChart from "../components/WeeklyStrengthChart";
import CoachSignalRatioChart from "../components/CoachSignalRatioChart";
import { useAppTourTarget } from "../contexts/AppTourContext";
import { coachApi, type CoachSignalRatioPoint, type CoachSignalRatioRange } from "../services/api";

const SCREEN_WIDTH = Dimensions.get("window").width;
const RECORD_LINKS_KEY = "personal_record_video_links";
const SIGNAL_RATIO_CACHE_KEY = "coach_signal_ratio_snapshot_v1";

type TimeFilter = "1H" | "1A" | "1Y" | "Tümü";
const FILTERS: TimeFilter[] = ["1H", "1A", "1Y", "Tümü"];
const FILTER_DAYS: Record<TimeFilter, number> = { "1H": 7, "1A": 30, "1Y": 365, "Tümü": 9999 };
const SIGNAL_RATIO_RANGE_BY_FILTER: Record<TimeFilter, CoachSignalRatioRange> = {
    "1H": "7",
    "1A": "30",
    "1Y": "365",
    "Tümü": "all",
};
type SignalRatioSnapshot = {
    range: CoachSignalRatioRange;
    generatedAt?: string;
    savedAt: string;
    points: CoachSignalRatioPoint[];
};
type ChartMetric =
    | `exercise:${string}`
    | `muscle:${string}`
    | "body:weight"
    | "nutrition:calories"
    | "nutrition:protein"
    | "nutrition:carbs"
    | "nutrition:fat";
type MetricTab = "performance" | "muscle" | "body" | "nutrition";

const METRIC_TABS: { key: MetricTab; label: string }[] = [
    { key: "performance", label: "Performans" },
    { key: "muscle", label: "Kas grubu" },
    { key: "body", label: "Vücut" },
    { key: "nutrition", label: "Beslenme" },
];

function metricTabFor(metric: ChartMetric): MetricTab {
    if (metric.startsWith("exercise:")) return "performance";
    if (metric.startsWith("muscle:")) return "muscle";
    if (metric.startsWith("nutrition:")) return "nutrition";
    return "body";
}

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
    const isFocused = useIsFocused();
    const isFocusedRef = React.useRef(isFocused);
    const scrollRef = React.useRef<ScrollView | null>(null);
    const { animStyle } = useScreenEnter();
    const { animStyle: filtersAnimStyle } = useScreenEnter({ delay: 80 });
    const { animStyle: chartAnimStyle } = useScreenEnter({ delay: 150 });
    const { animStyle: prsAnimStyle } = useScreenEnter({ delay: 220 });

    const [filter, setFilter] = React.useState<TimeFilter>("1A");
    const [chartMetric, setChartMetric] = React.useState<ChartMetric>("body:weight");
    const [splitFilter, setSplitFilter] = React.useState("Tümü");
    const [activeMetricTab, setActiveMetricTab] = React.useState<MetricTab>("performance");
    const [allWorkouts, setAllWorkouts] = React.useState<any[]>([]);
    const [bodyMeasurements, setBodyMeasurements] = React.useState<any[]>([]);
    const [nutritionLogs, setNutritionLogs] = React.useState<any[]>([]);
    const [weeklyPoints, setWeeklyPoints] = React.useState<WeeklyPoint[]>([]);
    const [weeklySnapshot, setWeeklySnapshot] = React.useState<ExerciseSnapshot[]>([]);
    const [analyticsSnapshot, setAnalyticsSnapshot] = React.useState<WorkoutAnalyticsSnapshot | null>(null);
    const [animationProgress, setAnimationProgress] = React.useState(0);
    const chartAnimationTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const chartRequestIdRef = React.useRef(0);
    const signalRatioRequestIdRef = React.useRef(0);
    const isNavigatingToRecordsRef = React.useRef(false);
    const hasSetDefaultMetric = React.useRef(false);
    const tourOffsetsRef = React.useRef<Record<string, number>>({});
    const rememberTourOffset = React.useCallback((id: string) => (event: any) => {
        tourOffsetsRef.current[id] = event.nativeEvent.layout.y;
    }, []);
    const scrollToTourTarget = React.useCallback((id: string) => {
        const y = tourOffsetsRef.current[id] ?? 0;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 110), animated: true });
    }, []);
    const chartTourRef = useAppTourTarget("progress.chart", { scrollTo: () => scrollToTourTarget("progress.chart") });
    const filterTourRef = useAppTourTarget("progress.filter", { scrollTo: () => scrollToTourTarget("progress.filter") });
    const recordsTourRef = useAppTourTarget("progress.records", { scrollTo: () => scrollToTourTarget("progress.records") });

    // 3 dakika TTL: stack ekrandan dönüşte sadece bayatlamış veri yeniden yüklenir
    const { shouldReload: shouldReloadAnalytics, markLoaded: markAnalyticsLoaded } = useStaleDataGuard(3 * 60 * 1000);

    React.useEffect(() => {
        isFocusedRef.current = isFocused;
        if (isFocused) isNavigatingToRecordsRef.current = false;
    }, [isFocused]);

    const [prs, setPrs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedPR, setSelectedPR] = React.useState<any | null>(null);
    const [recordLinks, setRecordLinks] = React.useState<Record<string, string>>({});
    const [isEditingPrLink, setIsEditingPrLink] = React.useState(false);
    const [linkDraft, setLinkDraft] = React.useState("");
    const [linkError, setLinkError] = React.useState("");
    const [filterModalVisible, setFilterModalVisible] = React.useState(false);
    const [signalRatioPoints, setSignalRatioPoints] = React.useState<CoachSignalRatioPoint[]>([]);
    const [signalRatioLoading, setSignalRatioLoading] = React.useState(false);
    const [signalRatioError, setSignalRatioError] = React.useState("");
    const [signalRatioUpdatedAt, setSignalRatioUpdatedAt] = React.useState<string | null>(null);

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
        return {
            performance: exercises.map((e) => ({ key: `exercise:${e}` as ChartMetric, label: e })),
            muscle: muscleGroups.map((g) => ({ key: `muscle:${g}` as ChartMetric, label: g })),
            body: [{ key: "body:weight" as ChartMetric, label: "Vücut Ağırlığı" }],
            nutrition: [
                { key: "nutrition:calories" as ChartMetric, label: "Kalori" },
                { key: "nutrition:protein" as ChartMetric, label: "Protein" },
                { key: "nutrition:carbs" as ChartMetric, label: "Karbonhidrat" },
                { key: "nutrition:fat" as ChartMetric, label: "Yağ" },
            ],
        } satisfies Record<MetricTab, { key: ChartMetric; label: string }[]>;
    }, [analyticsSnapshot]);
    const allMetricOptions = React.useMemo(
        () => Object.values(metricOptions).flat(),
        [metricOptions],
    );

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
            setTimeout(() => {
                if (isNavigatingToRecordsRef.current) return;
                if (requestId !== chartRequestIdRef.current) return;
                buildChartData(workouts, measurements, nutrition, activeFilter, metric);
            }, 30);
        });
    };

    // ── Derived chart info ────────────────────────────────────────────────────

    const loadSignalRatios = React.useCallback(async (activeFilter: TimeFilter, options?: { force?: boolean }) => {
        const range = SIGNAL_RATIO_RANGE_BY_FILTER[activeFilter];
        const requestId = ++signalRatioRequestIdRef.current;
        setSignalRatioError("");

        try {
            const rawSnapshot = await AsyncStorage.getItem(SIGNAL_RATIO_CACHE_KEY);
            const cached = rawSnapshot ? JSON.parse(rawSnapshot) as SignalRatioSnapshot : null;
            if (cached?.range === range && Array.isArray(cached.points)) {
                setSignalRatioPoints(cached.points);
                setSignalRatioUpdatedAt(cached.generatedAt || cached.savedAt);
            }

            const savedAtMs = cached?.savedAt ? new Date(cached.savedAt).getTime() : 0;
            const isCacheFresh = cached?.range === range && Date.now() - savedAtMs < 3 * 60 * 1000;
            const staleAnalytics = await isWorkoutAnalyticsStale().catch(() => false);
            if (!options?.force && isCacheFresh && !staleAnalytics) return;

            setSignalRatioLoading(true);
            const response = await coachApi.signalRatios({ range });
            if (requestId !== signalRatioRequestIdRef.current) return;

            const points = Array.isArray(response.data?.points) ? response.data.points : [];
            const generatedAt = response.data?.generatedAt || new Date().toISOString();
            setSignalRatioPoints(points);
            setSignalRatioUpdatedAt(generatedAt);
            await AsyncStorage.setItem(SIGNAL_RATIO_CACHE_KEY, JSON.stringify({
                range,
                generatedAt,
                savedAt: new Date().toISOString(),
                points,
            } satisfies SignalRatioSnapshot));
        } catch (error) {
            console.warn("[MyProgress] Signal ratio refresh failed:", error);
            if (requestId === signalRatioRequestIdRef.current) {
                setSignalRatioError("Koc sinyalleri yenilenemedi.");
            }
        } finally {
            if (requestId === signalRatioRequestIdRef.current) {
                setSignalRatioLoading(false);
            }
        }
    }, []);

    const chartTitle = React.useMemo(() => {
        const opt = allMetricOptions.find((o) => o.key === chartMetric);
        return opt?.label || "Progress";
    }, [allMetricOptions, chartMetric]);

    const handleSelectMetric = React.useCallback((metric: ChartMetric) => {
        setChartMetric(metric);
    }, []);

    const latestPoint = weeklyPoints[weeklyPoints.length - 1] ?? null;
    const latestSignalPoint = React.useMemo(
        () => [...signalRatioPoints].reverse().find((point) => point.analyzedCount > 0 || point.workoutCount > 0) || null,
        [signalRatioPoints],
    );
    const signalRatioUpdatedLabel = React.useMemo(() => {
        if (!signalRatioUpdatedAt) return "";
        const date = new Date(signalRatioUpdatedAt);
        if (!Number.isFinite(date.getTime())) return "";
        return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }, [signalRatioUpdatedAt]);

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
        let staleAnalytics = false;
        let needsAnalyticsRefresh = false;
        loadSignalRatios(filter).catch(() => undefined);
        const persistedAnalytics = await getPersistedWorkoutAnalyticsSnapshot().catch(() => null);
        if (persistedAnalytics) {
            setAnalyticsSnapshot(persistedAnalytics);
            setWeeklySnapshot(persistedAnalytics.weeklySnapshot || []);
            setPrs(persistedAnalytics.personalRecords || []);
            setLoading(false);
            needsAnalyticsRefresh =
                (persistedAnalytics.personalRecords || []).length === 0 &&
                (persistedAnalytics.weeklySnapshot || []).length === 0 &&
                (persistedAnalytics.exerciseCounts || []).length === 0;
        } else {
            needsAnalyticsRefresh = true;
        }

        // Load from caches instantly if available!
        const cachedWorkouts = getWorkoutCacheSnapshot(200);
        const cachedMeasurements = getBodyMeasurementSnapshot();
        const cachedNutrition = getNutritionSnapshot();
        if (cachedWorkouts.length > 0 || cachedMeasurements.length > 0 || cachedNutrition.length > 0) {
            setAllWorkouts(cachedWorkouts);
            setBodyMeasurements(cachedMeasurements);
            setNutritionLogs(cachedNutrition);
            scheduleChartData(cachedWorkouts, cachedMeasurements, cachedNutrition, filter, chartMetric);
            setLoading(false);
        }

        try {
            const [measurements, nutrition] = await Promise.all([
                getCachedBodyMeasurements(180),
                getCachedNutritionLogs(180),
            ]);
            staleAnalytics = await isWorkoutAnalyticsStale();
            needsAnalyticsRefresh = needsAnalyticsRefresh || staleAnalytics;

            setBodyMeasurements(measurements);
            setNutritionLogs(nutrition);
            const rawLinks = await AsyncStorage.getItem(RECORD_LINKS_KEY);
            setRecordLinks(rawLinks ? JSON.parse(rawLinks) : {});

            scheduleChartData(cachedWorkouts, measurements, nutrition, filter, chartMetric);
            if (needsAnalyticsRefresh) {
                InteractionManager.runAfterInteractions(() => {
                    getCachedWorkouts(200, { forceRefresh: true })
                        .then((freshWorkouts) => {
                            const analytics = getWorkoutAnalyticsSnapshot(freshWorkouts);
                            setAnalyticsSnapshot(analytics);
                            setWeeklySnapshot(analytics.weeklySnapshot || []);
                            setPrs(analytics.personalRecords || []);
                            setAllWorkouts(freshWorkouts);
                            scheduleChartData(freshWorkouts, measurements, nutrition, filter, chartMetric);
                        })
                        .catch((error) => {
                            console.warn("[MyProgress] Analytics refresh failed:", error);
                        });
                });
            }
            setLoading(false);
        } catch (err) {
            console.error("Analytics Load Error", err);
        } finally {
            setLoading(false);
        }
    };

    // ── Re-build on filter change ─────────────────────────────────────────────

    React.useEffect(() => {
        loadSignalRatios(filter).catch(() => undefined);
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
            if (!isFocusedRef.current) return;
            loadAnalytics().catch(() => undefined);
        });
        const unsubMeasurements = subscribeToBodyMeasurementCache(() => {
            if (!isFocusedRef.current) return;
            loadAnalytics().catch(() => undefined);
        });
        const unsubNutrition = subscribeToNutritionCache(() => {
            if (!isFocusedRef.current) return;
            loadAnalytics().catch(() => undefined);
        });
        return () => {
            unsubWorkouts();
            unsubMeasurements();
            unsubNutrition();
        };
    }, [isFocused]);

    // ── PR Modal helpers ──────────────────────────────────────────────────────

    const selectedPrLink = selectedPR ? recordLinks[recordKey(selectedPR)] : "";

    const handleOpenRecords = React.useCallback(() => {
        isNavigatingToRecordsRef.current = true;
        chartRequestIdRef.current++;
        if (chartAnimationTimerRef.current) {
            clearInterval(chartAnimationTimerRef.current);
            chartAnimationTimerRef.current = null;
        }
        (navigation as any).navigate("Records");
    }, [navigation]);

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
                ref={scrollRef}
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
                <Animated.View ref={filterTourRef} collapsable={false} onLayout={rememberTourOffset("progress.filter")} style={[styles.filterSummaryCard, filtersAnimStyle]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.filterSummaryLabel}>Görünüm</Text>
                        <Text style={styles.filterSummaryValue} numberOfLines={1}>
                            Koc sinyalleri · {filter}
                        </Text>
                    </View>
                    <AnimatedPressable
                        style={styles.filterOpenBtn}
                        onPress={() => {
                            setActiveMetricTab(metricTabFor(chartMetric));
                            setFilterModalVisible(true);
                        }}
                        pressedScale={0.96}
                    >
                        <Ionicons name="options-outline" size={16} color={colors.accent} />
                        <Text style={styles.filterOpenText}>Filtre</Text>
                    </AnimatedPressable>
                </Animated.View>

                {/* ── Progress Chart ── */}
                <Animated.View ref={chartTourRef} collapsable={false} onLayout={rememberTourOffset("progress.chart")} style={chartAnimStyle}>
                    <SectionHeader title="Koc sinyalleri" />
                    <GymCard elevated style={styles.chartCard}>
                        <View style={styles.scoreSummaryRow}>
                            <View style={styles.scoreSummaryLeft}>
                                <Text style={styles.scoreSummaryLabel}>Son analiz</Text>
                                {latestSignalPoint ? (
                                    <Text style={styles.scoreSummaryValue}>
                                        %{latestSignalPoint.progressRatio.toFixed(1)}
                                    </Text>
                                ) : (
                                    <Text style={styles.scoreSummaryEmpty}>—</Text>
                                )}
                                <Text style={styles.deltaHint}>progress orani</Text>
                            </View>
                            <View style={styles.scoreSummaryRight}>
                                {latestSignalPoint ? (
                                    <>
                                        <View style={styles.signalPillRow}>
                                            <View style={[styles.signalPill, { backgroundColor: (colors.warning || "#F59E0B") + "22" }]}>
                                                <Text style={[styles.signalPillText, { color: colors.warning || "#F59E0B" }]}>Plato %{latestSignalPoint.plateauRatio.toFixed(1)}</Text>
                                            </View>
                                            <View style={[styles.signalPill, { backgroundColor: (colors.error || "#EF4444") + "20" }]}>
                                                <Text style={[styles.signalPillText, { color: colors.error || "#EF4444" }]}>Dusus %{latestSignalPoint.regressionRatio.toFixed(1)}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.deltaHint}>Takip/notr %{latestSignalPoint.watchRatio.toFixed(1)}</Text>
                                    </>
                                ) : signalRatioLoading ? (
                                    <ActivityIndicator size="small" color={colors.accent} />
                                ) : (
                                    <Text style={styles.baselineLabel}>Veri bekleniyor</Text>
                                )}
                            </View>
                        </View>

                        <CoachSignalRatioChart data={signalRatioPoints} colors={colors} />

                        <View style={styles.chartLegend}>
                            <View style={styles.legendRow}>
                                <View style={[styles.legendDot, { backgroundColor: colors.success || "#22C55E" }]} />
                                <Text style={styles.legendText}>Progress</Text>
                            </View>
                            <View style={styles.legendRow}>
                                <View style={[styles.legendDot, { backgroundColor: colors.warning || "#F59E0B" }]} />
                                <Text style={styles.legendText}>Plato</Text>
                            </View>
                            <View style={styles.legendRow}>
                                <View style={[styles.legendDot, { backgroundColor: colors.error || "#EF4444" }]} />
                                <Text style={styles.legendText}>Dusus</Text>
                            </View>
                            <Text style={styles.legendText}>
                                Payda yorumlanabilir hareketlerdir. Takip/notr kalan oran metin olarak gosterilir.
                            </Text>
                            {!!signalRatioError && <Text style={styles.errorText}>{signalRatioError}</Text>}
                            {!!signalRatioUpdatedLabel && <Text style={styles.deltaHint}>Son yenileme {signalRatioUpdatedLabel}</Text>}
                        </View>
                    </GymCard>
                </Animated.View>

                <Animated.View style={chartAnimStyle}>
                    <SectionHeader title="Detay metrikler" />
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
                <Animated.View ref={recordsTourRef} collapsable={false} onLayout={rememberTourOffset("progress.records")} style={prsAnimStyle}>
                    <SectionHeader
                        title="En İyi Setlerim"
                        actionLabel="Tümünü Gör"
                        onAction={handleOpenRecords}
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
                    <KeyboardAwareScrollView
                        style={styles.modalBodyScroll}
                        contentContainerStyle={styles.modalScrollContent}
                        extraBottomPadding={spacing.lg}
                    >
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
                    </KeyboardAwareScrollView>
                )}
            </PremiumModalSurface>

            {/* ── Filter Modal ── */}
            <PremiumModalSurface visible={filterModalVisible} onDismiss={() => setFilterModalVisible(false)} containerStyle={styles.filterModalCard}>
                <View style={[styles.modalHeader, styles.filterModalHeader]}>
                    <Text style={styles.modalTitle}>Grafik Filtresi</Text>
                    <AnimatedPressable onPress={() => setFilterModalVisible(false)} pressedScale={0.9}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </AnimatedPressable>
                </View>

                <ScrollView
                    style={styles.filterModalBody}
                    contentContainerStyle={styles.filterModalBodyContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.filterModalLabel}>Metrik</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricTabRow}>
                        {METRIC_TABS.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.metricTabBtn, activeMetricTab === tab.key && styles.metricFilterBtnActive]}
                                onPress={() => setActiveMetricTab(tab.key)}
                                activeOpacity={0.72}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[styles.metricFilterText, activeMetricTab === tab.key && styles.metricFilterTextActive]}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={styles.metricFilterGrid}>
                        {metricOptions[activeMetricTab].length === 0 ? (
                            <Text style={styles.emptyMetricText}>Bu metrik için önce birkaç log biriktir.</Text>
                        ) : metricOptions[activeMetricTab].map((option) => (
                            <TouchableOpacity
                                key={option.key}
                                style={[styles.metricFilterBtn, chartMetric === option.key && styles.metricFilterBtnActive]}
                                onPress={() => handleSelectMetric(option.key)}
                                activeOpacity={0.72}
                            >
                                <Text
                                    numberOfLines={2}
                                    style={[styles.metricFilterText, chartMetric === option.key && styles.metricFilterTextActive]}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterModalLabel}>Antrenman</Text>
                    <View style={styles.metricFilterGrid}>
                        {splitOptions.map((option) => (
                            <TouchableOpacity
                                key={option}
                                style={[styles.splitFilterBtn, splitFilter === option && styles.metricFilterBtnActive]}
                                onPress={() => setSplitFilter(option)}
                                activeOpacity={0.72}
                            >
                                <Text
                                    numberOfLines={2}
                                    style={[styles.metricFilterText, splitFilter === option && styles.metricFilterTextActive]}
                                >
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.filterModalLabel}>Zaman</Text>
                    <View style={styles.timeFilterRow}>
                        {FILTERS.map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                                onPress={() => setFilter(f)}
                                activeOpacity={0.72}
                            >
                                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.filterModalFooter}>
                    <AnimatedPressable style={[styles.primaryAction, styles.filterApplyAction]} onPress={() => setFilterModalVisible(false)} pressedScale={0.985}>
                        <Text style={styles.primaryActionText}>Uygula</Text>
                    </AnimatedPressable>
                </View>
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
            flexShrink: 0,
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
        signalPillRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 6,
            maxWidth: 190,
        },
        signalPill: {
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: borderRadius.full,
        },
        signalPillText: {
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
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
            maxWidth: 460,
            maxHeight: "88%",
            borderRadius: borderRadius.xl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },
        filterModalHeader: {
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.md,
            marginBottom: 0,
        },
        filterModalBody: {
            flexGrow: 0,
            flexShrink: 1,
        },
        filterModalBodyContent: {
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.md,
        },
        filterModalFooter: {
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
        },
        filterApplyAction: {
            flex: 0,
        },
        filterModalLabel: {
            color: colors.text,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            marginTop: spacing.md,
            marginBottom: spacing.sm,
        },
        filterModalList: { maxHeight: 190 },
        splitFilterList: { maxHeight: 132 },
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
        metricFilterGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "stretch",
            gap: spacing.sm,
            paddingBottom: spacing.md,
            marginBottom: spacing.sm,
        },
        timeFilterRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        metricTabRow: {
            gap: spacing.sm,
            paddingBottom: spacing.sm,
            marginBottom: spacing.xs,
        },
        metricTabBtn: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            minHeight: 38,
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            justifyContent: "center",
        },
        metricFilterBtn: {
            flexBasis: "47%",
            flexGrow: 1,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            minHeight: 46,
            minWidth: 132,
            maxWidth: "100%",
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 1,
        },
        splitFilterBtn: {
            flexBasis: "47%",
            flexGrow: 1,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            minHeight: 44,
            minWidth: 118,
            maxWidth: "100%",
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 1,
        },
        metricFilterBtnActive: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        metricFilterText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            flexShrink: 1,
            textAlign: "center",
            lineHeight: lineHeight.sm,
        },
        metricFilterTextActive: { color: colors.accent },
        emptyMetricText: {
            color: colors.textMuted,
            fontSize: fontSize.sm,
            lineHeight: lineHeight.md,
            paddingVertical: spacing.md,
        },
        filterBtn: {
            flex: 1,
            minWidth: 64,
            minHeight: 42,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
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
        modalBodyScroll: {
            maxHeight: "100%",
        },
        modalScrollContent: {
            paddingBottom: spacing.sm,
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
            flexWrap: "wrap",
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
