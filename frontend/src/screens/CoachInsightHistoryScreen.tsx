import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { coachApi } from "../services/api";

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

export default function CoachInsightHistoryScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [loading, setLoading] = React.useState(true);
    const [insights, setInsights] = React.useState<any[]>([]);

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

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Koç Sinyal Geçmişi</Text>
                    <Text style={styles.subtitle}>Eski progress, plato ve müdahale adayları burada kalır.</Text>
                </View>
            </View>

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
            ) : (
                <View style={styles.list}>
                    {insights.map((insight) => {
                        const meta = getMeta(insight.type, colors);
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
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
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
