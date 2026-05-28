// ─────────────────────────────────────────────
// ProgramDetailScreen — Program detay sayfası
// Döngüsel (Cycle-based) program: Gün listesi, silme, antrenman başlat
// ─────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { parseApiError, programApi, workoutApi } from "../services/api";
import { showAlert } from "../utils/confirm";
import ActionConfirmModal from "../components/ActionConfirmModal";
import NoticeModal from "../components/NoticeModal";

type Nav = NativeStackNavigationProp<RootStackParamList, "ProgramDetail">;
type Route = RouteProp<RootStackParamList, "ProgramDetail">;

interface ProgramDay {
    label: string;
    isRestDay?: boolean;
    exercises: {
        id?: string;
        name: string;
        targetSets: { targetReps: string; targetRPE?: string; targetRIR?: string; targetWeight?: string; isWarmup?: boolean }[];
    }[];
}

interface ProgramData {
    id: string;
    name: string;
    description?: string;
    frequency: number;
    currentDayIndex: number;
    isPublic: boolean;
    isMine?: boolean;
    isStarredByMe?: boolean;
    starCount?: number;
    sourceProgramId?: string | null;
    user?: {
        id?: string;
        firstName?: string;
        lastName?: string;
        nickname?: string | null;
        avatarUrl?: string | null;
    };
    sourceProgram?: ProgramData;
    sourceUpdateAvailable?: boolean;
    data: {
        frequency?: number;
        days: ProgramDay[];
    } | null;
    createdAt: string;
}

