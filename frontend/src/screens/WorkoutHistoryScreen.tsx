// ─────────────────────────────────────────────
// WorkoutHistoryScreen — Full Workout Log
// Star/favorite, clear history
// ─────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { parseApiError, workoutApi } from "../services/api";
import { syncPendingWorkouts, getPendingWorkoutCount, resetFailedWorkouts, clearAllPendingWorkouts } from "../services/syncService";
import { confirmDialog, showAlert } from "../utils/confirm";
import GymCard from "../components/GymCard";

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
    const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [pendingInfo, setPendingInfo] = useState<{ pending: number; failed: number; permanent: number }>({ pending: 0, failed: 0, permanent: 0 });

    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const loadPendingInfo = async () => {
        const info = await getPendingWorkoutCount();
        setPendingInfo(info);
    };

    const loadData = async () => {
        try {
            // Sync any pending workouts first
            try {
                await syncPendingWorkouts();
            } catch (syncErr) {
                console.warn("[WorkoutHistory] Pending sync hatası:", syncErr);
            }

            const res = await workoutApi.list({ limit: 100 });
            const fetched: WorkoutItem[] = res.data.workouts || [];

            // Always sort newest first (most recent workout at top)
            const ordered = [...fetched].sort((a, b) =>
                new Date(b.logDate).getTime() - new Date(a.logDate).getTime()
            );

            setWorkouts(ordered);

            // Restore favorites
            const favsStr = await AsyncStorage.getItem(FAVORITES_KEY);
            if (favsStr) setFavorites(new Set(JSON.parse(favsStr)));

            // Load pending info after sync attempt
            await loadPendingInfo();
        } catch (err) {
            console.error("[WorkoutHistory] Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRetrySync = async () => {
        setSyncing(true);
        try {
            await resetFailedWorkouts();
            await syncPendingWorkouts();
        } catch (err) {
            console.error("[WorkoutHistory] Retry sync error:", err);
        } finally {
            const info = await getPendingWorkoutCount();
            setPendingInfo(info);
            await loadData();
            setSyncing(false);
        }
    };

    const handleClearPending = async () => {
        const confirmed = await confirmDialog(
            "Bekleyen Antrenmanları Temizle",
            "Sunucuya gönderilememiş tüm antrenman verileri silinecek. Bu işlem geri alınamaz."
        );
        if (confirmed) {
            await clearAllPendingWorkouts();
            const info = await getPendingWorkoutCount();
            setPendingInfo(info);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const toggleFavorite = async (id: string) => {
        const newFavs = new Set(favorites);
        if (newFavs.has(id)) newFavs.delete(id);
        else newFavs.add(id);
        setFavorites(newFavs);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavs]));
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirmDialog(
            "Antrenmanı Sil",
            "Bu antrenmanı silmek istediğinize emin misiniz?"
        );
        if (confirmed) {
            try {
                await workoutApi.delete(id);
                setWorkouts((prev) => prev.filter((w) => w.id !== id));
                await loadData();
            } catch (err: any) {
                const apiError = parseApiError(err);
                showAlert("Hata", apiError.message || "Silme islemi basarisiz.");
            }
        }
    };

    const handleClearOrder = async () => {
        const confirmed = await confirmDialog(
            "Sıralamayı Sıfırla",
            "Liste sıralaması sıfırlanacak. Antrenman kayıtları silinmeyecek."
        );
        if (confirmed) {
            await AsyncStorage.removeItem(ORDER_KEY);
            await loadData();
        }
    };

    const renderItem = ({ item }: { item: WorkoutItem }) => {
        const isFav = favorites.has(item.id);
        const exerciseCount = item.data?.exercises?.length || 0;
        const duration = item.data?.totalDuration || item.data?.duration || 0;
        const durationMin = Math.floor(duration / 60);

        return (
            <GymCard style={styles.card}>
                <View style={styles.cardRow}>
                    <TouchableOpacity
                        style={styles.cardContent}
                        onPress={() => (navigation as any).navigate("WorkoutDetail", { workout: item })}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.dateText}>
                            {new Date(item.logDate).toLocaleDateString("tr-TR", {
                                day: "numeric", month: "short", year: "numeric"
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
                        </View>
                    </TouchableOpacity>

                    <View style={styles.actionColumn}>
                        <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.iconBtn}>
                            <Ionicons
                                name={isFav ? "star" : "star-outline"}
                                size={20}
                                color={isFav ? colors.accent : colors.textMuted}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                    </View>
                </View>
            </GymCard>
        );
    };
    if (loading) {
        return (
            <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Antrenman Geçmişi</Text>
                <TouchableOpacity onPress={handleClearOrder} style={styles.backBtn}>
                    <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Pending Workouts Banner */}
            {(pendingInfo.pending + pendingInfo.failed + pendingInfo.permanent) > 0 && (
                <View style={[styles.pendingBanner, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.pendingTitle, { color: colors.accent }]}>
                            ⏳ {pendingInfo.pending + pendingInfo.failed + pendingInfo.permanent} bekleyen antrenman
                        </Text>
                        <Text style={[styles.pendingDesc, { color: colors.textSecondary }]}>
                            Sunucuya henüz gönderilemeyen kayıtlar var.
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                            onPress={handleRetrySync}
                            disabled={syncing}
                            style={[styles.pendingBtn, { backgroundColor: colors.accent }]}
                        >
                            {syncing ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.pendingBtnText}>Tekrar Dene</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleClearPending}
                            style={[styles.pendingBtn, { backgroundColor: colors.error }]}
                        >
                            <Text style={styles.pendingBtnText}>Temizle</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {workouts.length === 0 && (pendingInfo.pending + pendingInfo.failed + pendingInfo.permanent) === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Henüz antrenman kaydınız yok.</Text>
                </View>
            ) : workouts.length > 0 ? (
                <FlatList
                    style={styles.listContainer}
                    data={workouts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={true}
                />
            ) : null}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 52,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    backBtn: {
        padding: spacing.xs,
        minWidth: 44,
        alignItems: "center",
    },
    list: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    listContainer: {
        flex: 1,
    },
    card: {
        marginBottom: spacing.md,
    },
    dragHandle: {
        paddingRight: spacing.sm,
        paddingVertical: spacing.md,
    },
    cardContent: {
        flex: 1,
    },
    cardRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    title: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        flex: 1,
    },
    iconBtn: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
    },
    actionColumn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
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
    },
    pendingTitle: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        marginBottom: 2,
    },
    pendingDesc: {
        fontSize: fontSize.xs,
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


