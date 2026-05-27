import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { coachApi } from "../services/api";

type SubscriptionTier = "free" | "pro" | "coach_plus";
const PROGRESS_GREEN = "#22C55E";

const getSubscriptionTier = (user: any): SubscriptionTier => {
    const directTier = String(user?.subscriptionTier || "").toLowerCase();
    const settingsTier = String(user?.settings?.subscriptionTier || "").toLowerCase();
    const tier = directTier || settingsTier;
    return tier === "pro" || tier === "coach_plus" ? tier : "free";
};

const formatBestSet = (set?: any) => {
    if (!set) return "Baz yok";
    const rir = set.rir !== null && set.rir !== undefined && String(set.rir).trim() ? ` · RIR ${set.rir}` : "";
    return `${set.weight ?? 0} kg x ${set.reps ?? 0}${rir}`;
};

const getDecisionMeta = (item: any, colors: any) => {
    const flags = Array.isArray(item?.flags) ? item.flags : [];
    if (flags.includes("single_session_regression")) {
        return { label: "Düşüş", icon: "arrow-down-circle-outline" as const, color: colors.danger || "#FF4D4D" };
    }
    if (flags.includes("plateau_candidate")) {
        return { label: "Plato adayı", icon: "alert-circle-outline" as const, color: colors.warning || "#F5A524" };
    }
    if (item?.decision === "progress") {
        return { label: "Progress", icon: "trending-up-outline" as const, color: PROGRESS_GREEN };
    }
    if (item?.decision === "baseline") {
        return { label: "Baz veri", icon: "flag-outline" as const, color: colors.textMuted };
    }
    return { label: "Takip", icon: "eye-outline" as const, color: colors.textSecondary };
};

const getInsightMeta = (type: string, colors: any) => {
    if (type === "RIR_ADJUSTMENT_CANDIDATE") {
        return { label: "RIR ayarı", icon: "speedometer-outline" as const, color: colors.warning || "#F5A524" };
    }
    if (type === "VOLUME_REDUCE_CANDIDATE") {
        return { label: "Hacim azalt", icon: "remove-circle-outline" as const, color: colors.warning || "#F5A524" };
    }
    if (type === "VOLUME_INCREASE_CANDIDATE") {
        return { label: "Set artır", icon: "add-circle-outline" as const, color: PROGRESS_GREEN };
    }
    if (type === "REGRESSION_DETECTED") {
        return { label: "Düşüş", icon: "arrow-down-circle-outline" as const, color: colors.danger || "#FF4D4D" };
    }
    if (type === "PLATEAU_CANDIDATE") {
        return { label: "Plato adayı", icon: "alert-circle-outline" as const, color: colors.warning || "#F5A524" };
    }
    if (type === "PROGRESS_DETECTED") {
        return { label: "Progress", icon: "trending-up-outline" as const, color: PROGRESS_GREEN };
    }
    return { label: "Sinyal", icon: "pulse-outline" as const, color: colors.textSecondary };
};

const formatInsightDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
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
    const [coachInsights, setCoachInsights] = React.useState<any[]>([]);
    const [aiStatus, setAiStatus] = React.useState<any | null>(null);
    const [aiMessages, setAiMessages] = React.useState<any[]>([]);
    const [coachQuestion, setCoachQuestion] = React.useState("");
    const [coachAnswer, setCoachAnswer] = React.useState<any | null>(null);
    const [reportLoading, setReportLoading] = React.useState(false);
    const [askLoading, setAskLoading] = React.useState(false);
    const coachNarration = weeklyReport?.coachNarration;
    const coachChatLimit = aiStatus?.coachChat?.limit || 0;
    const coachChatUsed = aiStatus?.coachChat?.used || 0;
    const coachChatRemaining = aiStatus?.coachChat?.remaining || 0;
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

    const loadAiStatus = React.useCallback(async () => {
        if (!isCoachPlus) return;
        try {
            const response = await coachApi.aiStatus();
            setAiStatus(response.data || null);
        } catch (error) {
            setAiStatus(null);
        }
    }, [isCoachPlus]);

    const loadAiMessages = React.useCallback(async () => {
        if (!isCoachPlus) return;
        try {
            const response = await coachApi.aiMessages({ limit: 5 });
            setAiMessages(Array.isArray(response.data?.data) ? response.data.data : []);
        } catch (error) {
            setAiMessages([]);
        }
    }, [isCoachPlus]);

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
        loadAiStatus();
        loadAiMessages();
        return () => {
            mounted = false;
        };
    }, [loadAiMessages, loadAiStatus, loadCoachInsights]);

    const handleAskCoach = async () => {
        const question = coachQuestion.trim();
        if (!question || askLoading) return;
        setAskLoading(true);
        setCoachAnswer(null);
        try {
            const response = await coachApi.ask({ question });
            setCoachAnswer(response.data || null);
            setCoachQuestion("");
            loadAiStatus();
            loadAiMessages();
        } catch (error) {
            setCoachAnswer({
                text: "Koç cevabı şu an alınamadı. Biraz sonra tekrar deneyebilirsin.",
                source: "fallback",
                reason: "provider_error",
            });
        } finally {
            setAskLoading(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <View style={styles.iconBadge}>
                    <MaterialCommunityIcons name="brain" size={30} color={colors.background} />
                </View>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>{isCoachPlus ? "AI KOÇ" : "AKILLI KOÇ"}</Text>
                    <Text style={styles.title}>Koç</Text>
                    <Text style={styles.subtitle}>
                        {isFree
                            ? "SmartProgress loglarını, programını ve toparlanmanı birlikte okuyup sıradaki en mantıklı adımı gösterecek."
                            : "Logların, programın ve toparlanma sinyallerin üzerinden sıradaki en mantıklı adımı takip et."}
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
                <View style={styles.activeHero}>
                    <View style={styles.panelTopRow}>
                        <View style={styles.activeHeroCopy}>
                            <Text style={styles.panelLabel}>{isCoachPlus ? "Coach+ erişimi" : "Pro erişimi"}</Text>
                            <Text style={styles.panelTitle}>Koç takibi aktif</Text>
                        </View>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusText}>Aktif</Text>
                        </View>
                    </View>
                    <Text style={styles.panelText}>
                        Haftalık raporun, kalıcı sinyallerin ve program wizard'ın buradan yönetilir. Koç otomatik değişiklik yapmaz; yakalar, açıklar ve aksiyon önerir.
                    </Text>
                    <View style={styles.activeHeroActions}>
                        <TouchableOpacity
                            style={[styles.primaryButton, styles.heroPrimaryButton]}
                            activeOpacity={0.85}
                            onPress={() => navigation.navigate("PremiumProgramWizard")}
                        >
                            <Ionicons name="map-outline" size={18} color={colors.background} />
                            <Text style={styles.primaryButtonText}>Akıllı Program Wizard'ı Aç</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.heroSecondaryButton}
                            activeOpacity={0.85}
                            onPress={() => navigation.navigate("CoachWeeklyReport")}
                        >
                            <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                            <Text style={styles.heroSecondaryText}>Haftalık Rapor</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {!isFree && (
                <View style={styles.section}>
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
                            color={PROGRESS_GREEN}
                            colors={colors}
                        />
                        <MetricTile
                            icon="alert-circle-outline"
                            label="Dikkat"
                            value={(weeklyReport?.plateauCount ?? 0) + (weeklyReport?.regressionCount ?? 0) || attentionSignals.length}
                            color={colors.warning || "#F5A524"}
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
                </View>
            )}

            {isFree ? (
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
            ) : (
                <View style={styles.section}>
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
                </View>
            )}

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
                            <TouchableOpacity
                                style={styles.secondaryActionBtn}
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate("CoachWeeklyReport")}
                            >
                                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                                <Text style={styles.secondaryActionText}>Detaylı haftalık raporu aç</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {coachInsights.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.reportTopRow}>
                        <Text style={styles.sectionTitle}>Son koç sinyalleri</Text>
                        <Text style={styles.answerMeta}>Kalıcı hafıza</Text>
                    </View>
                    <View style={styles.timelineCard}>
                        {coachInsights.slice(0, 8).map((insight, index) => {
                            const meta = getInsightMeta(insight.type, colors);
                            return (
                                <View key={insight.id} style={styles.timelineItem}>
                                    <View style={styles.timelineRail}>
                                        <View style={[styles.timelineDot, { backgroundColor: meta.color }]} />
                                        {index < Math.min(coachInsights.length, 8) - 1 && <View style={styles.timelineLine} />}
                                    </View>
                                    <View style={styles.timelineBody}>
                                        <View style={styles.signalTitleRow}>
                                            <Text style={styles.signalTitle}>{insight.exerciseName}</Text>
                                            <Text style={[styles.signalBadge, { color: meta.color }]}>{meta.label}</Text>
                                        </View>
                                        <Text style={styles.signalMeta}>
                                            {formatBestSet(insight.previousBest)} {"->"} {formatBestSet(insight.currentBest)}
                                        </Text>
                                        <Text style={styles.signalReason}>{insight.reason}</Text>
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

            {isCoachPlus ? (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>AI Koç Sorusu</Text>
                    <View style={styles.askCard}>
                        <View style={styles.reportTopRow}>
                            <View style={styles.askHeaderCopy}>
                                <Text style={styles.reportTitle}>Coach+ soru hakkı</Text>
                                <Text style={styles.panelText}>
                                    Kısa ve loglarına bağlı sorular sor. Bütçe dolarsa sistem güvenli fallback cevaba döner.
                                </Text>
                            </View>
                            {!!aiStatus && (
                                <View style={styles.statusPill}>
                                    <Text style={styles.statusText}>
                                        {coachChatUsed}/{coachChatLimit || 50}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TextInput
                            style={styles.askInput}
                            value={coachQuestion}
                            onChangeText={setCoachQuestion}
                            placeholder="Örn: Bu hafta takipteki hareketler için ne yapmalıyım?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={1200}
                        />
                        <TouchableOpacity
                            style={[styles.primaryButton, (!coachQuestion.trim() || askLoading) && styles.disabledButton]}
                            activeOpacity={0.85}
                            disabled={!coachQuestion.trim() || askLoading}
                            onPress={handleAskCoach}
                        >
                            <Ionicons name="send-outline" size={18} color={colors.background} />
                            <Text style={styles.primaryButtonText}>{askLoading ? "Soruluyor" : "Koça Sor"}</Text>
                        </TouchableOpacity>
                        {!!coachAnswer && (
                            <View style={styles.answerBox}>
                                <View style={styles.narrationHeader}>
                                    <Ionicons
                                        name={coachAnswer.source === "openai" ? "sparkles-outline" : "shield-checkmark-outline"}
                                        size={18}
                                        color={colors.accent}
                                    />
                                    <Text style={styles.narrationTitle}>
                                        {coachAnswer.source === "openai" ? "AI Koç cevabı" : "Güvenli koç cevabı"}
                                    </Text>
                                </View>
                                <Text style={styles.narrationSummary}>{coachAnswer.text}</Text>
                                {!!coachAnswer.reason && (
                                    <Text style={styles.answerMeta}>
                                        Kaynak: {coachAnswer.reason === "feature_limit_denied" ? "Soru hakkı" : coachAnswer.reason === "budget_denied" ? "Bütçe koruması" : coachAnswer.reason === "provider_disabled" ? "Mock mod" : "Fallback"}
                                    </Text>
                                )}
                            </View>
                        )}
                        {!!aiStatus && (
                            <Text style={styles.answerMeta}>
                                Kalan soru: {coachChatRemaining}. Tahmini kalan AI bütçesi: ${((aiStatus.remainingMicros || 0) / 1000000).toFixed(2)}
                            </Text>
                        )}
                        {aiMessages.length > 0 && (
                            <View style={styles.messageHistory}>
                                <Text style={styles.reportTitle}>Son sorular</Text>
                                {aiMessages.slice(0, 5).map((message) => (
                                    <View key={message.id} style={styles.messageItem}>
                                        <Text style={styles.messageQuestion}>{message.question}</Text>
                                        <Text style={styles.messageAnswer} numberOfLines={3}>{message.answer}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            ) : (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Coach+ AI</Text>
                    <View style={styles.lockedCoachCard}>
                        <View style={styles.lockedIcon}>
                            <Ionicons name="lock-closed-outline" size={22} color={colors.accent} />
                        </View>
                        <View style={styles.lockedCopy}>
                            <Text style={styles.reportTitle}>AI soru hakkı Coach+ ile açılır</Text>
                            <Text style={styles.panelText}>
                                Coach+ katmanında aylık 50 kontrollü AI soru hakkı, haftalık rapora bağlı cevaplar ve bütçe korumalı yanıt sistemi olacak.
                            </Text>
                            <View style={styles.lockedFeatures}>
                                <View style={styles.planItem}>
                                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                                    <Text style={styles.planItemText}>Program ve log bağlamına göre cevap</Text>
                                </View>
                                <View style={styles.planItem}>
                                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                                    <Text style={styles.planItemText}>Otomatik değişiklik yok, karar kullanıcıda</Text>
                                </View>
                                <View style={styles.planItem}>
                                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                                    <Text style={styles.planItemText}>Aylık 50 soru ve maliyet limiti</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.compareSection}>
                <View style={styles.dashboardHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Paket farkı</Text>
                        <Text style={styles.dashboardSubtitle}>Koç motoru ayrı, AI sohbet katmanı ayrı değer üretir.</Text>
                    </View>
                </View>
                <View style={styles.planGrid}>
                    <PlanCard
                        title="Pro"
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
                    />
                    <PlanCard
                        title="Coach+"
                        subtitle="AI Koç Katmanı"
                        badge="50 soru / ay"
                        icon="sparkles-outline"
                        items={[
                            "Pro içindeki tüm koç motoru özellikleri",
                            "Log ve rapor bağlamına göre AI cevapları",
                            "Bütçe korumalı, kontrollü soru hakkı",
                            "Daha açıklayıcı haftalık yorum ve yönlendirme",
                        ]}
                        colors={colors}
                        active={isCoachPlus}
                        highlighted
                    />
                </View>
                <View style={styles.pricingNote}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                    <Text style={styles.noteText}>
                        Ödeme açılmadan önce bu ayrımı manuel erişimle test ediyoruz. Böylece fiyatlandırmadan önce maliyet, kullanım ve gerçek değer algısını ölçebiliriz.
                    </Text>
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
}: {
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    items: string[];
    colors: any;
    active?: boolean;
    highlighted?: boolean;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
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
    activeHero: {
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
        lineHeight: 17,
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
        lineHeight: 20,
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
        lineHeight: 18,
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
        lineHeight: 20,
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
        lineHeight: 20,
    },
    messageAnswer: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 18,
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
        lineHeight: 18,
    },
    interventionText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        lineHeight: 18,
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
