import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { programApi, parseApiError } from "../services/api";
import GymCard from "../components/GymCard";
import NoticeModal from "../components/NoticeModal";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SortMode = "stars" | "newest" | "oldest";
type SplitFilter = "ALL" | "PPL" | "AP" | "UL" | "TL" | "FB" | "OTHER";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
    { key: "stars", label: "Yıldız" },
    { key: "newest", label: "Yeni" },
    { key: "oldest", label: "Eski" },
];

const SPLIT_OPTIONS: { key: SplitFilter; label: string }[] = [
    { key: "ALL", label: "Tümü" },
    { key: "PPL", label: "PPL" },
    { key: "AP", label: "AP" },
    { key: "UL", label: "UL" },
    { key: "TL", label: "TL" },
    { key: "FB", label: "FB" },
    { key: "OTHER", label: "Diğer" },
];

function ownerName(program: any) {
    const user = program.user;
    if (!user) return "Topluluk";
    return user.nickname || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Topluluk";
}

function ownerInitials(program: any) {
    const user = program.user;
    const initials = `${user?.firstName?.charAt(0) || ""}${user?.lastName?.charAt(0) || ""}`.trim();
    return (initials || ownerName(program).slice(0, 2)).toUpperCase();
}

function programDayCount(program: any) {
    if (Array.isArray(program.data?.days)) return program.data.days.length;
    if (Array.isArray(program.data?.exercises)) return program.data.exercises.length;
    return 0;
}

function splitLabel(program: any) {
    const split = String(program.data?.splitType || "OTHER").toUpperCase();
    return SPLIT_OPTIONS.find((option) => option.key === split)?.label || "Diğer";
}

