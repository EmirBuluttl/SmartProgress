// ─────────────────────────────────────────────
// HomeScreen — Dashboard
// Sıradaki antrenman (cycle-aware), hızlı başlat
// ─────────────────────────────────────────────
import React, { useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
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
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { workoutApi, programApi, authApi, notificationApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { isCycleProgram } from "../types/workout";
import GymCard from "../components/GymCard";
import AccentButton from "../components/AccentButton";
import StatBadge from "../components/StatBadge";
import SectionHeader from "../components/SectionHeader";
import ActiveWorkoutBanner from "../components/ActiveWorkoutBanner";
import { syncPendingWorkouts } from "../services/syncService";
import { countProgressEvents } from "../utils/workoutMetrics";

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
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [workouts, setWorkouts] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [communityPrograms, setCommunityPrograms] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalWorkouts: 0, currentStreak: 0, totalPRs: 0 });
    const [loading, setLoading] = useState(true);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [bannerRefresh, setBannerRefresh] = useState(0);
    const [dayPickerOpen, setDayPickerOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const hasLoadedDashboard = React.useRef(false);
    const scrollRef = useRef<ScrollView | null>(null);
    const shouldRestoreScroll = useRef(false);

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
            const streak = calculateStreak(fetchedWorkouts, myPrograms || [], activeProgramId);
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
            <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color={colors.accent} />
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
        setFavoriteId(next);
        if (next) await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, next);
        else await AsyncStorage.removeItem(ACTIVE_PROGRAM_KEY);
        await AsyncStorage.removeItem(FAVORITES_KEY);
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

    const selectActiveProgramDay = async (dayIndex: number) => {
        if (!favoriteProgram) return;
        await programApi.setDay(favoriteProgram.id, dayIndex);
        setDayPickerOpen(false);
        await loadDashboard();
    };

    const openNotification = async (notification: any) => {
        try {
            if (!notification.readAt) {
                const res = await notificationApi.markRead(notification.id);
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (err) {
            console.warn("[HomeScreen] Notification could not be marked read:", err);
        }

        setNotificationsVisible(false);
        if (notification.actionScreen === "ProgramDetail" && notification.actionParams?.programId) {
            navigation.navigate("ProgramDetail", { programId: notification.actionParams.programId });
        }
    };

    return (
        <>
        <ScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={restoreScrollPosition}
        >
            {/* ─── Header ─── */}
            <View style={styles.header}>
                <View>
                    <View style={styles.streakRow}>
                        <Ionicons name="flame" size={22} color={colors.accent} />
                        <Text style={[styles.streakValue, { marginLeft: spacing.xs }]}>
                            {stats.currentStreak} Gündür
                        </Text>
                    </View>
                    <Text style={styles.streakText}>Antrenman Kaçırmadın</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.notificationBtn}
                        onPress={() => setNotificationsVisible(true)}
                        activeOpacity={0.82}
                    >
                        <Ionicons name="notifications-outline" size={22} color={colors.accent} />
                        {unreadCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.avatarCircle}
                        onPress={() =>
                            (navigation as any).navigate("MainTabs", { screen: "Profile" })
                        }
                        activeOpacity={0.8}
                    >
                        {user?.avatarUrl || user?.profileImage ? (
                            <Image source={{ uri: user.avatarUrl || user.profileImage }} style={{ width: "100%", height: "100%", borderRadius: 20 }} />
                        ) : (
                            <Text style={styles.avatarText}>{initials}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ─── Active Workout Banner ─── */}
            <ActiveWorkoutBanner refreshKey={bannerRefresh} />

            <TouchableOpacity
                style={styles.quickWorkoutCard}
                onPress={() => navigation.navigate("WorkoutSession", { mode: "free" })}
                activeOpacity={0.86}
            >
                <View style={styles.quickWorkoutIcon}>
                    <Ionicons name="flash-outline" size={20} color={colors.background} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.quickWorkoutTitle}>Serbest antrenman</Text>
                    <Text style={styles.quickWorkoutSubtitle}>
                        Program seçmeden hareket ekleyip logla
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* ─── Stats Row ─── */}
            <View style={styles.statsRow}>
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
            </View>

            {/* ─── Sıradaki Antrenman (Cycle-Based) ─── */}
            {favoriteProgram && isCurrentProgramCycle && currentDay && (
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
                        onPress={() => navigation.navigate("ProgramDayDetail", {
                            programId: favoriteProgram.id,
                            programName: favoriteProgram.name,
                            dayIndex: currentDayIndex,
                            day: currentDay,
                            programData: favoriteProgram.data,
                        })}
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
                                navigation.navigate("WorkoutSession", {
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
            )}

            {/* ─── Aktif Program (Non-Cycle) ─── */}
            {favoriteProgram && !isCurrentProgramCycle && (
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
                            navigation.navigate("WorkoutSession", {
                                programId: favoriteProgram.id,
                                programName: favoriteProgram.name,
                                programData: favoriteProgram.data,
                            })
                        }
                        style={{ marginTop: spacing.md, minHeight: 56 }}
                    />
                </GymCard>
            )}

            {/* ─── No Favorite Hint ─── */}
            {!favoriteProgram && programs.length > 0 && (
                <GymCard style={styles.todayCard}>
                    <Text style={styles.todayHint}>
                        Bir programı uzun basarak aktif takibe al; buraya "Sıradaki Antrenman" olarak sabitlensin.
                    </Text>
                </GymCard>
            )}

            {/* ─── Recent Workouts ─── */}
            <SectionHeader
                title="Son Antrenmanlar"
                actionLabel="Tümü"
                onAction={() => navigation.navigate("WorkoutHistory")}
            />
            {workouts.length > 0 ? (
                <FlatList
                    data={sortNewestFirst(workouts)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.workoutList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => navigation.navigate("WorkoutDetail", { workout: item })}
                        >
                            <GymCard elevated style={[styles.workoutCard, { width: WORKOUT_CARD_WIDTH }]}>
                                <View style={styles.workoutCardHeader}>
                                    <Text style={styles.workoutTitle}>{item.title}</Text>
                                    <View style={styles.sportBadge}>
                                        <Text style={styles.sportBadgeText}>{item.sportName || "Fitness"}</Text>
                                    </View>
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
                        </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
                />
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
                        <TouchableOpacity
                            key={prog.id}
                            activeOpacity={0.8}
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
                        </TouchableOpacity>
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
                        <TouchableOpacity
                            key={prog.id}
                            activeOpacity={0.85}
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
                        </TouchableOpacity>
                    );
                })
            ) : (
                <Text style={styles.emptyStateText}>Toplulukta henüz public program yok.</Text>
            )}

            <View style={{ height: spacing.xxxl }} />
        </ScrollView>
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
                        <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    {notifications.length === 0 ? (
                        <View style={styles.notificationEmpty}>
                            <Ionicons name="notifications-off-outline" size={34} color={colors.textMuted} />
                            <Text style={styles.notificationEmptyText}>Şimdilik bildirimin yok.</Text>
                        </View>
                    ) : (
                        notifications.map((item) => (
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
                        ))
                    )}
                </View>
            </View>
        </Modal>
        </>
    );
}

