// ─────────────────────────────────────────────
// RecordsScreen — Kişisel Rekorlar (Tümü)
// Tüm egzersizlerde ulaşılan en yüksek ağırlıklar
// ─────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { workoutApi } from "../services/api";
import { getPersonalRecords } from "../utils/workoutMetrics";

interface PRRecord {
    exercise: string;
    weight: number;
    reps: number;
    unit: string;
    date: string;
    splitLabel?: string;
}

export default function RecordsScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [records, setRecords] = useState<PRRecord[]>([]);
    const [splitFilter, setSplitFilter] = useState("Tümü");
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadRecords();
        }, [])
    );

    const loadRecords = async () => {
        try {
            const res = await workoutApi.list({ limit: 200 });
            const workouts = res.data.workouts || [];

            setRecords(getPersonalRecords(workouts) as PRRecord[]);
        } catch (err) {
            console.error("[Records] Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (iso: string): string => {
        try {
            return new Date(iso).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        } catch {
            return iso;
        }
    };

    const getMedalColor = (index: number): string => {
        if (index === 0) return "#FFD700"; // Gold
        if (index === 1) return "#C0C0C0"; // Silver
        if (index === 2) return "#CD7F32"; // Bronze
        return colors.textMuted;
    };

    const renderItem = ({ item, index }: { item: PRRecord; index: number }) => (
        <View style={styles.recordRow}>
            <View style={[styles.rankCircle, { backgroundColor: index < 3 ? getMedalColor(index) + "20" : colors.surfaceElevated }]}>
                {index < 3 ? (
                    <Ionicons name="trophy" size={16} color={getMedalColor(index)} />
                ) : (
                    <Text style={styles.rankText}>{index + 1}</Text>
                )}
            </View>
            <View style={styles.recordInfo}>
                <Text style={styles.recordName} numberOfLines={1}>{item.exercise}</Text>
                <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
            </View>
            <Text style={styles.recordWeight}>
                {item.weight} <Text style={styles.recordUnit}>{item.unit} x {item.reps}</Text>
            </Text>
        </View>
    );

    const splitOptions = React.useMemo(() => {
        const labels = Array.from(new Set(records.map((record) => record.splitLabel || "Genel")));
        return ["Tümü", ...labels];
    }, [records]);

    const visibleRecords = React.useMemo(() => (
        splitFilter === "Tümü"
            ? records
            : records.filter((record) => (record.splitLabel || "Genel") === splitFilter)
    ), [records, splitFilter]);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kişisel Rekorlar</Text>
                <View style={{ width: 24 }} />
            </View>

            {records.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="trophy-outline" size={64} color={colors.border} />
                    <Text style={styles.emptyText}>Henüz rekor bulunmuyor.</Text>
                    <Text style={styles.emptySubtext}>Antrenman loglarınızdan rekorlar otomatik hesaplanır.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.filterWrap}>
                        <FlatList
                            horizontal
                            data={splitOptions}
                            keyExtractor={(item) => item}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.filterChip, splitFilter === item && styles.filterChipActive]}
                                    onPress={() => setSplitFilter(item)}
                                >
                                    <Text style={[styles.filterChipText, splitFilter === item && styles.filterChipTextActive]}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                    <FlatList
                        data={visibleRecords}
                        keyExtractor={(item) => item.exercise}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                </>
            )}
        </View>
    );
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    filterWrap: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    filterChip: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginRight: spacing.sm,
    },
    filterChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    filterChipText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    filterChipTextActive: {
        color: colors.accent,
    },
    recordRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
    },
    rankCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    rankText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
    },
    recordInfo: { flex: 1, marginRight: spacing.sm },
    recordName: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        color: colors.text,
        marginBottom: 2,
    },
    recordDate: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
    },
    recordWeight: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    recordUnit: {
        fontSize: fontSize.sm,
        fontWeight: "normal" as any,
        color: colors.textSecondary,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.xxl,
    },
    emptyText: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
        marginTop: spacing.lg,
    },
    emptySubtext: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        textAlign: "center",
        marginTop: spacing.xs,
    },
});
