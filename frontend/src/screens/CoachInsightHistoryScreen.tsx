import React from "react";
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import ActionConfirmModal from "../components/ActionConfirmModal";
import NoticeModal from "../components/NoticeModal";
import { coachApi, parseApiError, programApi } from "../services/api";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { getActiveProgramId } from "../utils/workoutNavigation";

const PROGRESS_GREEN = "#22C55E";

const formatBestSet = (set?: any) => {
    if (!set) return "Baz yok";
    const rir = set.rir !== null && set.rir !== undefined && String(set.rir).trim() ? ` · RIR ${set.rir}` : "";
    if (set.weightMode === "bodyweight") {
        const external = Number(set.externalWeight || 0);
        const loadText = external > 0
            ? `BW + ${external} kg`
            : `BW${set.bodyWeight ? ` (${set.bodyWeight} kg)` : ""}`;
        return `${loadText} x ${set.reps ?? 0}${rir}`;
    }
    return `${set.weight ?? 0} kg x ${set.reps ?? 0}${rir}`;
};

const formatDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

const getMeta = (type: string, colors: any) => {
    if (type === "RIR_ADJUSTMENT_CANDIDATE") return { label: "RIR ayarı", icon: "speedometer-outline" as const, color: colors.warning || "#F5A524" };
    if (type === "VOLUME_REDUCE_CANDIDATE") return { label: "Hacim azalt", icon: "remove-circle-outline" as const, color: colors.warning || "#F5A524" };
    if (type === "WEIGHT_INCREASE_CANDIDATE") return { label: "Ağırlık artır", icon: "barbell-outline" as const, color: PROGRESS_GREEN };
    if (type === "VOLUME_INCREASE_CANDIDATE") return { label: "Set artır", icon: "add-circle-outline" as const, color: PROGRESS_GREEN };
    if (type === "REGRESSION_DETECTED") return { label: "Düşüş", icon: "arrow-down-circle-outline" as const, color: colors.danger || "#FF4D4D" };
    if (type === "PLATEAU_CANDIDATE") return { label: "Plato adayı", icon: "alert-circle-outline" as const, color: colors.warning || "#F5A524" };
    if (type === "PROGRESS_DETECTED") return { label: "Progress", icon: "trending-up-outline" as const, color: PROGRESS_GREEN };
    return { label: "Sinyal", icon: "pulse-outline" as const, color: colors.textSecondary };
};

const FILTERS = [
    { key: "all", label: "Tümü" },
    { key: "progress", label: "Progress" },
    { key: "action", label: "Müdahale" },
    { key: "plateau", label: "Plato" },
    { key: "regression", label: "Düşüş" },
] as const;

type InsightFilter = typeof FILTERS[number]["key"];
type RecommendationDecision = "accepted" | "rejected" | "follow";
type RecommendationType = "relax_rir" | "reduce_volume" | "increase_weight" | "increase_volume";

const DECISION_LABELS: Record<RecommendationDecision, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    accepted: { label: "Uygulanacak", icon: "checkmark-circle-outline" },
    follow: { label: "Takipte", icon: "eye-outline" },
    rejected: { label: "Reddedildi", icon: "close-circle-outline" },
};

function matchesFilter(insight: any, filter: InsightFilter) {
    if (filter === "all") return true;
    if (filter === "progress") return insight.type === "PROGRESS_DETECTED" || insight.type === "WEIGHT_INCREASE_CANDIDATE";
    if (filter === "action") {
        return insight.type === "RIR_ADJUSTMENT_CANDIDATE" ||
            insight.type === "VOLUME_REDUCE_CANDIDATE" ||
            insight.type === "VOLUME_INCREASE_CANDIDATE" ||
            insight.type === "WEIGHT_INCREASE_CANDIDATE";
    }
    if (filter === "plateau") return insight.type === "PLATEAU_CANDIDATE";
    if (filter === "regression") return insight.type === "REGRESSION_DETECTED";
    return true;
}

