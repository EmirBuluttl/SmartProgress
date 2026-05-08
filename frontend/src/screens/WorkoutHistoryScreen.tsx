// ─────────────────────────────────────────────
// WorkoutHistoryScreen — Full Workout Log
// Star/favorite, drag-to-reorder, clear history
// ─────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { workoutApi } from "../services/api";
import { syncPendingWorkouts } from "../services/syncService";
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

    const styles = React.useMemo(() => createStyles(colors), [colors]);

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
        } catch (err) {
            console.error("[WorkoutHistory] Load error:", err);
        } finally {
            setLoading(false);
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

    const handleDelete = (id: string) => {
        Alert.alert(
            "Antrenmanı Sil",
            "Bu antrenmanı silmek istediğinize emin misiniz?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Sil",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await workoutApi.delete(id);
                            // Refresh list
                            await loadData();
                        } catch (err) {
                            Alert.alert("Hata", "Silme işlemi başarısız.");
                        }
                    },
                },
            ]
        );
    };

    const handleDragEnd = async ({ data }: { data: WorkoutItem[] }) => {
        setWorkouts(data);
        await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(data.map((w) => w.id)));
    };

    const handleClearOrder = () => {
        Alert.alert(
            "Sıralamayı Sıfırla",
            "Liste sıralaması sıfırlanacak. Antrenman kayıtları silinmeyecek.",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Sıfırla",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem(ORDER_KEY);
                        await loadData();
                    },
                },
            ]
        );
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<WorkoutItem>) => {
        const isFav = favorites.has(item.id);
        const exerciseCount = item.data?.exercises?.length || 0;
        const duration = item.data?.totalDuration || item.data?.duration || 0;
        const durationMin = Math.floor(duration / 60);

        return (
            <GymCard
                style={[
                    styles.card,
                    isActive && { opacity: 0.9, borderColor: colors.accent },
                ]}
            >
                {/* Drag Handle */}
                <TouchableOpacity onLongPress={drag} style={styles.dragHandle} activeOpacity={0.7}>
                    <Ionicons name="reorder-three-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Content */}
                <TouchableOpacity
                    style={styles.cardContent}
                    onPress={() => (navigation as any).navigate("WorkoutDetail", { workout: item })}
                    activeOpacity={0.7}
                >
                    <View style={styles.cardHeader}>
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
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
                    <Text style={styles.dateText}>
                        📅 {new Date(item.logDate).toLocaleDateString("tr-TR", {
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
                                <Text style={styles.chipText}>⏱ {durationMin}dk</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
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

            {workouts.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Henüz antrenman kaydınız yok.</Text>
                </View>
            ) : (
                <DraggableFlatList
                    data={workouts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    onDragEnd={handleDragEnd}
                    contentContainerStyle={styles.list}
                />
            )}
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
    card: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    dragHandle: {
        paddingRight: spacing.sm,
        paddingVertical: spacing.md,
    },
    cardContent: {
        flex: 1,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        flex: 1,
    },
    iconBtn: {
        padding: 16, // 56px touch target area
        justifyContent: "center",
        alignItems: "center",
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
});