export default function CommunityProgramsScreen() {
    const navigation = useNavigation<Nav>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [programs, setPrograms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [sort, setSort] = useState<SortMode>("stars");
    const [split, setSplit] = useState<SplitFilter>("ALL");
    const [splitInfoVisible, setSplitInfoVisible] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await programApi.listCommunity({
                limit: 50,
                sort,
                ...(split !== "ALL" ? { split } : {}),
            });
            setPrograms(res.data.programs || []);
        } catch (err) {
            console.error("[CommunityPrograms] Load error:", err);
        } finally {
            setLoading(false);
        }
    }, [sort, split]);

    useFocusEffect(useCallback(() => {
        setLoading(true);
        load();
    }, [load]));

    const updateProgram = (next: any) => {
        setPrograms((prev) =>
            prev
                .map((program) => (program.id === next.id ? { ...program, ...next } : program))
                .sort((a, b) => {
                    if (sort === "newest") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    if (sort === "oldest") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    return (b.starCount || 0) - (a.starCount || 0);
                }),
        );
    };

    const toggleStar = async (program: any) => {
        setBusyId(program.id);
        try {
            const res = program.isStarredByMe
                ? await programApi.unstar(program.id)
                : await programApi.star(program.id);
            updateProgram(res.data);
        } catch (err) {
            const apiError = parseApiError(err);
            Alert.alert("Hata", apiError.message);
        } finally {
            setBusyId(null);
        }
    };

    const copyToLibrary = async (program: any) => {
        setBusyId(program.id);
        try {
            const res = await programApi.copyToLibrary(program.id);
            Alert.alert("Eklendi", "Program kitaplığına eklendi.");
            navigation.navigate("ProgramDetail", { programId: res.data.id });
        } catch (err) {
            const apiError = parseApiError(err);
            Alert.alert("Hata", apiError.message);
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <View style={[styles.root, styles.center]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Topluluk Programları</Text>
                <View style={styles.iconBtn} />
            </View>

            <FlatList
                data={programs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <View style={styles.filters}>
                        <Text style={styles.filterLabel}>Sıralama</Text>
                        <View style={styles.filterRow}>
                            {SORT_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.filterChip, sort === option.key && styles.filterChipActive]}
                                    onPress={() => setSort(option.key)}
                                >
                                    <Text style={[styles.filterChipText, sort === option.key && styles.filterChipTextActive]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.filterLabelRow}>
                            <Text style={styles.filterLabel}>Split</Text>
                            <TouchableOpacity
                                style={styles.infoBtn}
                                onPress={() => setSplitInfoVisible(true)}
                            >
                                <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.filterRow}>
                            {SPLIT_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.filterChip, split === option.key && styles.filterChipActive]}
                                    onPress={() => setSplit(option.key)}
                                >
                                    <Text style={[styles.filterChipText, split === option.key && styles.filterChipTextActive]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="planet-outline" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>Henüz public program yok.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.86}
                        onPress={() => navigation.navigate("ProgramDetail", { programId: item.id })}
                    >
                        <GymCard elevated style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                                    <View style={styles.ownerRow}>
                                        {item.user?.avatarUrl ? (
                                            <Image source={{ uri: item.user.avatarUrl }} style={styles.ownerAvatar} />
                                        ) : (
                                            <View style={styles.ownerAvatarFallback}>
                                                <Text style={styles.ownerAvatarText}>{ownerInitials(item)}</Text>
                                            </View>
                                        )}
                                        <Text style={styles.owner} numberOfLines={1}>{ownerName(item)}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.starPill}
                                    onPress={() => toggleStar(item)}
                                    disabled={busyId === item.id}
                                >
                                    <Ionicons
                                        name={item.isStarredByMe ? "star" : "star-outline"}
                                        size={17}
                                        color={colors.accent}
                                    />
                                    <Text style={styles.starText}>{item.starCount || 0}</Text>
                                </TouchableOpacity>
                            </View>

                            {item.description ? (
                                <Text style={styles.description} numberOfLines={2}>
                                    {item.description}
                                </Text>
                            ) : null}

                            <View style={styles.metaRow}>
                                <View style={styles.metaPill}>
                                    <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                                    <Text style={styles.metaText}>{programDayCount(item)} gün</Text>
                                </View>
                                <View style={styles.metaPill}>
                                    <Ionicons name="repeat-outline" size={13} color={colors.textMuted} />
                                    <Text style={styles.metaText}>{item.frequency || 7}/döngü</Text>
                                </View>
                                <View style={styles.metaPill}>
                                    <Ionicons name="layers-outline" size={13} color={colors.textMuted} />
                                    <Text style={styles.metaText}>{splitLabel(item)}</Text>
                                </View>
                            </View>

                            {!item.isMine && (
                                <TouchableOpacity
                                    style={styles.copyBtn}
                                    onPress={() => copyToLibrary(item)}
                                    disabled={busyId === item.id}
                                >
                                    <Ionicons name="library-outline" size={16} color={colors.background} />
                                    <Text style={styles.copyText}>Kitaplığıma Ekle</Text>
                                </TouchableOpacity>
                            )}
                        </GymCard>
                    </TouchableOpacity>
                )}
            />
            <NoticeModal
                visible={splitInfoVisible}
                title="Split Kısaltmaları"
                message={"PPL: Push Pull Legs\nAP: Anterior Posterior\nUL: Upper Lower\nTL: Torso Limbs\nFB: Full Body\nDiğer: Bu kalıpların dışında özel programlar"}
                onClose={() => setSplitInfoVisible(false)}
            />
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: "center", alignItems: "center" },
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
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    iconBtn: {
        padding: spacing.xs,
        minWidth: 44,
        alignItems: "center",
    },
    list: { padding: spacing.lg, paddingBottom: 120 },
    filters: {
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    filterLabel: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        textTransform: "uppercase",
        letterSpacing: 0,
    },
    filterLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    infoBtn: {
        padding: 2,
    },
    filterRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    filterChip: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    filterChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    filterChipText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    filterChipTextActive: {
        color: colors.accent,
    },
    card: { marginBottom: spacing.md },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    name: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    ownerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: 4,
    },
    owner: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        flex: 1,
    },
    ownerAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.surfaceElevated,
    },
    ownerAvatarFallback: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    ownerAvatarText: {
        fontSize: 9,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    starPill: {
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
    starText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    description: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    metaRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    metaPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    metaText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        fontWeight: fontWeight.semibold,
    },
    copyBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
    },
    copyText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    empty: { alignItems: "center", paddingTop: spacing.xxxl, gap: spacing.md },
    emptyText: { color: colors.textMuted, fontSize: fontSize.md },
});
