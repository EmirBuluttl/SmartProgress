// ─────────────────────────────────────────────
// ProgramListScreen — All User Programs
// List, start, or manage user programs
// ─────────────────────────────────────────────
import React, { useCallback } from "react";
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { programApi } from "../services/api";
import GymCard from "../components/GymCard";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { navigateToWorkoutRespectingActiveSession } from "../utils/workoutNavigation";

// ─── Stagger wrapper — her kart index * 50ms delay ile girer ───
function StaggerCard({ index, children }: { index: number; children: React.ReactNode }) {
    const { animStyle } = useScreenEnter({ delay: index * 50 });
    return <Animated.View style={animStyle}>{children}</Animated.View>;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;
const ACTIVE_PROGRAM_KEY = "active_program_id";
const LEGACY_FAVORITES_KEY = "program_favorite_id";

export default function ProgramListScreen() {
    const navigation = useNavigation<Nav>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [programs, setPrograms] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeId, setActiveId] = React.useState<string | null>(null);

    const load = async () => {
        try {
            const res = await programApi.listMine();
            const active = await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY);
            const legacy = await AsyncStorage.getItem(LEGACY_FAVORITES_KEY);
            const list = res.data.programs || [];
            console.log(
                "[ProgramList] Loaded programs from listMine:",
                JSON.stringify(
                    list.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        hasData: !!p.data,
                    })),
                    null,
                    2,
                ),
            );
            setPrograms(list);
            setActiveId(active || legacy);
        } catch (err) {
            console.error("[ProgramList] Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleActiveProgram = async (id: string) => {
        const next = activeId === id ? null : id;
        setActiveId(next);
        if (next) await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, next);
        else await AsyncStorage.removeItem(ACTIVE_PROGRAM_KEY);
        await AsyncStorage.removeItem(LEGACY_FAVORITES_KEY);
    };

    useFocusEffect(useCallback(() => { load(); }, []));

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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.75}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Programlarım</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate("ProgramCreate")}
                    style={styles.iconBtn}
                    activeOpacity={0.75}
                >
                    <Ionicons name="add" size={28} color={colors.accent} />
                </TouchableOpacity>
            </View>

            {programs.length === 0 ? (
                <View style={styles.empty}>
                    <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Henüz bir programınız yok.</Text>
                    <TouchableOpacity
                        style={styles.createBtn}
                        onPress={() => navigation.navigate("ProgramCreate")}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.createBtnText}>Program Oluştur</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={programs}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item, index }) => (
                        <StaggerCard index={index}>
                        <TouchableOpacity
                        activeOpacity={0.75}
                            onPress={() => navigation.navigate("ProgramDetail", { programId: item.id })}
                        >
                        <GymCard elevated style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.progName} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <View style={styles.badgeRow}>
                                    {activeId === item.id && (
                                        <Ionicons name="bookmark" size={16} color={colors.accent} />
                                    )}
                                    {item.sourceProgramId && (
                                        <View style={styles.libraryBadge}>
                                            <Text style={styles.libraryText}>KITAPLIK</Text>
                                        </View>
                                    )}
                                    {item.isPublic && (
                                        <View style={styles.publicBadge}>
                                            <Text style={styles.publicText}>PUBLIC</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            {item.description ? (
                                <Text style={styles.progDesc} numberOfLines={2}>
                                    {item.description}
                                </Text>
                            ) : null}
                            {item.data?.exercises && (
                                <Text style={styles.exerciseCount}>
                                    {item.data.exercises.length} egzersiz
                                </Text>
                            )}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.followBtn, activeId === item.id && styles.followBtnActive]}
                                    onPress={() => toggleActiveProgram(item.id)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons
                                        name={activeId === item.id ? "bookmark" : "bookmark-outline"}
                                        size={16}
                                        color={activeId === item.id ? colors.background : colors.accent}
                                    />
                                    <Text style={[styles.followBtnText, activeId === item.id && styles.followBtnTextActive]}>
                                        {activeId === item.id ? "Takipte" : "Takibe Al"}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.startBtn}
                                    onPress={() => {
                                        console.log(
                                            "[ProgramList] Starting program:",
                                            item.id,
                                            "hasData=",
                                            !!item.data,
                                        );
                                        navigateToWorkoutRespectingActiveSession(navigation, {
                                            programId: item.id,
                                            programName: item.name,
                                            programData: item.data,
                                        });
                                    }}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="play" size={16} color={colors.background} />
                                    <Text style={styles.startBtnText}>Başlat</Text>
                                </TouchableOpacity>
                            </View>
                        </GymCard>
                        </TouchableOpacity>
                        </StaggerCard>
                    )}
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
    iconBtn: {
        padding: spacing.xs,
        minWidth: 44,
        alignItems: "center",
    },
    list: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    card: {
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.xs,
    },
    progName: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        flex: 1,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginLeft: spacing.sm,
    },
    libraryBadge: {
        backgroundColor: colors.surfaceElevated,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    libraryText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.textMuted,
    },
    publicBadge: {
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        marginLeft: spacing.sm,
    },
    publicText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    progDesc: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        lineHeight: 20,
    },
    exerciseCount: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    actionRow: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    followBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.accent,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    followBtnActive: {
        backgroundColor: colors.accent,
    },
    followBtnText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    followBtnTextActive: {
        color: colors.background,
    },
    startBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    startBtnText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.background,
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
    createBtn: {
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    createBtnText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
});
