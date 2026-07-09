import React from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { borderRadius, fontSize, fontWeight, lineHeight, spacing } from "../constants/theme";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { coachApi } from "../services/api";
import { useScreenEnter } from "../hooks/useScreenEnter";
import AnimatedPressable from "../components/AnimatedPressable";
import { navigateWithFeedback, NavigationFeedbackVariant } from "../utils/navigationFeedback";
import NoticeModal from "../components/NoticeModal";

type SubscriptionTier = "free" | "pro" | "coach_plus";


const getSubscriptionTier = (user: any): SubscriptionTier => {
    const directTier = String(user?.subscriptionTier || "").toLowerCase();
    const settingsTier = String(user?.settings?.subscriptionTier || "").toLowerCase();
    const directStatus = String(user?.subscriptionStatus || "").toLowerCase();
    const settingsStatus = String(user?.settings?.subscriptionStatus || "").toLowerCase();
    const status = directStatus || settingsStatus;
    const expiresAt = user?.settings?.pro_trial_expires_at ? new Date(user.settings.pro_trial_expires_at) : null;
    if (status === "trial" && expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        return "free";
    }
    if (status && status !== "active" && status !== "trial") return "free";
    const tier = directTier || settingsTier;
    return tier === "pro" || tier === "coach_plus" ? tier : "free";
};

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

const getDecisionMeta = (item: any, colors: any) => {
    const flags = Array.isArray(item?.flags) ? item.flags : [];
    if (flags.includes("single_session_regression")) {
        return { label: "Düşüş", icon: "arrow-down-circle-outline" as const, color: colors.error };
    }
    if (flags.includes("plateau_candidate")) {
        return { label: "Plato adayı", icon: "alert-circle-outline" as const, color: colors.warning };
    }
    if (item?.decision === "progress") {
        return { label: "Progress", icon: "trending-up-outline" as const, color: colors.success };
    }
    if (item?.decision === "baseline") {
        return { label: "Baz veri", icon: "flag-outline" as const, color: colors.textMuted };
    }
    return { label: "Takip", icon: "eye-outline" as const, color: colors.textSecondary };
};

const getInsightMeta = (type: string, colors: any) => {
    if (type === "RIR_ADJUSTMENT_CANDIDATE") {
        return { label: "RIR ayarı", icon: "speedometer-outline" as const, color: colors.warning };
    }
    if (type === "VOLUME_REDUCE_CANDIDATE") {
        return { label: "Hacim azalt", icon: "remove-circle-outline" as const, color: colors.warning };
    }
    if (type === "WEIGHT_INCREASE_CANDIDATE") {
        return { label: "Ağırlık artır", icon: "barbell-outline" as const, color: colors.success };
    }
    if (type === "VOLUME_INCREASE_CANDIDATE") {
        return { label: "Set artır", icon: "add-circle-outline" as const, color: colors.success };
    }
    if (type === "REGRESSION_DETECTED") {
        return { label: "Düşüş", icon: "arrow-down-circle-outline" as const, color: colors.error };
    }
    if (type === "PLATEAU_CANDIDATE") {
        return { label: "Plato adayı", icon: "alert-circle-outline" as const, color: colors.warning };
    }
    if (type === "PROGRESS_DETECTED") {
        return { label: "Progress", icon: "trending-up-outline" as const, color: colors.success };
    }
    return { label: "Sinyal", icon: "pulse-outline" as const, color: colors.textSecondary };
};

const formatInsightDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
};

const PRO_WIZARD_USES = 15;