function normalizeExerciseName(value: unknown) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function cloneData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value || {}));
}

function shiftRange(value: unknown, delta: number) {
    const text = String(value || "").trim();
    if (!text) return text;
    const numbers = text.match(/\d+(?:[.,]\d+)?/g);
    if (!numbers?.length) return text;
    const shifted = numbers.map((part) => {
        const next = Math.max(0, Number(part.replace(",", ".")) + delta);
        return Number.isInteger(next) ? String(next) : String(Number(next.toFixed(1)));
    });
    if (shifted.length >= 2) return `${shifted[0]}-${shifted[1]}`;
    return shifted[0];
}

function getRecommendationType(insight: any): RecommendationType | null {
    const type = insight?.metadata?.recommendation?.type;
    return type === "relax_rir" || type === "reduce_volume" || type === "increase_weight" || type === "increase_volume"
        ? type
        : null;
}

function getPatchPreviewText(insight: any) {
    const recommendationType = getRecommendationType(insight);
    const exerciseName = String(insight?.exerciseName || "ilgili hareket");
    if (recommendationType === "reduce_volume") {
        return `${exerciseName} icin son calisma seti kaldirilacak. Isinma setlerine dokunulmaz ve hareket 1 calisma setinin altina dusmez.`;
    }
    if (recommendationType === "increase_volume") {
        return `${exerciseName} icin son calisma seti kopyalanarak 1 calisma seti eklenecek. Isinma setlerine dokunulmaz.`;
    }
    if (recommendationType === "relax_rir") {
        return `${exerciseName} icin hedef RIR 1 kademe rahatlatilacak; RPE hedefi varsa 1 puan dusurulecek.`;
    }
    if (recommendationType === "increase_weight") {
        return `${exerciseName} icin program setleri degismeyecek. Sonraki logda minimum agirlik artisi dene notu programa kaydedilecek.`;
    }
    return "Bu sinyal icin uygulanabilir program degisikligi bulunamadi. Yine de karar kaydi tutulabilir.";
}

function applyCoachProgramPatch(programData: any, insight: any) {
    const recommendationType = getRecommendationType(insight);
    const exerciseName = String(insight?.exerciseName || "");
    const normalizedName = normalizeExerciseName(exerciseName.replace(/\s+\((Sol|Sag|Sağ|Left|Right)\)$/i, ""));
    const data = cloneData(programData);
    const days = Array.isArray(data.days) ? data.days : [];
    let changed = false;

    if (recommendationType === "increase_weight") {
        const notes = Array.isArray(data.coachActionNotes) ? data.coachActionNotes : [];
        data.coachActionNotes = [
            ...notes,
            {
                id: `coach_note_${Date.now()}`,
                type: recommendationType,
                exerciseName,
                message: insight?.metadata?.recommendation?.message || "Sonraki benzer sessionda form bozulmadan minimum agirlik artisi dene.",
                createdAt: new Date().toISOString(),
                sourceInsightId: insight?.id,
            },
        ];
        return { data, changed: true, summary: "Minimum agirlik artisi notu programa kaydedildi." };
    }

    for (const day of days) {
        const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
        for (const exercise of exercises) {
            if (normalizeExerciseName(exercise?.name) !== normalizedName) continue;
            const targetSets = Array.isArray(exercise.targetSets) ? exercise.targetSets : [];
            const workingIndexes = targetSets
                .map((set: any, index: number) => ({ set, index }))
                .filter((item: any) => !item.set?.isWarmup)
                .map((item: any) => item.index);

            if (recommendationType === "reduce_volume") {
                if (workingIndexes.length <= 1) {
                    return { data, changed: false, summary: "Bu hareket zaten minimum calisma setinde; set azaltimi uygulanmadi." };
                }
                const removeIndex = workingIndexes[workingIndexes.length - 1];
                exercise.targetSets = targetSets.filter((_: any, index: number) => index !== removeIndex);
                changed = true;
            } else if (recommendationType === "increase_volume") {
                const sourceIndex = workingIndexes[workingIndexes.length - 1];
                if (sourceIndex === undefined) {
                    return { data, changed: false, summary: "Kopyalanacak calisma seti bulunamadi." };
                }
                const clonedSet = {
                    ...targetSets[sourceIndex],
                    id: `coach_set_${Date.now()}`,
                    isWarmup: false,
                };
                exercise.targetSets = [
                    ...targetSets.slice(0, sourceIndex + 1),
                    clonedSet,
                    ...targetSets.slice(sourceIndex + 1),
                ];
                changed = true;
            } else if (recommendationType === "relax_rir") {
                exercise.targetSets = targetSets.map((set: any) => {
                    if (set?.isWarmup) return set;
                    const next = { ...set };
                    if (next.targetRIR) {
                        next.targetRIR = shiftRange(next.targetRIR, 1);
                        changed = true;
                    }
                    if (next.targetRPE) {
                        next.targetRPE = shiftRange(next.targetRPE, -1);
                        changed = true;
                    }
                    return next;
                });
            }

            if (changed) {
                return { data, changed: true, summary: `${exerciseName} icin program guncellendi.` };
            }
        }
    }

    return { data, changed: false, summary: `${exerciseName || "Hareket"} aktif programda bulunamadi.` };
}