export default function ProgramDetailScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { programId } = route.params;
    const { colors } = useTheme();

    const [program, setProgram] = useState<ProgramData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [socialBusy, setSocialBusy] = useState(false);
    const [syncingSource, setSyncingSource] = useState(false);
    const [restAdvancing, setRestAdvancing] = useState(false);
    const [workoutCount, setWorkoutCount] = useState(0);
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

    const s = React.useMemo(() => createStyles(colors), [colors]);

    const fetchProgram = useCallback(async () => {
        try {
            const [progRes, workoutRes] = await Promise.all([
                programApi.getById(programId),
                workoutApi.list({ limit: 200 }),
            ]);
            setProgram(progRes.data as ProgramData);
            const allWorkouts = workoutRes.data?.workouts || [];
            const count = allWorkouts.filter((w: any) => w.data?.programId === programId).length;
            setWorkoutCount(count);
        } catch (err: any) {
            console.error("[ProgramDetail] fetch error:", err?.message);
            Alert.alert("Hata", "Program yüklenemedi.");
            navigation.goBack();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [programId]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchProgram();
        }, [fetchProgram]),
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchProgram();
    };

    const handleDelete = async () => {
        if (deleting) return;
        setDeleting(true);
        try {
            await programApi.deleteProgram(programId);
            navigation.goBack();
        } catch (err: any) {
            const apiError = parseApiError(err);
            showAlert("Hata", apiError.message || "Silme islemi basarisiz.");
            setDeleting(false);
        }
    };

    const handleStartWorkout = async () => {
        if (!program?.data?.days) return;
        if (program.isPublic && program.isMine === false) {
            const copied = await copyProgramToLibrary();
            if (!copied?.data?.days) return;
            navigation.replace("ProgramDetail", { programId: copied.id });
            navigation.navigate("WorkoutSession", {
                programId: copied.id,
                programName: copied.name,
                dayIndex: copied.currentDayIndex,
                programData: copied.data as any,
            });
            return;
        }

        const dayIndex = program.currentDayIndex;
        const currentDay = program.data.days[dayIndex];

        if (currentDay?.isRestDay) {
            Alert.alert(
                "Dinlenme Günü",
                "Bugün dinlenme günü! Yine de antrenman başlatmak ister misiniz?",
                [
                    { text: "Hayır", style: "cancel" },
                    {
                        text: "Evet, Başlat",
                        onPress: () => navigateToSession(dayIndex),
                    },
                ],
            );
            return;
        }

        navigateToSession(dayIndex);
    };

    const navigateToSession = (dayIndex: number) => {
        navigation.navigate("WorkoutSession", {
            programId: program!.id,
            programName: program!.name,
            dayIndex,
            programData: program!.data as any,
        });
    };

    const handleStartSelectedDay = async (dayIndex: number) => {
        if (!program?.data?.days) return;
        setSelectedDayIndex(null);

        if (program.isPublic && program.isMine === false) {
            const copied = await copyProgramToLibrary();
            if (!copied?.data?.days) return;
            navigation.replace("ProgramDetail", { programId: copied.id });
            navigation.navigate("WorkoutSession", {
                programId: copied.id,
                programName: copied.name,
                dayIndex,
                programData: copied.data as any,
            });
            return;
        }

        navigateToSession(dayIndex);
    };

    const navigateToDayDetail = (dayIndex: number) => {
        if (!program?.data?.days?.[dayIndex]) return;
        setSelectedDayIndex(null);
        navigation.navigate("ProgramDayDetail", {
            programId: program.id,
            programName: program.name,
            dayIndex,
            day: program.data.days[dayIndex],
            programData: program.data as any,
        });
    };

    const handleEdit = () => {
        if (!program) return;
        navigation.navigate("ProgramCreate", {
            editProgramId: program.id,
            editProgramData: program,
        });
    };

    const handleDayTap = (dayIndex: number) => {
        if (!program) return;
        setSelectedDayIndex(dayIndex);
    };

    const completeRestDay = async () => {
        if (!program || restAdvancing) return;
        setRestAdvancing(true);
        try {
            const res = await programApi.advanceDay(program.id);
            setProgram(res.data as ProgramData);
            setNotice({ title: "Dinlenme tamamlandı", message: "Sıradaki antrenman gününe geçildi." });
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Hata", message: apiError.message || "Dinlenme günü tamamlanamadı." });
        } finally {
            setRestAdvancing(false);
        }
    };

    const toggleStar = async () => {
        if (!program || socialBusy) return;
        setSocialBusy(true);
        try {
            const res = program.isStarredByMe
                ? await programApi.unstar(program.id)
                : await programApi.star(program.id);
            setProgram(res.data as ProgramData);
        } catch (err) {
            const apiError = parseApiError(err);
            showAlert("Hata", apiError.message || "Yıldız işlemi başarısız.");
        } finally {
            setSocialBusy(false);
        }
    };

    const copyProgramToLibrary = async (): Promise<ProgramData | null> => {
        if (!program || socialBusy) return null;
        setSocialBusy(true);
        try {
            const res = await programApi.copyToLibrary(program.id);
            return res.data as ProgramData;
        } catch (err) {
            const apiError = parseApiError(err);
            showAlert("Hata", apiError.message || "Program kitaplığa eklenemedi.");
            return null;
        } finally {
            setSocialBusy(false);
        }
    };

    const syncFromSource = async () => {
        if (!program || syncingSource) return;
        setSyncingSource(true);
        try {
            const res = await programApi.syncSource(program.id);
            setProgram(res.data as ProgramData);
            setNotice({ title: "Güncellendi", message: "Program kopyan kaynak programın son sürümüne geçirildi." });
        } catch (err) {
            const apiError = parseApiError(err);
            showAlert("Hata", apiError.message || "Program güncellenemedi.");
        } finally {
            setSyncingSource(false);
        }
    };

    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (!program) return null;

    const days = program.data?.days || [];
    const currentDayIndex = program.currentDayIndex;
    const currentDay = days[currentDayIndex];
    const isOwner = program.isMine !== false;
    const ownerName =
        program.user?.nickname ||
        [program.user?.firstName, program.user?.lastName].filter(Boolean).join(" ");
    const ownerInitials = getInitials(
        program.user?.firstName,
        program.user?.lastName,
        ownerName || "SP",
    );
    const selectedDay = selectedDayIndex !== null ? days[selectedDayIndex] : null;

    return (
        <View style={s.container}>
            {/* ─── Header ─── */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.75}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <Text style={s.headerTitle} numberOfLines={1}>
                    {program.name}
                </Text>

                <View style={s.headerActions}>
                    {isOwner && (
                        <>
                            <TouchableOpacity
                                onPress={handleEdit}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={s.headerIconBtn}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.accent} />
                            </TouchableOpacity>

                            <Pressable
                                onPress={() => setConfirmDeleteVisible(true)}
                                disabled={deleting}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={s.headerIconBtn}
                            >
                                <Ionicons
                                    name="trash-outline"
                                    size={20}
                                    color={deleting ? colors.textMuted : colors.error}
                                />
                            </Pressable>
                        </>
                    )}

                    <TouchableOpacity
                        onPress={handleStartWorkout}
                        style={s.startBtn}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="play" size={16} color={colors.background} />
                        <Text style={s.startBtnText}>Başlat</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
            >
                {/* ─── Info Card ─── */}
                <View style={s.infoCard}>
                    {program.description ? (
                        <Text style={s.description}>{program.description}</Text>
                    ) : null}

                    <View style={s.metaRow}>
                        <View style={s.metaItem}>
                            <Ionicons name="repeat-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {program.data?.frequency ? `Frekans: ${program.data.frequency} gün/hafta` : "Frekans hedefi yok"}
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>{days.length} gün tanımlı</Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="time-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                Oluşturulma: {new Date(program.createdAt).toLocaleDateString("tr-TR")}
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {Math.max(0, Math.floor((Date.now() - new Date(program.createdAt).getTime()) / 86400000))} gündür kullanılıyor
                            </Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons
                                name={program.isPublic ? "globe-outline" : "lock-closed-outline"}
                                size={16}
                                color={colors.accent}
                            />
                            <Text style={s.metaText}>
                                {program.isPublic ? "Herkese açık" : "Özel"}
                            </Text>
                        </View>
                        {program.isPublic && ownerName ? (
                            <TouchableOpacity
                                style={s.ownerPill}
                                activeOpacity={0.75}
                                onPress={() => {
                                    if (program.user?.id) navigation.navigate("PublicProfile", { userId: program.user.id });
                                }}
                            >
                                {program.user?.avatarUrl ? (
                                    <Image source={{ uri: program.user.avatarUrl }} style={s.ownerAvatar} />
                                ) : (
                                    <View style={s.ownerAvatarFallback}>
                                        <Text style={s.ownerAvatarText}>{ownerInitials}</Text>
                                    </View>
                                )}
                                <Text style={s.metaText}>{ownerName}</Text>
                            </TouchableOpacity>
                        ) : null}
                        {program.isPublic && (
                            <TouchableOpacity
                                style={s.starAction}
                                onPress={toggleStar}
                                disabled={socialBusy}
                                activeOpacity={0.75}
                            >
                                <Ionicons
                                    name={program.isStarredByMe ? "star" : "star-outline"}
                                    size={16}
                                    color={colors.accent}
                                />
                                <Text style={s.starActionText}>{program.starCount || 0}</Text>
                            </TouchableOpacity>
                        )}
                        <View style={s.metaItem}>
                            <Ionicons name="barbell-outline" size={16} color={colors.accent} />
                            <Text style={s.metaText}>
                                {workoutCount} antrenman tamamlandı
                            </Text>
                        </View>
                    </View>
                    {program.isPublic && !isOwner && (
                        <TouchableOpacity
                            style={s.copyBtn}
                            onPress={async () => {
                                const copied = await copyProgramToLibrary();
                                if (copied) navigation.replace("ProgramDetail", { programId: copied.id });
                            }}
                            disabled={socialBusy}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="library-outline" size={16} color={colors.background} />
                            <Text style={s.copyBtnText}>Kitaplığıma Ekle</Text>
                        </TouchableOpacity>
                    )}
                    {program.sourceUpdateAvailable && (
                        <View style={s.sourceUpdateBox}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.sourceUpdateTitle}>Kaynak program güncellendi</Text>
                                <Text style={s.sourceUpdateText}>
                                    İstersen bu kopyayı program sahibinin son sürümüne geçirebilirsin.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={s.sourceUpdateBtn}
                                onPress={syncFromSource}
                                disabled={syncingSource}
                                activeOpacity={0.75}
                            >
                                <Text style={s.sourceUpdateBtnText}>{syncingSource ? "..." : "Güncelle"}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ─── Current Day Highlight ─── */}
                {days.length > 0 && isOwner && (
                    <View style={s.currentDayBanner}>
                        <View style={s.currentDayInfo}>
                            <View style={s.currentDayDot} />
                            <Text style={s.currentDayLabel}>
                                Sıradaki:{" "}
                                <Text style={{ fontWeight: fontWeight.bold as any }}>
                                    {currentDay?.label || `Gün ${currentDayIndex + 1}`}
                                </Text>
                            </Text>
                        </View>
                        {currentDay?.isRestDay && (
                            <TouchableOpacity
                                style={s.completeRestBtn}
                                onPress={completeRestDay}
                                disabled={restAdvancing}
                                activeOpacity={0.75}
                            >
                                <Text style={s.completeRestText}>{restAdvancing ? "..." : "Tamamla / Geç"}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* ─── Day List ─── */}
                <Text style={s.sectionTitle}>Program Takvimi</Text>

                {days.map((day, idx) => {
                    const isCurrent = isOwner && idx === currentDayIndex;
                    const isRest = day.isRestDay;

                    return (
                        <View
                            key={idx}
                            style={[s.dayCard, isCurrent && s.dayCardActive]}
                        >
                            <TouchableOpacity onPress={() => handleDayTap(idx)} activeOpacity={0.75}>
                            <View style={s.dayHeader}>
                                <View
                                    style={[
                                        s.dayIndexCircle,
                                        isCurrent && s.dayIndexCircleActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.dayIndexText,
                                            isCurrent && s.dayIndexTextActive,
                                        ]}
                                    >
                                        {idx + 1}
                                    </Text>
                                </View>
                                <Text style={[s.dayLabel, isRest && s.restLabel]}>
                                    {day.label || `Gün ${idx + 1}`}
                                </Text>
                                {isCurrent && (
                                    <View style={s.currentBadge}>
                                        <Text style={s.currentBadgeText}>Sıradaki</Text>
                                    </View>
                                )}
                                {isRest && (
                                    <View style={s.restBadge}>
                                        <Ionicons name="bed-outline" size={14} color={colors.textMuted} />
                                        <Text style={s.restBadgeText}>Dinlenme</Text>
                                    </View>
                                )}
                            </View>

                            {!isRest && day.exercises.length > 0 && (
                                <View style={s.exerciseList}>
                                    {day.exercises.map((ex, exIdx) => (
                                        <View key={exIdx} style={s.exerciseRow}>
                                            <Text style={s.exerciseDot}>•</Text>
                                            <Text style={s.exerciseName}>{ex.name}</Text>
                                            <Text style={s.exerciseSets}>
                                                {formatSetSummary(ex.targetSets)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!isRest && day.exercises.length === 0 && (
                                <Text style={s.noExercises}>Egzersiz tanımlı değil</Text>
                            )}
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {days.length === 0 && (
                    <View style={s.emptyState}>
                        <Ionicons name="document-outline" size={48} color={colors.border} />
                        <Text style={s.emptyText}>Bu programda henüz gün tanımlı değil.</Text>
                    </View>
                )}
            </ScrollView>
            <ActionConfirmModal
                visible={confirmDeleteVisible}
                title="Programı sil?"
                message="Bu program kalıcı olarak silinecek. Bu işlem geri alınamaz."
                primaryLabel="Sil"
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={() => {
                    setConfirmDeleteVisible(false);
                    handleDelete();
                }}
                onSecondary={() => setConfirmDeleteVisible(false)}
                onDismiss={() => setConfirmDeleteVisible(false)}
            />
            <ActionConfirmModal
                visible={selectedDayIndex !== null}
                title={selectedDay?.label || "Program günü"}
                message={
                    selectedDay?.isRestDay
                        ? selectedDayIndex === currentDayIndex
                            ? "Bu gün dinlenme günü olarak tanımlı. Tamamlayıp sıradaki antrenman gününe geçebilirsin."
                            : "Bu gün dinlenme günü olarak tanımlı."
                        : "Bu program gününü sıradaki günü beklemeden başlatabilirsiniz."
                }
                primaryLabel={selectedDay?.isRestDay ? (selectedDayIndex === currentDayIndex ? "Tamamla / Geç" : "Detayları Gör") : "Günü Başlat"}
                secondaryLabel={selectedDay?.isRestDay ? "Kapat" : "Detayları Gör"}
                onPrimary={() => {
                    if (selectedDayIndex === null) return;
                    if (selectedDay?.isRestDay) {
                        if (selectedDayIndex === currentDayIndex) {
                            setSelectedDayIndex(null);
                            completeRestDay();
                        } else {
                            navigateToDayDetail(selectedDayIndex);
                        }
                        return;
                    }
                    handleStartSelectedDay(selectedDayIndex);
                }}
                onSecondary={() => {
                    if (selectedDay?.isRestDay) {
                        setSelectedDayIndex(null);
                        return;
                    }
                    if (selectedDayIndex !== null) navigateToDayDetail(selectedDayIndex);
                }}
                onDismiss={() => setSelectedDayIndex(null)}
            />
            <NoticeModal
                visible={!!notice}
                title={notice?.title ?? ""}
                message={notice?.message ?? ""}
                onClose={() => setNotice(null)}
            />
        </View>
    );
}

function formatSetSummary(targetSets: ProgramDay["exercises"][number]["targetSets"] = []): string {
    const warmup = targetSets.filter((set) => set.isWarmup).length;
    const working = targetSets.length - warmup;
    const parts: string[] = [];
    if (warmup > 0) parts.push(`${warmup} ısınma`);
    if (working > 0) parts.push(`${working} çalışma`);
    return parts.length > 0 ? `${parts.join(" · ")} seti` : "Set yok";
}

function getInitials(firstName?: string, lastName?: string, fallback = "SP"): string {
    const initials = `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.trim();
    if (initials) return initials.toUpperCase();
    return fallback.slice(0, 2).toUpperCase();
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
    },
    headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    headerIconBtn: { padding: spacing.xs },
    startBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    startBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.background },

    // Content
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

    // Info card
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    description: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    metaText: { fontSize: fontSize.xs, color: colors.textMuted },
    ownerPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    ownerAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.surfaceElevated,
    },
    ownerAvatarFallback: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    ownerAvatarText: {
        fontSize: 10,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    starAction: {
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
    starActionText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    copyBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        marginTop: spacing.md,
    },
    copyBtnText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
    sourceUpdateBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    sourceUpdateTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    sourceUpdateText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    sourceUpdateBtn: {
        backgroundColor: colors.accent,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    sourceUpdateBtnText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },

    // Current day banner
    currentDayBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.accentSubtle,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    currentDayInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    currentDayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    currentDayLabel: { fontSize: fontSize.sm, color: colors.text },
    completeRestBtn: {
        borderRadius: borderRadius.full,
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    completeRestText: {
        color: colors.background,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },

    // Section
    sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },

    // Day cards
    dayCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    dayCardActive: { borderColor: colors.accent, backgroundColor: colors.accentFill },
    dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dayIndexCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
    },
    dayIndexCircleActive: { backgroundColor: colors.accent },
    dayIndexText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted },
    dayIndexTextActive: { color: colors.background },
    dayLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
    restLabel: { color: colors.textMuted },
    currentBadge: { backgroundColor: colors.accent, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    currentBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.background },
    restBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        gap: 4,
    },
    restBadgeText: { fontSize: fontSize.xs, color: colors.textMuted },

    // Exercises
    exerciseList: { marginTop: spacing.sm, paddingLeft: 36 },
    exerciseRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs, gap: spacing.xs },
    exerciseDot: { fontSize: 10, color: colors.textMuted },
    exerciseName: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
    exerciseSets: { fontSize: fontSize.xs, color: colors.textMuted },
    noExercises: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs, paddingLeft: 36 },

    // Empty state
    emptyState: { alignItems: "center", paddingTop: spacing.xxxl, gap: spacing.md },
    emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" },
});

