// ─────────────────────────────────────────────
// ProgramDetailScreen — Program detay sayfası
// Döngüsel (Cycle-based) program: Gün listesi, silme, antrenman başlat
// ─────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Image,
    Animated,
    Modal,
    Share,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { moderationApi, parseApiError, programApi } from "../services/api";
import { getCachedWorkoutSummaries, getWorkoutSummarySnapshot } from "../services/workoutCacheService";
import ActionConfirmModal from "../components/ActionConfirmModal";
import NoticeModal from "../components/NoticeModal";
import ReportContentModal from "../components/ReportContentModal";
import {
    activateProgramForWorkout,
    buildPreviewWorkoutParams,
    buildTrackedWorkoutParams,
    getActiveProgramId,
    navigateToWorkoutRespectingActiveSession,
    type StartableProgram,
} from "../utils/workoutNavigation";
import { navigateWithFeedback } from "../utils/navigationFeedback";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { getCachedProgramById, getProgramDetailSnapshot, invalidateProgramCache } from "../services/programCacheService";
import { logPerf, markPerf } from "../utils/perfLogger";
import { buildGuideSummary, normalizeProgramIntro, PROGRAM_GUIDE_SUMMARY_RULES } from "../utils/programGuide";
import { COACH_PATTERN_LABELS, type CoachPatternKey } from "../services/coachRuleEngine";
import { hasPendingOnboardingTraining } from "../utils/appTourEvents";

type Nav = NativeStackNavigationProp<RootStackParamList, "ProgramDetail">;
type Route = RouteProp<RootStackParamList, "ProgramDetail">;

interface ProgramDay {
    label: string;
    isRestDay?: boolean;
    exercises: {
        id?: string;
        name: string;
        targetPattern?: CoachPatternKey;
        targetMuscle?: string;
        primaryMuscles?: string[];
        riskAdjusted?: boolean;
        painWarning?: string;
        logDisabled?: boolean;
        logDisabledReason?: string;
        targetSets: { targetReps: string; targetRPE?: string; targetRIR?: string; targetWeight?: string; isWarmup?: boolean }[];
    }[];
}

interface ProgramData {
    id: string;
    name: string;
    description?: string;
    frequency: number;
    currentDayIndex: number;
    isPublic: boolean;
    isMine?: boolean;
    isStarredByMe?: boolean;
    starCount?: number;
    sourceProgramId?: string | null;
    user?: {
        id?: string;
        firstName?: string;
        lastName?: string;
        nickname?: string | null;
        avatarUrl?: string | null;
    };
    sourceProgram?: ProgramData;
    sourceUpdateAvailable?: boolean;
    data: {
        frequency?: number;
        days: ProgramDay[];
        generatedBy?: string;
        coachProfile?: Record<string, any>;
        coachRiskReport?: Record<string, any>;
        coachRiskReports?: CoachRiskReport[];
    } | null;
    createdAt: string;
}

type PendingStart = {
    program: StartableProgram;
    dayIndex: number;
};

type CoachRiskReportType = "pain" | "injury";
type CoachRiskReport = {
    id: string;
    type: CoachRiskReportType;
    patterns: CoachPatternKey[];
    reportedAt: string;
    clearedAt?: string;
};

const COACH_PAIN_WARNING =
    "Agri bildirildi. Agirligi ciddi dusur, RPE 6 ustune cikma ve RIR 4-5 hedefle. Agri artarsa hareketi birak.";
const COACH_INJURY_DISABLED_REASON =
    "Gecici sakatlik bildirildi. Bu bolgeyi calistiran hareketleri sakatlik gecene kadar loglama.";
const PROGRAM_SHARE_BASE_URL = "https://app.smartprogress.online/programs";
const PROGRAM_APP_LINK_BASE_URL = "smartprogress://programs";

function unwrapProgramResponse(data: any, fallback?: ProgramData | null): ProgramData {
    return (data?.program || data || fallback) as ProgramData;
}

function normalizeCoachRiskReports(data?: ProgramData["data"] | null): CoachRiskReport[] {
    if (!data) return [];
    const rawReports = Array.isArray(data.coachRiskReports) ? data.coachRiskReports : [];
    const legacyReport = data.coachRiskReport;
    const reports = [
        ...rawReports,
        ...(legacyReport ? [legacyReport] : []),
    ];

    return reports
        .map((report, index) => {
            const type = report?.type === "injury" ? "injury" : report?.type === "pain" ? "pain" : null;
            const patterns = Array.isArray(report?.patterns)
                ? report.patterns.filter(Boolean)
                : [];
            if (!type || patterns.length === 0 || report?.clearedAt) return null;
            const reportedAt = typeof report.reportedAt === "string" ? report.reportedAt : new Date(0).toISOString();
            return {
                id: typeof report.id === "string" && report.id.length > 0
                    ? report.id
                    : `${type}-${patterns.join("-")}-${reportedAt}-${index}`,
                type,
                patterns,
                reportedAt,
            } as CoachRiskReport;
        })
        .filter((report): report is CoachRiskReport => !!report);
}

function applyCoachRiskReportsToDays(days: ProgramDay[], reports: CoachRiskReport[]): ProgramDay[] {
    return (days || []).map((day) => ({
        ...day,
        exercises: (day.exercises || []).map((exercise) => {
            const matchingReports = exercise.targetPattern
                ? reports.filter((report) => report.patterns.includes(exercise.targetPattern as CoachPatternKey))
                : [];
            const hasInjury = matchingReports.some((report) => report.type === "injury");
            const hasPain = matchingReports.some((report) => report.type === "pain");

            if (hasInjury) {
                return {
                    ...exercise,
                    riskAdjusted: true,
                    painWarning: undefined,
                    logDisabled: true,
                    logDisabledReason: COACH_INJURY_DISABLED_REASON,
                };
            }
            if (hasPain) {
                return {
                    ...exercise,
                    riskAdjusted: true,
                    painWarning: COACH_PAIN_WARNING,
                    logDisabled: false,
                    logDisabledReason: undefined,
                };
            }
            return {
                ...exercise,
                riskAdjusted: false,
                painWarning: undefined,
                logDisabled: false,
                logDisabledReason: undefined,
            };
        }),
    }));
}