export default function CoachScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const tier = getSubscriptionTier(user);
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { animStyle } = useScreenEnter();
    const { animStyle: heroAnimStyle } = useScreenEnter({ delay: 70 });
    const { animStyle: dashboardAnimStyle } = useScreenEnter({ delay: 140 });
    const { animStyle: flowAnimStyle } = useScreenEnter({ delay: 200 });
    const { animStyle: reportAnimStyle } = useScreenEnter({ delay: 260 });
    const navigateStatic = React.useCallback(
        (screen: keyof RootStackParamList, variant: NavigationFeedbackVariant = "detail") =>
            navigateWithFeedback(() => navigation.navigate(screen as any), { variant }),
        [navigation],
    );
    const isFree = tier === "free";
    const [weeklyReport, setWeeklyReport] = React.useState<any | null>(null);
    const [coachInsights, setCoachInsights] = React.useState<any[]>([]);
    const [reportLoading, setReportLoading] = React.useState(false);
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);
    const coachNarration = weeklyReport?.coachNarration;
    const trialExpiresAt = user?.settings?.pro_trial_expires_at ? new Date(user.settings.pro_trial_expires_at) : null;
    const trialDaysLeft = trialExpiresAt && Number.isFinite(trialExpiresAt.getTime())
        ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - Date.now()) / 86400000))
        : null;
    const freeWizardUsesRemaining = Math.max(0, Number(user?.settings?.free_wizard_uses_remaining ?? 2));
    const proWizardUsesRemaining = Math.max(0, Number(user?.settings?.pro_wizard_uses_remaining ?? PRO_WIZARD_USES));
    const wizardUsesRemaining = isFree ? freeWizardUsesRemaining : proWizardUsesRemaining;
    const exerciseAnalyses = React.useMemo(
        () => Array.isArray(weeklyReport?.exerciseAnalyses) ? weeklyReport.exerciseAnalyses : [],
        [weeklyReport],
    );
    const prioritySignals = React.useMemo(() => {
        const score = (item: any) => {
            const flags = Array.isArray(item?.flags) ? item.flags : [];
            if (flags.includes("single_session_regression")) return 4;
            if (flags.includes("plateau_candidate")) return 3;
            if (item?.decision === "progress") return 2;
            if (item?.decision === "watch") return 1;
            return 0;
        };
        return [...exerciseAnalyses].sort((a, b) => score(b) - score(a)).slice(0, 5);
    }, [exerciseAnalyses]);
    const progressSignals = React.useMemo(
        () => exerciseAnalyses.filter((item: any) => item?.decision === "progress"),
        [exerciseAnalyses],
    );
    const interventionSignals = React.useMemo(
        () => exerciseAnalyses.filter((item: any) => {
            const flags = Array.isArray(item?.flags) ? item.flags : [];
            return flags.includes("rir_adjustment_candidate") ||
                flags.includes("volume_reduce_candidate") ||
                flags.includes("volume_increase_candidate");
        }),
        [exerciseAnalyses],
    );
    const attentionSignals = React.useMemo(
        () => exerciseAnalyses.filter((item: any) => {
            const flags = Array.isArray(item?.flags) ? item.flags : [];
            return flags.includes("plateau_candidate") || flags.includes("single_session_regression");
        }),
        [exerciseAnalyses],
    );

    const loadCoachInsights = React.useCallback(async () => {
        try {
            const response = await coachApi.insights({ limit: 12 });
            setCoachInsights(Array.isArray(response.data?.data) ? response.data.data : []);
        } catch (error) {
            setCoachInsights([]);
        }
    }, []);

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
        loadCoachInsights();
        return () => {
            mounted = false;
        };
    }, [loadCoachInsights]);

    return (
        <>
        <Animated.ScrollView
            style={[styles.container, animStyle]}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <View style={styles.iconBadge}>
                    <MaterialCommunityIcons name="brain" size={30} color={colors.background} />
                </View>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>AKILLI KOÇ</Text>
                    <Text style={styles.title}>Koç</Text>
                    <Text style={styles.subtitle}>
                        {isFree
                            ? "SmartProgress loglarını, programını ve toparlanmanı birlikte okuyup sıradaki en mantıklı adımı gösterecek."
                            : "Logların, programın ve toparlanma sinyallerin üzerinden sıradaki en mantıklı adımı takip et."}
                    </Text>
                </View>
            </View>

            {isFree ? (
                <Animated.View style={[styles.teaserPanel, heroAnimStyle]}>
                    <View style={styles.panelTopRow}>
                        <View>
                            <Text style={styles.panelLabel}>Premium deneme</Text>
                            <Text style={styles.panelTitle}>Akıllı koçu deneyebilirsin</Text>
                        </View>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>{wizardUsesRemaining} wizard hakkı</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        Yeni hesaplarda Premium deneme suresi acik gelir. Deneme bittiyse de iki kez kisisel program wizard'ini kullanabilirsin.
                    </Text>
                    <View style={styles.accessSummaryRow}>
                        <View style={styles.accessSummaryItem}>
                            <Ionicons name="hourglass-outline" size={16} color={colors.accent} />
                            <Text style={styles.accessSummaryText}>
                                {trialDaysLeft !== null && trialDaysLeft > 0 ? `${trialDaysLeft} gün Premium deneme` : "Premium aktif"}
                            </Text>
                        </View>
                        <View style={styles.accessSummaryItem}>
                            <Ionicons name="map-outline" size={16} color={colors.accent} />
                            <Text style={styles.accessSummaryText}>{wizardUsesRemaining} wizard hakkı</Text>
                        </View>
                    </View>
                    <AnimatedPressable
                        style={styles.primaryButton}
                        pressedScale={0.985}
                        onPress={() => navigateStatic("PremiumProgramWizard", "modal")}
                    >
                        <Ionicons name="map-outline" size={18} color={colors.background} />
                        <Text style={styles.primaryButtonText}>Akilli Program Wizard'i Dene</Text>
                    </AnimatedPressable>
                </Animated.View>
            ) : (
                <Animated.View style={[styles.activeHero, heroAnimStyle]}>
                    <View style={styles.panelTopRow}>
                        <View style={styles.activeHeroCopy}>
                            <Text style={styles.panelLabel}>Premium erisimi</Text>
                            <Text style={styles.panelTitle}>Koç takibi aktif</Text>
                        </View>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>{trialDaysLeft !== null && trialDaysLeft > 0 ? `${trialDaysLeft} gün` : "Aktif"}</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        Haftalık raporun, kalıcı sinyallerin ve program wizard'ın buradan yönetilir. Koç otomatik değişiklik yapmaz; yakalar, açıklar ve aksiyon önerir.
                    </Text>
                    <View style={styles.accessSummaryRow}>
                        <View style={styles.accessSummaryItem}>
                            <Ionicons name="map-outline" size={16} color={colors.accent} />
                            <Text style={styles.accessSummaryText}>{wizardUsesRemaining} wizard hakkı</Text>
                        </View>
                        <View style={styles.accessSummaryItem}>
                            <Ionicons name="analytics-outline" size={16} color={colors.accent} />
                            <Text style={styles.accessSummaryText}>Rule engine aktif</Text>
                        </View>
                    </View>
                    <View style={styles.activeHeroActions}>
                        <AnimatedPressable
                            style={[styles.primaryButton, styles.heroPrimaryButton]}
                            pressedScale={0.985}
                            onPress={() => navigateStatic("PremiumProgramWizard", "modal")}
                        >
                            <Ionicons name="map-outline" size={18} color={colors.background} />
                            <Text style={styles.primaryButtonText}>Akıllı Program Wizard'ı Aç</Text>
                        </AnimatedPressable>
                        <AnimatedPressable
                            style={styles.heroSecondaryButton}
                            pressedScale={0.985}
                            onPress={() => navigateStatic("CoachWeeklyReport")}
                        >
                            <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                            <Text style={styles.heroSecondaryText}>Haftalık Rapor</Text>
                        </AnimatedPressable>
                    </View>
                </Animated.View>
            )}

            {(
                <Animated.View style={[styles.section, dashboardAnimStyle]}>
                    <View style={styles.dashboardHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Koç merkezi</Text>
                            <Text style={styles.dashboardSubtitle}>Bu hafta yakalanan sinyaller ve sıradaki aksiyonlar</Text>
                        </View>
                        <View style={styles.coachStatusBadge}>
                            <MaterialCommunityIcons name="brain" size={16} color={colors.background} />
                            <Text style={styles.coachStatusText}>Aktif</Text>
                        </View>
                    </View>
                    <View style={styles.metricGrid}>
                        <MetricTile
                            icon="trending-up-outline"
                            label="Progress"
                            value={weeklyReport?.progressCount ?? progressSignals.length}
                            color={colors.success}
                            colors={colors}
                        />
                        <MetricTile
                            icon="alert-circle-outline"
                            label="Dikkat"
                            value={(weeklyReport?.plateauCount ?? 0) + (weeklyReport?.regressionCount ?? 0) || attentionSignals.length}
                            color={colors.warning}
                            colors={colors}
                        />
                        <MetricTile
                            icon="construct-outline"
                            label="Aksiyon"
                            value={weeklyReport?.interventionCount ?? interventionSignals.length}
                            color={colors.accent}
                            colors={colors}
                        />
                    </View>
                    <AnimatedPressable
                        style={styles.secondaryActionBtn}
                        pressedScale={0.985}
                        onPress={() => navigateStatic("CoachWeeklyReport")}
                    >
                        <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                        <Text style={styles.secondaryActionText}>Haftalık raporu aç</Text>
                    </AnimatedPressable>
                </Animated.View>
            )}

            <Animated.View style={[styles.section, reportAnimStyle]}>
                <Text style={styles.sectionTitle}>Haftalık rapor</Text>
                <View style={styles.reportCard}>
                    <View style={styles.reportTopRow}>
                        <Text style={styles.reportTitle}>{reportLoading ? "Rapor hazırlanıyor" : "Bu hafta"}</Text>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>Aktif</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        {weeklyReport?.summary || "Yeterli log oluşunca bu alan progress, takip ve müdahale sinyallerini gösterecek."}
                    </Text>
                    {!!weeklyReport && (
                        <View style={styles.coachBrief}>
                            <View style={styles.coachBriefIcon}>
                                <MaterialCommunityIcons name="brain" size={22} color={colors.background} />
                            </View>
                            <View style={styles.coachBriefCopy}>
                                <Text style={styles.coachBriefLabel}>Koç okuması</Text>
                                <Text style={styles.coachBriefTitle}>{coachNarration?.headline || "Sinyaller analiz edildi"}</Text>
                                <Text style={styles.coachBriefText}>
                                    Progress, plato ve düşüş yakalandığında aşağıda hareket bazlı sebebiyle birlikte görünür.
                                </Text>
                            </View>
                        </View>
                    )}
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
                                <View style={styles.reportStat}>
                                    <Text style={styles.reportStatValue}>{weeklyReport.plateauCount ?? 0}</Text>
                                    <Text style={styles.reportStatLabel}>Plato</Text>
                                </View>
                                <View style={styles.reportStat}>
                                    <Text style={styles.reportStatValue}>{weeklyReport.regressionCount ?? 0}</Text>
                                    <Text style={styles.reportStatLabel}>Düşüş</Text>
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
                                    {(coachNarration.cautions || []).slice(0, 2).map((item: string) => (
                                        <View key={`caution-${item}`} style={styles.narrationItem}>
                                            <Ionicons name="warning-outline" size={16} color={colors.warning || colors.accent} />
                                            <Text style={styles.narrationItemText}>{item}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {prioritySignals.length > 0 && (
                                <View style={styles.signalStack}>
                                    <View style={styles.signalHeader}>
                                        <Text style={styles.reportTitle}>Koçun yakaladığı sinyaller</Text>
                                        <Text style={styles.answerMeta}>Öncelik sırasıyla</Text>
                                    </View>
                                    {prioritySignals.map((item: any, index: number) => {
                                        const meta = getDecisionMeta(item, colors);
                                        return (
                                            <View key={`${item.exerciseName}-${index}`} style={styles.signalCard}>
                                                <View style={[styles.signalIcon, { borderColor: meta.color, backgroundColor: `${meta.color}1A` }]}>
                                                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                                                </View>
                                                <View style={styles.signalCopy}>
                                                    <View style={styles.signalTitleRow}>
                                                        <Text style={styles.signalTitle}>{item.exerciseName}</Text>
                                                        <Text style={[styles.signalBadge, { color: meta.color }]}>{meta.label}</Text>
                                                    </View>
                                                    <Text style={styles.signalMeta}>
                                                        {formatBestSet(item.previousBest)} {"->"} {formatBestSet(item.currentBest)}
                                                    </Text>
                                                    <Text style={styles.signalReason}>{item.reason}</Text>
                                                    {!!item.interventionAdvice && (
                                                        <Text style={styles.interventionText}>{item.interventionAdvice}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                            <AnimatedPressable
                                style={styles.secondaryActionBtn}
                                pressedScale={0.985}
                                onPress={() => navigateStatic("CoachWeeklyReport")}
                            >
                                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                                <Text style={styles.secondaryActionText}>Detaylı haftalık raporu aç</Text>
                            </AnimatedPressable>
                        </>
                    )}
                </View>
            </Animated.View>

            {coachInsights.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.reportTopRow}>
                        <Text style={styles.sectionTitle}>Son koç sinyalleri</Text>
                        <TouchableOpacity style={styles.viewAllSignalsBtn} onPress={() => navigateStatic("CoachInsightHistory")} activeOpacity={0.82}>
                            <Text style={styles.viewAllSignalsText}>Tumunu gor</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.timelineCard}>
                        {coachInsights.slice(0, 3).map((insight, index) => {
                            const meta = getInsightMeta(insight.type, colors);
                            return (
                                <View key={insight.id} style={styles.timelineItem}>
                                    <View style={styles.timelineRail}>
                                        <View style={[styles.timelineDot, { backgroundColor: meta.color }]} />
                                        {index < Math.min(coachInsights.length, 3) - 1 && <View style={styles.timelineLine} />}
                                    </View>
                                    <View style={styles.timelineBody}>
                                        <View style={styles.signalTitleRow}>
                                            <Text style={styles.signalTitle}>{insight.exerciseName}</Text>
                                            <Text style={[styles.signalBadge, { color: meta.color }]}>{meta.label}</Text>
                                        </View>
                                        <Text style={styles.signalMeta}>
                                            {formatBestSet(insight.previousBest)} {"->"} {formatBestSet(insight.currentBest)}
                                        </Text>
                                        <Text style={styles.signalReason} numberOfLines={1}>{insight.reason}</Text>
                                        {!!insight.metadata?.interventionAdvice && (
                                            <Text style={styles.interventionText}>{insight.metadata.interventionAdvice}</Text>
                                        )}
                                        <Text style={styles.answerMeta}>{formatInsightDate(insight.signalDate)}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Akilli Program Wizard</Text>
                {isFree ? (
                    <Animated.View style={[styles.wizardHeroPanel, heroAnimStyle]}>
                        <View style={styles.panelTopRow}>
                            <View>
                                <Text style={styles.panelLabel}>Premium deneme</Text>
                                <Text style={styles.panelTitle}>Akilli kocu deneyebilirsin</Text>
                            </View>
                            <View style={styles.statusPill}>
                                <Text style={styles.statusText}>{wizardUsesRemaining} wizard hakki</Text>
                            </View>
                        </View>
                        <Text style={styles.panelText}>
                            Yeni hesaplarda Premium deneme suresi acik gelir. Deneme bittiyse de iki kez kisisel program wizard'ini kullanabilirsin.
                        </Text>
                        <View style={styles.accessSummaryRow}>
                            <View style={styles.accessSummaryItem}>
                                <Ionicons name="hourglass-outline" size={16} color={colors.accent} />
                                <Text style={styles.accessSummaryText}>
                                    {trialDaysLeft !== null && trialDaysLeft > 0 ? `${trialDaysLeft} gun Premium deneme` : "Premium aktif"}
                                </Text>
                            </View>
                            <View style={styles.accessSummaryItem}>
                                <Ionicons name="map-outline" size={16} color={colors.accent} />
                                <Text style={styles.accessSummaryText}>{wizardUsesRemaining} wizard hakki</Text>
                            </View>
                        </View>
                        <AnimatedPressable
                            style={styles.primaryButton}
                            pressedScale={0.985}
                            onPress={() => navigateStatic("PremiumProgramWizard", "modal")}
                        >
                            <Ionicons name="map-outline" size={18} color={colors.background} />
                            <Text style={styles.primaryButtonText}>Akilli Program Wizard'i Dene</Text>
                        </AnimatedPressable>
                    </Animated.View>
                ) : (
                    <Animated.View style={[styles.wizardHeroPanel, heroAnimStyle]}>
                        <View style={styles.panelTopRow}>
                            <View style={styles.activeHeroCopy}>
                                <Text style={styles.panelLabel}>Premium erisimi</Text>
                                <Text style={styles.panelTitle}>Koc takibi aktif</Text>
                            </View>
                            <View style={styles.statusPill}>
                                <Text style={styles.statusText}>{trialDaysLeft !== null && trialDaysLeft > 0 ? `${trialDaysLeft} gun` : "Aktif"}</Text>
                            </View>
                        </View>
                        <Text style={styles.panelText}>
                            Haftalik raporun, kalici sinyallerin ve program wizard'in buradan yonetilir. Koc otomatik degisiklik yapmaz; yakalar, aciklar ve aksiyon onerir.
                        </Text>
                        <View style={styles.accessSummaryRow}>
                            <View style={styles.accessSummaryItem}>
                                <Ionicons name="map-outline" size={16} color={colors.accent} />
                                <Text style={styles.accessSummaryText}>{wizardUsesRemaining} wizard hakki</Text>
                            </View>
                            <View style={styles.accessSummaryItem}>
                                <Ionicons name="analytics-outline" size={16} color={colors.accent} />
                                <Text style={styles.accessSummaryText}>Rule engine aktif</Text>
                            </View>
                        </View>
                        <View style={styles.activeHeroActions}>
                            <AnimatedPressable
                                style={[styles.primaryButton, styles.heroPrimaryButton]}
                                pressedScale={0.985}
                                onPress={() => navigateStatic("PremiumProgramWizard", "modal")}
                            >
                                <Ionicons name="map-outline" size={18} color={colors.background} />
                                <Text style={styles.primaryButtonText}>Akilli Program Wizard'i Ac</Text>
                            </AnimatedPressable>
                            <AnimatedPressable
                                style={styles.heroSecondaryButton}
                                pressedScale={0.985}
                                onPress={() => navigateStatic("CoachWeeklyReport")}
                            >
                                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                                <Text style={styles.heroSecondaryText}>Haftalik Rapor</Text>
                            </AnimatedPressable>
                        </View>
                    </Animated.View>
                )}
            </View>

            <View style={styles.compareSection}>
                <View style={styles.dashboardHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Paket bilgisi</Text>
                    </View>
                </View>
                <View style={styles.planGrid}>
                    <PlanCard
                        title="Premium"
                        subtitle="Akıllı Koç Motoru"
                        badge="Rule engine"
                        icon="analytics-outline"
                        items={[
                            "Program wizard ve kişisel split kurulumu",
                            "Haftalık progress, plato ve düşüş raporu",
                            "RIR, hacim azaltma ve set artırma adayları",
                            "Otomatik değişiklik yok; karar kullanıcıda",
                        ]}
                        colors={colors}
                        active={tier === "pro"}
                        highlighted
                        onPress={() => navigateStatic("PremiumDetail")}
                    />
                    <PlanCard
                        title="Coach+"
                        subtitle="Yakinda"
                        badge="Yakinda"
                        icon="sparkles-outline"
                        items={[]}
                        colors={colors}
                        active={false}
                    />
                </View>
            </View>

            {isFree ? (
                <Animated.View style={[styles.section, flowAnimStyle]}>
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
                </Animated.View>
            ) : (
                <Animated.View style={[styles.section, flowAnimStyle]}>
                    <Text style={styles.sectionTitle}>Koç akışı</Text>
                    <FeatureRow
                        icon="analytics-outline"
                        title="Logları oku"
                        description="Çalışma setlerinden en iyi performansı çıkarır; ısınma ve süre setlerini progress hesabına karıştırmaz."
                        colors={colors}
                    />
                    <FeatureRow
                        icon="git-compare-outline"
                        title="Önceki seansla kıyasla"
                        description="Ağırlık, tekrar ve RIR sinyalini hareket bazlı okuyup progress, düşüş veya plato adayını ayırır."
                        colors={colors}
                    />
                    <FeatureRow
                        icon="construct-outline"
                        title="Aksiyon öner"
                        description="RIR rahatlatma, hacim azaltma veya set artırma adaylarını kullanıcı onayına bırakır."
                        colors={colors}
                    />
                </Animated.View>
            )}

            <View style={styles.noteBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
                <Text style={styles.noteText}>
                    Program değişiklikleri otomatik uygulanmayacak. Koç önerir, son kararı sen verirsin.
                </Text>
            </View>
        </Animated.ScrollView>
        <NoticeModal
            visible={!!notice}
            title={notice?.title || ""}
            message={notice?.message || ""}
            onClose={() => setNotice(null)}
        />
        </>
    );
}

function MetricTile({
    icon,
    label,
    value,
    color,
    colors,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    value: number;
    color: string;
    colors: any;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.metricTile}>
            <View style={[styles.metricIcon, { backgroundColor: `${color}1A`, borderColor: color }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
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
    badge,
    icon,
    items,
    colors,
    active = false,
    highlighted = false,
    onPress,
}: {
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    items: string[];
    colors: any;
    active?: boolean;
    highlighted?: boolean;
    onPress?: () => void;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const content = (
        <>
            <View style={styles.planHeader}>
                <View style={[styles.planIcon, highlighted && styles.planIconHighlighted]}>
                    <Ionicons name={icon} size={19} color={highlighted ? colors.background : colors.accent} />
                </View>
                <View style={styles.planHeaderCopy}>
                    <Text style={styles.planTitle}>{title}</Text>
                    <Text style={styles.planSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <View style={styles.planBadgeRow}>
                <View style={[styles.planBadge, highlighted && styles.planBadgeHighlighted]}>
                    <Text style={[styles.planBadgeText, highlighted && styles.planBadgeTextHighlighted]}>{badge}</Text>
                </View>
                {active && (
                    <View style={styles.activePlanBadge}>
                        <Text style={styles.activePlanText}>Aktif</Text>
                    </View>
                )}
            </View>
            <View style={styles.planItems}>
                {items.map((item) => (
                    <View key={item} style={styles.planItem}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                        <Text style={styles.planItemText}>{item}</Text>
                    </View>
                ))}
            </View>
        </>
    );

    if (onPress) {
        return (
            <AnimatedPressable style={[styles.planCard, highlighted && styles.planCardHighlighted]} onPress={onPress} pressedScale={0.985}>
                {content}
            </AnimatedPressable>
        );
    }

    return (
        <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
            {content}
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
        paddingTop: spacing.lg,
        paddingBottom: 80,
        gap: spacing.xl,
    },
    header: {
        flexDirection: "row",
        gap: spacing.md,
        alignItems: "center",
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 16,
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
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: lineHeight.sm,
    },
    teaserPanel: {
        display: "none",
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
    },
    activeHero: {
        display: "none",
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderLight || colors.border,
        padding: spacing.xl,
        gap: spacing.md,
    },
    wizardHeroPanel: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderLight || colors.border,
        padding: spacing.xl,
        gap: spacing.md,
    },
    activeHeroCopy: {
        flex: 1,
    },
    activeHeroActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        alignItems: "center",
    },
    heroPrimaryButton: {
        flex: 1,
        minWidth: 190,
    },
    heroSecondaryButton: {
        display: "none",
        flex: 1,
        minWidth: 150,
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xs,
    },
    heroSecondaryText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
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
        lineHeight: lineHeight.sm,
    },
    accessSummaryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    accessSummaryItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    accessSummaryText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
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
    disabledButton: {
        opacity: 0.55,
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
    dashboardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
    },
    dashboardSubtitle: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        lineHeight: lineHeight.sm,
        marginTop: spacing.xs,
    },
    coachStatusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    coachStatusText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    metricGrid: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    metricTile: {
        flex: 1,
        minHeight: 108,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        justifyContent: "space-between",
    },
    metricIcon: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    metricValue: {
        color: colors.text,
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
    },
    metricLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
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
        lineHeight: lineHeight.sm,
    },
    planGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
    },
    planCard: {
        flex: 1,
        minWidth: 260,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    planCardHighlighted: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    planHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    planIcon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    planIconHighlighted: {
        backgroundColor: colors.accent,
    },
    planHeaderCopy: {
        flex: 1,
        gap: spacing.xs,
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
    planBadgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    planBadge: {
        alignSelf: "flex-start",
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    planBadgeHighlighted: {
        borderColor: colors.accent,
        backgroundColor: colors.background,
    },
    planBadgeText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    planBadgeTextHighlighted: {
        color: colors.accent,
    },
    activePlanBadge: {
        alignSelf: "flex-start",
        borderRadius: borderRadius.full,
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    activePlanText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
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
        lineHeight: lineHeight.sm,
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
        lineHeight: lineHeight.sm,
    },
    pricingNote: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    coachBrief: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    coachBriefIcon: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    coachBriefCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    coachBriefLabel: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    coachBriefTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    coachBriefText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: lineHeight.sm,
    },
    reportCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    askCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    askHeaderCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    askInput: {
        minHeight: 98,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.text,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.sm,
        textAlignVertical: "top",
        lineHeight: lineHeight.sm,
    },
    answerBox: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.sm,
    },
    answerMeta: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    viewAllSignalsBtn: {
        minHeight: 34,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },
    viewAllSignalsText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.heavy,
    },
    lockedCoachCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    lockedIcon: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
    },
    lockedCopy: {
        flex: 1,
        gap: spacing.sm,
    },
    lockedFeatures: {
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    messageHistory: {
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    messageItem: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.xs,
    },
    messageQuestion: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        lineHeight: lineHeight.sm,
    },
    messageAnswer: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: lineHeight.sm,
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
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    reportStat: {
        flex: 1,
        minWidth: 92,
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
        lineHeight: lineHeight.sm,
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
        lineHeight: lineHeight.sm,
    },
    signalStack: {
        gap: spacing.sm,
    },
    signalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
    },
    signalCard: {
        flexDirection: "row",
        gap: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
    },
    signalIcon: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    signalCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    signalTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    signalTitle: {
        flex: 1,
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    signalBadge: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    signalMeta: {
        color: colors.text,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    signalReason: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: lineHeight.sm,
    },
    interventionText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        lineHeight: lineHeight.sm,
        fontWeight: fontWeight.semibold,
    },
    secondaryActionBtn: {
        minHeight: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    secondaryActionText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    timelineCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    timelineItem: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: spacing.md,
    },
    timelineRail: {
        width: 18,
        alignItems: "center",
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
    },
    timelineLine: {
        flex: 1,
        width: 1,
        backgroundColor: colors.border,
        marginTop: spacing.xs,
    },
    timelineBody: {
        flex: 1,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.xs,
    },
});
