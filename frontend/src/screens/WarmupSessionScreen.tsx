import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AccentButton from "../components/AccentButton";
import ActionConfirmModal from "../components/ActionConfirmModal";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { restoreActiveSession, saveActiveSession } from "../services/syncService";
import type { CardioBlock, WorkoutExercise, WorkoutSession, WorkoutSet } from "../types/workout";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function parseNumber(raw: string): number {
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
    const numeric = Number(value) || 0;
    return numeric > 0 ? String(numeric) : "";
}

function hasLoggedSetData(set: WorkoutSet): boolean {
    return Number(set.weight) > 0 ||
        Number(set.reps) > 0 ||
        Number(set.durationSeconds) > 0 ||
        Number(set.rpe) > 0;
}

function hasWarmupData(session?: WorkoutSession | null): boolean {
    const routine = session?.warmupRoutine;
    if (!routine) return false;
    return !!routine.steps?.some((step) => step.completed) ||
        !!routine.exercises?.some((exercise) => exercise.sets.some(hasLoggedSetData)) ||
        !!routine.cardioBlocks?.some((block) => block.completedAt || Number(block.totalDuration) > 0);
}

export default function WarmupSessionScreen() {
    const navigation = useNavigation<Navigation>();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [exitModalVisible, setExitModalVisible] = useState(false);
    const closingRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        restoreActiveSession().then((saved) => {
            if (!mounted) return;
            if (!saved?.warmupRoutine) {
                navigation.goBack();
                return;
            }
            setSession(saved);
            setLoading(false);
        });
        return () => {
            mounted = false;
        };
    }, [navigation]);

    useEffect(() => {
        const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
            if (closingRef.current) return;
            event.preventDefault();
            setExitModalVisible(true);
        });
        return unsubscribe;
    }, [navigation]);

    const persist = useCallback(async (nextSession: WorkoutSession) => {
        setSession(nextSession);
        await saveActiveSession(nextSession);
    }, []);

    const updateWarmupSet = useCallback((
        exerciseId: string,
        setId: string,
        field: "weight" | "reps" | "durationSeconds",
        raw: string,
    ) => {
        if (!session?.warmupRoutine) return;
        const value = field === "weight" ? parseNumber(raw) : Math.max(0, Math.floor(parseNumber(raw)));
        const nextSession = {
            ...session,
            warmupRoutine: {
                ...session.warmupRoutine,
                exercises: (session.warmupRoutine.exercises || []).map((exercise) =>
                    exercise.id === exerciseId
                        ? {
                            ...exercise,
                            sets: exercise.sets.map((set) => set.id === setId ? { ...set, [field]: value } : set),
                        }
                        : exercise,
                ),
            },
        };
        persist(nextSession);
    }, [persist, session]);

    const toggleCardioComplete = useCallback((blockId: string) => {
        if (!session?.warmupRoutine) return;
        const now = new Date().toISOString();
        const nextSession = {
            ...session,
            warmupRoutine: {
                ...session.warmupRoutine,
                cardioBlocks: (session.warmupRoutine.cardioBlocks || []).map((block) =>
                    block.id === blockId
                        ? { ...block, completedAt: block.completedAt ? undefined : now }
                        : block,
                ),
            },
        };
        persist(nextSession);
    }, [persist, session]);

    const finishWarmup = useCallback(async () => {
        if (!session?.warmupRoutine) return;
        closingRef.current = true;
        await persist({
            ...session,
            warmupRoutine: {
                ...session.warmupRoutine,
                status: "completed",
                completedAt: new Date().toISOString(),
                steps: session.warmupRoutine.steps?.map((step) => ({ ...step, completed: true })),
            },
        });
        navigation.goBack();
    }, [navigation, persist, session]);

    const abandonWarmup = useCallback(async () => {
        if (!session?.warmupRoutine) return;
        setExitModalVisible(false);
        closingRef.current = true;
        await persist({
            ...session,
            warmupRoutine: {
                ...session.warmupRoutine,
                status: "cancelled",
                completedAt: new Date().toISOString(),
            },
        });
        navigation.goBack();
    }, [navigation, persist, session]);

    const saveAndExit = useCallback(async () => {
        setExitModalVisible(false);
        closingRef.current = true;
        if (session) await persist(session);
        navigation.navigate("MainTabs");
    }, [navigation, persist, session]);

    const routine = session?.warmupRoutine;
    const exercises: WorkoutExercise[] = routine?.exercises || [];
    const cardioBlocks: CardioBlock[] = routine?.cardioBlocks || [];

    if (loading || !session || !routine) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Isinma rutini hazirlaniyor...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setExitModalVisible(true)}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Isinma Rutini</Text>
                    <Text style={styles.headerSubtitle}>{session.title}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.helper}>
                    Bu alan ana antrenman setlerinden bagimsizdir. Rutini tamamlayabilir veya yarida birakip antrenmana gecebilirsin.
                </Text>

                {exercises.map((exercise) => (
                    <View key={exercise.id} style={styles.card}>
                        <Text style={styles.exerciseTitle}>{exercise.name}</Text>
                        {exercise.targetReps ? <Text style={styles.targetText}>Hedef: {exercise.targetReps}</Text> : null}
                        {exercise.sets.map((set, index) => {
                            const durationMode = set.effortMode === "duration";
                            return (
                                <View key={set.id} style={styles.setRow}>
                                    <Text style={styles.setIndex}>{index + 1}</Text>
                                    <View style={styles.inputWrap}>
                                        <Text style={styles.inputLabel}>Kg</Text>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="decimal-pad"
                                            value={formatNumber(set.weight)}
                                            onChangeText={(text) => updateWarmupSet(exercise.id, set.id, "weight", text)}
                                            placeholder="kg"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                    <View style={styles.inputWrap}>
                                        <Text style={styles.inputLabel}>{durationMode ? "Sure" : "Tekrar"}</Text>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="number-pad"
                                            value={formatNumber(durationMode ? set.durationSeconds : set.reps)}
                                            onChangeText={(text) => updateWarmupSet(exercise.id, set.id, durationMode ? "durationSeconds" : "reps", text)}
                                            placeholder={durationMode ? "sn" : "tekrar"}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ))}

                {cardioBlocks.map((block) => (
                    <TouchableOpacity
                        key={block.id}
                        style={[styles.cardioCard, block.completedAt && styles.cardioCardDone]}
                        onPress={() => toggleCardioComplete(block.id || "")}
                        activeOpacity={0.82}
                    >
                        <View style={styles.cardioIcon}>
                            <Ionicons name={block.completedAt ? "checkmark" : "pulse-outline"} size={18} color={block.completedAt ? colors.background : colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.exerciseTitle}>{block.title}</Text>
                            <Text style={styles.targetText}>{Math.round((block.totalDuration || 0) / 60)} dk hafif tempo</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {exercises.length === 0 && cardioBlocks.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>Bu rutin bos gorunuyor</Text>
                        <Text style={styles.targetText}>Programini duzenleyerek bu gun icin hareket veya kardiyo ekleyebilirsin.</Text>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={abandonWarmup}>
                    <Text style={styles.secondaryText}>Antrenmana Gec</Text>
                </TouchableOpacity>
                <AccentButton title="Isinmayi Tamamla" onPress={finishWarmup} />
            </View>

            <ActionConfirmModal
                visible={exitModalVisible}
                title="Isinmadan cik?"
                message={hasWarmupData(session)
                    ? "Girdigin isinma verilerini koruyup cikabilir, rutine devam edebilir veya isinmayi yarida birakip antrenmana gecebilirsin."
                    : "Rutine devam edebilir ya da isinmayi yarida birakip ana antrenmana gecebilirsin."}
                primaryLabel="Kaydet ve Cik"
                secondaryLabel="Isinmaya Devam Et"
                tertiaryLabel="Isinmayi Yarida Birak"
                onPrimary={saveAndExit}
                onSecondary={() => setExitModalVisible(false)}
                onTertiary={abandonWarmup}
                onDismiss={() => setExitModalVisible(false)}
            />
        </KeyboardAvoidingView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    loadingText: { color: colors.textSecondary, fontSize: fontSize.md },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === "ios" ? 58 : spacing.xxl,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    iconBtn: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    headerTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    headerSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    content: { padding: spacing.lg, paddingBottom: 140 },
    helper: { color: colors.textSecondary, lineHeight: 21, marginBottom: spacing.lg },
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    exerciseTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    targetText: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
    setRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.md },
    setIndex: { width: 24, minHeight: 44, flexShrink: 0, color: colors.accent, fontWeight: fontWeight.bold, textAlign: "center", textAlignVertical: "center" },
    inputWrap: {
        flexGrow: 1,
        flexBasis: 96,
        minWidth: 82,
    },
    inputLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        marginBottom: 4,
    },
    input: {
        minHeight: 44,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        color: colors.text,
        backgroundColor: colors.surfaceElevated,
        textAlign: "center",
    },
    cardioCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardioCardDone: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    cardioIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent },
    emptyCard: { padding: spacing.xl, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    emptyTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
    footer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: spacing.lg,
        gap: spacing.sm,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    secondaryBtn: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
    },
    secondaryText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
});