export default function ProgramDetailScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { programId } = route.params;
    const { colors } = useTheme();
    const { animStyle } = useScreenEnter({ variant: "slide" });

    const [program, setProgram] = useState<ProgramData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [socialBusy, setSocialBusy] = useState(false);
    const [syncingSource, setSyncingSource] = useState(false);
    const [restAdvancing, setRestAdvancing] = useState(false);
    const [workoutCount, setWorkoutCount] = useState(0);
    const [notice, setNotice] = useState<{ title: string; message: string; goBackOnClose?: boolean } | null>(null);
    const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);
    const [reportVisible, setReportVisible] = useState(false);
    const [blockVisible, setBlockVisible] = useState(false);
    const [moderationBusy, setModerationBusy] = useState(false);
    const [shareConfirmVisible, setShareConfirmVisible] = useState(false);
    const [sharingProgram, setSharingProgram] = useState(false);
    const [riskModalVisible, setRiskModalVisible] = useState(false);
    const [riskReportType, setRiskReportType] = useState<CoachRiskReportType>("pain");
    const [selectedRiskPatterns, setSelectedRiskPatterns] = useState<CoachPatternKey[]>([]);
    const [riskSaving, setRiskSaving] = useState(false);
    const [onboardingTrainingPending, setOnboardingTrainingPending] = useState(false);

    const s = React.useMemo(() => createStyles(colors), [colors]);
    const coachPatternOptions = React.useMemo(() => {
        const seen = new Set<CoachPatternKey>();
        const options: { key: CoachPatternKey; label: string }[] = [];
        (program?.data?.days || []).forEach((day) => {
            (day.exercises || []).forEach((exercise) => {
                const key = exercise.targetPattern;
                if (!key || seen.has(key)) return;
                seen.add(key);
                options.push({ key, label: exercise.targetMuscle || COACH_PATTERN_LABELS[key] || key });
            });
        });
        return options;
    }, [program?.data]);
    const activeCoachRiskReports = React.useMemo(
        () => normalizeCoachRiskReports(program?.data),
        [program?.data],
    );

    const fetchProgram = useCallback(async () => {
        markPerf("program_detail_ready");
        try {
            const cachedProgram = getProgramDetailSnapshot(programId);
            if (cachedProgram) {
                setProgram(cachedProgram as ProgramData);
                setLoading(false);
            }

            const cachedWorkouts = getWorkoutSummarySnapshot(100);
            if (cachedWorkouts.length > 0) {
                setWorkoutCount(cachedWorkouts.filter((w: any) => w.data?.programId === programId).length);
            }

            const progRes = await getCachedProgramById(programId);
            setProgram(progRes as ProgramData);
            setLoading(false);

            getCachedWorkoutSummaries(100)
                .then((summaries) => {
                    const count = (summaries || []).filter((w: any) => w.data?.programId === programId).length;
                    setWorkoutCount(count);
                })
                .catch(() => undefined);
        } catch (err: any) {
            console.error("[ProgramDetail] fetch error:", err?.message);
            setNotice({ title: "Program yuklenemedi", message: "Program bilgileri yuklenemedi.", goBackOnClose: true });
        } finally {
            setLoading(false);
            setRefreshing(false);
            logPerf("program_detail_ready", "program_detail_ready");
        }
    }, [programId]);

    useFocusEffect(
        useCallback(() => {
            if (!getProgramDetailSnapshot(programId)) setLoading(true);
            fetchProgram();
            hasPendingOnboardingTraining()
                .then(setOnboardingTrainingPending)
                .catch(() => setOnboardingTrainingPending(false));
        }, [fetchProgram]),
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchProgram();
    };

    const handleDelete = async () => {
        if (deleting) return;
        setDeleting(true);
        try {
            await programApi.deleteProgram(programId);
            invalidateProgramCache(programId);
            navigation.goBack();
        } catch (err: any) {
            const apiError = parseApiError(err);
            setNotice({ title: "Silinemedi", message: apiError.message || "Silme islemi basarisiz." });
            setDeleting(false);
        }
    };

    const handleStartWorkout = async () => {
        if (!program?.data?.days) return;
        if (program.isPublic && program.isMine === false) {
            const copied = await copyProgramToLibrary();
            if (!copied?.data?.days) return;
            navigation.replace("ProgramDetail", { programId: copied.id });
            navigateToWorkoutRespectingActiveSession(navigation, {
                programId: copied.id,
                programName: copied.name,
                dayIndex: copied.currentDayIndex,
                programData: copied.data as any,
            });
            return;
        }

        const dayIndex = program.currentDayIndex;
        const currentDay = program.data.days[dayIndex];

        if (currentDay?.isRestDay) {
            setSelectedDayIndex(dayIndex);
            return;
        }

        navigateToSession(dayIndex);
    };

    const navigateToSession = async (dayIndex: number) => {
        const programToStart = {
            id: program!.id,
            name: program!.name,
            data: program!.data as any,
        };
        const activeProgramId = await getActiveProgramId();

        if (activeProgramId !== programToStart.id) {
            setPendingStart({ program: programToStart, dayIndex });
            return;
        }

        navigateToWorkoutRespectingActiveSession(navigation, buildTrackedWorkoutParams(programToStart, dayIndex));
    };

    const startPendingAsActive = async () => {
        if (!pendingStart) return;
        const next = pendingStart;
        setPendingStart(null);
        await activateProgramForWorkout(next.program.id);
        navigateToWorkoutRespectingActiveSession(navigation, buildTrackedWorkoutParams(next.program, 0));
    };

    const startPendingWithoutTracking = () => {
        if (!pendingStart) return;
        const next = pendingStart;
        setPendingStart(null);
        navigateToWorkoutRespectingActiveSession(navigation, buildPreviewWorkoutParams(next.program, next.dayIndex));
    };

    const handleStartSelectedDay = async (dayIndex: number) => {
        if (!program?.data?.days) return;
        setSelectedDayIndex(null);

        if (program.isPublic && program.isMine === false) {
            const copied = await copyProgramToLibrary();
            if (!copied?.data?.days) return;
            navigation.replace("ProgramDetail", { programId: copied.id });
            navigateToWorkoutRespectingActiveSession(navigation, {
                programId: copied.id,
                programName: copied.name,
                dayIndex,
                programData: copied.data as any,
            });
            return;
        }

        navigateToSession(dayIndex);
    };

    const navigateToDayDetail = (dayIndex: number) => {
        if (!program?.data?.days?.[dayIndex]) return;
        const programData = program.data;
        const day = programData.days[dayIndex];
        setSelectedDayIndex(null);
        navigateWithFeedback(() => navigation.navigate("ProgramDayDetail", {
            programId: program.id,
            programName: program.name,
            dayIndex,
            day,
            programData: programData as any,
        }));
    };

    const handleEdit = () => {
        if (!program) return;
        navigateWithFeedback(() => navigation.navigate("ProgramCreate", {
            editProgramId: program.id,
            editProgramData: program,
        }), { variant: "modal" });
    };

    const handleDayTap = (dayIndex: number) => {
        if (!program) return;
        setSelectedDayIndex(dayIndex);
    };

    const completeRestDay = async () => {
        if (!program || restAdvancing) return;
        setRestAdvancing(true);
        try {
            const res = await programApi.advanceDay(program.id);
            setProgram(res.data as ProgramData);
            setNotice({ title: "Dinlenme tamamlandı", message: "Sıradaki antrenman gününe geçildi." });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Hata", message: apiError.message || "Dinlenme günü tamamlanamadı." });
        } finally {
            setRestAdvancing(false);
        }
    };

    const toggleStar = async () => {
        if (!program || socialBusy) return;
        setSocialBusy(true);
        try {
            const res = program.isStarredByMe
                ? await programApi.unstar(program.id)
                : await programApi.star(program.id);
            setProgram(res.data as ProgramData);
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Islem basarisiz", message: apiError.message || "Yildiz islemi basarisiz." });
        } finally {
            setSocialBusy(false);
        }
    };

    const copyProgramToLibrary = async (): Promise<ProgramData | null> => {
        if (!program || socialBusy) return null;
        setSocialBusy(true);
        try {
            const res = await programApi.copyToLibrary(program.id);
            return res.data as ProgramData;
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Eklenemedi", message: apiError.message || "Program kitapliga eklenemedi." });
            return null;
        } finally {
            setSocialBusy(false);
        }
    };

    const syncFromSource = async () => {
        if (!program || syncingSource) return;
        setSyncingSource(true);
        try {
            const res = await programApi.syncSource(program.id);
            setProgram(res.data as ProgramData);
            setNotice({ title: "Güncellendi", message: "Program kopyan kaynak programın son sürümüne geçirildi." });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Guncellenemedi", message: apiError.message || "Program guncellenemedi." });
        } finally {
            setSyncingSource(false);
        }
    };

    const reportProgram = async (
        reason: "inappropriate" | "spam" | "harassment" | "misleading" | "other",
        details?: string,
    ) => {
        if (!program || moderationBusy) return;
        setModerationBusy(true);
        try {
            await moderationApi.report({
                targetType: "PROGRAM",
                targetProgramId: program.id,
                reason,
                details,
            });
            setReportVisible(false);
            setNotice({ title: "Şikayet alındı", message: "İçeriği inceleme kuyruğuna aldık. Teşekkür ederiz." });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Şikayet gönderilemedi", message: apiError.message });
        } finally {
            setModerationBusy(false);
        }
    };

    const blockProgramOwner = async () => {
        const ownerId = program?.user?.id;
        if (!ownerId || moderationBusy) return;
        setModerationBusy(true);
        try {
            await moderationApi.blockUser(ownerId);
            setBlockVisible(false);
            setNotice({
                title: "Kullanıcı engellendi",
                message: "Bu kullanıcının public içerikleri artık keşif ve profil akışlarında gösterilmeyecek.",
                goBackOnClose: true,
            });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Engellenemedi", message: apiError.message });
        } finally {
            setModerationBusy(false);
        }
    };

    const sharePublicProgram = async (programToShare: ProgramData) => {
        if (!programToShare.id) {
            setNotice({ title: "Paylasilamadi", message: "Program linki icin program kimligi bulunamadi." });
            return;
        }
        const shareUrl = `${PROGRAM_SHARE_BASE_URL}/${programToShare.id}`;
        const appUrl = `${PROGRAM_APP_LINK_BASE_URL}/${programToShare.id}`;
        const title = programToShare.name || "SmartProgress programi";
        const message = Platform.OS === "web"
            ? `${title}\n${shareUrl}`
            : `${title}\nUygulamada ac: ${appUrl}\nWeb: ${shareUrl}`;

        if (Platform.OS === "web") {
            const webNavigator = typeof navigator !== "undefined" ? navigator as any : null;
            if (webNavigator?.share) {
                await webNavigator.share({ title, text: title, url: shareUrl });
                return;
            }
            if (webNavigator?.clipboard?.writeText) {
                await webNavigator.clipboard.writeText(shareUrl);
                setNotice({ title: "Link kopyalandi", message: "Program paylasim linki panoya kopyalandi." });
                return;
            }
            setNotice({ title: "Paylasim linki", message: shareUrl });
            return;
        }

        await Share.share({
            title,
            message,
            url: appUrl,
        });
    };

    const handleShareProgram = async () => {
        if (!program || sharingProgram) return;
        if (!program.isPublic) {
            setShareConfirmVisible(true);
            return;
        }
        try {
            setSharingProgram(true);
            await sharePublicProgram(program);
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Paylasilamadi", message: apiError.message || "Program paylasim akisi basarisiz oldu." });
        } finally {
            setSharingProgram(false);
        }
    };

    const makePublicAndShare = async () => {
        if (!program || sharingProgram) return;
        setSharingProgram(true);
        try {
            const res = await programApi.toggleVisibility(program.id);
            const nextProgram = {
                ...program,
                ...unwrapProgramResponse(res.data, program),
                id: unwrapProgramResponse(res.data, program).id || program.id,
                isPublic: true,
            };
            invalidateProgramCache(program.id);
            setProgram(nextProgram);
            setShareConfirmVisible(false);
            await sharePublicProgram(nextProgram);
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Paylasilamadi", message: apiError.message || "Program public yapilip paylasilamadi." });
        } finally {
            setSharingProgram(false);
        }
    };

    if (loading) {
        return (
            <Animated.View style={[s.centered, animStyle]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </Animated.View>
        );
    }

    if (!program) return null;

    const days = program.data?.days || [];
    const currentDayIndex = program.currentDayIndex;
    const currentDay = days[currentDayIndex];
    const isOwner = program.isMine !== false;
    const ownerName =
        program.user?.nickname ||
        [program.user?.firstName, program.user?.lastName].filter(Boolean).join(" ");
    const ownerInitials = getInitials(
        program.user?.firstName,
        program.user?.lastName,
        ownerName || "SP",
    );
    const selectedDay = selectedDayIndex !== null ? days[selectedDayIndex] : null;
    const programIntro = normalizeProgramIntro((program.data as any)?.programIntro);
    const programIntroSummary = buildGuideSummary(programIntro);
    const isCoachProgram = !!program.data && (
        program.data.generatedBy === "smartprogress_rule_engine_v1" ||
        !!program.data.coachProfile ||
        programIntro?.source === "coach"
    );
    const openProgramGuide = () => {
        navigation.navigate("ProgramGuide", {
            programId: program.id,
            programName: program.name,
            programIntro: (program.data as any)?.programIntro,
            programData: program.data,
            onboardingTraining: onboardingTrainingPending,
        });
    };
    const startOnboardingTrainingDemo = () => {
        if (!program.data) return;
        navigation.navigate("WorkoutSession", {
            programId: program.id,
            programName: program.name,
            dayIndex: 0,
            programData: program.data as any,
            trainingMode: "onboarding_demo",
        });
    };
    const openCoachRiskModal = (type: CoachRiskReportType) => {
        setRiskReportType(type);
        setSelectedRiskPatterns([]);
        setRiskModalVisible(true);
    };
    const toggleRiskPattern = (pattern: CoachPatternKey) => {
        setSelectedRiskPatterns((prev) => (
            prev.includes(pattern)
                ? prev.filter((item) => item !== pattern)
                : [...prev, pattern]
        ));
    };
    const applyCoachRiskReport = async () => {
        if (!program.data || selectedRiskPatterns.length === 0 || riskSaving) return;
        const selectedSet = new Set(selectedRiskPatterns);
        const report: CoachRiskReport = {
            id: `${riskReportType}-${Date.now()}`,
            type: riskReportType,
            patterns: selectedRiskPatterns,
            reportedAt: new Date().toISOString(),
        };
        const nextReports = [
            ...activeCoachRiskReports.filter((existing) => !(
                existing.type === riskReportType &&
                existing.patterns.some((pattern) => selectedSet.has(pattern))
            )),
            report,
        ];
        const nextData = {
            ...program.data,
            coachRiskReport: undefined,
            coachRiskReports: nextReports,
            days: applyCoachRiskReportsToDays(program.data.days || [], nextReports),
        };

        try {
            setRiskSaving(true);
            const res = await programApi.update(program.id, { data: nextData });
            invalidateProgramCache(program.id);
            setProgram(res.data as ProgramData);
            setRiskModalVisible(false);
            setNotice({
                title: riskReportType === "injury" ? "Sakatlik notu eklendi" : "Agri notu eklendi",
                message: riskReportType === "injury"
                    ? "Program degismedi. Secilen bolgedeki hareketler gorunur kalacak fakat loglanamayacak."
                    : "Program degismedi. Secilen bolgedeki hareketler guvenli mod uyarisi ile loglanacak.",
            });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Not kaydedilemedi", message: apiError.message || "Agri/sakatlik notu kaydedilemedi." });
        } finally {
            setRiskSaving(false);
        }
    };
    const clearCoachRiskReport = async (reportId: string) => {
        if (!program.data || riskSaving) return;
        const nextReports = activeCoachRiskReports.filter((report) => report.id !== reportId);
        const nextData = {
            ...program.data,
            coachRiskReport: undefined,
            coachRiskReports: nextReports,
            days: applyCoachRiskReportsToDays(program.data.days || [], nextReports),
        };

        try {
            setRiskSaving(true);
            const res = await programApi.update(program.id, { data: nextData });
            invalidateProgramCache(program.id);
            setProgram(res.data as ProgramData);
            setNotice({
                title: "Durum notu kaldirildi",
                message: "Secilen agri/sakatlik notu kaldirildi. Kalan notlar varsa programda korunur.",
            });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Not kaldirilamadi", message: apiError.message || "Agri/sakatlik notu kaldirilamadi." });
        } finally {
            setRiskSaving(false);
        }
    };

    return (
        <Animated.View style={[s.container, animStyle]}>
            {/* ─── Header ─── */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.75}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <Text style={s.headerTitle} numberOfLines={1}>
                    {program.name}
                </Text>

                <View style={s.headerActions}>
                    <TouchableOpacity
                        onPress={handleShareProgram}
                        disabled={sharingProgram}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.headerIconBtn}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name="share-social-outline"
                            size={20}
                            color={sharingProgram ? colors.textMuted : colors.accent}
                        />
                    </TouchableOpacity>
                    {isOwner && (
                        <>
                            <TouchableOpacity
                                onPress={handleEdit}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={s.headerIconBtn}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.accent} />
                            </TouchableOpacity>

                            <Pressable
                                onPress={() => setConfirmDeleteVisible(true)}
                                disabled={deleting}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={s.headerIconBtn}
                            >
                                <Ionicons
                                    name="trash-outline"
                                    size={20}
                                    color={deleting ? colors.textMuted : colors.error}
                                />
                            </Pressable>
                        </>
                    )}

                    <TouchableOpacity
                        onPress={handleStartWorkout}
                        style={s.startBtn}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="play" size={16} color={colors.background} />
                        <Text style={s.startBtnText}>Başlat</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
            >
                {/* ─── Info Card ─── */}
                <View style={s.infoCard}>
                    {program.description ? (
                        <Text style={s.description}>{program.description}</Text>
                    ) : null}

                    <View style={s.metaRow}>
                        <View style={s.metaItem}>
                            <Ionicons name="repeat-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {program.data?.frequency ? `Frekans: ${program.data.frequency} gün/hafta` : "Frekans hedefi yok"}
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>{days.length} gün tanımlı</Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="time-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                Oluşturulma: {new Date(program.createdAt).toLocaleDateString("tr-TR")}
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {Math.max(0, Math.floor((Date.now() - new Date(program.createdAt).getTime()) / 86400000))} gündür kullanılıyor
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons
                                name={program.isPublic ? "globe-outline" : "lock-closed-outline"}
                                size={16}
                                color={colors.accent}
                            />
                            <Text style={s.metaText}>
                                {program.isPublic ? "Herkese açık" : "Özel"}
                            </Text>
                        </View>
                        {program.isPublic && ownerName ? (
                            <TouchableOpacity
                                style={s.ownerPill}
                                activeOpacity={0.75}
                                onPress={() => {
                                    const userId = program.user?.id;
                                    if (userId) navigateWithFeedback(() => navigation.navigate("PublicProfile", { userId }));
                                }}
                            >
                                {program.user?.avatarUrl ? (
                                    <Image source={{ uri: program.user.avatarUrl }} style={s.ownerAvatar} />
                                ) : (
                                    <View style={s.ownerAvatarFallback}>
                                        <Text style={s.ownerAvatarText}>{ownerInitials}</Text>
                                    </View>
                                )}
                                <Text style={s.metaText}>{ownerName}</Text>
                            </TouchableOpacity>
                        ) : null}
                        {program.isPublic && (
                            <TouchableOpacity
                                style={s.starAction}
                                onPress={toggleStar}
                                disabled={socialBusy}
                                activeOpacity={0.75}
                            >
                                <Ionicons
                                    name={program.isStarredByMe ? "star" : "star-outline"}
                                    size={16}
                                    color={colors.accent}
                                />
                                <Text style={s.starActionText}>{program.starCount || 0}</Text>
                            </TouchableOpacity>
                        )}
                        <View style={s.metaItem}>
                            <Ionicons name="barbell-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {workoutCount} antrenman tamamlandı
                            </Text>
                        </View>
                    </View>
                    {program.isPublic && !isOwner && (
                        <TouchableOpacity
                            style={s.copyBtn}
                            onPress={async () => {
                                const copied = await copyProgramToLibrary();
                                if (copied) navigation.replace("ProgramDetail", { programId: copied.id });
                            }}
                            disabled={socialBusy}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="library-outline" size={16} color={colors.background} />
                            <Text style={s.copyBtnText}>Kitaplığıma Ekle</Text>
                        </TouchableOpacity>
                    )}
                    {program.isPublic && !isOwner && (
                        <View style={s.moderationRow}>
                            <TouchableOpacity style={s.moderationBtn} onPress={() => setReportVisible(true)} activeOpacity={0.75}>
                                <Ionicons name="flag-outline" size={15} color={colors.textSecondary} />
                                <Text style={s.moderationText}>Şikayet et</Text>
                            </TouchableOpacity>
                            {program.user?.id ? (
                                <TouchableOpacity style={s.moderationBtn} onPress={() => setBlockVisible(true)} activeOpacity={0.75}>
                                    <Ionicons name="ban-outline" size={15} color={colors.error} />
                                    <Text style={[s.moderationText, { color: colors.error }]}>Kullanıcıyı engelle</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}
                    {program.sourceUpdateAvailable && (
                        <View style={s.sourceUpdateBox}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.sourceUpdateTitle}>Kaynak program güncellendi</Text>
                                <Text style={s.sourceUpdateText}>
                                    İstersen bu kopyayı program sahibinin son sürümüne geçirebilirsin.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={s.sourceUpdateBtn}
                                onPress={syncFromSource}
                                disabled={syncingSource}
                                activeOpacity={0.75}
                            >
                                <Text style={s.sourceUpdateBtnText}>{syncingSource ? "..." : "Güncelle"}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {programIntro ? (
                    <View style={s.infoCard}>
                        <View style={s.sectionHeaderRow}>
                            <Ionicons name="school-outline" size={18} color={colors.accent} />
                            <Text style={s.sectionTitle}>{programIntro.title || "Program rehberi"}</Text>
                        </View>
                        {(programIntroSummary.length ? programIntroSummary : PROGRAM_GUIDE_SUMMARY_RULES).slice(0, 5).map((rule) => (
                            <View key={rule} style={s.guideSummaryRow}>
                                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                                <Text style={s.guideSummaryText}>{rule}</Text>
                            </View>
                        ))}
                        <TouchableOpacity style={s.guideDetailBtn} onPress={openProgramGuide} activeOpacity={0.8}>
                            <Text style={s.guideDetailText}>Detayli rehberi ac</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* ─── Current Day Highlight ─── */}
                {isOwner && onboardingTrainingPending ? (
                    <View style={s.trainingResumeCard}>
                        <View style={s.sectionHeaderRow}>
                            <Ionicons name="school-outline" size={18} color={colors.accent} />
                            <Text style={s.sectionTitle}>Loglamayi ogren</Text>
                        </View>
                        <Text style={s.trainingResumeText}>
                            Ilk kurulum egitimin henuz tamamlanmadi. Demo antrenman gercek kayit olusturmaz; sadece set loglamayi ve antrenmani bitirme akisini ogretir.
                        </Text>
                        <TouchableOpacity style={s.guideDetailBtn} onPress={startOnboardingTrainingDemo} activeOpacity={0.8}>
                            <Text style={s.guideDetailText}>Demo loglamaya devam et</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                ) : null}

                {isOwner && isCoachProgram && coachPatternOptions.length > 0 ? (
                    <View style={s.riskCard}>
                        <View style={s.sectionHeaderRow}>
                            <Ionicons name="medkit-outline" size={18} color={colors.accent} />
                            <Text style={s.sectionTitle}>Agri / sakatlik bildir</Text>
                        </View>
                        <Text style={s.riskText}>
                            Gecici durumlarda program degismez. Agri icin guvenli mod uyarisi eklenir; sakatlikta ilgili hareketler gorunur kalir ama loglanamaz.
                        </Text>
                        {activeCoachRiskReports.length > 0 ? (
                            <View style={s.activeRiskList}>
                                <Text style={s.activeRiskTitle}>Aktif durumlar</Text>
                                {activeCoachRiskReports.map((report) => (
                                    <View key={report.id} style={s.activeRiskRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.activeRiskName}>
                                                {report.type === "injury" ? "Sakatlik bildirimi" : "Agri bildirimi"}
                                            </Text>
                                            <Text style={s.activeRiskMeta} numberOfLines={2}>
                                                {report.patterns.map((pattern) => COACH_PATTERN_LABELS[pattern] || pattern).join(", ")}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={s.activeRiskClearBtn}
                                            onPress={() => clearCoachRiskReport(report.id)}
                                            disabled={riskSaving}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                                            <Text style={s.activeRiskClearText}>Gecti</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                        <View style={s.riskActionRow}>
                            <TouchableOpacity style={s.riskActionBtn} onPress={() => openCoachRiskModal("pain")} activeOpacity={0.8}>
                                <Ionicons name="warning-outline" size={15} color={colors.accent} />
                                <Text style={s.riskActionText}>Agri bildir</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.riskActionBtn} onPress={() => openCoachRiskModal("injury")} activeOpacity={0.8}>
                                <Ionicons name="lock-closed-outline" size={15} color={colors.accent} />
                                <Text style={s.riskActionText}>Sakatlik bildir</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}

                {days.length > 0 && isOwner && (
                    <View style={s.currentDayBanner}>
                        <View style={s.currentDayInfo}>
                            <View style={s.currentDayDot} />
                            <Text style={s.currentDayLabel}>
                                Sıradaki:{" "}
                                <Text style={{ fontWeight: fontWeight.bold as any }}>
                                    {currentDay?.label || `Gün ${currentDayIndex + 1}`}
                                </Text>
                            </Text>
                        </View>
                        {currentDay?.isRestDay && (
                            <TouchableOpacity
                                style={s.completeRestBtn}
                                onPress={completeRestDay}
                                disabled={restAdvancing}
                                activeOpacity={0.75}
                            >
                                <Text style={s.completeRestText}>{restAdvancing ? "..." : "Tamamla / Geç"}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* ─── Day List ─── */}
                <Text style={s.sectionTitle}>Program Takvimi</Text>

                {days.map((day, idx) => {
                    const isCurrent = isOwner && idx === currentDayIndex;
                    const isRest = day.isRestDay;

                    return (
                        <View
                            key={idx}
                            style={[s.dayCard, isCurrent && s.dayCardActive]}
                        >
                            <TouchableOpacity onPress={() => handleDayTap(idx)} activeOpacity={0.75}>
                            <View style={s.dayHeader}>
                                <View
                                    style={[
                                        s.dayIndexCircle,
                                        isCurrent && s.dayIndexCircleActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.dayIndexText,
                                            isCurrent && s.dayIndexTextActive,
                                        ]}
                                    >
                                        {idx + 1}
                                    </Text>
                                </View>
                                <Text style={[s.dayLabel, isRest && s.restLabel]}>
                                    {day.label || `Gün ${idx + 1}`}
                                </Text>
                                {isCurrent && (
                                    <View style={s.currentBadge}>
                                        <Text style={s.currentBadgeText}>Sıradaki</Text>
                                    </View>
                                )}
                                {isRest && (
                                    <View style={s.restBadge}>
                                        <Ionicons name="bed-outline" size={14} color={colors.textMuted} />
                                        <Text style={s.restBadgeText}>Dinlenme</Text>
                                    </View>
                                )}
                            </View>

                            {!isRest && day.exercises.length > 0 && (
                                <View style={s.exerciseList}>
                                    {day.exercises.map((ex, exIdx) => (
                                        <View key={exIdx} style={s.exerciseRow}>
                                            <Text style={s.exerciseDot}>•</Text>
                                            <Text style={s.exerciseName}>{ex.name}</Text>
                                            <Text style={s.exerciseSets}>
                                                {formatSetSummary(ex.targetSets)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!isRest && day.exercises.length === 0 && (
                                <Text style={s.noExercises}>Egzersiz tanımlı değil</Text>
                            )}
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {days.length === 0 && (
                    <View style={s.emptyState}>
                        <Ionicons name="document-outline" size={48} color={colors.border} />
                        <Text style={s.emptyText}>Bu programda henüz gün tanımlı değil.</Text>
                    </View>
                )}
            </ScrollView>
            <Modal
                visible={riskModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRiskModalVisible(false)}
            >
                <View style={s.riskOverlay}>
                    <View style={s.riskModal}>
                        <View style={s.riskModalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.riskModalTitle}>
                                    {riskReportType === "injury" ? "Sakatlik bolgesi" : "Agri bolgesi"}
                                </Text>
                                <Text style={s.riskModalText}>
                                    Program degismeyecek. Etkilenen bolgeyi sec; log ekraninda guvenli uyari veya kilit uygulanacak.
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setRiskModalVisible(false)} style={s.riskCloseBtn}>
                                <Ionicons name="close" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={s.riskPatternWrap}>
                            {coachPatternOptions.map((option) => {
                                const selected = selectedRiskPatterns.includes(option.key);
                                return (
                                    <TouchableOpacity
                                        key={option.key}
                                        style={[s.riskPatternChip, selected && s.riskPatternChipActive]}
                                        onPress={() => toggleRiskPattern(option.key)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[s.riskPatternText, selected && s.riskPatternTextActive]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity
                            style={[s.riskSaveBtn, (selectedRiskPatterns.length === 0 || riskSaving) && s.riskSaveBtnDisabled]}
                            onPress={applyCoachRiskReport}
                            disabled={selectedRiskPatterns.length === 0 || riskSaving}
                            activeOpacity={0.85}
                        >
                            <Text style={s.riskSaveText}>{riskSaving ? "Kaydediliyor..." : "Notu uygula"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <ActionConfirmModal
                visible={shareConfirmVisible}
                title="Program public yapilsin mi?"
                message="Paylasim linki olusturmak icin program herkese acik olmalidir. Public yaptiginda topluluk tarafindan gorulebilir ve linkle acilabilir."
                primaryLabel={sharingProgram ? "Hazirlaniyor..." : "Public yap ve paylas"}
                secondaryLabel="Vazgec"
                onPrimary={makePublicAndShare}
                onSecondary={() => setShareConfirmVisible(false)}
                onDismiss={() => setShareConfirmVisible(false)}
            />
            <ActionConfirmModal
                visible={confirmDeleteVisible}
                title="Programı sil?"
                message="Bu program kalıcı olarak silinecek. Bu işlem geri alınamaz."
                primaryLabel="Sil"
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={() => {
                    setConfirmDeleteVisible(false);
                    handleDelete();
                }}
                onSecondary={() => setConfirmDeleteVisible(false)}
                onDismiss={() => setConfirmDeleteVisible(false)}
            />
            <ActionConfirmModal
                visible={selectedDayIndex !== null}
                title={selectedDay?.label || "Program günü"}
                message={
                    selectedDay?.isRestDay
                        ? selectedDayIndex === currentDayIndex
                            ? "Bu gün dinlenme günü olarak tanımlı. Tamamlayıp sıradaki antrenman gününe geçebilirsin."
                            : "Bu gün dinlenme günü olarak tanımlı."
                        : "Bu program gününü sıradaki günü beklemeden başlatabilirsiniz."
                }
                primaryLabel={selectedDay?.isRestDay ? (selectedDayIndex === currentDayIndex ? "Tamamla / Geç" : "Detayları Gör") : "Günü Başlat"}
                secondaryLabel={selectedDay?.isRestDay ? "Kapat" : "Detayları Gör"}
                onPrimary={() => {
                    if (selectedDayIndex === null) return;
                    if (selectedDay?.isRestDay) {
                        if (selectedDayIndex === currentDayIndex) {
                            setSelectedDayIndex(null);
                            completeRestDay();
                        } else {
                            navigateToDayDetail(selectedDayIndex);
                        }
                        return;
                    }
                    handleStartSelectedDay(selectedDayIndex);
                }}
                onSecondary={() => {
                    if (selectedDay?.isRestDay) {
                        setSelectedDayIndex(null);
                        return;
                    }
                    if (selectedDayIndex !== null) navigateToDayDetail(selectedDayIndex);
                }}
                onDismiss={() => setSelectedDayIndex(null)}
            />
            <ActionConfirmModal
                visible={!!pendingStart}
                title="Bu program takipte degil"
                message="Programi aktif hale getirirsen onceki aktif programin gun sirasi sifirlanir ve bu program ilk gunden takibe alinir. Istersen sadece sectigin gunu calisabilirsin."
                primaryLabel="Aktif yap ve baslat"
                secondaryLabel="Sadece bu gunu baslat"
                onPrimary={startPendingAsActive}
                onSecondary={startPendingWithoutTracking}
                onDismiss={() => setPendingStart(null)}
            />
            <ActionConfirmModal
                visible={blockVisible}
                title="Kullanıcıyı engelle?"
                message="Bu kullanıcının public profili ve programları artık sana gösterilmeyecek. Gerekirse destek üzerinden geri alınabilir."
                primaryLabel={moderationBusy ? "İşleniyor..." : "Engelle"}
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={blockProgramOwner}
                onSecondary={() => setBlockVisible(false)}
                onDismiss={() => setBlockVisible(false)}
            />
            <ReportContentModal
                visible={reportVisible}
                title="Programı şikayet et"
                message="Bu rapor manuel olarak incelenir. Acil güvenlik riski görürsen destek üzerinden de bize ulaş."
                busy={moderationBusy}
                onSubmit={reportProgram}
                onDismiss={() => setReportVisible(false)}
            />
            <NoticeModal
                visible={!!notice}
                title={notice?.title ?? ""}
                message={notice?.message ?? ""}
                onClose={() => {
                    const shouldGoBack = notice?.goBackOnClose;
                    setNotice(null);
                    if (shouldGoBack) navigation.goBack();
                }}
            />
        </Animated.View>
    );
}

function formatSetSummary(targetSets: ProgramDay["exercises"][number]["targetSets"] = []): string {
    const warmup = targetSets.filter((set) => set.isWarmup).length;
    const working = targetSets.length - warmup;
    const parts: string[] = [];
    if (warmup > 0) parts.push(`${warmup} ısınma`);
    if (working > 0) parts.push(`${working} çalışma`);
    return parts.length > 0 ? `${parts.join(" · ")} seti` : "Set yok";
}

function getInitials(firstName?: string, lastName?: string, fallback = "SP"): string {
    const initials = `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.trim();
    if (initials) return initials.toUpperCase();
    return fallback.slice(0, 2).toUpperCase();
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
    },
    headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    headerIconBtn: { padding: spacing.xs },
    startBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    startBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.background },

    // Content
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

    // Info card
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    description: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    metaText: { fontSize: fontSize.xs, color: colors.textMuted },
    ownerPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    ownerAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.surfaceElevated,
    },
    ownerAvatarFallback: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    ownerAvatarText: {
        fontSize: 10,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    starAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    starActionText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    copyBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        marginTop: spacing.md,
    },
    copyBtnText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
    moderationRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    moderationBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        minHeight: 38,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    moderationText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    sourceUpdateBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    sourceUpdateTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    sourceUpdateText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    sourceUpdateBtn: {
        backgroundColor: colors.accent,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    sourceUpdateBtnText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },

    // Current day banner
    currentDayBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.accentSubtle,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    currentDayInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    currentDayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    currentDayLabel: { fontSize: fontSize.sm, color: colors.text },
    completeRestBtn: {
        borderRadius: borderRadius.full,
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    completeRestText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },

    // Section
    sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    introRow: {
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: spacing.xs,
    },
    introTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    introBody: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    guideSummaryRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        paddingTop: spacing.sm,
    },
    guideSummaryText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    guideDetailBtn: {
        marginTop: spacing.md,
        minHeight: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },
    guideDetailText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    trainingResumeCard: {
        backgroundColor: colors.accentMuted,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.accent,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    trainingResumeText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    riskCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    riskText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    activeRiskList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    activeRiskTitle: {
        color: colors.text,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        textTransform: "uppercase",
        letterSpacing: 0,
    },
    activeRiskRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background,
        padding: spacing.sm,
    },
    activeRiskName: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    activeRiskMeta: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    activeRiskClearBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        minHeight: 34,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.success,
        backgroundColor: colors.successMuted,
        paddingHorizontal: spacing.sm,
    },
    activeRiskClearText: {
        color: colors.success,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    riskActionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    riskActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        minHeight: 40,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentSubtle,
        paddingHorizontal: spacing.md,
    },
    riskClearBtn: {
        borderColor: colors.success,
        backgroundColor: colors.successMuted,
    },
    riskActionText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    riskOverlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.62)",
        padding: spacing.lg,
    },
    riskModal: {
        width: "100%",
        maxWidth: 520,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
    },
    riskModalHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    riskModalTitle: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.xs,
    },
    riskModalText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    riskCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    riskPatternWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    riskPatternChip: {
        minHeight: 38,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
    riskPatternChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accent,
    },
    riskPatternText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    riskPatternTextActive: {
        color: colors.background,
    },
    riskSaveBtn: {
        minHeight: 46,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.lg,
    },
    riskSaveBtnDisabled: {
        opacity: 0.55,
    },
    riskSaveText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },

    // Day cards
    dayCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    dayCardActive: { borderColor: colors.accent, backgroundColor: colors.accentFill },
    dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dayIndexCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
    },
    dayIndexCircleActive: { backgroundColor: colors.accent },
    dayIndexText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted },
    dayIndexTextActive: { color: colors.background },
    dayLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
    restLabel: { color: colors.textMuted },
    currentBadge: { backgroundColor: colors.accent, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    currentBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.background },
    restBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        gap: 4,
    },
    restBadgeText: { fontSize: fontSize.xs, color: colors.textMuted },

    // Exercises
    exerciseList: { marginTop: spacing.sm, paddingLeft: 36 },
    exerciseRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs, gap: spacing.xs },
    exerciseDot: { fontSize: 10, color: colors.textMuted },
    exerciseName: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
    exerciseSets: { fontSize: fontSize.xs, color: colors.textMuted },
    noExercises: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs, paddingLeft: 36 },

    // Empty state
    emptyState: { alignItems: "center", paddingTop: spacing.xxxl, gap: spacing.md },
    emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" },
});

