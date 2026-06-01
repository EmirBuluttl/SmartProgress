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
    TextInput,
    Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bodyMeasurementApi, nutritionApi, workoutApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";
import { buildExerciseScoreTrend, buildProgressTrend, getPersonalRecords } from "../utils/workoutMetrics";

const SCREEN_WIDTH = Dimensions.get("window").width;
const RECORD_LINKS_KEY = "personal_record_video_links";

type TimeFilter = "1H" | "1A" | "1Y" | "Tümü";
const FILTERS: TimeFilter[] = ["1H", "1A", "1Y", "Tümü"];
const FILTER_DAYS: Record<TimeFilter, number> = { "1H": 7, "1A": 30, "1Y": 365, "Tümü": 9999 };
type ChartMetric = "progress:all" | `exercise:${string}` | "body:weight" | "nutrition:calories" | "nutrition:protein" | "nutrition:carbs" | "nutrition:fat";

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

export default function MyProgressScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const isAutoSuggestEnabled = user?.settings?.is_auto_suggest_enabled === true;
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();

    const [filter, setFilter] = React.useState<TimeFilter>("1A");
    const [chartMetric, setChartMetric] = React.useState<ChartMetric>("progress:all");
    const [splitFilter, setSplitFilter] = React.useState("Tümü");
    const [allWorkouts, setAllWorkouts] = React.useState<any[]>([]);
    const [bodyMeasurements, setBodyMeasurements] = React.useState<any[]>([]);
    const [nutritionLogs, setNutritionLogs] = React.useState<any[]>([]);
    const [chartData, setChartData] = React.useState<{
        labels: string[];
        datasets: { data: number[] }[];
    }>({ labels: ["0"], datasets: [{ data: [0] }] });
    const [prs, setPrs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedPR, setSelectedPR] = React.useState<any | null>(null);
    const [recordLinks, setRecordLinks] = React.useState<Record<string, string>>({});
    const [isEditingPrLink, setIsEditingPrLink] = React.useState(false);
    const [linkDraft, setLinkDraft] = React.useState("");
    const [linkError, setLinkError] = React.useState("");

    const styles = React.useMemo(() => createStyles(colors), [colors]);

    // ─── Progress calculation ─────────────────

    const metricOptions = React.useMemo(() => {
        const exercises = Array.from(new Set(getPersonalRecords(allWorkouts).map((pr) => pr.exercise))).slice(0, 12);
        return [
            { key: "progress:all" as ChartMetric, label: "Genel Progress" },
            ...exercises.map((exercise) => ({ key: `exercise:${exercise}` as ChartMetric, label: exercise })),
            { key: "body:weight" as ChartMetric, label: "Vücut Ağırlığı" },
            { key: "nutrition:calories" as ChartMetric, label: "Kalori" },
            { key: "nutrition:protein" as ChartMetric, label: "Protein" },
            { key: "nutrition:carbs" as ChartMetric, label: "Karbonhidrat" },
            { key: "nutrition:fat" as ChartMetric, label: "Yağ" },
        ];
    }, [allWorkouts]);

    const splitOptions = React.useMemo(() => {
        const labels = Array.from(new Set(allWorkouts.map((workout) => String(workout.title || "Genel"))));
        return ["Tümü", ...labels];
    }, [allWorkouts]);

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
        const scopedWorkouts = splitFilter === "Tümü"
            ? workouts
            : workouts.filter((workout) => String(workout.title || "Genel") === splitFilter);
        const labels: string[] = [];
        let dataPoints: number[] = [];

        if (metric === "progress:all") {
            buildProgressTrend(scopedWorkouts)
                .filter((point) => new Date(point.date || 0) >= cutoff && point.comparable > 0)
                .forEach((point, idx) => {
                    dataPoints.push(point.percentage);
                    labels.push(`A${idx + 1}`);
                });
        } else if (metric.startsWith("exercise:")) {
            const exerciseName = metric.replace("exercise:", "");
            buildExerciseScoreTrend(scopedWorkouts, exerciseName)
                .filter((point) => new Date(point.date || 0) >= cutoff && point.comparable)
                .forEach((point, idx) => {
                    dataPoints.push(point.score);
                    labels.push(`A${idx + 1}`);
                });
        } else if (metric === "body:weight") {
            const records = [...measurements]
                .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                .filter((record) => new Date(record.date || 0) >= cutoff && toNumber(record.weight) > 0);
            const labelStep = Math.max(1, Math.ceil(records.length / 5));
            records.forEach((record, idx) => {
                    dataPoints.push(toNumber(record.weight));
                    labels.push(idx === 0 || idx === records.length - 1 || idx % labelStep === 0 ? formatDateLabel(record.date) : "");
                });
        } else {
            const field = metric.replace("nutrition:", "");
            const records = [...nutrition]
                .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                .filter((record) => new Date(record.date || 0) >= cutoff && toNumber(record[field]) > 0);
            const labelStep = Math.max(1, Math.ceil(records.length / 5));
            records.forEach((record, idx) => {
                    dataPoints.push(toNumber(record[field]));
                    labels.push(idx === 0 || idx === records.length - 1 || idx % labelStep === 0 ? formatDateLabel(record.date) : "");
                });
        }

        if (dataPoints.length === 0) {
            dataPoints = [0];
            labels.push("-");
        }
        setChartData({ labels, datasets: [{ data: dataPoints }] });
    };

    const chartTitle = React.useMemo(() => {
        const selected = metricOptions.find((option) => option.key === chartMetric);
        return selected?.label || "Progress";
    }, [chartMetric, metricOptions]);

    const chartSuffix = chartMetric === "progress:all" || chartMetric.startsWith("exercise:")
        ? "%"
        : chartMetric === "body:weight"
            ? " kg"
            : chartMetric === "nutrition:calories"
                ? " kcal"
                : " g";

    const chartDecimalPlaces = chartMetric === "progress:all" || chartMetric.startsWith("exercise:") || chartMetric === "body:weight" || chartSuffix === " g" ? 1 : 0;

    const latestChartValue = React.useMemo(() => {
        const values = chartData.datasets[0]?.data || [];
        return values.length ? values[values.length - 1] : 0;
    }, [chartData]);

    const latestChartLabel = React.useMemo(() => {
        if (chartMetric === "progress:all" || chartMetric.startsWith("exercise:")) {
            return `${latestChartValue > 0 ? "+" : ""}${latestChartValue.toFixed(1)}%`;
        }
        if (chartMetric === "body:weight") return `${latestChartValue.toFixed(1)} kg`;
        if (chartMetric === "nutrition:calories") return `${Math.round(latestChartValue)} kcal`;
        return `${latestChartValue.toFixed(1)} g`;
    }, [chartMetric, latestChartValue]);

    // ─── Load analytics ───────────────────────

    const loadAnalytics = async () => {
        try {
            const [workoutRes, measurementRes, nutritionRes] = await Promise.all([
                workoutApi.list({ limit: 200 }),
                bodyMeasurementApi.list({ limit: 180 }),
                nutritionApi.list({ limit: 180 }),
            ]);
            const workouts = workoutRes.data.workouts || [];
            const measurements = measurementRes.data.measurements || [];
            const nutrition = nutritionRes.data.logs || [];

            setAllWorkouts(workouts);
            setBodyMeasurements(measurements);
            setNutritionLogs(nutrition);
            buildChartData(workouts, measurements, nutrition, filter, chartMetric);

            setPrs(getPersonalRecords(workouts));
            const rawLinks = await AsyncStorage.getItem(RECORD_LINKS_KEY);
            setRecordLinks(rawLinks ? JSON.parse(rawLinks) : {});
        } catch (err) {
            console.error("Analytics Load Error", err);
        } finally {
            setLoading(false);
        }
    };

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

    // Re-filter when filter changes
    React.useEffect(() => {
        if (allWorkouts.length > 0 || bodyMeasurements.length > 0 || nutritionLogs.length > 0) {
            buildChartData(allWorkouts, bodyMeasurements, nutritionLogs, filter, chartMetric);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, chartMetric, splitFilter]);

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
                contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Page Title */}
                <Text style={styles.pageTitle}>MyProgress</Text>
                <Text style={styles.pageSubtitle}>Performans analitiğin ve akıllı öneriler</Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.metricFilterRow}
                >
                    {metricOptions.map((option) => (
                        <TouchableOpacity
                            key={option.key}
                            style={[styles.metricFilterBtn, chartMetric === option.key && styles.metricFilterBtnActive]}
                            onPress={() => setChartMetric(option.key)}
                        >
                            <Text style={[styles.metricFilterText, chartMetric === option.key && styles.metricFilterTextActive]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.metricFilterRow}
                >
                    {splitOptions.map((option) => (
                        <TouchableOpacity
                            key={option}
                            style={[styles.splitFilterBtn, splitFilter === option && styles.metricFilterBtnActive]}
                            onPress={() => setSplitFilter(option)}
                        >
                            <Text style={[styles.metricFilterText, splitFilter === option && styles.metricFilterTextActive]}>
                                {option}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

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

                {/* ─── Progress Chart ─── */}
                <SectionHeader title={chartTitle} />
                <GymCard elevated style={styles.chartCard}>
                    <View style={styles.scoreSummaryRow}>
                        <View>
                            <Text style={styles.scoreSummaryLabel}>
                                {chartMetric === "progress:all" || chartMetric.startsWith("exercise:") ? "Son yük skoru" : "Son kayıt"}
                            </Text>
                            <Text style={styles.scoreSummaryHint}>
                                {chartMetric === "progress:all" || chartMetric.startsWith("exercise:")
                                    ? "Kilo yüzdesi + tekrar katsayısı"
                                    : "Seçili filtredeki son veri"}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.scoreSummaryValue,
                                latestChartValue < 0 && styles.scoreSummaryValueNegative,
                            ]}
                        >
                            {latestChartLabel}
                        </Text>
                    </View>
                    <LineChart
                        data={chartData}
                        width={SCREEN_WIDTH - spacing.lg * 4}
                        height={200}
                        yAxisSuffix={chartSuffix}
                        chartConfig={{
                            backgroundColor: colors.surface,
                            backgroundGradientFrom: colors.surfaceLight,
                            backgroundGradientTo: colors.surface,
                            decimalPlaces: chartDecimalPlaces,
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
                        <Text style={styles.legendText}>
                            {chartMetric.startsWith("exercise:")
                                ? "Seçili harekette önceki en iyi kayda göre yük skoru"
                                : chartMetric === "progress:all"
                                    ? "Antrenmandaki hareketlerin ortalama yük skoru"
                                    : "Profilde kaydettiğin takip verileri"}
                        </Text>
                    </View>
                </GymCard>

                {/* ─── AI Suggestion ─── */}
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

                {/* ─── Personal Records ─── */}
                <SectionHeader
                    title="Kişisel Rekorlar (PR)"
                    actionLabel="Tümünü Gör"
                    onAction={() => navigation.navigate("Records")}
                />
                {prs.length > 0 ? (
                    prs.slice(0, 5).map((pr, index) => (
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
                onRequestClose={closePrModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Kişisel Rekor</Text>
                            <TouchableOpacity onPress={closePrModal}>
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
                                        {new Date(selectedPR.date).toLocaleDateString("tr-TR", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </Text>
                                    {selectedPR.workoutTitle && (
                                        <Text style={styles.modalMetaText}>
                                            {selectedPR.workoutTitle}
                                        </Text>
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
                                            <TouchableOpacity style={styles.secondaryAction} onPress={() => setIsEditingPrLink(false)}>
                                                <Text style={styles.secondaryActionText}>İptal</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.primaryAction} onPress={savePrLink}>
                                                <Text style={styles.primaryActionText}>Kaydet</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                <TouchableOpacity
                                    style={[styles.videoBtn, selectedPrLink && styles.videoBtnActive]}
                                    onPress={() => selectedPrLink ? Linking.openURL(selectedPrLink) : openPrLinkEditor()}
                                    onLongPress={openPrLinkEditor}
                                >
                                    <Ionicons name={selectedPrLink ? "play-circle" : "link-outline"} size={18} color={colors.background} />
                                    <Text style={styles.videoBtnText}>{selectedPrLink ? "PR Videosunu Aç" : "Video Bağlantısı Ekle"}</Text>
                                </TouchableOpacity>
                                )}
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
    metricFilterTextActive: {
        color: colors.accent,
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
    scoreSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    scoreSummaryLabel: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    scoreSummaryHint: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    scoreSummaryValue: {
        color: colors.accent,
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
    },
    scoreSummaryValueNegative: {
        color: colors.error,
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
    videoBtnActive: {
        backgroundColor: colors.accent,
    },
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
