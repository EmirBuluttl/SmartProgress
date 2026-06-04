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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius, lineHeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { workoutApi, programApi, authApi, notificationApi } from "../services/api";
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
import { syncPendingWorkouts } from "../services/syncService";
import { countProgressEvents } from "../utils/workoutMetrics";
import { calculateWorkoutStreak } from "../utils/streak";
import AnimatedPressable from "../components/AnimatedPressable";
import { requestMainTabSwitch } from "../utils/mainTabEvents";
import { navigateToWorkoutRespectingActiveSession } from "../utils/workoutNavigation";

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

    const [workouts, setWorkouts] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [communityPrograms, setCommunityPrograms] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalWorkouts: 0, currentStreak: 0, totalPRs: 0 });
    const animatedStreak = useCountUp(stats.currentStreak);
    const [loading, setLoading] = useState(true);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [bannerRefresh, setBannerRefresh] = useState(0);
    const [dayPickerOpen, setDayPickerOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [quickWorkoutConfirmVisible, setQuickWorkoutConfirmVisible] = useState(false);
    const [notificationFilter, setNotificationFilter] = useState<"all" | "progress" | "reminder" | "program" | "social">("all");
    const hasLoadedDashboard = React.useRef(false);
    const scrollRef = useRef<ScrollView | null>(null);
    const shouldRestoreScroll = useRef(false);
    const activationLift = useRef(new Animated.Value(0)).current;
    const activeCardPulse = useRef(new Animated.Value(0)).current;
    const [activatedProgramId, setActivatedProgramId] = useState<string | null>(null);

    const loadDashboard = async () => {
        try {
            // Sync any pending workouts first so they appear in the list
            try {
                await syncPendingWorkouts();
            } catch (syncErr) {
                console.warn("[HomeScreen] Pending sync hatası:", syncErr);
            }

            const [userRes, workoutRes, progRes] = await Promise.all([
                authApi.getProfile(),
                workoutApi.list({ limit: 20 }),
                programApi.listMine(),
            ]);
            const fetchedWorkouts = sortNewestFirst(workoutRes.data.workouts || []);
            if (userRes.data) updateUser(userRes.data);
            setWorkouts(fetchedWorkouts);

            const myPrograms = progRes.data.programs || [];
            console.log(
                "[HomeScreen] Loaded programs from listMine:",
                JSON.stringify(
                    myPrograms.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        hasData: !!p.data,
                    })),
                    null,
                    2,
                ),
            );
            setPrograms(myPrograms);

            const activeProgramId =
                (await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY)) ||
                (await AsyncStorage.getItem(FAVORITES_KEY));
            const streak = calculateWorkoutStreak(fetchedWorkouts, myPrograms || [], activeProgramId);
            setStats({
                totalWorkouts: workoutRes.data.count || fetchedWorkouts.length,
                currentStreak: streak,
                totalPRs: countProgressEvents(fetchedWorkouts),
            });

            try {
                const communityRes = await programApi.listCommunity({ limit: 3 });
                setCommunityPrograms(communityRes.data.programs || []);
            } catch (communityErr) {
                console.warn("[HomeScreen] Community programs could not be loaded:", communityErr);
                setCommunityPrograms([]);
            }
        } catch (error) {
            console.error("[HomeScreen] Failed to load dashboard data:", error);
        } finally {
            hasLoadedDashboard.current = true;
            setLoading(false);
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
            const res = await notificationApi.list({ limit: 20 });
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (err) {
            console.warn("[HomeScreen] Notifications could not be loaded:", err);
            setNotifications([]);
            setUnreadCount(0);
        }
    };

    useFocusEffect(
        useCallback(() => {
            shouldRestoreScroll.current = savedHomeScrollY > 0;
            if (!hasLoadedDashboard.current) {
                setLoading(true);
            }
            loadDashboard();
            loadFavorite();
            loadNotifications();
            const restoreTimer = setTimeout(restoreScrollPosition, 50);
            return () => clearTimeout(restoreTimer);
        }, [])
    );

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

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }]}>
                <SkeletonList count={4} />
            </View>
        );
    }

    const firstName = user?.firstName || "Sporcu";
    const lastName = user?.lastName || "";
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    const favoriteProgram = favoriteId
        ? programs.find((p) => p.id === favoriteId) || null
        : null;

    const toggleFavoriteProgram = async (id: string) => {
        const next = favoriteId === id ? null : id;
        setActivatedProgramId(id);
        setFavoriteId(next);
        if (next) await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, next);
        else await AsyncStorage.removeItem(ACTIVE_PROGRAM_KEY);
        await AsyncStorage.removeItem(FAVORITES_KEY);
        if (next) {
            scrollRef.current?.scrollTo({ y: 210, animated: true });
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
        setDayPickerOpen(false);
        await loadDashboard();
    };

    const openCurrentProgramDayDetail = () => {
        if (!favoriteProgram || !currentDay) return;
        navigation.navigate("ProgramDayDetail", {
            programId: favoriteProgram.id,
            programName: favoriteProgram.name,
            dayIndex: currentDayIndex,
            day: currentDay,
            programData: favoriteProgram.data,
        });
    };

    const openNotification = async (notification: any) => {
        try {
            if (!notification.readAt && !String(notification.id).startsWith("local-")) {
                const res = await notificationApi.markRead(notification.id);
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (err) {
            console.warn("[HomeScreen] Notification could not be marked read:", err);
        }

        if (notification.actionScreen === "ProgramDetail" && notification.actionParams?.programId) {
            setNotificationsVisible(false);
            navigation.navigate("ProgramDetail", { programId: notification.actionParams.programId });
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
            setNotifications(res.data.notifications || []);
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
                <View>
                    <View style={styles.streakRow}>
                        <Ionicons name="flame" size={22} color={colors.accent} />
                        <Text style={[styles.streakValue, { marginLeft: spacing.xs }]}>
                            {animatedStreak} Gündür
                        </Text>
                    </View>
                    <Text style={styles.streakText}>Antrenman Kaçırmadın</Text>
                </View>
                <View style={styles.headerActions}>
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

            <Animated.View style={quickAnimStyle}>
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
            <Animated.View style={[styles.statsRow, statsAnimStyle]}>
                <StatBadge
                    value={stats.totalWorkouts}
                    label="Antrenman"
                    icon={<Ionicons name="barbell-outline" size={18} color={colors.accent} />}
                />
                <View style={{ width: spacing.sm }} />
                <StatBadge
                    value={stats.currentStreak}
                    label="Seri"
                    accentValue
                    icon={<Ionicons name="flame-outline" size={18} color={colors.accent} />}
                />
                <View style={{ width: spacing.sm }} />
                <StatBadge
                    value={stats.totalPRs}
                    label="Progress"
                    icon={<Ionicons name="trending-up-outline" size={18} color={colors.accent} />}
                />
            </Animated.View>

            {/* ─── Sıradaki Antrenman (Cycle-Based) ─── */}
            {favoriteProgram && isCurrentProgramCycle && currentDay && (
                <Animated.View style={mainCardAnimStyle}>
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
                <Animated.View style={mainCardAnimStyle}>
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
                <Animated.View style={mainCardAnimStyle}>
                <GymCard style={styles.todayCard}>
                    <Text style={styles.todayHint}>
                        Bir programı uzun basarak aktif takibe al; buraya "Sıradaki Antrenman" olarak sabitlensin.
                    </Text>
                </GymCard>
                </Animated.View>
            )}

            {/* ─── Recent Workouts ─── */}
            <SectionHeader
                title="Son Antrenmanlar"
                actionLabel="Tümü"
                onAction={() => navigation.navigate("WorkoutHistory")}
            />
            {workouts.length > 0 ? (
                <Animated.View style={listAnimStyle}>
                <FlatList
                    data={sortNewestFirst(workouts)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.workoutList}
                    renderItem={({ item }) => (
                        <AnimatedPressable
                            pressedScale={0.985}
                            onPress={() => navigation.navigate("WorkoutDetail", { workout: item })}
                        >
                            <GymCard elevated style={[styles.workoutCard, { width: WORKOUT_CARD_WIDTH }]}>
                                <View style={styles.workoutCardHeader}>
                                    <Text style={styles.workoutTitle}>{item.title}</Text>
                                </View>
                                <Text style={styles.workoutDate}>
                                    {formatDate(item.logDate)}
                                </Text>
                                <View style={styles.workoutSummaryRow}>
                                    <Text style={styles.workoutSummaryText}>
                                        {countWorkoutSets(item)} set
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
            <SectionHeader
                title="Programlarım"
                actionLabel={programs.length > 3 ? "Tümü" : "Yeni Oluştur"}
                onAction={() => programs.length > 3 ? navigation.navigate("ProgramList") : navigation.navigate("ProgramCreate")}
            />
            {programs.length > 3 && (
                <TouchableOpacity
                    style={styles.inlineCreateBtn}
                    onPress={() => navigation.navigate("ProgramCreate")}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                    <Text style={styles.inlineCreateText}>Yeni program oluştur</Text>
                </TouchableOpacity>
            )}
            {programs.length > 0 ? (
                programs.slice(0, 3).map((prog) => {
                    const isCycle = isCycleProgram(prog.data);
                    const dayIdx = prog.currentDayIndex ?? 0;
                    const dayCount = isCycle ? prog.data.days.length : 0;
                    return (
                        <Animated.View key={prog.id} style={programActivationStyle(prog.id)}>
                        <AnimatedPressable
                            pressedScale={0.985}
                            onPress={() => {
                                navigation.navigate("ProgramDetail", {
                                    programId: prog.id,
                                });
                            }}
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

            <SectionHeader
                title="Topluluk Programları"
                actionLabel="Keşfet"
                onAction={() => navigation.navigate("CommunityPrograms")}
            />
            {communityPrograms.length > 0 ? (
                communityPrograms.map((prog) => {
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
                        <AnimatedPressable
                            key={prog.id}
                            pressedScale={0.985}
                            onPress={() => navigation.navigate("ProgramDetail", { programId: prog.id })}
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
                    );
                })
            ) : (
                <Text style={styles.emptyStateText}>Toplulukta henüz public program yok.</Text>
            )}

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
                navigateToWorkoutRespectingActiveSession(navigation, { mode: "free" });
            }}
            onSecondary={() => setQuickWorkoutConfirmVisible(false)}
            onDismiss={() => setQuickWorkoutConfirmVisible(false)}
        />
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

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}dk ${s > 0 ? `${s}sn` : ""}`.trim();
}

function countWorkoutSets(workout: any): number {
    const exercises = Array.isArray(workout?.data?.exercises) ? workout.data.exercises : [];
    return exercises.reduce((sum: number, exercise: any) => {
        const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
        return sum + sets.filter((set: any) => !set?.isWarmup).length;
    }, 0);
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
        alignSelf: "flex-start",
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
