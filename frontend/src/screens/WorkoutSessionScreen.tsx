// ─────────────────────────────────────────────
// WorkoutSessionScreen — Aktif Antrenman Kaydı
// Egzersiz/set ekleme, ağırlık/tekrar/RPE girişi
// Local persistence + outbox sync
// ─────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import {
    WorkoutSession,
    WorkoutExercise,
    WorkoutSet,
    TargetSet,
    ProgramData,
} from "../types/workout";
import DraggableFlatList, {
    ScaleDecorator,
    RenderItemParams,
} from "react-native-draggable-flatlist";
import {
    saveActiveSession,
    clearActiveSession,
    restoreActiveSession,
    savePendingWorkout,
    syncPendingWorkouts,
} from "../services/syncService";
import { programApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import AccentButton from "../components/AccentButton";

// ─── Constants ───────────────────────────────

// Default Fitness sport ID — replace with dynamic value when sports API ready
const DEFAULT_SPORT_ID = "00000000-0000-0000-0000-000000000001";
const AUTOSAVE_DEBOUNCE_MS = 500;

// ─── ID Generator ────────────────────────────

function uid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ─── New Factories & Helpers ─────────────────

function createSession(): WorkoutSession {
    return {
        id: uid(),
        title: "",
        sportId: DEFAULT_SPORT_ID,
        exercises: [],
        startedAt: new Date().toISOString(),
        totalDuration: 0,
        status: "active",
    };
}

/**
 * Normalize any incoming programData shape into a ProgramData or null.
 * Supported shapes:
 * - { frequency, days: [...] }
 * - { days: [...] }
 * - { data: { frequency, days: [...] }, ... }
 * - { exercises: [...] }
 */
function normalizeProgramData(raw: any): ProgramData | null {
    if (!raw) return null;

    let data: any = raw;

    // If we're passed the full Program object, unwrap inner data
    if (data && data.data && !Array.isArray(data.days) && !data.exercises) {
        data = data.data;
    }

    // Cycle-based structure. Older saved programs may only have { days }
    // while frequency lives on the Program row, so keep this tolerant.
    if (Array.isArray(data.days)) {
        return {
            frequency: typeof data.frequency === "number" ? data.frequency : data.days.length,
            days: data.days,
        };
    }

    // Legacy flat exercises structure
    if (Array.isArray(data.exercises)) {
        return {
            exercises: data.exercises,
        } as ProgramData;
    }

    console.warn("[WorkoutSession] normalizeProgramData: Unsupported programData shape", {
        keys: Object.keys(data || {}),
    });
    return null;
}

// ─── Component ───────────────────────────────

export default function WorkoutSessionScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RootStackParamList, "WorkoutSession">>();
    const { user } = useAuth();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const isAutoSuggestEnabled = user?.settings?.is_auto_suggest_enabled !== false;

    const [session, setSession] = useState<WorkoutSession>(createSession);
    const [elapsed, setElapsed] = useState(0);
    const [finishing, setFinishing] = useState(false);
    const [restored, setRestored] = useState(false);
    const [rpeMode, setRpeMode] = useState<"rpe" | "rir" | "both">("rpe");

    // Use a ref for finishing flag so beforeRemove always has the latest value
    // (avoids stale closure problem where state is captured at render time)
    const finishingRef = useRef(false);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRefs = useRef<Record<string, TextInput | null>>({});

    const focusNext = useCallback((exIndex: number, setIndex: number, field: "weight" | "reps" | "rpe") => {
        let nextKey = "";
        if (field === "weight") nextKey = `ex-${exIndex}-set-${setIndex}-reps`;
        else if (field === "reps") nextKey = `ex-${exIndex}-set-${setIndex}-rpe`;
        else if (field === "rpe") nextKey = `ex-${exIndex}-set-${setIndex + 1}-weight`;

        const nextInput = inputRefs.current[nextKey];
        if (nextInput) {
            nextInput.focus();
        }
    }, []);

    // ─── Decimal Input Cache ─────────────────
    // Stores raw text per input so users can type "72." or "72,5" without
    // the dot/comma being stripped by parseFloat on every keystroke.
    const [textCache, setTextCache] = useState<Record<string, string>>({});

    const cacheKey = (exerciseId: string, setId: string, field: string) =>
        `${exerciseId}-${setId}-${field}`;

    const getTextValue = (exerciseId: string, setId: string, field: string, numericValue: number | string): string => {
        const key = cacheKey(exerciseId, setId, field);
        if (key in textCache) return textCache[key];
        if (typeof numericValue === 'string') return numericValue || "";
        return numericValue > 0 ? String(numericValue) : "";
    };

    const onNumericChange = (exerciseId: string, setId: string, field: keyof WorkoutSet, text: string) => {
        // Replace comma with dot for Turkish keyboards
        const normalized = text.replace(/,/g, ".");
        const key = cacheKey(exerciseId, setId, field);
        setTextCache((prev) => ({ ...prev, [key]: normalized }));
    };

    const onNumericBlur = (exerciseId: string, setId: string, field: keyof WorkoutSet | string, isInteger = false) => {
        const key = cacheKey(exerciseId, setId, field as string);
        const raw = textCache[key];
        if (raw === undefined) return;

        // RIR accepts string ranges like "1-2", "2-3" — preserve as-is
        if (field === "rir") {
            updateSet(exerciseId, setId, field as any, raw.trim() || "");
            setTextCache((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }

        const num = isInteger ? (parseInt(raw, 10) || 0) : (parseFloat(raw) || 0);
        const clamped = field === "rpe" ? Math.min(num, 10) : num;
        updateSet(exerciseId, setId, field as any, clamped);
        // Clear cache so it falls back to formatted number
        setTextCache((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // ─── Restore Active Session / Load Program ─
    useEffect(() => {
        (async () => {
            console.log("[WorkoutSession] route params:", JSON.stringify(route.params, null, 2));

            const params = route.params;
            const hasProgramParams = !!(params?.programId || params?.programData);

            // ────────────────────────────────────────
            // CASE 1: Coming from a program → ALWAYS start fresh
            // Clear any stale session and load program data
            // ────────────────────────────────────────
            if (hasProgramParams) {
                console.log("[WorkoutSession] Program params detected, clearing any old session");
                await clearActiveSession();

                const programId = params?.programId;
                const hasProgramDataParam = !!params?.programData;
                let programData = params?.programData as any;
                let programName = params?.programName;
                const dayIndex = params?.dayIndex ?? 0;

                if (!programId && !programData) {
                    navigation.goBack();
                    return;
                }

                // Only hit backend when no programData was provided at all but we have an ID.
                if (programId && !hasProgramDataParam) {
                    try {
                        console.log("[WorkoutSession] Fetching program by ID from backend:", programId);
                        const res = await programApi.getById(programId);
                        const fetched = res.data;
                        if (fetched) {
                            programData = fetched.data;
                            programName = fetched.name;
                        }
                    } catch (err: any) {
                        console.error("[WorkoutSession] Failed to load program:", err);
                        navigation.goBack();
                        return;
                    }
                }

                if (typeof programData === "string") {
                    try { programData = JSON.parse(programData); } catch (e) { console.error("Parse error:", e); }
                }

                const normalized = normalizeProgramData(programData);

                if (!normalized) {
                    console.warn("[WorkoutSession] Program data could not be normalized");
                    navigation.goBack();
                    return;
                }

                // ── Cycle-based: pick exercises from days[dayIndex] ──
                const isCycle = (normalized as any).days && Array.isArray((normalized as any).days);
                const days = isCycle ? (normalized as any).days : undefined;
                const templateExercises: any[] = isCycle
                    ? (days![dayIndex % days!.length]?.exercises ?? [])
                    : ((normalized as any).exercises ?? []);

                if (templateExercises.length > 0) {
                    const dayLabel = isCycle
                        ? days![dayIndex % days!.length]?.label
                        : undefined;
                    const title = dayLabel
                        ? `${programName ?? "Antrenman"} · ${dayLabel}`
                        : (programName ?? "Antrenman");

                    const newExercises: WorkoutExercise[] = templateExercises.map((templateEx: any) => {
                        const targetSet = templateEx.targetSets?.[0] ?? templateEx.sets?.[0];
                        return {
                            id: uid(),
                            name: templateEx.name,
                            targetReps: targetSet?.targetReps,
                            targetWeight: targetSet?.targetWeight,
                            targetRPE: targetSet?.targetRPE,
                            targetRIR: targetSet?.targetRIR,
                            sets: (templateEx.targetSets ?? templateEx.sets ?? [{}]).map((ts: TargetSet) => ({
                                id: uid(),
                                weight: 0,
                                reps: 0,
                                rpe: 0,
                                unit: "kg" as const,
                                completed: false,
                                isWarmup: !!ts?.isWarmup,
                                targetReps: ts?.targetReps,
                                targetWeight: ts?.targetWeight,
                                targetRPE: ts?.targetRPE,
                                targetRIR: ts?.targetRIR,
                            })),
                        };
                    });
                    setSession(prev => ({
                        ...prev,
                        title,
                        exercises: newExercises,
                        programId: programId,
                        dayIndex,
                    }));
                } else {
                    console.warn("[WorkoutSession] No exercises found for this day");
                    navigation.goBack();
                    return;
                }
            }
            // ────────────────────────────────────────
            // CASE 2: No program params → try to restore saved session
            // ────────────────────────────────────────
            else {
                const saved = await restoreActiveSession();
                if (saved && saved.status === "active" && !saved.completedAt) {
                    setSession(saved);
                    const start = new Date(saved.startedAt).getTime();
                    setElapsed(Math.floor((Date.now() - start) / 1000));
                } else {
                    // No valid session to restore and no program params
                    await clearActiveSession();
                    navigation.goBack();
                    return;
                }
            }

            setRestored(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Timer ───────────────────────────────
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (finishingRef.current) return; // don't tick after finish
            setElapsed((prev) => prev + 1);
        }, 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // ─── Debounced Auto-Save ─────────────────
    useEffect(() => {
        if (!restored || finishingRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (finishingRef.current) return;
            saveActiveSession({ ...session, totalDuration: elapsed });
        }, AUTOSAVE_DEBOUNCE_MS);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [session, elapsed, restored]);

    // ─── Back Navigation — just save silently ─
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            // Use ref instead of state to avoid stale closure issue:
            // When finishWorkout() calls navigation.replace(), the beforeRemove
            // fires but the finishing state may not have updated yet.
            // The ref always has the latest value.
            if (finishingRef.current) return;

            // Always save the current session before leaving
            saveActiveSession({ ...session, totalDuration: elapsed });
            // Let the navigation proceed — session stays in AsyncStorage
        });
        return unsubscribe;
    }, [navigation, session, elapsed]);

    // ─── Update Helpers ──────────────────────

    const updateSession = useCallback((updater: (prev: WorkoutSession) => WorkoutSession) => {
        setSession(updater);
    }, []);

    const updateSet = useCallback(
        (exerciseId: string, setId: string, field: keyof WorkoutSet, value: string | number | boolean) => {
            updateSession((prev) => ({
                ...prev,
                exercises: prev.exercises.map((e) =>
                    e.id === exerciseId
                        ? {
                            ...e,
                            sets: e.sets.map((s) =>
                                s.id === setId ? { ...s, [field]: value } : s,
                            ),
                        }
                        : e,
                ),
            }));
        },
        [updateSession],
    );

    const toggleSetCompleted = useCallback((exerciseId: string, setId: string) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((e) =>
                e.id === exerciseId
                    ? {
                        ...e,
                        sets: e.sets.map((s) =>
                            s.id === setId ? { ...s, completed: !s.completed } : s,
                        ),
                    }
                    : e,
            ),
        }));
    }, [updateSession]);

    const removeSet = useCallback((exerciseId: string, setId: string) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((e) =>
                e.id === exerciseId
                    ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
                    : e,
            ),
        }));
    }, [updateSession]);

    const addExercise = useCallback(() => {
        const newEx: WorkoutExercise = {
            id: uid(),
            name: "",
            isCustom: true,
            sets: [
                { id: uid(), weight: 0, reps: 0, unit: "kg", completed: false },
            ],
        };
        updateSession((prev) => ({
            ...prev,
            exercises: [...prev.exercises, newEx],
        }));
    }, [updateSession]);

    const removeExercise = useCallback((exerciseId: string) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((e) => e.id !== exerciseId),
        }));
    }, [updateSession]);

    const addSetToExercise = useCallback((exerciseId: string) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((e) =>
                e.id === exerciseId
                    ? { ...e, sets: [...e.sets, { id: uid(), weight: 0, reps: 0, unit: "kg" as const, completed: false }] }
                    : e
            ),
        }));
    }, [updateSession]);

    const updateExerciseName = useCallback((exerciseId: string, name: string) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((e) =>
                e.id === exerciseId ? { ...e, name } : e
            ),
        }));
    }, [updateSession]);

    // ─── Finish Workout ──────────────────────

    const finishWorkout = async () => {
        const validExercises = session.exercises.filter(
            (e) => e.name.trim().length > 0 && e.sets.some((s) => s.weight > 0 || s.reps > 0),
        );

        if (validExercises.length === 0) {
            Alert.alert("Eksik Bilgi", "En az bir egzersiz adı ve bir set bilgisi girmelisiniz.");
            return;
        }

        setFinishing(true);
        finishingRef.current = true;

        // Stop the timer and any pending auto-save immediately
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        try {
            const completedSession: WorkoutSession = {
                ...session,
                exercises: validExercises,
                completedAt: new Date().toISOString(),
                totalDuration: elapsed,
                totalVolume: validExercises.reduce((total, ex) =>
                    total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0
                ),
                status: "completed",
            };

            await savePendingWorkout(completedSession);
            await clearActiveSession();

            try {
                const syncResult = await syncPendingWorkouts();
                if (syncResult.failed > 0) {
                    Alert.alert(
                        "Senkronizasyon Uyarısı",
                        `Antrenman yerel olarak kaydedildi ancak sunucuya gönderilemedi.\n\n` +
                        `Hata: ${syncResult.errors.join(", ")}\n\n` +
                        `İnternet bağlantınızı kontrol edin. Sonraki giriş sırasında tekrar denenecek.`,
                    );
                } else if (syncResult.offline) {
                    Alert.alert(
                        "Çevrimdışı Kayıt",
                        "Antrenman yerel olarak kaydedildi. İnternet bağlantısı sağlandığında otomatik olarak senkronize edilecek.",
                    );
                }
            } catch (err) {
                console.warn("[WorkoutSession] Sync hatası (arka planda yeniden denenecek):", err);
                Alert.alert(
                    "Senkronizasyon Hatası",
                    "Antrenman yerel olarak kaydedildi ancak sunucuya gönderilemedi. " +
                    "Sonraki girişinizde tekrar denenecek.",
                );
            }

            // ── Compute summary stats ──
            const totalVolume = validExercises.reduce((total, ex) =>
                total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0), 0
            );
            const setCount = validExercises.reduce((total, ex) => total + ex.sets.length, 0);

            // ── Advance cycle day if linked to a program ──
            const programId = route.params?.programId;
            const programData = normalizeProgramData(route.params?.programData as any) as any;
            const dayIndex = route.params?.dayIndex ?? 0;
            const isCycle = programData && Array.isArray(programData.days) && programData.days.length > 0;

            let nextDayLabel: string | undefined;
            let dayLabel: string | undefined;

            if (programId && isCycle) {
                try {
                    const nextIndex = (dayIndex + 1) % programData.days.length;
                    dayLabel = programData.days[dayIndex]?.label;
                    nextDayLabel = programData.days[nextIndex]?.label;
                    await programApi.advanceDay(programId);
                } catch (err) {
                    console.warn("[WorkoutSession] advanceDay hatası:", err);
                }
            }

            // ── Navigate to Summary ──
            (navigation as any).replace("WorkoutSummary", {
                programId,
                programName: route.params?.programName,
                dayLabel,
                nextDayLabel,
                totalVolume: Math.round(totalVolume),
                duration: elapsed,
                exerciseCount: validExercises.length,
                setCount,
            });
        } catch (error) {
            console.error("[WorkoutSession] Kaydetme hatası:", error);
            Alert.alert("Kaydetme Hatası", "Antrenman verisi kaydedilirken bir hata oluştu.");
        } finally {
            setFinishing(false);
        }
    };

    const cancelWorkout = () => {
        // Check if any sets have been filled in
        const hasData = session.exercises.some((ex) =>
            ex.sets.some((s) => s.weight > 0 || s.reps > 0)
        );

        const doCancel = async () => {
            // Stop the timer immediately
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            await clearActiveSession();
            navigation.goBack();
        };

        const doSaveAndLeave = async () => {
            // Save current session to AsyncStorage so user can continue later
            await saveActiveSession({ ...session, totalDuration: elapsed });
            navigation.goBack();
        };

        if (!hasData) {
            // Nothing entered — session doesn't count, exit immediately
            doCancel();
            return;
        }

        // Data exists — give user 3 options
        Alert.alert(
            "Antrenman Devam Ediyor",
            "Verileriniz kayıtlı. Ne yapmak istersiniz?",
            [
                {
                    text: "Vazgeç",
                    style: "cancel",
                },
                {
                    text: "Kaydet ve Çık",
                    onPress: doSaveAndLeave,
                },
                {
                    text: "İptal Et",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Emin misiniz?",
                            "Antrenman tamamen silinecek ve geri alınamaz.",
                            [
                                { text: "Hayır", style: "cancel" },
                                {
                                    text: "Evet, Sil",
                                    style: "destructive",
                                    onPress: doCancel,
                                },
                            ],
                        );
                    },
                },
            ],
        );
    };


    // ─── Format Helpers ──────────────────────

    const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    // ─── Render Helpers ──────────────────────

    const cycleMode = () => {
        setRpeMode((prev) => {
            if (prev === "rpe") return "rir";
            if (prev === "rir") return "both";
            return "rpe";
        });
    };

    const modeLabelMap = { rpe: "RPE", rir: "RIR", both: "RPE+RIR" };

    const renderHeader = () => (
        <View style={styles.listHeader}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={cancelWorkout}
                    style={styles.cancelBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <TouchableOpacity
                        style={styles.rirToggleBtn}
                        onPress={cycleMode}
                    >
                        <Text style={styles.rirToggleText}>
                            {modeLabelMap[rpeMode]}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.rirToggleBtn, { borderColor: colors.accent }]}
                        onPress={addExercise}
                    >
                        <Ionicons name="add" size={16} color={colors.accent} />
                    </TouchableOpacity>

                    <View style={styles.timerContainer}>
                        <Ionicons name="time-outline" size={20} color={colors.accent} />
                        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
                    </View>
                </View>
            </View>

            <Text style={styles.titleText}>
                {session.title || "Program Antrenmanı"}
            </Text>
        </View>
    );

    const renderFooter = () => (
        <View style={styles.listFooter}>
            <AccentButton
                title="✅  Antrenmanı Bitir"
                onPress={finishWorkout}
                loading={finishing}
                style={styles.finishBtn}
            />
            <View style={{ height: spacing.xxxl * 2 }} />
        </View>
    );

    const renderExerciseItem = ({ item: exercise, drag, isActive, getIndex }: RenderItemParams<WorkoutExercise>) => {
        const exIndex = getIndex() ?? 0;
        return (
            <ScaleDecorator>
                <View style={[styles.exerciseCard, isActive && styles.activeExerciseCard]}>
                    <View style={styles.exerciseHeader}>
                        <TouchableOpacity onLongPress={drag} delayLongPress={200} style={styles.dragHandle}>
                            <Ionicons name="reorder-two" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.exerciseIndexBadge}>
                            <Text style={styles.exerciseIndexText}>{exIndex + 1}</Text>
                        </View>

                        {exercise.isCustom ? (
                            <TextInput
                                style={[styles.exerciseNameText, { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 2 }]}
                                value={exercise.name}
                                onChangeText={(text) => updateExerciseName(exercise.id, text)}
                                placeholder="Egzersiz adı..."
                                placeholderTextColor={colors.textMuted}
                                selectionColor={colors.accent}
                            />
                        ) : (
                            <Text style={styles.exerciseNameText} numberOfLines={1}>
                                {exercise.name}
                            </Text>
                        )}

                        {exercise.isCustom && (
                            <TouchableOpacity
                                onPress={() => removeExercise(exercise.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ paddingLeft: spacing.sm }}
                            >
                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isAutoSuggestEnabled && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, marginBottom: spacing.md }}>
                            <Ionicons name="sparkles" size={14} color={colors.accent} style={{ marginRight: 4 }} />
                            <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                                AI Önerisi: {exercise.targetWeight ? (parseFloat(exercise.targetWeight) + 2.5) : "+2.5"} kg
                            </Text>
                        </View>
                    )}

                    <View style={styles.setHeaderRow}>
                        <Text style={[styles.setHeaderText, { flex: 0.5 }]}>SET</Text>
                        <Text style={[styles.setHeaderText, { flex: 1 }]}>KG</Text>
                        <Text style={[styles.setHeaderText, { flex: 1 }]}>TEKRAR</Text>
                        {(rpeMode === "rpe" || rpeMode === "both") && (
                            <Text style={[styles.setHeaderText, { flex: 0.8 }]}>RPE</Text>
                        )}
                        {(rpeMode === "rir" || rpeMode === "both") && (
                            <Text style={[styles.setHeaderText, { flex: 0.8 }]}>RIR</Text>
                        )}
                    </View>

                    {(() => {
                        let warmupCount = 0;
                        let workingCount = 0;
                        return exercise.sets.map((set: WorkoutSet, setIndex: number) => {
                            const isWarmup = !!set.isWarmup;
                            if (isWarmup) warmupCount++;
                            else workingCount++;
                            const label = isWarmup ? `W${warmupCount}` : `${workingCount}`;
                            return (
                        <View key={set.id} style={[styles.setRow, isWarmup && { opacity: 0.7, borderLeftWidth: 3, borderLeftColor: colors.textMuted, paddingLeft: spacing.xs }]}>
                            <Text style={[styles.setNumber, { flex: 0.5 }, isWarmup && { fontStyle: "italic" as const, color: colors.textMuted }]}>
                                {label}
                            </Text>

                            <View style={[styles.inputWrapper, { flex: 1 }]}>
                                <TextInput
                                    ref={(el) => { inputRefs.current[`ex-${exIndex}-set-${setIndex}-weight`] = el; }}
                                    style={styles.numericInput}
                                    value={getTextValue(exercise.id, set.id, "weight", set.weight)}
                                    onChangeText={(text) => {
                                        onNumericChange(exercise.id, set.id, "weight", text);
                                        if (text.trim() && !set.completed) toggleSetCompleted(exercise.id, set.id);
                                    }}
                                    onBlur={() => onNumericBlur(exercise.id, set.id, "weight")}
                                    placeholder={set.targetWeight ?? exercise.targetWeight ?? "0"}
                                    placeholderTextColor={
                                        (set.targetWeight || exercise.targetWeight)
                                            ? colors.accentDark
                                            : colors.textMuted
                                    }
                                    keyboardType="decimal-pad"
                                    selectionColor={colors.accent}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNext(exIndex, setIndex, "weight")}
                                    blurOnSubmit={false}
                                />
                            </View>

                            <View style={[styles.inputWrapper, { flex: 1 }]}>
                                <TextInput
                                    ref={(el) => { inputRefs.current[`ex-${exIndex}-set-${setIndex}-reps`] = el; }}
                                    style={styles.numericInput}
                                    value={getTextValue(exercise.id, set.id, "reps", set.reps)}
                                    onChangeText={(text) => {
                                        onNumericChange(exercise.id, set.id, "reps", text);
                                        if (text.trim() && !set.completed) toggleSetCompleted(exercise.id, set.id);
                                    }}
                                    onBlur={() => onNumericBlur(exercise.id, set.id, "reps", true)}
                                    placeholder={set.targetReps ?? exercise.targetReps ?? "0"}
                                    placeholderTextColor={
                                        (set.targetReps || exercise.targetReps)
                                            ? colors.accentDark
                                            : colors.textMuted
                                    }
                                    keyboardType="number-pad"
                                    selectionColor={colors.accent}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNext(exIndex, setIndex, "reps")}
                                    blurOnSubmit={false}
                                />
                            </View>

                            {(rpeMode === "rpe" || rpeMode === "both") && (
                            <View style={[styles.inputWrapper, { flex: 0.8 }]}>
                                <TextInput
                                    ref={(el) => { inputRefs.current[`ex-${exIndex}-set-${setIndex}-rpe`] = el; }}
                                    style={styles.numericInput}
                                    value={getTextValue(exercise.id, set.id, "rpe", set.rpe ?? 0)}
                                    onChangeText={(text) => onNumericChange(exercise.id, set.id, "rpe", text)}
                                    onBlur={() => onNumericBlur(exercise.id, set.id, "rpe")}
                                    placeholder={
                                        (set.targetRPE || exercise.targetRPE)
                                            ? `${set.targetRPE ?? exercise.targetRPE}`
                                            : "—"
                                    }
                                    placeholderTextColor={colors.accentDark}
                                    keyboardType="number-pad"
                                    selectionColor={colors.accent}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNext(exIndex, setIndex, "rpe")}
                                    blurOnSubmit={false}
                                />
                            </View>
                            )}

                            {(rpeMode === "rir" || rpeMode === "both") && (
                            <View style={[styles.inputWrapper, { flex: 0.8 }]}>
                                <TextInput
                                    style={styles.numericInput}
                                    value={getTextValue(exercise.id, set.id, "rir" as any, (set as any).rir ?? "")}
                                    onChangeText={(text) => onNumericChange(exercise.id, set.id, "rir" as any, text)}
                                    onBlur={() => onNumericBlur(exercise.id, set.id, "rir" as any)}
                                    placeholder={
                                        (set.targetRIR || exercise.targetRIR)
                                            ? `${set.targetRIR ?? exercise.targetRIR}`
                                            : "—"
                                    }
                                    placeholderTextColor={colors.accentDark}
                                    keyboardType="number-pad"
                                    selectionColor={colors.accent}
                                />
                            </View>
                            )}

                            <TouchableOpacity
                                onPress={() => removeSet(exercise.id, set.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ paddingLeft: 4 }}
                            >
                                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                            );
                        });
                    })()}

                    {exercise.isCustom && (
                        <TouchableOpacity
                            style={styles.addSetBtn}
                            onPress={() => addSetToExercise(exercise.id)}
                        >
                            <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                            <Text style={styles.addSetText}>Set Ekle</Text>
                        </TouchableOpacity>
                    )}

                </View>
            </ScaleDecorator>
        );
    };

    // ─── Render ──────────────────────────────

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <DraggableFlatList
                data={session.exercises}
                onDragEnd={({ data }: { data: WorkoutExercise[] }) => updateSession(prev => ({ ...prev, exercises: data }))}
                keyExtractor={(item: WorkoutExercise) => item.id}
                renderItem={renderExerciseItem}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                containerStyle={styles.scrollView}
            />
        </KeyboardAvoidingView>
    );
}



// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === "ios" ? 60 : spacing.xxxl + spacing.lg,
        paddingBottom: spacing.xxxl,
    },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    cancelBtn: {
        padding: spacing.xs,
    },
    timerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    rirToggleBtn: {
        marginRight: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    rirToggleText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
    },
    timerText: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.accent,
        marginLeft: spacing.sm,
        fontVariant: ["tabular-nums"],
    },

    // Title
    titleText: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xxl,
        paddingVertical: spacing.sm,
    },

    // Exercise Card
    exerciseCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    exerciseHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    exerciseIndexBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.sm,
    },
    exerciseIndexText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    exerciseNameText: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        color: colors.text,
        paddingVertical: spacing.xs,
        marginRight: spacing.sm,
    },

    // Set Header
    setHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    setHeaderText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
        textAlign: "center",
    },

    // Set Row
    setRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    setNumber: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
        textAlign: "center",
    },
    inputWrapper: {
        marginHorizontal: spacing.xs,
    },
    numericInput: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.sm,
        paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
        paddingHorizontal: spacing.md,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        textAlign: "center",
        minHeight: 48,
        borderWidth: 1.5,
        borderColor: colors.border,
    },

    // Complete Button
    completeBtn: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceLight,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    completeBtnActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },

    // Drag 
    dragHandle: {
        paddingRight: spacing.sm,
        paddingLeft: spacing.xs,
        justifyContent: "center",
    },
    activeExerciseCard: {
        borderColor: colors.accent,
        elevation: 8,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    listHeader: {
        marginBottom: spacing.md,
    },
    listFooter: {
        marginTop: spacing.md,
    },

    // Add Set
    addSetBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.sm,
        marginTop: spacing.xs,
    },
    addSetText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.accent,
        marginLeft: spacing.xs,
    },

    // Add Exercise
    addExerciseBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1.5,
        borderColor: colors.accent,
        borderRadius: borderRadius.md,
        borderStyle: "dashed",
    },

    // Finish
    finishBtn: {
        marginBottom: spacing.lg,
    },
});
