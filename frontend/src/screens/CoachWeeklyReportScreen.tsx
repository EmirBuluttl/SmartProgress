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
    return `${set.weight ?? 0} kg x ${set.reps ?? 0}${rir}`;
};

const getMeta = (item: any, colors: any) => {
    const flags = Array.isArray(item?.flags) ? item.flags : [];
    if (flags.includes("rir_adjustment_candidate")) return { label: "RIR ayarı", icon: "speedometer-outline" as const, color: colors.warning || "#F5A524" };
    if (flags.includes("volume_reduce_candidate")) return { label: "Hacim azalt", icon: "remove-circle-outline" as const, color: colors.warning || "#F5A524" };
    if (flags.includes("weight_increase_candidate")) return { label: "Ağırlık artır", icon: "barbell-outline" as const, color: PROGRESS_GREEN };
    if (flags.includes("volume_increase_candidate")) return { label: "Set artır", icon: "add-circle-outline" as const, color: PROGRESS_GREEN };
    if (flags.includes("single_session_regression")) return { label: "Düşüş", icon: "arrow-down-circle-outline" as const, color: colors.danger || "#FF4D4D" };
    if (flags.includes("plateau_candidate")) return { label: "Plato adayı", icon: "alert-circle-outline" as const, color: colors.warning || "#F5A524" };
    if (item?.decision === "progress") return { label: "Progress", icon: "trending-up-outline" as const, color: PROGRESS_GREEN };
    if (item?.decision === "baseline") return { label: "Baz veri", icon: "flag-outline" as const, color: colors.textMuted };
    return { label: "Takip", icon: "eye-outline" as const, color: colors.textSecondary };
};

export default function CoachWeeklyReportScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [loading, setLoading] = React.useState(true);
    const [report, setReport] = React.useState<any | null>(null);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const response = await coachApi.weeklyReport();
                if (mounted) setReport(response.data?.data || null);
            } catch (error) {
                if (mounted) setReport(null);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const analyses = Array.isArray(report?.exerciseAnalyses) ? report.exerciseAnalyses : [];
    const progressItems = analyses.filter((item: any) => item.decision === "progress");
    const plateauItems = analyses.filter((item: any) => item.flags?.includes("plateau_candidate"));
    const regressionItems = analyses.filter((item: any) => item.flags?.includes("single_session_regression"));
    const interventionItems = analyses.filter((item: any) =>
        item.flags?.includes("rir_adjustment_candidate") ||
        item.flags?.includes("volume_reduce_candidate") ||
        item.flags?.includes("weight_increase_candidate") ||
        item.flags?.includes("volume_increase_candidate"),
    );
    const watchItems = analyses.filter((item: any) => item.decision === "watch" && !item.flags?.includes("plateau_candidate") && !item.flags?.includes("single_session_regression"));

    const renderGroup = (title: string, items: any[]) => {
        if (items.length === 0) return null;
        return (
            <View style={styles.group}>
                <Text style={styles.groupTitle}>{title}</Text>
                {items.map((item, index) => {
                    const meta = getMeta(item, colors);
                    return (
                        <View key={`${title}-${item.exerciseName}-${index}`} style={styles.signalCard}>
                            <View style={[styles.signalIcon, { borderColor: meta.color, backgroundColor: `${meta.color}1A` }]}>
                                <Ionicons name={meta.icon} size={20} color={meta.color} />
                            </View>
                            <View style={styles.signalCopy}>
                                <View style={styles.signalTitleRow}>
                                    <Text style={styles.signalTitle}>{item.exerciseName}</Text>
                                    <Text style={[styles.signalBadge, { color: meta.color }]}>{meta.label}</Text>
                                </View>
                                <Text style={styles.signalMeta}>{formatBestSet(item.previousBest)} {"->"} {formatBestSet(item.currentBest)}</Text>
                                <Text style={styles.signalReason}>{item.reason}</Text>
                                {!!item.interventionAdvice && (
                                    <Text style={styles.interventionText}>{item.interventionAdvice}</Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>COACH REPORT</Text>
                    <Text style={styles.title}>Haftalık Rapor</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingCard}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.mutedText}>Rapor hazırlanıyor</Text>
                </View>
            ) : (
                <>
                    <View style={styles.heroCard}>
                        <View style={styles.heroTopRow}>
                            <View style={styles.reportMark}>
                                <Ionicons name="sparkles-outline" size={20} color={colors.background} />
                            </View>
                            <View style={styles.heroCopy}>
                                <Text style={styles.eyebrow}>WEEKLY INTELLIGENCE</Text>
                                <Text style={styles.heroTitle}>{report?.coachNarration?.headline || "Bu haftanın özeti"}</Text>
                            </View>
                        </View>
                        <Text style={styles.heroText}>{report?.coachNarration?.summary || report?.summary || "Bu hafta için rapor verisi yok."}</Text>
                        <View style={styles.statGrid}>
                            <Stat label="Antrenman" value={report?.workoutCount ?? 0} styles={styles} />
                            <Stat label="Progress" value={report?.progressCount ?? 0} styles={styles} />
                            <Stat label="Plato" value={report?.plateauCount ?? 0} styles={styles} />
                            <Stat label="Düşüş" value={report?.regressionCount ?? 0} styles={styles} />
                            <Stat label="Müdahale" value={report?.interventionCount ?? 0} styles={styles} />
                        </View>
                        {!!report?.coachNarration?.nextActions?.length && (
                            <View style={styles.actionPanel}>
                                <Text style={styles.actionPanelTitle}>Sıradaki koç aksiyonları</Text>
                                {report.coachNarration.nextActions.slice(0, 3).map((item: string) => (
                                    <View key={item} style={styles.actionRow}>
                                        <Ionicons name="arrow-forward-circle-outline" size={17} color={colors.accent} />
                                        <Text style={styles.actionText}>{item}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {renderGroup("Müdahale adayları", interventionItems)}
                    {renderGroup("Progress yakalanan hareketler", progressItems)}
                    {renderGroup("Plato adayları", plateauItems)}
                    {renderGroup("Düşüş sinyalleri", regressionItems)}
                    {renderGroup("Takipte kalacaklar", watchItems)}

                    {analyses.length === 0 && (
                        <View style={styles.loadingCard}>
                            <Text style={styles.mutedText}>Bu hafta hareket bazlı analiz üretmek için yeterli log yok.</Text>
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

function Stat({ label, value, styles }: { label: string; value: number; styles: any }) {
    return (
        <View style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 110, gap: spacing.xl },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    headerCopy: { flex: 1, gap: spacing.xs },
    eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    title: { color: colors.text, fontSize: fontSize.xxxl, fontWeight: fontWeight.heavy },
    heroCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
    },
    heroTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    reportMark: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    heroCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    heroTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    heroText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 21 },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    statCard: {
        flex: 1,
        minWidth: 120,
        backgroundColor: colors.background,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.xs,
    },
    statValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    statLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    actionPanel: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.sm,
    },
    actionPanelTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
    },
    actionText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    group: { gap: spacing.md },
    groupTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    signalCard: {
        flexDirection: "row",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    signalIcon: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    signalCopy: { flex: 1, gap: spacing.xs },
    signalTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    signalTitle: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    signalBadge: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    signalMeta: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    signalReason: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    interventionText: { color: colors.accent, fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold },
    loadingCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        alignItems: "center",
        gap: spacing.md,
    },
    mutedText: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: "center" },
});
