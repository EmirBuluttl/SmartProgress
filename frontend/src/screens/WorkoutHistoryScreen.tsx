import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { parseApiError, workoutApi } from "../services/api";
import {
    clearAllPendingWorkouts,
    getPendingWorkoutCount,
    resetFailedWorkouts,
    syncPendingWorkouts,
} from "../services/syncService";
import { showAlert } from "../utils/confirm";
import ActionConfirmModal from "../components/ActionConfirmModal";
import GymCard from "../components/GymCard";
import { summarizeCardioBlocks } from "../utils/cardio";

const FAVORITES_KEY = "workout_favorites";
const ORDER_KEY = "workout_display_order";

interface WorkoutItem {
    id: string;
    title: string;
    logDate: string;
    data?: any;
}

export default function WorkoutHistoryScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();

    const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [confirmClearPending, setConfirmClearPending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [pendingInfo, setPendingInfo] = useState({ pending: 0, failed: 0, permanent: 0 });

    const sortNewestFirst = (items: WorkoutItem[]) =>
        [...items].sort((a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime());

    const loadPendingInfo = async () => {
        setPendingInfo(await getPendingWorkoutCount());
    };

    const loadData = async () => {
        try {
            try {
                await syncPendingWorkouts();
            } catch (syncErr) {
                console.warn("[WorkoutHistory] Pending sync failed:", syncErr);
            }

            const [res, favsStr] = await Promise.all([
                workoutApi.list({ limit: 100 }),
                AsyncStorage.getItem(FAVORITES_KEY),
            ]);

            setWorkouts(sortNewestFirst(res.data.workouts || []));
            setFavorites(favsStr ? new Set(JSON.parse(favsStr)) : new Set());
            await loadPendingInfo();
        } catch (err) {
            console.error("[WorkoutHistory] Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, []),
    );

    const handleRetrySync = async () => {
        setSyncing(true);
        try {
            await resetFailedWorkouts();
            await syncPendingWorkouts();
            await loadData();
        } catch (err) {
            console.error("[WorkoutHistory] Retry sync error:", err);
        } finally {
            await loadPendingInfo();
            setSyncing(false);
        }
    };

    const handleClearPending = async () => {
        await clearAllPendingWorkouts();
        await loadPendingInfo();
        setConfirmClearPending(false);
    };

    const toggleFavorite = async (id: string) => {
        const next = new Set(favorites);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setFavorites(next);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
    };

    const handleDelete = async (id: string) => {
        const previous = workouts;
        setWorkouts((current) => current.filter((w) => w.id !== id));

        try {
            await workoutApi.delete(id);
            await loadData();
        } catch (err) {
            setWorkouts(previous);
            const apiError = parseApiError(err);
            showAlert("Hata", apiError.message || "Silme islemi basarisiz.");
        }
        setPendingDeleteId(null);
    };

    const handleClearOrder = async () => {
        await AsyncStorage.removeItem(ORDER_KEY);
        setWorkouts((current) => sortNewestFirst(current));
    };

    const renderWorkout = (item: WorkoutItem) => {
        const isFav = favorites.has(item.id);
        const exerciseCount = item.data?.exercises?.length || 0;
        const cardioSummary = summarizeCardioBlocks(item.data?.cardioBlocks);
        const duration = item.data?.totalDuration || item.data?.duration || 0;
        const durationMin = Math.floor(duration / 60);

        return (
            <GymCard key={item.id} style={styles.card}>
                <View style={styles.cardRow}>
                    <Pressable
                        style={styles.cardContent}
                        onPress={() => (navigation as any).navigate("WorkoutDetail", { workout: item })}
                    >
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.dateText}>
                            {new Date(item.logDate).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            })}
                        </Text>
                        <View style={styles.metaRow}>
                            {exerciseCount > 0 && (
                                <View style={styles.chip}>
                                    <Text style={styles.chipText}>{exerciseCount} egzersiz</Text>
                                </View>
                            )}
                            {durationMin > 0 && (
                                <View style={styles.chip}>
                                    <Text style={styles.chipText}>{durationMin}dk</Text>
                                </View>
                            )}
                            {cardioSummary ? (
                                <View style={styles.chip}>
                                    <Text style={styles.chipText}>{cardioSummary}</Text>
                                </View>
                            ) : null}
                        </View>
                    </Pressable>

                    <View style={styles.actionColumn}>
                        <Pressable onPress={() => toggleFavorite(item.id)} style={styles.iconBtn}>
                            <Ionicons
                                name={isFav ? "star" : "star-outline"}
                                size={21}
                                color={isFav ? colors.accent : colors.textMuted}
                            />
                        </Pressable>
                        <Pressable onPress={() => setPendingDeleteId(item.id)} style={styles.iconBtn}>
                            <Ionicons name="trash-outline" size={21} color={colors.error} />
                        </Pressable>
                    </View>
                </View>
            </GymCard>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    const pendingTotal = pendingInfo.pending + pendingInfo.failed + pendingInfo.permanent;

    return (
        <View style={styles.root}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Antrenman Gecmisi</Text>
                <Pressable onPress={handleClearOrder} style={styles.headerBtn}>
                    <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
                </Pressable>
            </View>

            {pendingTotal > 0 && (
                <View style={[styles.pendingBanner, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.pendingTitle, { color: colors.accent }]}>
                            {pendingTotal} bekleyen antrenman
                        </Text>
                        <Text style={[styles.pendingDesc, { color: colors.textSecondary }]}>
                            Sunucuya henuz gonderilemeyen kayitlar var.
                        </Text>
                    </View>
                    <View style={styles.pendingActions}>
                        <Pressable
                            onPress={handleRetrySync}
                            disabled={syncing}
                            style={[styles.pendingBtn, { backgroundColor: colors.accent }]}
                        >
                            {syncing ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.pendingBtnText}>Tekrar Dene</Text>
                            )}
                        </Pressable>
                        <Pressable
                            onPress={() => setConfirmClearPending(true)}
                            style={[styles.pendingBtn, { backgroundColor: colors.error }]}
                        >
                            <Text style={styles.pendingBtnText}>Temizle</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {workouts.length === 0 && pendingTotal === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Henuz antrenman kaydiniz yok.</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.listContainer}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator
                >
                    {workouts.map(renderWorkout)}
                </ScrollView>
            )}
            <ActionConfirmModal
                visible={!!pendingDeleteId}
                title="Antrenmanı sil?"
                message="Bu antrenman kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz."
                primaryLabel="Sil"
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={() => pendingDeleteId && handleDelete(pendingDeleteId)}
                onSecondary={() => setPendingDeleteId(null)}
                onDismiss={() => setPendingDeleteId(null)}
            />
            <ActionConfirmModal
                visible={confirmClearPending}
                title="Bekleyen kayıtları temizle?"
                message="Sunucuya gönderilemeyen yerel antrenman kayıtları silinecek."
                primaryLabel="Temizle"
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={handleClearPending}
                onSecondary={() => setConfirmClearPending(false)}
                onDismiss={() => setConfirmClearPending(false)}
            />
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    root: {
        flex: 1,
        minHeight: 0,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerBtn: {
        minWidth: 48,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    listContainer: {
        flex: 1,
        minHeight: 0,
    },
    list: {
        padding: spacing.lg,
        paddingBottom: 120,
    },
    card: {
        marginBottom: spacing.md,
    },
    cardRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    cardContent: {
        flex: 1,
        minHeight: 72,
        justifyContent: "center",
    },
    title: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    dateText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    metaRow: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    chip: {
        backgroundColor: colors.surfaceElevated,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    chipText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    actionColumn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    iconBtn: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
    },
    emptyText: {
        fontSize: fontSize.md,
        color: colors.textMuted,
        fontStyle: "italic",
    },
    pendingBanner: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: spacing.sm,
    },
    pendingTitle: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        marginBottom: 2,
    },
    pendingDesc: {
        fontSize: fontSize.xs,
    },
    pendingActions: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    pendingBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 36,
    },
    pendingBtnText: {
        color: "#fff",
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
});
