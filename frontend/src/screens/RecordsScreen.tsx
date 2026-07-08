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
    TextInput,
    Linking,
    Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { getPersistedWorkoutAnalyticsSnapshot } from "../services/workoutAnalyticsCacheService";
import { groupForExerciseName, MUSCLE_GROUPS } from "../data/exerciseTaxonomy";
import AnimatedPressable from "../components/AnimatedPressable";
import PremiumModalSurface from "../components/PremiumModalSurface";
import { useScreenEnter } from "../hooks/useScreenEnter";

const RECORD_LINKS_KEY = "personal_record_video_links";

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
    const insets = useSafeAreaInsets();
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const { animStyle: headerAnimStyle } = useScreenEnter({ delay: 0 });
    const { animStyle: filterAnimStyle } = useScreenEnter({ delay: 90 });

    const [records, setRecords] = useState<PRRecord[]>([]);
    const [splitFilter, setSplitFilter] = useState("Tümü");
    const [muscleFilter, setMuscleFilter] = useState("Tümü");
    const [query, setQuery] = useState("");
    const [links, setLinks] = useState<Record<string, string>>({});
    const [editingRecord, setEditingRecord] = useState<PRRecord | null>(null);
    const [linkDraft, setLinkDraft] = useState("");
    const [linkError, setLinkError] = useState("");
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadRecords();
        }, [])
    );

    const loadRecords = async () => {
        try {
            const analytics = await getPersistedWorkoutAnalyticsSnapshot();
            setRecords((analytics?.personalRecords || []) as PRRecord[]);
            const rawLinks = await AsyncStorage.getItem(RECORD_LINKS_KEY);
            setLinks(rawLinks ? JSON.parse(rawLinks) : {});
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

    const recordKey = (record: PRRecord) => record.exercise.trim().toLocaleLowerCase("tr-TR");

    const isAllowedVideoUrl = (value: string) => {
        if (!value.trim()) return true;
        try {
            const url = new URL(value.trim());
            const host = url.hostname.replace(/^www\./, "");
            return host === "youtube.com" || host === "youtu.be" || host === "instagram.com";
        } catch {
            return false;
        }
    };

    const saveRecordLink = async () => {
        if (!editingRecord) return;
        if (!isAllowedVideoUrl(linkDraft)) {
            setLinkError("Sadece YouTube veya Instagram bağlantısı ekleyebilirsin.");
            return;
        }
        const next = { ...links };
        const key = recordKey(editingRecord);
        if (linkDraft.trim()) next[key] = linkDraft.trim();
        else delete next[key];
        setLinks(next);
        await AsyncStorage.setItem(RECORD_LINKS_KEY, JSON.stringify(next));
        setEditingRecord(null);
        setLinkDraft("");
        setLinkError("");
    };

    const openLinkEditor = (record: PRRecord) => {
        setEditingRecord(record);
        setLinkDraft(links[recordKey(record)] || "");
        setLinkError("");
    };

    const renderItem = ({ item, index }: { item: PRRecord; index: number }) => {
        const videoUrl = links[recordKey(item)];
        return (
            <AnimatedPressable style={styles.recordPressable} pressedScale={0.99}>
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
                    <AnimatedPressable
                        style={[styles.linkBtn, videoUrl && styles.linkBtnActive]}
                        onPress={() => videoUrl ? Linking.openURL(videoUrl) : openLinkEditor(item)}
                        onLongPress={() => openLinkEditor(item)}
                        pressedScale={0.94}
                    >
                        <Ionicons name={videoUrl ? "play-circle" : "link-outline"} size={18} color={videoUrl ? colors.background : colors.accent} />
                    </AnimatedPressable>
                </View>
            </AnimatedPressable>
    )};

    const splitOptions = React.useMemo(() => {
        const labels = Array.from(new Set(records.map((record) => record.splitLabel || "Genel")));
        return ["Tümü", ...labels];
    }, [records]);
    const muscleOptions = React.useMemo(() => ["Tümü", ...MUSCLE_GROUPS.map((group) => group.beginnerLabel)], []);

    const visibleRecords = React.useMemo(() => {
        const search = query.trim().toLocaleLowerCase("tr-TR");
        return records.filter((record) => {
            if (splitFilter !== "Tümü" && (record.splitLabel || "Genel") !== splitFilter) return false;
            if (muscleFilter !== "Tümü") {
                const group = groupForExerciseName(record.exercise);
                if ((group?.beginnerLabel || "Genel") !== muscleFilter) return false;
            }
            if (search && !record.exercise.toLocaleLowerCase("tr-TR").includes(search)) return false;
            return true;
        });
    }, [muscleFilter, query, records, splitFilter]);

    if (loading) {
        return (
            <Animated.View style={[styles.container, { justifyContent: "center", alignItems: "center" }, animStyle]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </Animated.View>
        );
    }

    return (
            <Animated.View style={[styles.container, animStyle]}>
            {/* Header */}
            <Animated.View style={[styles.header, { paddingTop: insets.top + spacing.md }, headerAnimStyle]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>En İyi Setlerim</Text>
                <View style={{ width: 24 }} />
            </Animated.View>

            {records.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="trophy-outline" size={64} color={colors.border} />
                    <Text style={styles.emptyText}>Henüz rekor bulunmuyor.</Text>
                    <Text style={styles.emptySubtext}>Antrenman loglarınızdan rekorlar otomatik hesaplanır.</Text>
                </View>
            ) : (
                <>
                    <Animated.View style={[styles.filterWrap, filterAnimStyle]}>
                        <View style={styles.searchBox}>
                            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Hareket ara"
                                placeholderTextColor={colors.textMuted}
                                style={styles.searchInput}
                            />
                        </View>
                        <FlatList
                            horizontal
                            data={splitOptions}
                            keyExtractor={(item) => item}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <AnimatedPressable
                                    style={[styles.filterChip, splitFilter === item && styles.filterChipActive]}
                                    onPress={() => setSplitFilter(item)}
                                    pressedScale={0.96}
                                >
                                    <Text style={[styles.filterChipText, splitFilter === item && styles.filterChipTextActive]}>{item}</Text>
                                </AnimatedPressable>
                            )}
                        />
                        <FlatList
                            horizontal
                            data={muscleOptions}
                            keyExtractor={(item) => `muscle-${item}`}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <AnimatedPressable
                                    style={[styles.filterChip, muscleFilter === item && styles.filterChipActive]}
                                    onPress={() => setMuscleFilter(item)}
                                    pressedScale={0.96}
                                >
                                    <Text style={[styles.filterChipText, muscleFilter === item && styles.filterChipTextActive]}>{item}</Text>
                                </AnimatedPressable>
                            )}
                        />
                    </Animated.View>
                    <FlatList
                        data={visibleRecords}
                        keyExtractor={(item) => item.exercise}
                        renderItem={renderItem}
                        initialNumToRender={10}
                        maxToRenderPerBatch={8}
                        windowSize={7}
                        removeClippedSubviews
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                </>
            )}
            <PremiumModalSurface visible={!!editingRecord} onDismiss={() => setEditingRecord(null)} containerStyle={styles.modalCard}>
                <Text style={styles.modalTitle}>PR videosu</Text>
                <Text style={styles.modalText}>
                    {editingRecord?.exercise} rekoruna YouTube veya Instagram bağlantısı ekleyebilirsin.
                </Text>
                <TextInput
                    value={linkDraft}
                    onChangeText={setLinkDraft}
                    placeholder="https://youtube.com/... veya https://instagram.com/..."
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    style={styles.linkInput}
                />
                {!!linkError && <Text style={styles.errorText}>{linkError}</Text>}
                <View style={styles.modalActions}>
                    <AnimatedPressable style={styles.secondaryBtn} onPress={() => setEditingRecord(null)} pressedScale={0.98}>
                        <Text style={styles.secondaryBtnText}>İptal</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.primaryBtn} onPress={saveRecordLink} pressedScale={0.98}>
                        <Text style={styles.primaryBtnText}>Kaydet</Text>
                    </AnimatedPressable>
                </View>
            </PremiumModalSurface>
        </Animated.View>
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
        paddingTop: spacing.md,
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
        gap: spacing.sm,
    },
    searchBox: {
        minHeight: 44,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: fontSize.sm,
        paddingVertical: spacing.sm,
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
    recordPressable: {
        width: "100%",
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
        marginRight: spacing.sm,
    },
    recordUnit: {
        fontSize: fontSize.sm,
        fontWeight: "normal" as any,
        color: colors.textSecondary,
    },
    linkBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    linkBtnActive: {
        backgroundColor: colors.accent,
    },
    modalCard: {
        width: "100%",
        maxWidth: 460,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.md,
    },
    modalTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    modalText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    linkInput: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.text,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.sm,
    },
    errorText: { color: colors.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    modalActions: { flexDirection: "row", gap: spacing.sm },
    secondaryBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
    },
    secondaryBtnText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    primaryBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    primaryBtnText: { color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
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
