// ─────────────────────────────────────────────
// HomeScreen — Dashboard
// Sıradaki antrenman (cycle-aware), hızlı başlat
// ─────────────────────────────────────────────
import React, { useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Animated,
    StyleSheet,
    FlatList,
    Dimensions,
    ActivityIndicator,
    TouchableOpacity,
    Image,
    Modal,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius, lineHeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { programApi, notificationApi } from "../services/api";
import { getCachedProfile, getProfileSnapshot } from "../services/authCacheService";
import { getCachedNotifications, updateNotificationCache, getNotificationSnapshot } from "../services/notificationCacheService";
import { useAuth } from "../store/AuthContext";
import { isCycleProgram } from "../types/workout";
import GymCard from "../components/GymCard";
import AccentButton from "../components/AccentButton";
import StatBadge from "../components/StatBadge";
import SectionHeader from "../components/SectionHeader";
import ActiveWorkoutBanner from "../components/ActiveWorkoutBanner";
import ActionConfirmModal from "../components/ActionConfirmModal";
import { SkeletonList } from "../components/SkeletonCard";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { useCountUp } from "../hooks/useCountUp";
import { calculateWorkoutStreak } from "../utils/streak";
import AnimatedPressable from "../components/AnimatedPressable";
import { requestMainTabSwitch } from "../utils/mainTabEvents";
import {
    navigateToFreeWorkoutRespectingActiveSession,
    navigateToWorkoutRespectingActiveSession,
} from "../utils/workoutNavigation";
import { navigateWithFeedback, NavigationFeedbackVariant } from "../utils/navigationFeedback";
import { cancelAllPreWorkoutReminderNotifications, reschedulePreWorkoutRemindersForProgram } from "../services/localNotificationService";
import { getCachedWorkoutSummaries, getWorkoutSummarySnapshot, subscribeToWorkoutCache } from "../services/workoutCacheService";
import { getPersistedWorkoutAnalyticsSnapshot } from "../services/workoutAnalyticsCacheService";
import { useMyProgramsQuery } from "../hooks/usePrograms";
import { logPerf, markPerf } from "../utils/perfLogger";
import { useStaleDataGuard } from "../hooks/useStaleDataGuard";
import { applyProgramDayIndex } from "../services/programDayProgressService";
import { useAppTourTarget } from "../contexts/AppTourContext";
import { hasPendingOnboardingTraining } from "../utils/appTourEvents";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WORKOUT_CARD_WIDTH = SCREEN_WIDTH * 0.7;

type HomeNav = NativeStackNavigationProp<RootStackParamList>;
const FAVORITES_KEY = "program_favorite_id";
const ACTIVE_PROGRAM_KEY = "active_program_id";
let savedHomeScrollY = 0;

export default function HomeScreen() {
    const navigation = useNavigation<HomeNav>();
    const { user, updateUser } = useAuth();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter();
    const { animStyle: headerAnimStyle } = useScreenEnter({ delay: 0 });
    const { animStyle: quickAnimStyle } = useScreenEnter({ delay: 80 });
    const { animStyle: statsAnimStyle } = useScreenEnter({ delay: 140 });
    const { animStyle: mainCardAnimStyle } = useScreenEnter({ delay: 200 });
    const { animStyle: listAnimStyle } = useScreenEnter({ delay: 260 });
    const navigateStatic = React.useCallback(
        (screen: keyof RootStackParamList, variant: NavigationFeedbackVariant = "detail") =>
            navigateWithFeedback(() => navigation.navigate(screen as any), { variant }),
        [navigation],
    );

    const [workouts, setWorkouts] = useState<any[]>([]);
    const { data: programs = [] } = useMyProgramsQuery();
    const [communityPrograms, setCommunityPrograms] = useState<any[]>([]);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [onboardingTrainingPending, setOnboardingTrainingPending] = useState(false);
    const totalWorkouts = workouts.length;
    const currentStreak = React.useMemo(() => {
        return calculateWorkoutStreak(workouts, programs, favoriteId);
    }, [workouts, programs, favoriteId]);
    const [progressEvents, setProgressEvents] = useState(0);
    const totalPRs = progressEvents;
    const animatedStreak = useCountUp(currentStreak);
    const [loading, setLoading] = useState(true);
    const [bannerRefresh, setBannerRefresh] = useState(0);
    const [dayPickerOpen, setDayPickerOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>(() => getNotificationSnapshot().notifications);
    const [unreadCount, setUnreadCount] = useState<number>(() => getNotificationSnapshot().unreadCount);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [quickWorkoutConfirmVisible, setQuickWorkoutConfirmVisible] = useState(false);
    const [notificationFilter, setNotificationFilter] = useState<"all" | "progress" | "reminder" | "program" | "social">("all");
    const [streakCelebration, setStreakCelebration] = useState<number | null>(null);
    const hasLoadedDashboard = React.useRef(false);
    const scrollRef = useRef<ScrollView | null>(null);
    const shouldRestoreScroll = useRef(false);
    const activationLift = useRef(new Animated.Value(0)).current;
    const activeCardPulse = useRef(new Animated.Value(0)).current;
    const streakCelebrationAnim = useRef(new Animated.Value(0)).current;
    const [activatedProgramId, setActivatedProgramId] = useState<string | null>(null);
    const tourOffsetsRef = React.useRef<Record<string, number>>({});
    const rememberTourOffset = React.useCallback((id: string) => (event: any) => {
        tourOffsetsRef.current[id] = event.nativeEvent.layout.y;
    }, []);
    const scrollToTourTarget = React.useCallback((id: string) => {
        const y = tourOffsetsRef.current[id] ?? 0;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 110), animated: true });
    }, []);
    const streakTourRef = useAppTourTarget("home.streak", { scrollTo: () => scrollToTourTarget("home.streak"), maxHeight: 72, maxWidthRatio: 0.62 });
    const headerActionsTourRef = useAppTourTarget("home.headerActions", { scrollTo: () => scrollToTourTarget("home.headerActions"), maxHeight: 64, maxWidthRatio: 0.42 });
    const quickWorkoutTourRef = useAppTourTarget("home.quickWorkout", { scrollTo: () => scrollToTourTarget("home.quickWorkout"), maxHeight: 68, padding: 4 });
    const statsTourRef = useAppTourTarget("home.stats", { scrollTo: () => scrollToTourTarget("home.stats"), maxHeight: 92, padding: 4 });
    const activeProgramTourRef = useAppTourTarget("home.activeProgram", { scrollTo: () => scrollToTourTarget("home.activeProgram"), maxHeight: 210, padding: 6 });
    const recentWorkoutsTourRef = useAppTourTarget("home.recentWorkouts", { scrollTo: () => scrollToTourTarget("home.recentWorkouts"), maxHeight: 48, padding: 4 });
    const programsTourRef = useAppTourTarget("home.programs", { scrollTo: () => scrollToTourTarget("home.programs"), maxHeight: 126, padding: 4 });
    const communityTourRef = useAppTourTarget("home.community", { scrollTo: () => scrollToTourTarget("home.community"), maxHeight: 126, padding: 4 });

    // 2 dakika TTL: stack ekrandan dönüşte sadece verisi bayatlamış HomeScreen yeniden yükler
    const { shouldReload: shouldReloadDashboard, markLoaded: markDashboardLoaded } = useStaleDataGuard(2 * 60 * 1000);

    React.useEffect(() => {
        if (!user?.id || loading || currentStreak <= 0) return;
        const key = `last_seen_streak:${user.id}`;
        let cancelled = false;
        AsyncStorage.getItem(key)
            .then((raw) => {
                if (cancelled) return;
                const previous = raw ? Number(raw) : null;
                if (previous === null || !Number.isFinite(previous)) {
                    AsyncStorage.setItem(key, String(currentStreak)).catch(() => undefined);
                    return;
                }
                if (currentStreak > previous) {
                    setStreakCelebration(currentStreak);
                    streakCelebrationAnim.setValue(0);
                    Animated.sequence([
                        Animated.timing(streakCelebrationAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
                        Animated.delay(2200),
                        Animated.timing(streakCelebrationAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
                    ]).start(() => setStreakCelebration(null));
                }
                AsyncStorage.setItem(key, String(currentStreak)).catch(() => undefined);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [currentStreak, loading, streakCelebrationAnim, user?.id]);

    // ── Memoized render-time hesaplamalar ─────────────────────────────────────
    // sortNewestFirst her render'da çalışmasın
    const sortedWorkouts = React.useMemo(() => sortNewestFirst(workouts), [workouts]);
    // countWorkoutSets her FlatList item render'ında çalışmasın
    const workoutSetCounts = React.useMemo(() => {
        const map: Record<string, number> = {};
        for (const w of workouts) map[w.id] = countWorkoutSets(w);
        return map;
    }, [workouts]);
    const recentProgramLogTimes = React.useMemo(() => {
        const map = new Map<string, number>();
        for (const workout of sortedWorkouts) {
            const time = new Date(workout?.logDate || workout?.createdAt || 0).getTime();
            if (!Number.isFinite(time) || time <= 0) continue;
            for (const key of getWorkoutProgramTraceKeys(workout)) {
                if (!map.has(key)) map.set(key, time);
            }
        }
        return map;
    }, [sortedWorkouts]);
    const displayedPrograms = React.useMemo(() => {
        return [...programs].sort((a: any, b: any) => {
            if (favoriteId) {
                if (a.id === favoriteId && b.id !== favoriteId) return -1;
                if (b.id === favoriteId && a.id !== favoriteId) return 1;
            }
            const aLast = getProgramLastLogTime(a, recentProgramLogTimes);
            const bLast = getProgramLastLogTime(b, recentProgramLogTimes);
            if (aLast !== bLast) return bLast - aLast;
            const aCreated = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bCreated = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return (Number.isFinite(bCreated) ? bCreated : 0) - (Number.isFinite(aCreated) ? aCreated : 0);
        });
    }, [favoriteId, programs, recentProgramLogTimes]);

    const loadDashboard = async () => {
        markPerf("home_data_ready");
        try {
            const cachedWorkouts = getWorkoutSummarySnapshot(30);
            const cachedProfile = getProfileSnapshot();

            if (cachedWorkouts.length > 0) {
                setWorkouts(sortNewestFirst(cachedWorkouts).slice(0, 100));
                setLoading(false);
            }
            if (cachedProfile) {
                setLoading(false);
            }

            // 1. Profile load (independent)
            getCachedProfile()
                .then((userRes) => {
                    if (userRes) {
                        updateUser(userRes);
                        setLoading(false);
                    }
                })
                .catch((err) => console.warn("[HomeScreen] Profile load failed:", err));

            getPersistedWorkoutAnalyticsSnapshot()
                .then((analytics) => {
                    if (analytics) setProgressEvents(analytics.progressEvents || 0);
                })
                .catch(() => undefined);

            // 2. Workout summaries load (independent and light)
            getCachedWorkoutSummaries(100)
                .then((workoutRes) => {
                    const fetchedWorkouts = sortNewestFirst(workoutRes || []).slice(0, 100);
                    setWorkouts(fetchedWorkouts);
                    setLoading(false);
                })
                .catch((err) => console.warn("[HomeScreen] Workouts load failed:", err));

            // 3. Community Programs load (independent background)
            programApi.listCommunity({ limit: 3 })
                .then((communityRes) => {
                    setCommunityPrograms(communityRes.data.programs || []);
                })
                .catch((communityErr) => {
                    console.warn("[HomeScreen] Community programs could not be loaded:", communityErr);
                    setCommunityPrograms([]);
                });

        } catch (error) {
            console.error("[HomeScreen] Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
            hasLoadedDashboard.current = true;
            logPerf("home_data_ready", "home_data_ready");
        }
    };

    const loadFavorite = async () => {
        const active = await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY);
        const legacyFav = await AsyncStorage.getItem(FAVORITES_KEY);
        const next = active || legacyFav;
        setFavoriteId(next);
        if (next && !active) {
            await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, next);
            await AsyncStorage.removeItem(FAVORITES_KEY);
        }
    };

    const loadNotifications = async () => {
        try {
            // Önce cache'den anlık göster, sonra background'da fetch et
            const snapshot = getNotificationSnapshot();
            if (snapshot.notifications.length > 0) {
                setNotifications(snapshot.notifications);
                setUnreadCount(snapshot.unreadCount);
            }
            const fresh = await getCachedNotifications();
            setNotifications(fresh.notifications);
            setUnreadCount(fresh.unreadCount);
        } catch (err) {
            console.warn("[HomeScreen] Notifications could not be loaded:", err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            shouldRestoreScroll.current = savedHomeScrollY > 0;
            if (shouldReloadDashboard()) {
                if (!hasLoadedDashboard.current) setLoading(true);
                markDashboardLoaded();
                loadDashboard();
                loadFavorite();
                loadNotifications();
            }
            hasPendingOnboardingTraining()
                .then(setOnboardingTrainingPending)
                .catch(() => setOnboardingTrainingPending(false));
            const restoreTimer = setTimeout(restoreScrollPosition, 50);
            return () => clearTimeout(restoreTimer);
        }, [])
    );

    React.useEffect(() => {
        const unsubWorkouts = subscribeToWorkoutCache(() => {
            loadDashboard().catch(() => undefined);
        });
        return () => {
            unsubWorkouts();
        };
    }, []);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        savedHomeScrollY = event.nativeEvent.contentOffset.y;
    };

    const restoreScrollPosition = () => {
        if (!shouldRestoreScroll.current || savedHomeScrollY <= 0) return;
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: savedHomeScrollY, animated: false });
        });
        shouldRestoreScroll.current = false;
    };

    // Refresh the active workout banner whenever screen gains focus
    useFocusEffect(
        useCallback(() => {
            setBannerRefresh((prev) => prev + 1);
        }, []),
    );

    const firstName = user?.firstName || "Sporcu";
    const lastName = user?.lastName || "";
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    const favoriteProgram = favoriteId
        ? programs.find((p: any) => p.id === favoriteId) || null
        : null;

    const toggleFavoriteProgram = async (id: string) => {
        const next = favoriteId === id ? null : id;
        setActivatedProgramId(id);
        setFavoriteId(next);
        if (next) await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, next);
        else await AsyncStorage.removeItem(ACTIVE_PROGRAM_KEY);
        await AsyncStorage.removeItem(FAVORITES_KEY);
        if (next) {
            const activeProgram = programs.find((program: any) => program.id === next);
            if (activeProgram && Array.isArray(activeProgram.data?.days)) {
                await reschedulePreWorkoutRemindersForProgram({
                    programId: activeProgram.id,
                    programName: activeProgram.name,
                    currentDayIndex: activeProgram.currentDayIndex || 0,
                    days: activeProgram.data.days,
                    reminders: user?.settings?.pre_workout_reminders_by_program?.[activeProgram.id],
                });
            }
            scrollRef.current?.scrollTo({ y: 210, animated: true });
        } else {
            await cancelAllPreWorkoutReminderNotifications();
        }
        activationLift.setValue(0);
        activeCardPulse.setValue(0);
        Animated.parallel([
            Animated.sequence([
                Animated.timing(activationLift, { toValue: 1, duration: 420, useNativeDriver: true }),
                Animated.timing(activationLift, { toValue: 0, duration: 120, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.timing(activeCardPulse, { toValue: 1, duration: 180, useNativeDriver: true }),
                Animated.timing(activeCardPulse, { toValue: 0, duration: 180, useNativeDriver: true }),
                Animated.timing(activeCardPulse, { toValue: 1, duration: 180, useNativeDriver: true }),
                Animated.timing(activeCardPulse, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]),
        ]).start(() => setActivatedProgramId(null));
    };

    const programActivationStyle = (id: string) => activatedProgramId === id
        ? {
            transform: [{ translateY: activationLift.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) }],
            opacity: activationLift.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 0.86, 0.25] }),
        }
        : undefined;

    const activeCardPulseStyle = {
        transform: [{ scale: activeCardPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }],
        opacity: activeCardPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
    };

    // ─── Cycle-aware next workout ───────────────
    const isCurrentProgramCycle = favoriteProgram && isCycleProgram(favoriteProgram.data);
    const currentDayIndex: number = favoriteProgram?.currentDayIndex ?? 0;
    const cycleData = isCurrentProgramCycle ? favoriteProgram!.data : null;
    const currentDay = cycleData?.days?.[currentDayIndex];
    const nextDayIndex = cycleData
        ? (currentDayIndex + 1) % cycleData.days.length
        : 0;
    const nextDay = cycleData?.days?.[nextDayIndex];
    const activeDayReminder = favoriteProgram
        ? user?.settings?.pre_workout_reminders_by_program?.[favoriteProgram.id]?.days?.[String(currentDayIndex)]
        : undefined;
    const activeDayReminderNote = String(activeDayReminder?.note || "").trim();
    const preWorkoutReminderNotification =
        activeDayReminder?.enabled === true && !!activeDayReminderNote && favoriteProgram && currentDay
            ? {
                id: "local-pre-workout-reminder",
                type: "reminder",
                title: "Antrenman hatirlatmasi",
                message: `${favoriteProgram.name} icin ${currentDay.label}: ${activeDayReminderNote}`,
                actionLabel: "Programi ac",
                actionScreen: "ProgramDetail",
                actionParams: { programId: favoriteProgram.id },
                readAt: null,
            }
            : null;
    const displayedNotifications = preWorkoutReminderNotification
        ? [preWorkoutReminderNotification, ...notifications.filter((item) => item.id !== preWorkoutReminderNotification.id)]
        : notifications;

    React.useEffect(() => {
        if (!favoriteProgram || !cycleData?.days?.length) return;
        reschedulePreWorkoutRemindersForProgram({
            programId: favoriteProgram.id,
            programName: favoriteProgram.name,
            currentDayIndex,
            days: cycleData.days,
            reminders: user?.settings?.pre_workout_reminders_by_program?.[favoriteProgram.id],
        }).catch((error) => {
            console.warn("[HomeScreen] Pre-workout local notifications could not be scheduled:", error);
        });
    }, [cycleData, currentDayIndex, favoriteProgram, user?.settings?.pre_workout_reminders_by_program]);

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }]}>
                <SkeletonList count={4} />
            </View>
        );
    }

    const filteredNotifications = displayedNotifications.filter((item) => {
        if (notificationFilter === "all") return true;
        const haystack = `${item.type || ""} ${item.title || ""} ${item.message || ""} ${item.actionScreen || ""}`.toLocaleLowerCase("tr-TR");
        if (notificationFilter === "progress") return haystack.includes("progress") || haystack.includes("pr") || haystack.includes("geli");
        if (notificationFilter === "reminder") return haystack.includes("hat") || haystack.includes("reminder") || haystack.includes("antrenman");
        if (notificationFilter === "program") return haystack.includes("program");
        if (notificationFilter === "social") return haystack.includes("star") || haystack.includes("yıldız") || haystack.includes("sosyal");
        return true;
    });
    const displayedUnreadCount = unreadCount + (preWorkoutReminderNotification ? 1 : 0);

    const selectActiveProgramDay = async (dayIndex: number) => {
        if (!favoriteProgram) return;
        await programApi.setDay(favoriteProgram.id, dayIndex);
        applyProgramDayIndex(favoriteProgram.id, dayIndex);
        setDayPickerOpen(false);
        await loadDashboard();
    };

    const openCurrentProgramDayDetail = () => {
        if (!favoriteProgram || !currentDay) return;
        navigateWithFeedback(() => navigation.navigate("ProgramDayDetail", {
            programId: favoriteProgram.id,
            programName: favoriteProgram.name,
            dayIndex: currentDayIndex,
            day: currentDay,
            programData: favoriteProgram.data,
        }));
    };

    const continueOnboardingTraining = () => {
        if (!favoriteProgram?.data) return;
        navigateWithFeedback(() => navigation.navigate("WorkoutSession", {
            programId: favoriteProgram.id,
            programName: favoriteProgram.name,
            dayIndex: 0,
            programData: favoriteProgram.data,
            trainingMode: "onboarding_demo",
        }));
    };

    const shareWorkoutSummary = async (workout: any) => {
        const durationSeconds = workout?.data?.totalDuration || workout?.data?.duration || workout?.totalDuration || workout?.duration || 0;
        const setCount = workoutSetCounts[workout.id] ?? countWorkoutSets(workout);
        const exerciseCount = Number(workout?.data?.exerciseCount || workout?.exerciseCount || 0);
        const totalVolume = Number(workout?.data?.totalVolume || workout?.totalVolume || 0);
        const lines = [
            workout?.title || "SmartProgress antrenman ozeti",
            (workout?.programName || workout?.data?.programName) ? `Program: ${workout.programName || workout.data?.programName}` : undefined,
            workout?.data?.dayLabel ? `Gun: ${workout.data.dayLabel}` : undefined,
            workout?.logDate ? `Tarih: ${formatDate(workout.logDate)}` : undefined,
            `Sure: ${formatDuration(durationSeconds)}`,
            exerciseCount > 0 ? `Egzersiz: ${exerciseCount}` : undefined,
            `Set: ${setCount}`,
            totalVolume > 0 ? `Yuk skoru: ${totalVolume.toFixed(1)}` : undefined,
            "SmartProgress ile loglandi.",
        ].filter(Boolean);
        try {
            await Share.share({
                title: workout?.title || "SmartProgress antrenman ozeti",
                message: lines.join("\n"),
            });
        } catch (error) {
            console.warn("[HomeScreen] Workout summary could not be shared:", error);
        }
    };

    const openNotification = async (notification: any) => {
        try {
            if (!notification.readAt && !String(notification.id).startsWith("local-")) {
                const res = await notificationApi.markRead(notification.id);
                const nextNotifs = res.data.notifications || [];
                const nextUnread = res.data.unreadCount || 0;
                setNotifications(nextNotifs);
                setUnreadCount(nextUnread);
                // Cache'i senkronize et — bir sonraki focus'ta ağa gitmesin
                updateNotificationCache(nextNotifs, nextUnread);
            }
        } catch (err) {
            console.warn("[HomeScreen] Notification could not be marked read:", err);
        }

        if (notification.actionScreen === "ProgramDetail" && notification.actionParams?.programId) {
            setNotificationsVisible(false);
            navigateWithFeedback(() => navigation.navigate("ProgramDetail", { programId: notification.actionParams.programId }));
        } else if (notification.actionScreen === "MyProgress") {
            requestMainTabSwitch("MyProgress");
            setNotificationsVisible(false);
        } else {
            setNotificationsVisible(false);
        }
    };

    const clearNotifications = async () => {
        try {
            const res = await notificationApi.clear();
            const nextNotifs = res.data.notifications || [];
            setNotifications(nextNotifs);
            updateNotificationCache(nextNotifs, 0);
        } catch (err) {
            console.warn("[HomeScreen] Failed to clear notifications:", err);
        }
    };

    return (
        <>
        <Animated.ScrollView
            ref={scrollRef}
            style={[styles.container, animStyle]}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={restoreScrollPosition}
        >
            {/* ─── Header ─── */}
            <Animated.View style={[styles.header, headerAnimStyle]}>
                <View ref={streakTourRef} collapsable={false} onLayout={rememberTourOffset("home.streak")}>
                    <View style={styles.streakRow}>
                        <Ionicons name="flame" size={22} color={colors.accent} />
                        <Text style={[styles.streakValue, { marginLeft: spacing.xs }]}>
                            {animatedStreak} Gündür
                        </Text>
                    </View>
                    <Text style={styles.streakText}>Antrenman Kaçırmadın</Text>
                </View>
                <View ref={headerActionsTourRef} collapsable={false} onLayout={rememberTourOffset("home.headerActions")} style={styles.headerActions}>
                    <AnimatedPressable
                        style={styles.notificationBtn}
                        onPress={() => setNotificationsVisible(true)}
                        pressedScale={0.94}
                    >
                        <View style={styles.notificationBtnContent}>
                        <Ionicons name="notifications-outline" size={22} color={colors.accent} />
                        {displayedUnreadCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>{displayedUnreadCount > 9 ? "9+" : displayedUnreadCount}</Text>
                            </View>
                        )}
                        </View>
                    </AnimatedPressable>
                    <AnimatedPressable
                        style={styles.avatarCircle}
                        onPress={() =>
                            (navigation as any).navigate("MainTabs", { screen: "Profile" })
                        }
                        pressedScale={0.94}
                    >
                        <View style={styles.avatarCircleContent}>
                        {user?.avatarUrl || user?.profileImage ? (
                            <Image source={{ uri: user.avatarUrl || user.profileImage }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>{initials}</Text>
                        )}
                        </View>
                    </AnimatedPressable>
                </View>
            </Animated.View>

            {/* ─── Active Workout Banner ─── */}
            <ActiveWorkoutBanner refreshKey={bannerRefresh} />

            <Animated.View ref={quickWorkoutTourRef} collapsable={false} onLayout={rememberTourOffset("home.quickWorkout")} style={quickAnimStyle}>
            <AnimatedPressable
                style={styles.quickWorkoutCard}
                onPress={() => setQuickWorkoutConfirmVisible(true)}
                pressedScale={0.99}
            >
                <View style={styles.quickWorkoutInner}>
                    <View style={styles.quickWorkoutIcon}>
                        <Ionicons name="flash-outline" size={20} color={colors.background} />
                    </View>
                    <View style={styles.quickWorkoutTextBlock}>
                        <Text style={styles.quickWorkoutTitle} numberOfLines={1}>Serbest antrenman</Text>
                        <Text style={styles.quickWorkoutSubtitle} numberOfLines={1}>
                            Program seçmeden hareket ekleyip logla
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
            </AnimatedPressable>
            </Animated.View>

            {/* ─── Stats Row ─── */}
            <Animated.View ref={statsTourRef} collapsable={false} onLayout={rememberTourOffset("home.stats")} style={[styles.statsRow, statsAnimStyle]}>
                <StatBadge
                    value={totalWorkouts}
                    label="Antrenman"
                    icon={<Ionicons name="barbell-outline" size={18} color={colors.accent} />}
                />
                <View style={{ width: spacing.sm }} />
                <StatBadge
                    value={currentStreak}
                    label="Seri"
                    accentValue
                    icon={<Ionicons name="flame-outline" size={18} color={colors.accent} />}
                />
                <View style={{ width: spacing.sm }} />
                <StatBadge
                    value={totalPRs}
                    label="Progress"
                    icon={<Ionicons name="trending-up-outline" size={18} color={colors.accent} />}
                />
            </Animated.View>

            {/* ─── Sıradaki Antrenman (Cycle-Based) ─── */}
            <View>
            {onboardingTrainingPending && favoriteProgram ? (
                <Animated.View style={mainCardAnimStyle}>
                    <GymCard elevated style={styles.trainingContinueCard}>
                        <View style={styles.trainingContinueHeader}>
                            <View style={styles.trainingContinueIcon}>
                                <Ionicons name="school-outline" size={20} color={colors.background} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.trainingContinueTitle}>Loglama egitimi yarim kaldi</Text>
                                <Text style={styles.trainingContinueText}>
                                    Demo antrenman gercek kayit olusturmaz. Set loglamayi tamamlayip sonra hatirlatici kurabilirsin.
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.trainingContinueBtn} onPress={continueOnboardingTraining} activeOpacity={0.84}>
                            <Text style={styles.trainingContinueBtnText}>Egitime devam et</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.background} />
                        </TouchableOpacity>
                    </GymCard>
                </Animated.View>
            ) : null}

            {favoriteProgram && isCurrentProgramCycle && currentDay && (
                <Animated.View ref={activeProgramTourRef} collapsable={false} onLayout={rememberTourOffset("home.activeProgram")} style={mainCardAnimStyle}>
                <Animated.View style={activeCardPulseStyle}>
                <TouchableOpacity activeOpacity={0.94} onPress={openCurrentProgramDayDetail}>
                <GymCard elevated style={styles.todayCard}>
                    <View style={styles.todayHeader}>
                        <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>SIRADAKI ANTRENMAN</Text>
                        </View>
                        <TouchableOpacity onPress={() => toggleFavoriteProgram(favoriteProgram.id)}>
                            <Ionicons name="bookmark" size={20} color={colors.accent} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.todayProgName}>{favoriteProgram.name}</Text>
                    <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={openCurrentProgramDayDetail}
                    >
                        <View style={styles.todayDayAction}>
                            <Text style={styles.todayDayLabel}>{currentDay.label}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                        </View>
                    </TouchableOpacity>

                    {/* Exercise preview */}
                    {currentDay.exercises.length > 0 ? (
                        <View style={styles.exercisePreviewList}>
                            {currentDay.exercises.slice(0, 3).map((ex: any, i: number) => (
                                <View key={i} style={styles.exercisePreviewRow}>
                                    <View style={styles.exercisePreviewDot} />
                                    <Text style={styles.exercisePreviewText}>
                                        {ex.name}
                                        {ex.targetSets?.length > 0
                                            ? ` · ${ex.targetSets.length} set × ${ex.targetSets[0].targetReps} tekrar`
                                            : ""}
                                    </Text>
                                </View>
                            ))}
                            {currentDay.exercises.length > 3 && (
                                <Text style={styles.exerciseMoreText}>
                                    +{currentDay.exercises.length - 3} egzersiz daha
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.offDayText}>🛌 Dinlenme Günü</Text>
                    )}

                    {/* Frequency badge */}
                    <View style={styles.freqBadgeRow}>
                        <View style={styles.freqBadge}>
                            <Ionicons name="calendar-outline" size={12} color={colors.accent} />
                            <Text style={styles.freqBadgeText}>
                                Gün {currentDayIndex + 1}/{cycleData?.days.length}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.changeDayBtn}
                            onPress={() => setDayPickerOpen((prev) => !prev)}
                            activeOpacity={0.82}
                        >
                            <Ionicons name="swap-horizontal-outline" size={13} color={colors.textSecondary} />
                            <Text style={styles.changeDayText}>Gün değiştir</Text>
                        </TouchableOpacity>
                    </View>

                    {dayPickerOpen ? (
                        <View style={styles.dayPickerPanel}>
                            {cycleData?.days.map((day: any, index: number) => (
                                <TouchableOpacity
                                    key={`${day.label}-${index}`}
                                    style={[
                                        styles.dayPickerChip,
                                        index === currentDayIndex && styles.dayPickerChipActive,
                                    ]}
                                    onPress={() => selectActiveProgramDay(index)}
                                    activeOpacity={0.82}
                                >
                                    <Text
                                        style={[
                                            styles.dayPickerChipText,
                                            index === currentDayIndex && styles.dayPickerChipTextActive,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {index + 1}. {day.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    <AccentButton
                        title={currentDay.exercises.length > 0 ? "Antrenmanı Başlat" : "Sonraki Güne Geç"}
                        onPress={() => {
                            if (currentDay.exercises.length > 0) {
                                navigateToWorkoutRespectingActiveSession(navigation, {
                                    programId: favoriteProgram.id,
                                    programName: favoriteProgram.name,
                                    dayIndex: currentDayIndex,
                                    programData: favoriteProgram.data,
                                });
                            } else {
                                // Rest day — advance without a session
                                programApi.advanceDay(favoriteProgram.id).then(() => {
                                    applyProgramDayIndex(favoriteProgram.id, nextDayIndex);
                                    loadDashboard();
                                });
                            }
                        }}
                        style={{ marginTop: spacing.md, minHeight: 56 }}
                    />
                </GymCard>
                </TouchableOpacity>
                </Animated.View>
                </Animated.View>
            )}

            {/* ─── Aktif Program (Non-Cycle) ─── */}
            {favoriteProgram && !isCurrentProgramCycle && (
                <Animated.View ref={activeProgramTourRef} collapsable={false} onLayout={rememberTourOffset("home.activeProgram")} style={mainCardAnimStyle}>
                <Animated.View style={activeCardPulseStyle}>
                <GymCard elevated style={styles.todayCard}>
                    <View style={styles.todayHeader}>
                        <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>AKTİF PROGRAMIN</Text>
                        </View>
                        <TouchableOpacity onPress={() => toggleFavoriteProgram(favoriteProgram.id)}>
                            <Ionicons name="bookmark" size={20} color={colors.accent} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.todayProgName}>{favoriteProgram.name}</Text>
                    {favoriteProgram.description ? (
                        <Text style={styles.todayProgDesc} numberOfLines={2}>
                            {favoriteProgram.description}
                        </Text>
                    ) : null}
                    <AccentButton
                        title="Aktif Programı Başlat"
                        onPress={() =>
                            navigateToWorkoutRespectingActiveSession(navigation, {
                                programId: favoriteProgram.id,
                                programName: favoriteProgram.name,
                                programData: favoriteProgram.data,
                            })
                        }
                        style={{ marginTop: spacing.md, minHeight: 56 }}
                    />
                </GymCard>
                </Animated.View>
                </Animated.View>
            )}

            {/* ─── No Favorite Hint ─── */}
            {!favoriteProgram && programs.length > 0 && (
                <Animated.View ref={activeProgramTourRef} collapsable={false} onLayout={rememberTourOffset("home.activeProgram")} style={mainCardAnimStyle}>
                <GymCard style={styles.todayCard}>
                    <Text style={styles.todayHint}>
                        Bir programı uzun basarak aktif takibe al; buraya "Sıradaki Antrenman" olarak sabitlensin.
                    </Text>
                </GymCard>
                </Animated.View>
            )}
            {!favoriteProgram && programs.length === 0 && (
                <Animated.View ref={activeProgramTourRef} collapsable={false} onLayout={rememberTourOffset("home.activeProgram")} style={mainCardAnimStyle}>
                <GymCard style={styles.todayCard}>
                    <Text style={styles.todayHint}>
                        Programını oluşturduktan sonra sıradaki antrenman ve aktif gün bilgisi burada görünecek.
                    </Text>
                </GymCard>
                </Animated.View>
            )}

            {/* ─── Recent Workouts ─── */}
            </View>

            <View>
            <View ref={recentWorkoutsTourRef} collapsable={false} onLayout={rememberTourOffset("home.recentWorkouts")}>
            <SectionHeader
                title="Son Antrenmanlar"
                actionLabel="Tümü"
                onAction={() => navigateStatic("WorkoutHistory")}
            />
            </View>
            {workouts.length > 0 ? (
                <Animated.View style={listAnimStyle}>
                <FlatList
                    data={sortedWorkouts}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                    directionalLockEnabled
                    disableIntervalMomentum
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.workoutList}
                    renderItem={({ item }) => (
                        <AnimatedPressable
                            pressedScale={0.985}
                            onPress={() => navigateWithFeedback(() => navigation.navigate("WorkoutDetail", { workout: item }))}
                        >
                            <GymCard elevated style={[styles.workoutCard, { width: WORKOUT_CARD_WIDTH }]}>
                                <View style={styles.workoutCardHeader}>
                                    <Text style={styles.workoutTitle} numberOfLines={1}>{item.title}</Text>
                                    <TouchableOpacity
                                        style={styles.workoutShareBtn}
                                        onPress={(event) => {
                                            event.stopPropagation();
                                            shareWorkoutSummary(item);
                                        }}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="share-social-outline" size={16} color={colors.accent} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.workoutDate}>
                                    {formatDate(item.logDate)}
                                </Text>
                                <View style={styles.workoutSummaryRow}>
                                    <Text style={styles.workoutSummaryText}>
                                        {workoutSetCounts[item.id] ?? 0} set
                                    </Text>
                                    <View style={styles.workoutSummaryDot} />
                                    <Text style={styles.workoutSummaryText}>
                                        {formatDuration(item.data?.totalDuration || item.data?.duration || 0)}
                                    </Text>
                                </View>
                            </GymCard>
                        </AnimatedPressable>
                    )}
                    ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
                />
                </Animated.View>
            ) : (
                <Text style={styles.emptyStateText}>Henüz antrenman kaydınız yok.</Text>
            )}

            {/* ─── My Programs ─── */}
            <View ref={programsTourRef} collapsable={false} onLayout={rememberTourOffset("home.programs")}>
                <SectionHeader
                    title="Programlarım"
                    actionLabel={programs.length > 3 ? "Tümü" : "Yeni Oluştur"}
                    onAction={() => programs.length > 3 ? navigateStatic("ProgramList") : navigateStatic("ProgramCreate", "modal")}
                />
            </View>
            </View>

            <View>
            {programs.length > 3 && (
                <TouchableOpacity
                    style={styles.inlineCreateBtn}
                    onPress={() => navigateStatic("ProgramCreate", "modal")}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                    <Text style={styles.inlineCreateText}>Yeni program oluştur</Text>
                </TouchableOpacity>
            )}
            {displayedPrograms.length > 0 ? (
                displayedPrograms.slice(0, 3).map((prog: any, index: number) => {
                    const isCycle = isCycleProgram(prog.data);
                    const dayIdx = prog.currentDayIndex ?? 0;
                    const dayCount = isCycle ? prog.data.days.length : 0;
                    return (
                        <Animated.View
                            key={prog.id}
                            style={programActivationStyle(prog.id)}
                        >
                        <AnimatedPressable
                            pressedScale={0.985}
                            onPress={() => navigateWithFeedback(() => {
                                navigation.navigate("ProgramDetail", {
                                    programId: prog.id,
                                });
                            })}
                            onLongPress={() => toggleFavoriteProgram(prog.id)}
                        >
                            <GymCard style={styles.programCard} elevated>
                                <View style={styles.programHeader}>
                                    <Text style={styles.programName}>{prog.name}</Text>
                                    <View style={styles.programBadgeRow}>
                                        {favoriteId === prog.id && (
                                            <Ionicons name="bookmark" size={16} color={colors.accent} style={{ marginRight: spacing.xs }} />
                                        )}
                                        {isCycle && (
                                            <View style={styles.cycleBadge}>
                                                <Text style={styles.cycleBadgeText}>🔄 {dayIdx + 1}/{dayCount}</Text>
                                            </View>
                                        )}
                                        {prog.isPublic && (
                                            <View style={styles.publicBadge}>
                                                <Text style={styles.publicBadgeText}>PUBLIC</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Text style={styles.programDesc} numberOfLines={2}>
                                    {prog.description || (isCycle
                                        ? `${dayCount} günlük döngüsel program${prog.data?.frequency ? ` · Haftada ${prog.data.frequency} gün` : ""}`
                                        : "Açıklama yok.")}
                                </Text>
                            </GymCard>
                        </AnimatedPressable>
                        </Animated.View>
                    );
                })
            ) : (
                <Text style={styles.emptyStateText}>Henüz bir program oluşturmadınız.</Text>
            )}

            <View ref={communityTourRef} collapsable={false} onLayout={rememberTourOffset("home.community")}>
                <SectionHeader
                    title="Topluluk Programları"
                    actionLabel="Keşfet"
                    onAction={() => navigateStatic("CommunityPrograms")}
                />
            </View>
            </View>

            <View>
            {communityPrograms.length > 0 ? (
                communityPrograms.map((prog, index) => {
                    const owner =
                        prog.user?.nickname ||
                        [prog.user?.firstName, prog.user?.lastName].filter(Boolean).join(" ") ||
                        "Topluluk";
                    const ownerInitials =
                        `${prog.user?.firstName?.charAt(0) || ""}${prog.user?.lastName?.charAt(0) || ""}`.trim().toUpperCase() ||
                        owner.slice(0, 2).toUpperCase();
                    const dayCount = Array.isArray(prog.data?.days)
                        ? prog.data.days.length
                        : Array.isArray(prog.data?.exercises)
                            ? prog.data.exercises.length
                            : 0;

                    return (
                        <View
                            key={prog.id}
                        >
                        <AnimatedPressable
                            pressedScale={0.985}
                            onPress={() => navigateWithFeedback(() => navigation.navigate("ProgramDetail", { programId: prog.id }))}
                        >
                            <GymCard style={styles.communityCard} elevated>
                                <View style={styles.programHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.programName} numberOfLines={1}>{prog.name}</Text>
                                        <View style={styles.communityOwnerRow}>
                                            {prog.user?.avatarUrl ? (
                                                <Image source={{ uri: prog.user.avatarUrl }} style={styles.communityOwnerAvatar} />
                                            ) : (
                                                <View style={styles.communityOwnerAvatarFallback}>
                                                    <Text style={styles.communityOwnerAvatarText}>{ownerInitials}</Text>
                                                </View>
                                            )}
                                            <Text style={styles.communityOwner} numberOfLines={1}>{owner}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.communityStar}>
                                        <Ionicons name="star" size={15} color={colors.accent} />
                                        <Text style={styles.communityStarText}>{prog.starCount || 0}</Text>
                                    </View>
                                </View>
                                <Text style={styles.programDesc} numberOfLines={2}>
                                    {prog.description || `${dayCount} günlük public program`}
                                </Text>
                            </GymCard>
                        </AnimatedPressable>
                        </View>
                    );
                })
            ) : (
                <Text style={styles.emptyStateText}>Toplulukta henüz public program yok.</Text>
            )}
            </View>

            <View style={{ height: spacing.xxxl }} />
        </Animated.ScrollView>
        <ActionConfirmModal
            visible={quickWorkoutConfirmVisible}
            title="Antrenman başlatılsın mı?"
            message="Serbest antrenman program seçmeden boş bir log ekranı açar. Yanlışlıkla dokunduysan iptal edebilirsin."
            primaryLabel="Evet, başlat"
            secondaryLabel="Hayır"
            onPrimary={() => {
                setQuickWorkoutConfirmVisible(false);
                navigateToFreeWorkoutRespectingActiveSession(navigation);
            }}
            onSecondary={() => setQuickWorkoutConfirmVisible(false)}
            onDismiss={() => setQuickWorkoutConfirmVisible(false)}
        />
        {streakCelebration !== null && (
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.streakCelebration,
                    {
                        top: insets.top + spacing.md,
                        opacity: streakCelebrationAnim,
                        transform: [
                            {
                                translateY: streakCelebrationAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-18, 0],
                                }),
                            },
                            {
                                scale: streakCelebrationAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.96, 1],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <View style={styles.streakCelebrationIcon}>
                    <Ionicons name="flame" size={20} color={colors.background} />
                </View>
                <View style={styles.streakCelebrationCopy}>
                    <Text style={styles.streakCelebrationTitle}>Seri artti</Text>
                    <Text style={styles.streakCelebrationText}>{streakCelebration} gunluk seri yakaladin.</Text>
                </View>
            </Animated.View>
        )}
        <Modal
            visible={notificationsVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setNotificationsVisible(false)}
        >
            <View style={styles.notificationOverlay}>
                <View style={styles.notificationModal}>
                    <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>Bildirimler</Text>
                        <View style={styles.notificationHeaderActions}>
                            {displayedNotifications.length > 0 ? (
                                <TouchableOpacity onPress={clearNotifications} style={styles.notificationClearBtn}>
                                    <Text style={styles.notificationClearText}>Temizle</Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.notificationFilterBar}>
                        {([
                            ["all", "Tümü"],
                            ["progress", "Progress"],
                            ["reminder", "Hatırlatıcı"],
                            ["program", "Program"],
                            ["social", "Sosyal"],
                        ] as const).map(([key, label]) => (
                            <TouchableOpacity
                                key={key}
                                style={[styles.notificationFilterChip, notificationFilter === key && styles.notificationFilterChipActive]}
                                onPress={() => setNotificationFilter(key)}
                                activeOpacity={0.82}
                            >
                                <Text style={[styles.notificationFilterText, notificationFilter === key && styles.notificationFilterTextActive]}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {filteredNotifications.length === 0 ? (
                        <View style={styles.notificationEmpty}>
                            <Ionicons name="notifications-off-outline" size={34} color={colors.textMuted} />
                            <Text style={styles.notificationEmptyText}>Şimdilik bildirimin yok.</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={false}>
                        {filteredNotifications.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.notificationItem, !item.readAt && styles.notificationItemUnread]}
                                onPress={() => openNotification(item)}
                                activeOpacity={0.82}
                            >
                                <View style={styles.notificationDotWrap}>
                                    {!item.readAt ? <View style={styles.notificationDot} /> : null}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.notificationItemTitle}>{item.title}</Text>
                                    <Text style={styles.notificationItemMessage}>{item.message}</Text>
                                    {item.actionLabel ? (
                                        <Text style={styles.notificationAction}>{item.actionLabel}</Text>
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
        </>
    );
}

// ─── Helpers ────────────────────────────────

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function sortNewestFirst(items: any[]): any[] {
    return [...items].sort((a, b) => {
        const left = new Date(b.logDate || b.createdAt || 0).getTime();
        const right = new Date(a.logDate || a.createdAt || 0).getTime();
        return left - right;
    });
}

function normalizeProgramKey(value: unknown): string {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, " ");
}

function getWorkoutProgramTraceKeys(workout: any): string[] {
    const keys = new Set<string>();
    const programId =
        workout?.programId ||
        workout?.data?.programId ||
        workout?.data?.sourceProgramId ||
        workout?.sourceProgramId;
    const programName =
        workout?.programName ||
        workout?.data?.programName ||
        workout?.data?.sourceProgramName;
    if (programId) keys.add(`id:${String(programId)}`);
    const normalizedName = normalizeProgramKey(programName);
    if (normalizedName) keys.add(`name:${normalizedName}`);
    return Array.from(keys);
}

function getProgramLastLogTime(program: any, recentLogTimes: Map<string, number>): number {
    const idMatch = program?.id ? recentLogTimes.get(`id:${String(program.id)}`) : undefined;
    if (idMatch) return idMatch;
    const nameMatch = recentLogTimes.get(`name:${normalizeProgramKey(program?.name)}`);
    return nameMatch || 0;
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}dk ${s > 0 ? `${s}sn` : ""}`.trim();
}

function countWorkoutSets(workout: any): number {
    if (Number(workout?.data?.setCount || 0) > 0) return Number(workout.data.setCount);
    const exercises = Array.isArray(workout?.data?.exercises) ? workout.data.exercises : [];
    const counted = exercises.reduce((sum: number, exercise: any) => {
        const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
        return sum + sets.filter((set: any) => !set?.isWarmup).length;
    }, 0);
    return counted || Number(workout?.data?.exerciseCount || 0);
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    notificationBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    notificationBtnContent: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    notificationBadge: {
        position: "absolute",
        top: -3,
        right: -3,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.error,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: colors.background,
    },
    notificationBadgeText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: fontWeight.bold,
    },
    notificationOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.62)",
        justifyContent: "flex-start",
        paddingTop: spacing.xxxl + spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    notificationModal: {
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        maxHeight: "76%",
    },
    notificationList: {
        maxHeight: 390,
        flexGrow: 0,
    },
    notificationFilterBar: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        paddingBottom: spacing.md,
        marginBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    notificationFilterChip: {
        minHeight: 34,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceElevated,
    },
    notificationFilterChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    notificationFilterText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    notificationFilterTextActive: {
        color: colors.accent,
    },
    notificationHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
    },
    notificationHeaderActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    notificationClearBtn: {
        minHeight: 34,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    notificationClearText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    notificationTitle: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
    },
    notificationEmpty: {
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.xl,
    },
    notificationEmptyText: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
    },
    notificationItem: {
        flexDirection: "row",
        gap: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    notificationItemUnread: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    notificationDotWrap: {
        width: 10,
        paddingTop: 6,
        alignItems: "center",
    },
    notificationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.accent,
    },
    notificationItemTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        marginBottom: 4,
    },
    notificationItemMessage: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: lineHeight.sm,
    },
    notificationAction: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        marginTop: spacing.xs,
    },
    streakRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.xs,
    },
    streakValue: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    streakText: {
        fontSize: fontSize.sm,
        color: colors.accent,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.5,
    },
    streakCelebration: {
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        zIndex: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.surface,
        padding: spacing.md,
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    streakCelebrationIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    streakCelebrationCopy: { flex: 1, minWidth: 0 },
    streakCelebrationTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    streakCelebrationText: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    avatarCircle: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.accentMuted,
        borderWidth: 2, borderColor: colors.accent,
        alignItems: "center", justifyContent: "center",
    },
    avatarCircleContent: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    avatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarText: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    quickWorkoutCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.lg,
    },
    quickWorkoutInner: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        minHeight: 54,
    },
    quickWorkoutIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        flexShrink: 0,
        marginRight: spacing.sm,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    quickWorkoutTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    quickWorkoutTextBlock: {
        flex: 1,
        minWidth: 0,
        justifyContent: "center",
        paddingRight: spacing.sm,
    },
    quickWorkoutSubtitle: {
        marginTop: 2,
        fontSize: fontSize.xs,
        lineHeight: 16,
        color: colors.textSecondary,
    },
    statsRow: { flexDirection: "row", marginBottom: spacing.xl },
    // Today/Next Card
    trainingContinueCard: {
        marginBottom: spacing.lg,
        borderColor: colors.accent,
        borderWidth: 1,
        backgroundColor: colors.accentMuted,
    },
    trainingContinueHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
    },
    trainingContinueIcon: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    trainingContinueTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    trainingContinueText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
        marginTop: 3,
    },
    trainingContinueBtn: {
        minHeight: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    trainingContinueBtnText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    todayCard: { marginBottom: spacing.xxl, borderColor: colors.accent, borderWidth: 1 },
    todayHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: spacing.sm,
    },
    todayBadge: {
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    todayBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.accent },
    todayProgName: {
        fontSize: fontSize.xl, fontWeight: fontWeight.heavy,
        color: colors.text, marginBottom: spacing.xs,
    },
    todayDayLabel: {
        fontSize: fontSize.md, fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    todayDayAction: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    todayProgDesc: {
        fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: lineHeight.sm,
    },
    todayHint: {
        fontSize: fontSize.sm, color: colors.textSecondary,
        fontStyle: "italic", textAlign: "center",
    },
    exercisePreviewList: { marginBottom: spacing.sm },
    exercisePreviewRow: {
        flexDirection: "row", alignItems: "center",
        marginBottom: spacing.xs, gap: spacing.sm,
    },
    exercisePreviewDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: colors.accent,
    },
    exercisePreviewText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
    exerciseMoreText: {
        fontSize: fontSize.xs, color: colors.textMuted,
        fontStyle: "italic", marginTop: spacing.xs,
    },
    offDayText: {
        fontSize: fontSize.md, color: colors.textSecondary,
        textAlign: "center", paddingVertical: spacing.md,
    },
    freqBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        flexWrap: "wrap",
        marginBottom: spacing.sm,
    },
    freqBadge: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full, gap: spacing.xs,
    },
    freqBadgeText: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold },
    changeDayBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    changeDayText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: fontWeight.semibold,
    },
    dayPickerPanel: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    dayPickerChip: {
        maxWidth: "100%",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dayPickerChipActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    dayPickerChipText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.textSecondary,
    },
    dayPickerChipTextActive: {
        color: colors.background,
    },
    // Workouts
    workoutList: { paddingBottom: spacing.xl },
    workoutCard: { marginBottom: spacing.sm },
    workoutCardHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: spacing.sm,
    },
    workoutTitle: {
        fontSize: fontSize.lg, fontWeight: fontWeight.bold,
        color: colors.text, flex: 1,
    },
    workoutShareBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        marginLeft: spacing.sm,
    },
    sportBadge: {
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    sportBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.accent },
    workoutDate: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
    workoutSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    workoutSummaryText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: fontWeight.medium,
    },
    workoutSummaryDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.textMuted,
    },
    // Programs
    programCard: { marginBottom: spacing.md },
    programHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: spacing.sm,
    },
    programName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, flex: 1 },
    programBadgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    cycleBadge: {
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    cycleBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.accent },
    publicBadge: {
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    publicBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.accent },
    communityCard: { marginBottom: spacing.md },
    communityOwnerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: 4,
    },
    communityOwner: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        flex: 1,
    },
    communityOwnerAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.surfaceElevated,
    },
    communityOwnerAvatarFallback: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    communityOwnerAvatarText: {
        fontSize: 8,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    communityStar: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    communityStarText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    programDesc: {
        fontSize: fontSize.sm, color: colors.textSecondary,
        marginBottom: spacing.xs, lineHeight: lineHeight.sm,
    },
    inlineCreateBtn: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accentMuted,
    },
    inlineCreateText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    emptyStateText: {
        fontSize: fontSize.sm, color: colors.textMuted,
        fontStyle: "italic", marginBottom: spacing.xl,
    },
});
