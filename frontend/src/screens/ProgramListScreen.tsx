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
import GymCard from "../components/GymCard";
import ActionConfirmModal from "../components/ActionConfirmModal";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useScreenEnter } from "../hooks/useScreenEnter";
import {
    activateProgramForWorkout,
    ACTIVE_PROGRAM_KEY,
    buildPreviewWorkoutParams,
    buildTrackedWorkoutParams,
    clearActiveProgramId,
    getActiveProgramId,
    LEGACY_ACTIVE_PROGRAM_KEY,
    navigateToWorkoutRespectingActiveSession,
    type StartableProgram,
} from "../utils/workoutNavigation";
import { navigateWithFeedback } from "../utils/navigationFeedback";
import { useMyProgramsQuery } from "../hooks/usePrograms";

// ─── Stagger wrapper — her kart index * 50ms delay ile girer ───
function StaggerCard({ index, children }: { index: number; children: React.ReactNode }) {
    const { animStyle } = useScreenEnter({ delay: index * 50 });
    return <Animated.View style={animStyle}>{children}</Animated.View>;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgramListScreen() {
    const navigation = useNavigation<Nav>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const { data: programs = [], isLoading: queryLoading } = useMyProgramsQuery();
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [pendingStart, setPendingStart] = React.useState<StartableProgram | null>(null);
    const [loadingSettings, setLoadingSettings] = React.useState(true);

    const loadSettings = async () => {
        try {
            const active = await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY);
            const legacy = await AsyncStorage.getItem(LEGACY_ACTIVE_PROGRAM_KEY);
            setActiveId(active || legacy);
        } catch (err) {
            console.error("[ProgramList] Load settings error:", err);
        } finally {
            setLoadingSettings(false);
        }
    };

    const loading = queryLoading || loadingSettings;

    const toggleActiveProgram = async (id: string) => {
        const next = activeId === id ? null : id;
        setActiveId(next);
        if (next) await activateProgramForWorkout(next, activeId);
        else await clearActiveProgramId();
    };

    const startProgram = async (item: any) => {
        const programToStart: StartableProgram = { id: item.id, name: item.name, data: item.data };
        const currentActiveId = activeId || await getActiveProgramId();

        if (currentActiveId !== item.id) {
            setPendingStart(programToStart);
            return;
        }

        console.log("[ProgramList] Starting active program:", item.id, "hasData=", !!item.data);
        navigateToWorkoutRespectingActiveSession(navigation, buildTrackedWorkoutParams(programToStart));
    };

    const startPendingAsActive = async () => {
        if (!pendingStart) return;
        const programToStart = pendingStart;
        setPendingStart(null);
        await activateProgramForWorkout(programToStart.id, activeId);
        setActiveId(programToStart.id);
        navigateToWorkoutRespectingActiveSession(navigation, buildTrackedWorkoutParams(programToStart, 0));
    };

    const startPendingWithoutTracking = () => {
        if (!pendingStart) return;
        const programToStart = pendingStart;
        setPendingStart(null);
        navigateToWorkoutRespectingActiveSession(navigation, buildPreviewWorkoutParams(programToStart, 0));
    };

    useFocusEffect(useCallback(() => { loadSettings(); }, []));

    if (loading) {
        return (
            <Animated.View style={[styles.root, { justifyContent: "center", alignItems: "center" }, animStyle]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </Animated.View>
        );
    }

    return (
        <Animated.View style={[styles.root, animStyle]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.75}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Programlarım</Text>
                <TouchableOpacity
                    onPress={() => navigateWithFeedback(() => navigation.navigate("ProgramCreate"), { variant: "modal" })}
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
                        onPress={() => navigateWithFeedback(() => navigation.navigate("ProgramCreate"), { variant: "modal" })}
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
                            onPress={() => navigateWithFeedback(() => navigation.navigate("ProgramDetail", { programId: item.id }))}
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
                                    onPress={() => startProgram(item)}
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
            <ActionConfirmModal
                visible={!!pendingStart}
                title="Bu program takipte degil"
                message="Bu programi aktif takip edilen program haline getirirsem onceki aktif programin gun sirasi sifirlanir. Istersen sadece bu antrenmani takip akisini degistirmeden baslatabilirsin."
                primaryLabel="Aktif yap ve baslat"
                secondaryLabel="Sadece baslat"
                onPrimary={startPendingAsActive}
                onSecondary={startPendingWithoutTracking}
                onDismiss={() => setPendingStart(null)}
            />
        </Animated.View>
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
