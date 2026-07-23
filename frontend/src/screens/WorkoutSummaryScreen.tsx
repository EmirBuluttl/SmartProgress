// ─────────────────────────────────────────────
// WorkoutSummaryScreen — Post-workout özeti
// Antrenman bitince gösterilen özet ekranı
// ─────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Animated,
    Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import AccentButton from "../components/AccentButton";
import NoticeModal from "../components/NoticeModal";
import AnimatedPressable from "../components/AnimatedPressable";
import { CARDIO_TYPE_LABELS, summarizeCardioBlock, summarizeCardioBlocks } from "../utils/cardio";
import { parseApiError, programApi } from "../services/api";

type SummaryRoute = RouteProp<RootStackParamList, "WorkoutSummary">;

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}sa ${m}dk`;
    if (m > 0) return `${m}dk ${s > 0 ? `${s}sn` : ""}`.trim();
    return `${s}sn`;
}

export default function WorkoutSummaryScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<SummaryRoute>();
    const {
        programName,
        dayLabel,
        nextDayLabel,
        totalVolume,
        duration,
        exerciseCount,
        setCount,
        notes,
        cardioBlocks,
        sourceWorkout,
    } = route.params;

    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [notesVisible, setNotesVisible] = useState(false);
    const [savingProgram, setSavingProgram] = useState(false);
    const [savedProgramId, setSavedProgramId] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
    const trimmedNotes = notes?.trim();
    const canSaveAsProgram = !programName && Array.isArray(sourceWorkout?.exercises) && sourceWorkout.exercises.length > 0;

    const entryAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const sparkleAnim = useRef(new Animated.Value(0)).current;
    const statAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        entryAnim.setValue(0);
        fadeAnim.setValue(0);
        sparkleAnim.setValue(0);
        statAnims.forEach((anim) => anim.setValue(0));

        Animated.parallel([
            Animated.spring(entryAnim, {
                toValue: 1,
                tension: 76,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.delay(160),
                Animated.timing(sparkleAnim, {
                    toValue: 1,
                    duration: 680,
                    useNativeDriver: true,
                }),
            ]),
            Animated.sequence([
                Animated.delay(240),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 360,
                    useNativeDriver: true,
                }),
            ]),
            Animated.sequence([
                Animated.delay(340),
                Animated.stagger(
                    70,
                    statAnims.map((anim) =>
                        Animated.spring(anim, {
                            toValue: 1,
                            tension: 70,
                            friction: 8,
                            useNativeDriver: true,
                        })
                    )
                ),
            ]),
        ]).start();
    }, [entryAnim, fadeAnim, sparkleAnim, statAnims]);

    const handleGoHome = () => {
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    };

    const shareWorkoutSummary = async () => {
        const title = programName ? `${programName} tamamlandi` : "SmartProgress antrenman ozeti";
        const lines = [
            title,
            dayLabel ? `Gun: ${dayLabel}` : undefined,
            `Sure: ${formatDuration(duration)}`,
            `Egzersiz: ${exerciseCount}`,
            `Set: ${setCount}`,
            `Yuk skoru: ${Number(totalVolume || 0).toFixed(1)}`,
            "SmartProgress ile loglandi.",
        ].filter(Boolean);
        try {
            await Share.share({ title, message: lines.join("\n") });
        } catch {
            setNotice({ title: "Paylasilamadi", message: "Antrenman ozeti paylasilamadi. Lutfen tekrar dene." });
        }
    };

    const buildTargetSetFromLoggedSet = (set: any) => {
        const effortMode = set.effortMode === "duration" || set.durationSeconds ? "duration" : "reps";
        const sideMode = set.sideMode === "left_right" ? "left_right" : "both";
        const left = sideMode === "left_right" ? set.left : undefined;
        const right = sideMode === "left_right" ? set.right : undefined;
        const reps = effortMode === "duration"
            ? String(set.durationSeconds || left?.durationSeconds || right?.durationSeconds || "")
            : String(set.reps ?? left?.reps ?? right?.reps ?? "");
        const weight = set.weight ?? set.externalWeight ?? left?.weight ?? right?.weight;
        return {
            targetReps: reps,
            ...(weight !== undefined && weight !== null && weight !== "" ? { targetWeight: String(weight) } : {}),
            ...(set.weightMode ? { weightMode: set.weightMode } : {}),
            effortMode,
            sideMode,
            isWarmup: !!set.isWarmup,
        };
    };

    const saveFreeWorkoutAsProgram = async () => {
        if (!canSaveAsProgram || savingProgram) return;
        if (savedProgramId) {
            navigation.navigate("ProgramDetail", { programId: savedProgramId });
            return;
        }
        setSavingProgram(true);
        try {
            const exercises = (sourceWorkout.exercises || [])
                .map((exercise: any) => ({
                    id: exercise.id || Math.random().toString(36).slice(2),
                    exerciseId: exercise.exerciseId,
                    name: exercise.name,
                    targetSets: (exercise.sets || [])
                        .filter((set: any) => set.completed !== false)
                        .map(buildTargetSetFromLoggedSet)
                        .filter((set: any) => set.targetReps !== ""),
                }))
                .filter((exercise: any) => exercise.name && exercise.targetSets.length > 0);

            if (exercises.length === 0) {
                setNotice({ title: "Program olusturulamadi", message: "Kaydedilecek hareket veya set bulunamadi." });
                return;
            }

            const name = sourceWorkout.title || "Serbest antrenman programi";
            const res = await programApi.create({
                name,
                description: "Serbest antrenmandan program olarak kaydedildi.",
                isPublic: false,
                frequency: 1,
                data: {
                    frequency: 1,
                    splitType: "OTHER",
                    days: [
                        {
                            label: "1. Gun",
                            exercises,
                        },
                    ],
                },
            });
            const created = res.data?.program || res.data;
            if (created?.id) setSavedProgramId(created.id);
            setNotice({
                title: "Program kaydedildi",
                message: "Bu antrenman private program olarak kutuphanene eklendi.",
            });
            if (created?.id) {
                setTimeout(() => {
                    navigation.navigate("ProgramDetail", { programId: created.id });
                }, 350);
            }
        } catch (err) {
            const apiError = parseApiError(err);
            setNotice({ title: "Program kaydedilemedi", message: apiError.message || "Lutfen tekrar dene." });
        } finally {
            setSavingProgram(false);
        }
    };

    const sparkleDots = [
        { left: 0, top: 12, width: 6, height: 6, x: -18, y: -18 },
        { right: -4, top: 20, width: 5, height: 5, x: 20, y: -14 },
        { left: 18, bottom: 4, width: 4, height: 4, x: -14, y: 14 },
        { right: 18, bottom: 0, width: 6, height: 6, x: 16, y: 16 },
        { left: 46, top: -8, width: 4, height: 4, x: 0, y: -20 },
    ];

    const statItems = [
        { icon: "barbell-outline" as const, value: Number(totalVolume || 0).toFixed(1), label: "Yük Skoru" },
        { icon: "time-outline" as const, value: formatDuration(duration), label: "Süre" },
        { icon: "flash-outline" as const, value: exerciseCount, label: "Egzersiz" },
        { icon: "repeat-outline" as const, value: setCount, label: "Set" },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* ─── Trophy Animation ─── */}
            <Animated.View
                style={[
                    styles.trophyWrap,
                    {
                        opacity: entryAnim,
                        transform: [
                            {
                                translateY: entryAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [18, 0],
                                }),
                            },
                            {
                                scale: entryAnim.interpolate({
                                    inputRange: [0, 0.72, 1],
                                    outputRange: [0.72, 1.08, 1],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.trophyAura,
                        {
                            opacity: entryAnim.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, 0.32, 0.18],
                            }),
                            transform: [
                                {
                                    scale: entryAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.82, 1.18],
                                    }),
                                },
                            ],
                        },
                    ]}
                />
                <View pointerEvents="none" style={styles.sparkleLayer}>
                    {sparkleDots.map((dot, index) => (
                        <Animated.View
                            key={`${dot.width}-${index}`}
                            style={[
                                styles.sparkleDot,
                                dot,
                                {
                                    opacity: sparkleAnim.interpolate({
                                        inputRange: [0, 0.22, 1],
                                        outputRange: [0, 1, 0],
                                    }),
                                    transform: [
                                        {
                                            translateX: sparkleAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, dot.x],
                                            }),
                                        },
                                        {
                                            translateY: sparkleAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, dot.y],
                                            }),
                                        },
                                        {
                                            scale: sparkleAnim.interpolate({
                                                inputRange: [0, 0.35, 1],
                                                outputRange: [0.6, 1.15, 0.75],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    ))}
                </View>
                <View style={styles.trophyCircle}>
                    <Ionicons name="trophy-outline" size={48} color={colors.accent} />
                </View>
            </Animated.View>

            <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.congratsTitle}>Harika İş Çıkardın!</Text>
                {dayLabel ? (
                    <Text style={styles.congratsSub}>
                        {programName ? `${programName} · ` : ""}{dayLabel} tamamlandı
                    </Text>
                ) : (
                    <Text style={styles.congratsSub}>Antrenman tamamlandı</Text>
                )}
            </Animated.View>

            {/* ─── Stats Grid ─── */}
            <View style={styles.statsGrid}>
                {statItems.map((item, index) => {
                    const anim = statAnims[index];
                    return (
                        <Animated.View
                            key={item.label}
                            style={[
                                styles.statSlot,
                                {
                                    opacity: anim,
                                    transform: [
                                        {
                                            translateY: anim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [14, 0],
                                            }),
                                        },
                                        {
                                            scale: anim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.97, 1],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <GymCard elevated style={styles.statCard}>
                                <Ionicons name={item.icon} size={24} color={colors.accent} />
                                <Text style={styles.statValue}>{item.value}</Text>
                                <Text style={styles.statLabel}>{item.label}</Text>
                            </GymCard>
                        </Animated.View>
                    );
                })}
            </View>

            {/* ─── Next Day Preview ─── */}
            {nextDayLabel && (
                <Animated.View style={{ opacity: fadeAnim }}>
                    <GymCard elevated style={styles.nextDayCard}>
                        <View style={styles.nextDayHeader}>
                            <Ionicons name="arrow-forward-circle" size={22} color={colors.accent} />
                            <Text style={styles.nextDayTitle}>Sıradaki Antrenman</Text>
                        </View>
                        <Text style={styles.nextDayLabel}>{nextDayLabel}</Text>
                        <Text style={styles.nextDayHint}>
                            Ana sayfaya dön, yarınki antrenman hazır olacak.
                        </Text>
                    </GymCard>
                </Animated.View>
            )}

            {trimmedNotes ? (
                <Animated.View style={[styles.noteActionWrap, { opacity: fadeAnim }]}>
                    <AnimatedPressable
                        style={styles.noteActionPressable}
                        onPress={() => setNotesVisible(true)}
                        pressedScale={0.985}
                    >
                        <View style={styles.noteActionBtn}>
                            <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                            <Text style={styles.noteActionText}>Notları Görüntüle</Text>
                        </View>
                    </AnimatedPressable>
                </Animated.View>
            ) : null}

            {cardioBlocks && cardioBlocks.length > 0 ? (
                <Animated.View style={[styles.cardioWrap, { opacity: fadeAnim }]}>
                    <GymCard elevated style={styles.cardioCard}>
                        <View style={styles.cardioHeader}>
                            <Ionicons name="pulse-outline" size={20} color={colors.accent} />
                            <Text style={styles.cardioTitle}>Kardiyo</Text>
                        </View>
                        <Text style={styles.cardioSummary}>{summarizeCardioBlocks(cardioBlocks)}</Text>
                        {cardioBlocks.map((block: any) => (
                            <View key={block.id} style={styles.cardioRow}>
                                <Text style={styles.cardioRowTitle}>{(CARDIO_TYPE_LABELS as any)[block.type] || block.title}</Text>
                                <Text style={styles.cardioRowText}>{summarizeCardioBlock(block)}</Text>
                            </View>
                        ))}
                    </GymCard>
                </Animated.View>
            ) : null}

            {canSaveAsProgram ? (
                <Animated.View style={[styles.saveProgramWrap, { opacity: fadeAnim }]}>
                    <GymCard elevated style={styles.saveProgramCard}>
                        <View style={styles.saveProgramHeader}>
                            <Ionicons name="library-outline" size={20} color={colors.accent} />
                            <Text style={styles.saveProgramTitle}>Tekrar yapmak ister misin?</Text>
                        </View>
                        <Text style={styles.saveProgramText}>
                            Bu serbest antrenmani program olarak kutuphanene ekleyip sonraki sefer ayni akisi baslatabilirsin.
                        </Text>
                        <AnimatedPressable
                            style={styles.saveProgramPressable}
                            onPress={saveFreeWorkoutAsProgram}
                            disabled={savingProgram}
                            pressedScale={0.985}
                        >
                            <View style={[styles.saveProgramBtn, savingProgram && { opacity: 0.65 }, savedProgramId && styles.saveProgramBtnDone]}>
                                <Text style={styles.saveProgramBtnText}>
                                    {savingProgram ? "Kaydediliyor..." : savedProgramId ? "Programa git" : "Program olarak kaydet"}
                                </Text>
                            </View>
                        </AnimatedPressable>
                    </GymCard>
                </Animated.View>
            ) : null}

            {/* ─── Actions ─── */}
            <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
                <AnimatedPressable
                    style={styles.shareSummaryPressable}
                    onPress={shareWorkoutSummary}
                    pressedScale={0.985}
                >
                    <View style={styles.shareSummaryBtn}>
                        <Ionicons name="share-social-outline" size={18} color={colors.accent} />
                        <Text style={styles.shareSummaryText}>Ozeti paylas</Text>
                    </View>
                </AnimatedPressable>
                <AccentButton
                    title="Ana Sayfaya Dön"
                    onPress={handleGoHome}
                    style={{ minHeight: 56 }}
                />
            </Animated.View>
            <NoticeModal
                visible={notesVisible}
                title="Antrenman Notu"
                message={trimmedNotes ?? ""}
                onClose={() => setNotesVisible(false)}
            />
            <NoticeModal
                visible={!!notice}
                title={notice?.title ?? ""}
                message={notice?.message ?? ""}
                onClose={() => setNotice(null)}
            />
        </ScrollView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl + spacing.xl,
        paddingBottom: spacing.xxxl,
        alignItems: "center",
    },
    trophyWrap: {
        marginBottom: spacing.xl,
        position: "relative",
        width: 136,
        height: 136,
        alignItems: "center",
        justifyContent: "center",
    },
    trophyAura: {
        position: "absolute",
        width: 126,
        height: 126,
        borderRadius: 63,
        backgroundColor: colors.accentMuted,
    },
    sparkleLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2,
    },
    sparkleDot: {
        position: "absolute",
        borderRadius: 999,
        backgroundColor: colors.accent,
    },
    trophyCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
        elevation: 10,
        zIndex: 1,
    },
    trophyEmoji: {
        fontSize: 48,
    },
    congratsTitle: {
        fontSize: fontSize.xxl + 4,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    congratsSub: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xxl,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        justifyContent: "center",
        width: "100%",
        marginBottom: spacing.xl,
    },
    statSlot: {
        width: "46%",
    },
    statCard: {
        width: "100%",
        alignItems: "center",
        paddingVertical: spacing.lg,
        gap: spacing.xs,
    },
    statValue: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    statLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    nextDayCard: {
        width: "100%",
        marginBottom: spacing.xl,
        borderColor: colors.accent,
        borderWidth: 1,
    },
    nextDayHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    nextDayTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    nextDayLabel: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    nextDayHint: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    noteActionWrap: {
        width: "100%",
        marginBottom: spacing.lg,
    },
    noteActionPressable: {
        width: "100%",
    },
    noteActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    noteActionText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    actions: {
        width: "100%",
        gap: spacing.sm,
    },
    shareSummaryPressable: {
        width: "100%",
    },
    shareSummaryBtn: {
        minHeight: 50,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },
    shareSummaryText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    saveProgramWrap: {
        width: "100%",
        marginBottom: spacing.lg,
    },
    saveProgramCard: {
        width: "100%",
        gap: spacing.sm,
    },
    saveProgramHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    saveProgramTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    saveProgramText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    saveProgramPressable: {
        width: "100%",
    },
    saveProgramBtn: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        alignItems: "center",
        justifyContent: "center",
    },
    saveProgramBtnDone: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
    },
    saveProgramBtnText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    cardioWrap: {
        width: "100%",
        marginBottom: spacing.lg,
    },
    cardioCard: {
        width: "100%",
        gap: spacing.sm,
    },
    cardioHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    cardioTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    cardioSummary: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
    },
    cardioRow: {
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cardioRowTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    cardioRowText: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        marginTop: 2,
    },
});
