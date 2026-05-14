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
import { workoutApi, programApi, authApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { isCycleProgram } from "../types/workout";
import GymCard from "../components/GymCard";
import AccentButton from "../components/AccentButton";
import StatBadge from "../components/StatBadge";
import SectionHeader from "../components/SectionHeader";
import ActiveWorkoutBanner from "../components/ActiveWorkoutBanner";
import { syncPendingWorkouts } from "../services/syncService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WORKOUT_CARD_WIDTH = SCREEN_WIDTH * 0.7;

type HomeNav = NativeStackNavigationProp<RootStackParamList>;
const FAVORITES_KEY = "program_favorite_id";
let savedHomeScrollY = 0;

export default function HomeScreen() {
    const navigation = useNavigation<HomeNav>();
    const { user, updateUser } = useAuth();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [workouts, setWorkouts] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalWorkouts: 0, currentStreak: 0, totalPRs: 0 });
    const [loading, setLoading] = useState(true);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [bannerRefresh, setBannerRefresh] = useState(0);
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
            const fetchedWorkouts = [...(workoutRes.data.workouts || [])].sort(
                (a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime(),
            );
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

            const streak = calculateStreak(fetchedWorkouts, myPrograms || []);
            setStats({
                totalWorkouts: workoutRes.data.count || fetchedWorkouts.length,
                currentStreak: streak,
                totalPRs: 0,
            });
        } catch (error) {
            console.error("[HomeScreen] Failed to load dashboard data:", error);
        } finally {
            hasLoadedDashboard.current = true;
            setLoading(false);
        }
    };

    const loadFavorite = async () => {
        const fav = await AsyncStorage.getItem(FAVORITES_KEY);
        setFavoriteId(fav);
    };

    useFocusEffect(
        useCallback(() => {
            shouldRestoreScroll.current = savedHomeScrollY > 0;
            if (!hasLoadedDashboard.current) {
                setLoading(true);
            }
            loadDashboard();
            loadFavorite();
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
        if (next) await AsyncStorage.setItem(FAVORITES_KEY, next);
        else await AsyncStorage.removeItem(FAVORITES_KEY);
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

    return (
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

            {/* ─── Active Workout Banner ─── */}
            <ActiveWorkoutBanner refreshKey={bannerRefresh} />

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
                    label="PR"
                    icon={<Ionicons name="trophy-outline" size={18} color={colors.accent} />}
                />
            </View>

            {/* ─── Sıradaki Antrenman (Cycle-Based) ─── */}
            {favoriteProgram && isCurrentProgramCycle && currentDay && (
                <GymCard elevated style={styles.todayCard}>
                    <View style={styles.todayHeader}>
                        <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>⚡ SIRADAKI ANTRENMAN</Text>
                        </View>
                        <TouchableOpacity onPress={() => toggleFavoriteProgram(favoriteProgram.id)}>
                            <Ionicons name="star" size={20} color={colors.accent} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.todayProgName}>{favoriteProgram.name}</Text>
                    <Text style={styles.todayDayLabel}>{currentDay.label}</Text>

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
                    </View>

                    <AccentButton
                        title={currentDay.exercises.length > 0 ? "▶ Antrenmanı Başlat" : "⏭ Sonraki Güne Geç"}
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

            {/* ─── Favori Program (Non-Cycle) ─── */}
            {favoriteProgram && !isCurrentProgramCycle && (
                <GymCard elevated style={styles.todayCard}>
                    <View style={styles.todayHeader}>
                        <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>⭐ FAVORİ PROGRAMIN</Text>
                        </View>
                        <TouchableOpacity onPress={() => toggleFavoriteProgram(favoriteProgram.id)}>
                            <Ionicons name="star" size={20} color={colors.accent} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.todayProgName}>{favoriteProgram.name}</Text>
                    {favoriteProgram.description ? (
                        <Text style={styles.todayProgDesc} numberOfLines={2}>
                            {favoriteProgram.description}
                        </Text>
                    ) : null}
                    <AccentButton
                        title="⚡ Favori Programını Başlat"
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
                        ⭐ Bir programı uzun basarak favorilere ekle; buraya "Sıradaki Antrenman" olarak sabitlensin.
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
                    data={workouts}
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
                                    📅 {formatDate(item.logDate)}
                                </Text>
                                {item.data?.exercises && (
                                    <View style={{ marginBottom: spacing.sm }}>
                                        {item.data.exercises.slice(0, 2).map((ex: any, i: number) => (
                                            <Text key={i} style={styles.exerciseText}>
                                                • {ex.name} — {ex.sets?.[0]?.weight || 0}{ex.sets?.[0]?.unit || "kg"} x {ex.sets?.[0]?.reps || 0}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                                <Text style={styles.durationText}>
                                    ⏱ {formatDuration(item.data?.totalDuration || item.data?.duration || 0)}
                                </Text>
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
                title="🔥 Programlarım"
                actionLabel="Yeni Oluştur"
                onAction={() => navigation.navigate("ProgramCreate")}
            />
            {programs.length > 0 ? (
                programs.map((prog) => {
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
                                            <Ionicons name="star" size={16} color={colors.accent} style={{ marginRight: spacing.xs }} />
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
                                        ? `${dayCount} günlük döngüsel program · Haftada ${prog.data?.frequency} gün`
                                        : "Açıklama yok.")}
                                </Text>
                            </GymCard>
                        </TouchableOpacity>
                    );
                })
            ) : (
                <Text style={styles.emptyStateText}>Henüz bir program oluşturmadınız.</Text>
            )}

            <View style={{ height: spacing.xxxl }} />
        </ScrollView>
    );
}

// ─── Helpers ────────────────────────────────

function calculateStreak(workouts: any[], programs: any[] = []): number {
    if (!workouts.length) return 0;
    
    // Create a Set of all dates the user worked out
    const workedOutDates = new Set(workouts.map((w) => new Date(w.logDate).toDateString()));
    let streak = 0;
    const today = new Date();
    
    // Determine which days of the week are usually rest days based on the user's active/favorite program
    // If no program, assume no rest days
    let restDaysOfWeek = new Set<number>(); // 0 = Sunday, 1 = Monday, etc.
    if (programs.length > 0) {
        // Just pick the first cycle program to extract rest days for simplicity 
        // Or if you have a favorite program, pick that one. Here we pick the first cycle program.
        const cycleProg = programs.find(p => isCycleProgram(p.data));
        if (cycleProg) {
            // Find which indices in the cycle are rest days
            cycleProg.data.days.forEach((day: any, index: number) => {
                if (day.isRestDay) {
                   // This is an approximation. A true cycle might not align perfectly with calendar weeks.
                   // For a 7-day frequency cycle synced to calendar:
                   if (cycleProg.data.frequency === 7) {
                       // Assuming Day 1 is Monday (1)
                       let dotw = (index + 1) % 7;
                       restDaysOfWeek.add(dotw);
                   }
                }
            });
        }
    }

    // Check up to 365 days back
    for (let i = 0; i < 365; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const dayString = day.toDateString();
        
        if (workedOutDates.has(dayString)) {
            // Worked out!
            streak++;
        } else if (i === 0) {
            // It's today. If they haven't worked out today, it doesn't break the streak yet.
            // (They still have time to work out today).
            continue;
        } else if (restDaysOfWeek.has(day.getDay())) {
            // It was a rest day, so it doesn't break the streak, but we don't increment it either (or maybe we do? Typically streaks count continuous action days, ignoring rest days. Let's just ignore the gap).
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

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}dk ${s > 0 ? `${s}sn` : ""}`.trim();
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
        color: colors.accent, marginBottom: spacing.sm,
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
    freqBadgeRow: { flexDirection: "row", marginBottom: spacing.sm },
    freqBadge: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm, paddingVertical: 3,
        borderRadius: borderRadius.full, gap: spacing.xs,
    },
    freqBadgeText: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold },
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
    exerciseText: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
    durationText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
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
    programDesc: {
        fontSize: fontSize.sm, color: colors.textSecondary,
        marginBottom: spacing.xs, lineHeight: 20,
    },
    emptyStateText: {
        fontSize: fontSize.sm, color: colors.textMuted,
        fontStyle: "italic", marginBottom: spacing.xl,
    },
});