export default function CoachInsightHistoryScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const [loading, setLoading] = React.useState(true);
    const [insights, setInsights] = React.useState<any[]>([]);
    const [activeFilter, setActiveFilter] = React.useState<InsightFilter>("all");
    const [updatingInsightId, setUpdatingInsightId] = React.useState<string | null>(null);
    const [pendingApplyInsight, setPendingApplyInsight] = React.useState<any | null>(null);
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const response = await coachApi.insights({ limit: 50 });
                if (mounted) setInsights(Array.isArray(response.data?.data) ? response.data.data : []);
            } catch {
                if (mounted) setInsights([]);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const filteredInsights = insights.filter((insight) => matchesFilter(insight, activeFilter));
    const actionCount = insights.filter((insight) => matchesFilter(insight, "action")).length;
    const progressCount = insights.filter((insight) => matchesFilter(insight, "progress")).length;

    const updateRecommendationDecision = React.useCallback(async (insightId: string, decision: RecommendationDecision, programPatch?: any) => {
        setUpdatingInsightId(insightId);
        try {
            const response = await coachApi.updateInsightRecommendation(insightId, { decision, programPatch });
            const updatedInsight = response.data?.data;
            if (updatedInsight) {
                setInsights((prev) => prev.map((item) => item.id === insightId ? updatedInsight : item));
            }
        } catch (error) {
            console.warn("[CoachInsightHistory] Could not update recommendation decision", error);
            const apiError = parseApiError(error);
            setNotice({ title: "Karar kaydedilemedi", message: apiError.message });
        } finally {
            setUpdatingInsightId(null);
        }
    }, []);

    const applyRecommendationPatch = React.useCallback(async () => {
        const insight = pendingApplyInsight;
        if (!insight) return;
        setUpdatingInsightId(insight.id);
        setPendingApplyInsight(null);
        try {
            const activeProgramId = await getActiveProgramId();
            if (!activeProgramId) {
                setNotice({
                    title: "Aktif program yok",
                    message: "Koç önerisini uygulamak için önce kendi programlarından birini ana sayfada takipte yapmalısın.",
                });
                return;
            }

            const programResponse = await programApi.getById(activeProgramId);
            const program = programResponse.data;
            if (!program?.id || program?.isMine === false) {
                setNotice({
                    title: "Program uygulanamaz",
                    message: "Bu öneri yalnızca kendi aktif programında uygulanabilir. Public veya başkasına ait programı önce kütüphanene kopyala.",
                });
                return;
            }

            const patch = applyCoachProgramPatch(program.data || {}, insight);
            if (patch.changed) {
                await programApi.update(program.id, { data: patch.data });
            }
            await updateRecommendationDecision(insight.id, "accepted", {
                programId: program.id,
                recommendationType: getRecommendationType(insight),
                changed: patch.changed,
                summary: patch.summary,
            });
            setPendingApplyInsight(null);
            setNotice({
                title: patch.changed ? "Öneri uygulandı" : "Öneri kaydedildi",
                message: patch.summary,
            });
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Öneri uygulanamadı", message: apiError.message });
        } finally {
            setUpdatingInsightId(null);
        }
    }, [pendingApplyInsight, updateRecommendationDecision]);

    return (
        <>
        <Animated.ScrollView style={[styles.container, animStyle]} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Koç Sinyal Geçmişi</Text>
                    <Text style={styles.subtitle}>Eski progress, plato ve müdahale adayları burada kalır.</Text>
                </View>
            </View>

            {!loading && insights.length > 0 && (
                <View style={styles.overviewCard}>
                    <View style={styles.overviewItem}>
                        <Text style={styles.overviewValue}>{insights.length}</Text>
                        <Text style={styles.overviewLabel}>Toplam sinyal</Text>
                    </View>
                    <View style={styles.overviewDivider} />
                    <View style={styles.overviewItem}>
                        <Text style={[styles.overviewValue, { color: PROGRESS_GREEN }]}>{progressCount}</Text>
                        <Text style={styles.overviewLabel}>Progress</Text>
                    </View>
                    <View style={styles.overviewDivider} />
                    <View style={styles.overviewItem}>
                        <Text style={[styles.overviewValue, { color: colors.accent }]}>{actionCount}</Text>
                        <Text style={styles.overviewLabel}>Aksiyon</Text>
                    </View>
                </View>
            )}

            {!loading && insights.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map((filter) => {
                        const isActive = activeFilter === filter.key;
                        return (
                            <TouchableOpacity
                                key={filter.key}
                                style={[styles.filterChip, isActive && styles.filterChipActive]}
                                onPress={() => setActiveFilter(filter.key)}
                                activeOpacity={0.82}
                            >
                                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {loading ? (
                <View style={styles.emptyCard}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.emptyText}>Sinyaller yükleniyor...</Text>
                </View>
            ) : insights.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Ionicons name="sparkles-outline" size={22} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>Henüz sinyal yok</Text>
                    <Text style={styles.emptyText}>Benzer hareketlerde birkaç log biriktikçe koç hafızası burada oluşacak.</Text>
                </View>
            ) : filteredInsights.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Ionicons name="filter-outline" size={22} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>Bu filtrede sinyal yok</Text>
                    <Text style={styles.emptyText}>Başka bir filtre seçerek koç hafızasındaki diğer sinyallere bakabilirsin.</Text>
                </View>
            ) : (
                <View style={styles.list}>
                    {filteredInsights.map((insight) => {
                        const meta = getMeta(insight.type, colors);
                        const recommendation = insight.metadata?.recommendation;
                        const recommendationDecision = insight.metadata?.recommendationDecision?.decision as RecommendationDecision | undefined;
                        const decisionMeta = recommendationDecision ? DECISION_LABELS[recommendationDecision] : null;
                        const isUpdating = updatingInsightId === insight.id;
                        return (
                            <View key={insight.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.iconBadge, { backgroundColor: `${meta.color}22` }]}>
                                        <Ionicons name={meta.icon} size={18} color={meta.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.exerciseName}>{insight.exerciseName}</Text>
                                        <Text style={[styles.signalType, { color: meta.color }]}>{meta.label}</Text>
                                    </View>
                                    <Text style={styles.dateText}>{formatDate(insight.signalDate)}</Text>
                                </View>
                                <Text style={styles.bestLine}>
                                    {formatBestSet(insight.previousBest)} {"->"} {formatBestSet(insight.currentBest)}
                                </Text>
                                <Text style={styles.reason}>{insight.reason}</Text>
                                {!!insight.metadata?.interventionAdvice && (
                                    <Text style={styles.advice}>{insight.metadata.interventionAdvice}</Text>
                                )}
                                {!!recommendation && (
                                    <View style={styles.recommendationBox}>
                                        <View style={styles.recommendationHeader}>
                                            <View style={styles.recommendationTitleRow}>
                                                <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
                                                <Text style={styles.recommendationTitle}>{recommendation.label || "Koç önerisi"}</Text>
                                            </View>
                                            {!!decisionMeta && (
                                                <View style={styles.decisionPill}>
                                                    <Ionicons name={decisionMeta.icon} size={13} color={colors.accent} />
                                                    <Text style={styles.decisionText}>{decisionMeta.label}</Text>
                                                </View>
                                            )}
                                        </View>
                                        {!!recommendation.message && (
                                            <Text style={styles.recommendationMessage}>{recommendation.message}</Text>
                                        )}
                                        {!recommendationDecision && (
                                            <View style={styles.recommendationActions}>
                                                <TouchableOpacity
                                                    style={[styles.recommendationBtn, styles.recommendationBtnPrimary]}
                                                    onPress={() => setPendingApplyInsight(insight)}
                                                    disabled={isUpdating}
                                                    activeOpacity={0.82}
                                                >
                                                    {isUpdating ? <ActivityIndicator size="small" color={colors.background} /> : (
                                                        <Text style={styles.recommendationBtnPrimaryText}>Uygula</Text>
                                                    )}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.recommendationBtn}
                                                    onPress={() => updateRecommendationDecision(insight.id, "follow")}
                                                    disabled={isUpdating}
                                                    activeOpacity={0.82}
                                                >
                                                    <Text style={styles.recommendationBtnText}>Takip et</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.recommendationBtn}
                                                    onPress={() => updateRecommendationDecision(insight.id, "rejected")}
                                                    disabled={isUpdating}
                                                    activeOpacity={0.82}
                                                >
                                                    <Text style={styles.recommendationBtnText}>Reddet</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}
        </Animated.ScrollView>
        <ActionConfirmModal
            visible={!!pendingApplyInsight}
            title="Koç önerisini uygula?"
            message={pendingApplyInsight ? getPatchPreviewText(pendingApplyInsight) : ""}
            primaryLabel="Onayla"
            secondaryLabel="Vazgeç"
            onPrimary={applyRecommendationPatch}
            onSecondary={() => setPendingApplyInsight(null)}
            onDismiss={() => setPendingApplyInsight(null)}
        />
        <NoticeModal
            visible={!!notice}
            title={notice?.title || ""}
            message={notice?.message || ""}
            onClose={() => setNotice(null)}
        />
        </>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        color: colors.text,
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.bold,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        marginTop: spacing.xs,
    },
    list: {
        gap: spacing.md,
    },
    overviewCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    overviewItem: {
        flex: 1,
        gap: spacing.xs,
    },
    overviewValue: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
    },
    overviewLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    overviewDivider: {
        width: 1,
        height: 36,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
    filterRow: {
        gap: spacing.sm,
        paddingBottom: spacing.md,
    },
    filterChip: {
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    filterChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    filterText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    filterTextActive: {
        color: colors.accent,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    iconBadge: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
    },
    exerciseName: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
    },
    signalType: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        marginTop: 2,
    },
    dateText: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
    },
    bestLine: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    reason: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    advice: {
        color: colors.accent,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    recommendationBox: {
        backgroundColor: colors.accentMuted,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    recommendationHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    recommendationTitleRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    recommendationTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    recommendationMessage: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    recommendationActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    recommendationBtn: {
        minHeight: 34,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
    },
    recommendationBtnPrimary: {
        borderColor: colors.accent,
        backgroundColor: colors.accent,
    },
    recommendationBtnText: {
        color: colors.text,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    recommendationBtnPrimaryText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    decisionPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accent,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.surface,
    },
    decisionText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    emptyCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        alignItems: "center",
        gap: spacing.sm,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        textAlign: "center",
        lineHeight: 20,
    },
});
