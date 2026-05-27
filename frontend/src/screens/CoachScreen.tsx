import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { coachApi } from "../services/api";

type SubscriptionTier = "free" | "pro" | "coach_plus";

const getSubscriptionTier = (user: any): SubscriptionTier => {
    const directTier = String(user?.subscriptionTier || "").toLowerCase();
    const settingsTier = String(user?.settings?.subscriptionTier || "").toLowerCase();
    const tier = directTier || settingsTier;
    return tier === "pro" || tier === "coach_plus" ? tier : "free";
};

export default function CoachScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const tier = getSubscriptionTier(user);
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const isFree = tier === "free";
    const isCoachPlus = tier === "coach_plus";
    const [weeklyReport, setWeeklyReport] = React.useState<any | null>(null);
    const [reportLoading, setReportLoading] = React.useState(false);
    const coachNarration = weeklyReport?.coachNarration;

    React.useEffect(() => {
        let mounted = true;
        const loadReport = async () => {
            setReportLoading(true);
            try {
                const response = await coachApi.weeklyReport();
                if (mounted) setWeeklyReport(response.data?.data || null);
            } catch (error) {
                if (mounted) setWeeklyReport(null);
            } finally {
                if (mounted) setReportLoading(false);
            }
        };
        loadReport();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <View style={styles.iconBadge}>
                    <Ionicons name="pulse" size={28} color={colors.background} />
                </View>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>{isCoachPlus ? "AI KOÇ" : "AKILLI KOÇ"}</Text>
                    <Text style={styles.title}>Koç</Text>
                    <Text style={styles.subtitle}>
                        SmartProgress yakında loglarını, programını ve toparlanmanı birlikte okuyup sıradaki en mantıklı adımı gösterecek.
                    </Text>
                </View>
            </View>

            {isFree ? (
                <View style={styles.teaserPanel}>
                    <View style={styles.panelTopRow}>
                        <View>
                            <Text style={styles.panelLabel}>Premium hazırlığı</Text>
                            <Text style={styles.panelTitle}>Pro ve Coach+ yakında</Text>
                        </View>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>Yakında</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        İlk sürümde hedefimiz sohbet botu değil; programını takip eden, progress ve plato sinyallerini açıklayan kontrollü bir koç sistemi kurmak.
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("PremiumProgramWizard")}
                    >
                        <Ionicons name="map-outline" size={18} color={colors.background} />
                        <Text style={styles.primaryButtonText}>Akilli Program Wizard'i Dene</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.teaserPanel}>
                    <View style={styles.panelTopRow}>
                        <View>
                            <Text style={styles.panelLabel}>{isCoachPlus ? "Coach+ erişimi" : "Pro erişimi"}</Text>
                            <Text style={styles.panelTitle}>Koç altyapısı hazırlanıyor</Text>
                        </View>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>Aktif</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        Bu alan premium wizard, haftalık raporlar ve bekleyen koç kararları için ana merkez olacak.
                    </Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("PremiumProgramWizard")}
                    >
                        <Ionicons name="map-outline" size={18} color={colors.background} />
                        <Text style={styles.primaryButtonText}>Akilli Program Wizard'i Ac</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Neler gelecek?</Text>
                <FeatureRow
                    icon="map-outline"
                    title="Kişisel program wizard"
                    description="Seviye, frekans, ağrı durumu ve öncelikli kaslarına göre program kurulum akışı."
                    colors={colors}
                />
                <FeatureRow
                    icon="trending-up-outline"
                    title="Progress ve plato takibi"
                    description="Kilo, tekrar, RIR ve log düzenine göre takipte veya müdahale adayı olan hareketler."
                    colors={colors}
                />
                <FeatureRow
                    icon="document-text-outline"
                    title="Haftalık koç raporu"
                    description="Yeterli log varsa haftanın en iyi progress'i, takipteki hareketler ve gelecek hedefler."
                    colors={colors}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Haftalık rapor</Text>
                <View style={styles.reportCard}>
                    <View style={styles.reportTopRow}>
                        <Text style={styles.reportTitle}>{reportLoading ? "Rapor hazırlanıyor" : "Bu hafta"}</Text>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>Beta</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        {weeklyReport?.summary || "Yeterli log oluşunca bu alan progress, takip ve müdahale sinyallerini gösterecek."}
                    </Text>
                    {!!weeklyReport && (
                        <>
                            <View style={styles.reportStats}>
                                <View style={styles.reportStat}>
                                    <Text style={styles.reportStatValue}>{weeklyReport.workoutCount ?? 0}</Text>
                                    <Text style={styles.reportStatLabel}>Antrenman</Text>
                                </View>
                                <View style={styles.reportStat}>
                                    <Text style={styles.reportStatValue}>{weeklyReport.progressCount ?? 0}</Text>
                                    <Text style={styles.reportStatLabel}>Progress</Text>
                                </View>
                                <View style={styles.reportStat}>
                                    <Text style={styles.reportStatValue}>{weeklyReport.watchCount ?? 0}</Text>
                                    <Text style={styles.reportStatLabel}>Takip</Text>
                                </View>
                            </View>
                            {!!coachNarration && (
                                <View style={styles.narrationBox}>
                                    <View style={styles.narrationHeader}>
                                        <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
                                        <Text style={styles.narrationTitle}>{coachNarration.headline}</Text>
                                    </View>
                                    <Text style={styles.narrationSummary}>{coachNarration.summary}</Text>
                                    {(coachNarration.highlights || []).slice(0, 3).map((item: string) => (
                                        <View key={`highlight-${item}`} style={styles.narrationItem}>
                                            <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
                                            <Text style={styles.narrationItemText}>{item}</Text>
                                        </View>
                                    ))}
                                    {(coachNarration.nextActions || []).slice(0, 2).map((item: string) => (
                                        <View key={`action-${item}`} style={styles.narrationItem}>
                                            <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.textMuted} />
                                            <Text style={styles.narrationItemText}>{item}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </View>
            </View>

            <View style={styles.compareSection}>
                <Text style={styles.sectionTitle}>Paket farkı</Text>
                <View style={styles.planGrid}>
                    <PlanCard
                        title="Pro"
                        subtitle="Akıllı Koç"
                        items={["Program analizi", "Haftalık rapor", "Bekleyen kararlar"]}
                        colors={colors}
                    />
                    <PlanCard
                        title="Coach+"
                        subtitle="AI Koç"
                        items={["Pro özellikleri", "AI soru hakkı", "Detaylı açıklamalar"]}
                        colors={colors}
                        highlighted
                    />
                </View>
            </View>

            <View style={styles.noteBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
                <Text style={styles.noteText}>
                    Program değişiklikleri otomatik uygulanmayacak. Koç önerir, son kararı sen verirsin.
                </Text>
            </View>
        </ScrollView>
    );
}

function FeatureRow({
    icon,
    title,
    description,
    colors,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    description: string;
    colors: any;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
                <Ionicons name={icon} size={20} color={colors.accent} />
            </View>
            <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </View>
    );
}

function PlanCard({
    title,
    subtitle,
    items,
    colors,
    highlighted = false,
}: {
    title: string;
    subtitle: string;
    items: string[];
    colors: any;
    highlighted?: boolean;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
            <Text style={styles.planTitle}>{title}</Text>
            <Text style={styles.planSubtitle}>{subtitle}</Text>
            <View style={styles.planItems}>
                {items.map((item) => (
                    <View key={item} style={styles.planItem}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                        <Text style={styles.planItemText}>{item}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.xl,
        paddingTop: 56,
        paddingBottom: 110,
        gap: spacing.xl,
    },
    header: {
        flexDirection: "row",
        gap: spacing.md,
        alignItems: "center",
    },
    iconBadge: {
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    headerCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    eyebrow: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        letterSpacing: 1,
    },
    title: {
        color: colors.text,
        fontSize: fontSize.xxxl,
        fontWeight: fontWeight.heavy,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    teaserPanel: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
    },
    panelTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing.md,
    },
    panelLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        marginBottom: spacing.xs,
    },
    panelTitle: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
    },
    statusPill: {
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    statusText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    panelText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 21,
    },
    primaryButton: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xs,
    },
    primaryButtonText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    section: {
        gap: spacing.md,
    },
    compareSection: {
        gap: spacing.md,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    featureIcon: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
    },
    featureCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    featureTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    featureDescription: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    planGrid: {
        flexDirection: "row",
        gap: spacing.md,
    },
    planCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    planCardHighlighted: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    planTitle: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
    },
    planSubtitle: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    planItems: {
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    planItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    planItemText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 16,
    },
    noteBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    noteText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    reportCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    reportTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
    },
    reportTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    reportStats: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    reportStat: {
        flex: 1,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.xs,
    },
    reportStatValue: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.heavy,
    },
    reportStatLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    narrationBox: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.sm,
    },
    narrationHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    narrationTitle: {
        flex: 1,
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    narrationSummary: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    narrationItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
    },
    narrationItemText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 18,
    },
});