// ─── Helpers ────────────────────────────────

function calculateStreak(workouts: any[], programs: any[] = [], activeProgramId?: string | null): number {
    if (!workouts.length) return 0;
    
    // Create a Set of all dates the user worked out
    const workedOutDates = new Set(workouts.map((w) => new Date(w.logDate).toDateString()));
    let streak = 0;
    const today = new Date();

    const activeProgram = activeProgramId
        ? programs.find((program) => program.id === activeProgramId)
        : null;
    const cycleProgram = activeProgram && isCycleProgram(activeProgram.data)
        ? activeProgram
        : programs.find((program) => isCycleProgram(program.data));
    const cycleDays = cycleProgram && isCycleProgram(cycleProgram.data)
        ? cycleProgram.data.days
        : [];
    const currentCycleIndex = cycleProgram?.currentDayIndex ?? 0;

    let restDaysOfWeek = new Set<number>(); // 0 = Sunday, 1 = Monday, etc.
    if (!cycleDays.length) {
        restDaysOfWeek = new Set();
    } else if (cycleProgram?.data?.frequency === 7) {
        cycleDays.forEach((day: any, index: number) => {
            if (day.isRestDay) restDaysOfWeek.add((index + 1) % 7);
        });
    }

    // Check up to 365 days back
    for (let i = 0; i < 365; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const dayString = day.toDateString();
        const cycleDay = cycleDays.length
            ? cycleDays[((currentCycleIndex - i) % cycleDays.length + cycleDays.length) % cycleDays.length]
            : null;
        
        if (workedOutDates.has(dayString)) {
            // Worked out!
            streak++;
        } else if (i === 0) {
            // It's today. If they haven't worked out today, it doesn't break the streak yet.
            // (They still have time to work out today).
            continue;
        } else if (cycleDay?.isRestDay || restDaysOfWeek.has(day.getDay())) {
            // Rest/off days keep the chain alive but do not increment workout streak.
            continue;
        } else {
            // Did not work out, and it wasn't a recognized rest day. Streak broken.
            break;
        }
    }
    return streak;
}

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
        paddingTop: spacing.xxxl + spacing.xl,
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
    notificationHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
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
        lineHeight: 19,
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
    avatarText: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    quickWorkoutCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    quickWorkoutIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    quickWorkoutTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    quickWorkoutSubtitle: {
        marginTop: 2,
        fontSize: fontSize.sm,
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
        paddingHorizontal: spacing.sm, paddingVertical: 2,
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
        fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20,
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
        paddingHorizontal: spacing.sm, paddingVertical: 3,
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
        marginBottom: spacing.xs, lineHeight: 20,
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
