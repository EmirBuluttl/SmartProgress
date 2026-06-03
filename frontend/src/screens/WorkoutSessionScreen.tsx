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
    Platform,
    KeyboardAvoidingView,
    AppState,
    Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
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
import { bodyMeasurementApi, programApi, workoutApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import AccentButton from "../components/AccentButton";
import ActionConfirmModal from "../components/ActionConfirmModal";
import NoticeModal from "../components/NoticeModal";
import { calculateLoadScoreFromExercises, clampRpe, normalizeRirLogValue } from "../utils/workoutMetrics";
import { summarizeCardioBlocks } from "../utils/cardio";
import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "../data/exerciseLibrary";

// ─── Constants ───────────────────────────────

// Default Fitness sport ID — replace with dynamic value when sports API ready
const DEFAULT_SPORT_ID = "00000000-0000-0000-0000-000000000001";
const AUTOSAVE_DEBOUNCE_MS = 500;
const ADDED_EXERCISE_HIGHLIGHT_MS = 1400;

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
        cardioBlocks: [],
        startedAt: new Date().toISOString(),
        totalDuration: 0,
        status: "active",
    };
}

function insertSetByType<T extends { isWarmup?: boolean }>(sets: T[], nextSet: T, isWarmup: boolean): T[] {
    const insertAfterIndex = isWarmup
        ? sets.map((set) => !!set.isWarmup).lastIndexOf(true)
        : sets.map((set) => !set.isWarmup).lastIndexOf(true);
    const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : isWarmup ? 0 : sets.length;
    const copy = [...sets];
    copy.splice(insertIndex, 0, nextSet);
    return copy;
}

function parseDurationInput(raw: string): number {
    const value = raw.trim().toLowerCase().replace(/\s+/g, "");
    if (!value) return 0;
    const parts = value.split(":");
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        return Math.max(0, minutes * 60 + seconds);
    }
    return Math.max(0, parseInt(value.replace(/sn|sec|s/g, ""), 10) || 0);
}

function formatDurationInput(seconds: number | string | undefined): string {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total <= 0) return "";
    if (total < 60) return String(total);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function hasLoggedSetData(set: WorkoutSet): boolean {
    return Number(set.weight) > 0 ||
        Number(set.reps) > 0 ||
        Number(set.durationSeconds) > 0 ||
        Number(set.rpe) > 0;
}

function toWorkoutNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function averageRir(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const text = String(value).replace(",", ".").replace(/[–—]/g, "-").trim();
    if (!text) return null;
    if (text.includes("-")) {
        const parts = text.split("-").map((part) => Number(part.trim())).filter(Number.isFinite);
        if (parts.length > 0) return parts.reduce((sum, part) => sum + part, 0) / parts.length;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function getSetQualityWarning(set: WorkoutSet): string | null {
    if (!hasLoggedSetData(set) || set.isWarmup) return null;

    const weight = toWorkoutNumber(set.weight);
    const reps = Math.floor(toWorkoutNumber(set.reps));
    const rpe = toWorkoutNumber(set.rpe);
    const rir = averageRir((set as any).rir);
    const duration = toWorkoutNumber(set.durationSeconds);

    if (set.effortMode === "duration") {
        if (duration > 3600) return "Süre 60 dakikanın üstünde görünüyor.";
        if (weight > 500) return "Ağırlık 500 kg üstünde görünüyor.";
        return null;
    }

    if (weight > 500) return "Ağırlık 500 kg üstünde görünüyor.";
    if (reps > 100) return "Tekrar 100 üstünde görünüyor.";
    if (weight > 0 && reps <= 0) return "Ağırlık var ama tekrar yok.";
    if (rpe > 0 && rir !== null) {
        if (rpe >= 9 && rir >= 3) return "RPE yüksek ama RIR da yüksek girilmiş.";
        if (rpe <= 6 && rir <= 1) return "RPE düşük ama RIR çok düşük girilmiş.";
    }
    return null;
}

function prepareSessionForCoachAnalysis(session: WorkoutSession) {
    const warnings: string[] = [];
    const nextSession: WorkoutSession = {
        ...session,
        exercises: session.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set, index) => {
                const warning = getSetQualityWarning(set);
                if (!warning) {
                    if (!set.analysisExcluded && !set.analysisWarning) return set;
                    const { analysisExcluded, analysisWarning, ...cleanSet } = set;
                    return cleanSet;
                }
                warnings.push(`${exercise.name} · Set ${index + 1}: ${warning}`);
                return {
                    ...set,
                    analysisExcluded: true,
                    analysisWarning: warning,
                };
            }),
        })),
    };

    return { session: nextSession, warnings };
}

function hasLoggedCardioData(session: WorkoutSession): boolean {
    return !!session.activeCardioStage || (session.cardioBlocks || []).some((block) =>
        Number(block.totalDuration) > 0 ||
        Number(block.totalDistance) > 0 ||
        Number(block.totalSteps) > 0 ||
        Number(block.totalCalories) > 0 ||
        (Array.isArray(block.stages) && block.stages.length > 0),
    );
}

function closeActiveCardioIfNeeded(session: WorkoutSession): WorkoutSession {
    const activeStage = session.activeCardioStage;
    const activeBlockId = session.activeCardioBlockId;
    if (!activeStage || !activeBlockId) return session;

    const now = Date.now();
    const started = new Date(activeStage.startedAt).getTime();
    const duration = Number.isFinite(started)
        ? Math.max(0, Math.floor((now - started) / 1000))
        : Math.max(0, Number(activeStage.duration) || 0);
    const closedStage = {
        ...activeStage,
        endedAt: new Date(now).toISOString(),
        duration,
    };

    const cardioBlocks = (session.cardioBlocks || []).map((block) => {
        if (block.id !== activeBlockId) return block;
        const stages = [...(block.stages || []), closedStage];
        const totalDuration = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.duration) || 0), 0);
        const totalDistance = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.distance) || 0), 0);
        const totalSteps = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.steps) || 0), 0);
        const totalCalories = stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.calories) || 0), 0);
        return {
            ...block,
            stages,
            completedAt: new Date(now).toISOString(),
            totalDuration,
            totalDistance: totalDistance > 0 ? totalDistance : undefined,
            totalSteps: totalSteps > 0 ? totalSteps : undefined,
            totalCalories: totalCalories > 0 ? totalCalories : undefined,
        };
    });

    return {
        ...session,
        cardioBlocks,
        activeCardioBlockId: undefined,
        activeCardioStage: undefined,
    };
}

function isWorkoutSessionLike(value: unknown): value is WorkoutSession {
    const candidate = value as Partial<WorkoutSession> | null | undefined;
    return !!candidate &&
        typeof candidate === "object" &&
        typeof candidate.id === "string" &&
        typeof candidate.startedAt === "string" &&
        Array.isArray(candidate.exercises);
}

function hasLoggedWorkoutData(session: WorkoutSession): boolean {
    return hasLoggedCardioData(session) || session.exercises.some((exercise) =>
        exercise.name.trim().length > 0 &&
        exercise.sets.some(hasLoggedSetData),
    );
}

function getElapsedSeconds(session: WorkoutSession): number {
    const startedAt = new Date(session.startedAt).getTime();
    const wallClockElapsed = Number.isFinite(startedAt)
        ? Math.floor((Date.now() - startedAt) / 1000)
        : 0;
    return Math.max(0, session.totalDuration || 0, wallClockElapsed);
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

type TrackingMode = "none" | "rpe" | "rir" | "both";

function modeFromFlags(hasRPE: boolean, hasRIR: boolean): TrackingMode {
    if (hasRPE && hasRIR) return "both";
    if (hasRPE) return "rpe";
    if (hasRIR) return "rir";
    return "none";
}

function inferTrackingModeFromExercises(exercises: any[] = []): TrackingMode {
    let hasRPE = false;
    let hasRIR = false;

    for (const exercise of exercises) {
        if (exercise?.targetRPE) hasRPE = true;
        if (exercise?.targetRIR) hasRIR = true;
        const sets = Array.isArray(exercise?.targetSets)
            ? exercise.targetSets
            : Array.isArray(exercise?.sets)
                ? exercise.sets
                : [];
        for (const set of sets) {
            if (set?.targetRPE) hasRPE = true;
            if (set?.targetRIR) hasRIR = true;
        }
    }

    return modeFromFlags(hasRPE, hasRIR);
}

function inferTrackingModeFromSession(session: WorkoutSession): TrackingMode {
    return inferTrackingModeFromExercises(session.exercises);
}

function normalizeExerciseNameForLookup(name: unknown): string {
    return String(name || "").trim().toLowerCase();
}

function exerciseLookupKeys(exercise: any): string[] {
    const keys = [
        exercise?.exerciseId ? `id:${String(exercise.exerciseId).trim()}` : "",
        normalizeExerciseNameForLookup(exercise?.name),
    ].filter(Boolean);
    return Array.from(new Set(keys));
}

function buildPreviousWeightLookup(workouts: any[]): Map<string, number[]> {
    const lookup = new Map<string, number[]>();
    const newestFirst = [...workouts].sort(
        (a, b) => new Date(b.logDate || b.createdAt || 0).getTime() - new Date(a.logDate || a.createdAt || 0).getTime(),
    );

    newestFirst.forEach((workout) => {
        const exercises = Array.isArray(workout?.data?.exercises) ? workout.data.exercises : [];
        exercises.forEach((exercise: any) => {
            const keys = exerciseLookupKeys(exercise).filter((key) => !lookup.has(key));
            if (keys.length === 0) return;

            const weights = (Array.isArray(exercise?.sets) ? exercise.sets : [])
                .filter((set: any) => !set?.isWarmup)
                .map((set: any) => Number(set?.weight))
                .filter((weight: number) => Number.isFinite(weight) && weight > 0);

            if (weights.length > 0) {
                keys.forEach((key) => lookup.set(key, weights));
            }
        });
    });

    return lookup;
}

function buildPreviousRepsLookup(workouts: any[]): Map<string, number[]> {
    const lookup = new Map<string, number[]>();
    const newestFirst = [...workouts].sort(
        (a, b) => new Date(b.logDate || b.createdAt || 0).getTime() - new Date(a.logDate || a.createdAt || 0).getTime(),
    );

    newestFirst.forEach((workout) => {
        const exercises = Array.isArray(workout?.data?.exercises) ? workout.data.exercises : [];
        exercises.forEach((exercise: any) => {
            const keys = exerciseLookupKeys(exercise).filter((key) => !lookup.has(key));
            if (keys.length === 0) return;

            const reps = (Array.isArray(exercise?.sets) ? exercise.sets : [])
                .filter((set: any) => !set?.isWarmup)
                .map((set: any) => Number(set?.reps))
                .filter((rep: number) => Number.isFinite(rep) && rep > 0);

            if (reps.length > 0) {
                keys.forEach((key) => lookup.set(key, reps));
            }
        });
    });

    return lookup;
}

// ─── Component ───────────────────────────────

export default function WorkoutSessionScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RootStackParamList, "WorkoutSession">>();
    const { user } = useAuth();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const isAutoSuggestEnabled = user?.settings?.is_auto_suggest_enabled === true;
    const rememberRepsEnabled = user?.settings?.remember_reps_enabled === true;
    const showRpeRirInfo = user?.settings?.show_rpe_rir_info !== false;

    const [session, setSession] = useState<WorkoutSession>(createSession);
    const [elapsed, setElapsed] = useState(0);
    const [finishing, setFinishing] = useState(false);
    const [restored, setRestored] = useState(false);
    const [rpeMode, setRpeMode] = useState<"none" | "rpe" | "rir" | "both">("none");
    const [recentlyAddedExerciseId, setRecentlyAddedExerciseId] = useState<string | null>(null);
    const [emptyFinishModalVisible, setEmptyFinishModalVisible] = useState(false);
    const [qualityModalVisible, setQualityModalVisible] = useState(false);
    const [qualityWarnings, setQualityWarnings] = useState<string[]>([]);
    const [exitModalVisible, setExitModalVisible] = useState(false);
    const [exitModalHasData, setExitModalHasData] = useState(false);
    const [addExerciseModalVisible, setAddExerciseModalVisible] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState("");
    const [newExerciseLibraryItem, setNewExerciseLibraryItem] = useState<ExerciseLibraryItem | null>(null);
    const [newExerciseIndex, setNewExerciseIndex] = useState(0);
    const [noteModalVisible, setNoteModalVisible] = useState(false);
    const [noteDraft, setNoteDraft] = useState("");
    const [cardioListVisible, setCardioListVisible] = useState(false);
    const [freeWorkoutNameModalVisible, setFreeWorkoutNameModalVisible] = useState(false);
    const [freeWorkoutNameConfirmed, setFreeWorkoutNameConfirmed] = useState(false);
    const [freeWorkoutNameDraft, setFreeWorkoutNameDraft] = useState("");
    const [setSettingsExercise, setSetSettingsExercise] = useState<WorkoutExercise | null>(null);
    const [startBlockedModalVisible, setStartBlockedModalVisible] = useState(false);
    const [conceptNotice, setConceptNotice] = useState<{ title: string; message: string } | null>(null);
    const [postFinishNotice, setPostFinishNotice] = useState<{ title: string; message: string; summaryParams: any } | null>(null);
    const [latestBodyWeight, setLatestBodyWeight] = useState<number | null>(null);
    const [bodyWeightModal, setBodyWeightModal] = useState<{ exerciseId: string; setId: string } | null>(null);
    const [bodyWeightDraft, setBodyWeightDraft] = useState("");
    const isWeb = Platform.OS === "web";

    // Use a ref for finishing flag so beforeRemove always has the latest value
    // (avoids stale closure problem where state is captured at render time)
    const finishingRef = useRef(false);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRefs = useRef<Record<string, TextInput | null>>({});
    const webScrollRef = useRef<ScrollView | null>(null);
    const pendingExitActionRef = useRef<any>(null);
    const freeWorkoutNameConfirmedRef = useRef(false);
    const freeWorkoutNameOverrideRef = useRef<string | null>(null);
    const qualityCheckedSessionRef = useRef<WorkoutSession | null>(null);
    const preWorkoutReminderShownRef = useRef(false);

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

    const getEffortTextValue = (exerciseId: string, set: WorkoutSet): string => {
        if (set.effortMode === "duration") {
            const key = cacheKey(exerciseId, set.id, "durationSeconds");
            if (key in textCache) return textCache[key];
            return formatDurationInput(set.durationSeconds);
        }
        return getTextValue(exerciseId, set.id, "reps", set.reps);
    };

    const loadLatestBodyWeight = useCallback(async () => {
        try {
            const res = await bodyMeasurementApi.list({ limit: 30 });
            const latest = (res.data.measurements || [])
                .filter((record: any) => Number(record.weight) > 0)
                .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];
            const nextWeight = latest ? Number(latest.weight) : null;
            setLatestBodyWeight(Number.isFinite(nextWeight || NaN) ? nextWeight : null);
            return Number.isFinite(nextWeight || NaN) ? nextWeight : null;
        } catch (err) {
            console.warn("[WorkoutSession] Latest body weight could not be loaded:", err);
            return latestBodyWeight;
        }
    }, [latestBodyWeight]);

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

        if (field === "durationSeconds") {
            updateSet(exerciseId, setId, field as any, parseDurationInput(raw));
            setTextCache((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }

        // RIR accepts string ranges like "1-2", "2-3" — preserve as-is
        if (field === "rir") {
            const currentSet = session.exercises
                .find((exercise) => exercise.id === exerciseId)
                ?.sets.find((set) => set.id === setId);
            const cachedReps = textCache[cacheKey(exerciseId, setId, "reps")];
            const repsForClamp = cachedReps !== undefined ? parseInt(cachedReps, 10) || 0 : currentSet?.reps;
            updateSet(exerciseId, setId, field as any, normalizeRirLogValue(raw, repsForClamp) ?? "");
            setTextCache((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }

        const num = isInteger ? (parseInt(raw, 10) || 0) : (parseFloat(raw) || 0);
        const clamped = field === "rpe" ? clampRpe(num) : num;
        updateSet(exerciseId, setId, field as any, clamped);
        // Clear cache so it falls back to formatted number
        setTextCache((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const setFromCache = useCallback((set: WorkoutSet, exerciseId: string): WorkoutSet => {
        const nextSet = { ...set };
        const weightRaw = textCache[cacheKey(exerciseId, set.id, "weight")];
        const repsRaw = textCache[cacheKey(exerciseId, set.id, "reps")];
        const durationRaw = textCache[cacheKey(exerciseId, set.id, "durationSeconds")];
        const rpeRaw = textCache[cacheKey(exerciseId, set.id, "rpe")];
        const rirRaw = textCache[cacheKey(exerciseId, set.id, "rir")];

        if (weightRaw !== undefined) {
            nextSet.weight = parseFloat(weightRaw) || 0;
        }
        if (repsRaw !== undefined) {
            nextSet.reps = parseInt(repsRaw, 10) || 0;
        }
        if (durationRaw !== undefined) {
            nextSet.durationSeconds = parseDurationInput(durationRaw);
        }
        if (rpeRaw !== undefined) {
            nextSet.rpe = clampRpe(rpeRaw);
        }
        if (rirRaw !== undefined) {
            (nextSet as any).rir = normalizeRirLogValue(rirRaw, nextSet.reps) ?? "";
        }

        return nextSet;
    }, [textCache]);

    const getSessionWithCachedInputs = useCallback((): WorkoutSession => {
        if (Object.keys(textCache).length === 0) return session;

        return {
            ...session,
            exercises: session.exercises.map((exercise) => ({
                ...exercise,
                sets: exercise.sets.map((set) => setFromCache(set, exercise.id)),
            })),
        };
    }, [session, setFromCache, textCache]);

    const materializeSessionInputs = useCallback((): WorkoutSession => {
        if (Object.keys(textCache).length === 0) return session;

        const nextSession = getSessionWithCachedInputs();
        setSession(nextSession);
        setTextCache({});
        return nextSession;
    }, [getSessionWithCachedInputs, session, textCache]);

    // ─── Restore Active Session / Load Program ─
    useEffect(() => {
        (async () => {
            console.log("[WorkoutSession] route params:", JSON.stringify(route.params, null, 2));

            const params = route.params;
            const hasProgramParams = !!(params?.programId || params?.programData);
            const isFreeWorkout = params?.mode === "free";

            if (isFreeWorkout) {
                const saved = await restoreActiveSession();
                if (saved) {
                    setSession(saved);
                    setRpeMode(inferTrackingModeFromSession(saved));
                    setElapsed(getElapsedSeconds(saved));
                    setStartBlockedModalVisible(true);
                } else {
                    await clearActiveSession();
                    const newSession = {
                        ...createSession(),
                        title: "Serbest Antrenman",
                    };
                    setSession(newSession);
                    setElapsed(0);
                    await saveActiveSession(newSession);
                }
            }

            // ────────────────────────────────────────
            // CASE 1: Coming from a program → ALWAYS start fresh
            // Clear any stale session and load program data
            // ────────────────────────────────────────
            if (!isFreeWorkout && hasProgramParams) {
                const saved = await restoreActiveSession();
                if (saved) {
                    setSession(saved);
                    setRpeMode(inferTrackingModeFromSession(saved));
                    setElapsed(getElapsedSeconds(saved));
                    setStartBlockedModalVisible(true);
                    setRestored(true);
                    return;
                }

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
                const programTrackingMode = inferTrackingModeFromExercises(templateExercises);

                if (templateExercises.length > 0) {
                    const dayLabel = isCycle
                        ? days![dayIndex % days!.length]?.label
                        : undefined;
                    const title = dayLabel
                        ? `${programName ?? "Antrenman"} · ${dayLabel}`
                        : (programName ?? "Antrenman");

                    let previousWeights = new Map<string, number[]>();
                    let previousReps = new Map<string, number[]>();
                    try {
                        const workoutRes = await workoutApi.list({ limit: 200 });
                        const workouts = workoutRes.data.workouts || [];
                        previousWeights = buildPreviousWeightLookup(workouts);
                        if (rememberRepsEnabled) previousReps = buildPreviousRepsLookup(workouts);
                    } catch (err) {
                        console.warn("[WorkoutSession] Previous set placeholders could not be loaded:", err);
                    }

                    const newExercises: WorkoutExercise[] = templateExercises.map((templateEx: any) => {
                        const targetSet = templateEx.targetSets?.[0] ?? templateEx.sets?.[0];
                        const exercisePreviousWeights =
                            exerciseLookupKeys(templateEx).map((key) => previousWeights.get(key)).find(Boolean) || [];
                        const exercisePreviousReps =
                            exerciseLookupKeys(templateEx).map((key) => previousReps.get(key)).find(Boolean) || [];
                        let workingSetIndex = 0;
                        let repsSetIndex = 0;
                        return {
                            id: uid(),
                            exerciseId: templateEx.exerciseId,
                            name: templateEx.name,
                            targetReps: targetSet?.targetReps,
                            targetWeight: targetSet?.targetWeight,
                            targetRPE: targetSet?.targetRPE,
                            targetRIR: targetSet?.targetRIR,
                            sets: (templateEx.targetSets ?? templateEx.sets ?? [{}]).map((ts: TargetSet) => {
                                const isWarmup = !!ts?.isWarmup;
                                const previousWeight = isWarmup
                                    ? undefined
                                    : exercisePreviousWeights[workingSetIndex++];
                                const previousRepsValue = isWarmup
                                    ? undefined
                                    : exercisePreviousReps[repsSetIndex++];
                                return {
                                    id: uid(),
                                    weight: 0,
                                    reps: 0,
                                    weightMode: "kg" as const,
                                    effortMode: "reps" as const,
                                    durationSeconds: 0,
                                    rpe: 0,
                                    unit: "kg" as const,
                                    completed: false,
                                    isWarmup,
                                    targetReps: previousRepsValue ? String(previousRepsValue) : ts?.targetReps,
                                    targetWeight: previousWeight ? String(previousWeight) : ts?.targetWeight,
                                    targetRPE: ts?.targetRPE,
                                    targetRIR: ts?.targetRIR,
                                };
                            }),
                        };
                    });
                    const newSession: WorkoutSession = {
                        ...createSession(),
                        title,
                        exercises: newExercises,
                        programId: programId,
                        dayIndex,
                    };
                    setSession(newSession);
                    setRpeMode(programTrackingMode);
                    setElapsed(0);
                    await saveActiveSession(newSession);
                } else {
                    console.warn("[WorkoutSession] No exercises found for this day");
                    navigation.goBack();
                    return;
                }
            }
            // ────────────────────────────────────────
            // CASE 2: No program params → try to restore saved session
            // ────────────────────────────────────────
            else if (!isFreeWorkout) {
                const saved = await restoreActiveSession();
                if (saved) {
                    setSession(saved);
                    setRpeMode(inferTrackingModeFromSession(saved));
                    setElapsed(getElapsedSeconds(saved));
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

    useEffect(() => {
        loadLatestBodyWeight();
    }, [loadLatestBodyWeight]);

    useFocusEffect(
        useCallback(() => {
            if (!restored || finishingRef.current) return;
            let mounted = true;
            restoreActiveSession().then((saved) => {
                if (!mounted || !saved || saved.id !== session.id) return;
                setSession(saved);
                setElapsed(getElapsedSeconds(saved));
            });
            return () => {
                mounted = false;
            };
        }, [restored, session.id]),
    );

    // ─── Timer ───────────────────────────────
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (finishingRef.current) return; // don't tick after finish
            setElapsed(getElapsedSeconds(session));
        }, 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [session.startedAt, session.totalDuration]);

    useEffect(() => {
        if (!recentlyAddedExerciseId) return;

        const timer = setTimeout(() => {
            setRecentlyAddedExerciseId(null);
        }, ADDED_EXERCISE_HIGHLIGHT_MS);

        return () => clearTimeout(timer);
    }, [recentlyAddedExerciseId]);

    useEffect(() => {
        const note = String(user?.settings?.pre_workout_reminder_note || "").trim();
        if (
            preWorkoutReminderShownRef.current ||
            user?.settings?.pre_workout_reminder_enabled !== true ||
            !note ||
            session.exercises.length === 0
        ) {
            return;
        }

        preWorkoutReminderShownRef.current = true;
        setConceptNotice({
            title: "Antrenman hatirlatmasi",
            message: note,
        });
    }, [
        session.exercises.length,
        session.id,
        user?.settings?.pre_workout_reminder_enabled,
        user?.settings?.pre_workout_reminder_note,
    ]);

    // ─── Debounced Auto-Save ─────────────────
    useEffect(() => {
        if (!restored || finishingRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (finishingRef.current) return;
            const nextSession = { ...getSessionWithCachedInputs(), totalDuration: elapsed };
            saveActiveSession(nextSession);
        }, AUTOSAVE_DEBOUNCE_MS);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [elapsed, getSessionWithCachedInputs, restored]);

    useEffect(() => {
        if (!restored) return;

        const persistNow = () => {
            if (finishingRef.current) return;
            const nextSession = { ...getSessionWithCachedInputs(), totalDuration: elapsed };
            saveActiveSession(nextSession);
        };

        const appStateSubscription = AppState.addEventListener("change", (state) => {
            if (state === "inactive" || state === "background") persistNow();
        });

        if (!isWeb || typeof document === "undefined") {
            return () => appStateSubscription.remove();
        }

        const handleVisibility = () => {
            if (document.visibilityState === "hidden") persistNow();
        };
        const handlePageHide = () => persistNow();

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("beforeunload", handlePageHide);

        return () => {
            appStateSubscription.remove();
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("beforeunload", handlePageHide);
        };
    }, [elapsed, getSessionWithCachedInputs, isWeb, restored]);

    // ─── Back Navigation — ask before leaving active workout ─
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            // Use ref instead of state to avoid stale closure issue:
            // When finishWorkout() calls navigation.replace(), the beforeRemove
            // fires but the finishing state may not have updated yet.
            // The ref always has the latest value.
            if (finishingRef.current) return;

            e.preventDefault();
            pendingExitActionRef.current = e.data.action;
            const currentSession = materializeSessionInputs();
            setExitModalHasData(hasLoggedWorkoutData(currentSession));
            setExitModalVisible(true);
        });
        return unsubscribe;
    }, [navigation, materializeSessionInputs]);

    // ─── Update Helpers ──────────────────────

    const updateSession = useCallback((updater: (prev: WorkoutSession) => WorkoutSession) => {
        setSession(updater);
    }, []);

    const openNoteModal = useCallback(() => {
        setNoteDraft(session.notes ?? "");
        setNoteModalVisible(true);
    }, [session.notes]);

    const saveWorkoutNote = useCallback(() => {
        const notes = noteDraft.trim();
        updateSession((prev) => ({ ...prev, notes: notes || undefined }));
        setNoteModalVisible(false);
    }, [noteDraft, updateSession]);

    const clearWorkoutNote = useCallback(() => {
        setNoteDraft("");
        updateSession((prev) => ({ ...prev, notes: undefined }));
        setNoteModalVisible(false);
    }, [updateSession]);

    const updateSet = useCallback(
        (exerciseId: string, setId: string, field: keyof WorkoutSet, value: string | number | boolean | undefined) => {
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

    const updateSetPatch = useCallback(
        (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) => {
            updateSession((prev) => ({
                ...prev,
                exercises: prev.exercises.map((e) =>
                    e.id === exerciseId
                        ? {
                            ...e,
                            sets: e.sets.map((s) => s.id === setId ? { ...s, ...patch } : s),
                        }
                        : e,
                ),
            }));
        },
        [updateSession],
    );

    const updateUnilateralSide = useCallback((
        exerciseId: string,
        set: WorkoutSet,
        side: "left" | "right",
        field: "weight" | "reps" | "durationSeconds",
        rawValue: string,
    ) => {
        const value = field === "durationSeconds"
            ? parseDurationInput(rawValue)
            : Number(rawValue.replace(",", ".")) || 0;
        const nextSide = { ...(set[side] || {}), [field]: value };
        const otherSide = set[side === "left" ? "right" : "left"] || {};
        const left = side === "left" ? nextSide : otherSide;
        const right = side === "right" ? nextSide : otherSide;
        const leftWeight = Number(left.weight) || 0;
        const rightWeight = Number(right.weight) || 0;
        const leftReps = Number(left.reps) || 0;
        const rightReps = Number(right.reps) || 0;
        const leftDuration = Number(left.durationSeconds) || 0;
        const rightDuration = Number(right.durationSeconds) || 0;

        updateSetPatch(exerciseId, set.id, {
            sideMode: "left_right",
            left,
            right,
            weight: leftWeight > 0 && rightWeight > 0 ? Math.min(leftWeight, rightWeight) : Math.max(leftWeight, rightWeight, Number(set.weight) || 0),
            reps: leftReps > 0 && rightReps > 0 ? Math.min(leftReps, rightReps) : Math.max(leftReps, rightReps, Number(set.reps) || 0),
            durationSeconds: leftDuration > 0 && rightDuration > 0 ? Math.min(leftDuration, rightDuration) : Math.max(leftDuration, rightDuration, Number(set.durationSeconds) || 0),
            completed: true,
        });
    }, [updateSetPatch]);

    const exerciseLibraryResults = React.useMemo(() => {
        const query = newExerciseName.trim().toLocaleLowerCase("tr-TR");
        const filtered = query
            ? EXERCISE_LIBRARY.filter((item) => {
                const search = [
                    item.name,
                    item.pattern,
                    ...item.aliases,
                    ...item.primaryMuscles,
                    ...item.secondaryMuscles,
                    ...item.equipment,
                ].join(" ").toLocaleLowerCase("tr-TR");
                return search.includes(query);
            })
            : EXERCISE_LIBRARY;
        return [...filtered]
            .sort((a, b) => Number(b.beginnerFriendly) - Number(a.beginnerFriendly))
            .slice(0, 8);
    }, [newExerciseName]);

    const selectExerciseFromLibrary = useCallback((item: ExerciseLibraryItem) => {
        setNewExerciseLibraryItem(item);
        setNewExerciseName(item.name);
    }, []);

    const handleNewExerciseNameChange = useCallback((text: string) => {
        setNewExerciseName(text);
        setNewExerciseLibraryItem((current) => current?.name === text ? current : null);
    }, []);

    const setWeightMode = useCallback(async (exerciseId: string, set: WorkoutSet, weightMode: "kg" | "bodyweight") => {
        const key = cacheKey(exerciseId, set.id, "weight");
        setTextCache((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        if (weightMode === "bodyweight") {
            const measuredWeight = latestBodyWeight ?? await loadLatestBodyWeight();
            if (!measuredWeight || measuredWeight <= 0) {
                setBodyWeightDraft("");
                setBodyWeightModal({ exerciseId, setId: set.id });
                return;
            }
            updateSetPatch(exerciseId, set.id, { weightMode, weight: measuredWeight, bodyWeight: measuredWeight });
            return;
        }
        updateSetPatch(exerciseId, set.id, { weightMode, bodyWeight: undefined, externalWeight: undefined });
    }, [latestBodyWeight, loadLatestBodyWeight, updateSetPatch]);

    const saveBodyWeightForSet = useCallback(async () => {
        if (!bodyWeightModal) return;
        const parsed = Number(bodyWeightDraft.replace(",", "."));
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setConceptNotice({
                title: "Vücut ağırlığı gerekli",
                message: "BW setleri doğru hesaplayabilmem için güncel vücut ağırlığını kg cinsinden girmen gerekiyor.",
            });
            return;
        }

        try {
            const today = new Date().toISOString().slice(0, 10);
            const existingRes = await bodyMeasurementApi.list({ limit: 30 });
            const existingToday = (existingRes.data.measurements || []).find((record: any) =>
                String(record.date || "").slice(0, 10) === today,
            );
            await bodyMeasurementApi.save({
                date: today,
                weight: parsed,
                waist: existingToday?.waist ?? null,
                chest: existingToday?.chest ?? null,
                arm: existingToday?.arm ?? null,
                leg: existingToday?.leg ?? null,
                hip: existingToday?.hip ?? null,
                shoulder: existingToday?.shoulder ?? null,
                notes: existingToday?.notes ?? null,
            });
        } catch (err) {
            console.warn("[WorkoutSession] Body weight could not be saved:", err);
        }

        setLatestBodyWeight(parsed);
        updateSetPatch(bodyWeightModal.exerciseId, bodyWeightModal.setId, {
            weightMode: "bodyweight",
            weight: parsed,
            bodyWeight: parsed,
        });
        setBodyWeightModal(null);
        setBodyWeightDraft("");
    }, [bodyWeightDraft, bodyWeightModal, updateSetPatch]);

    const setEffortMode = useCallback((exerciseId: string, set: WorkoutSet, effortMode: "reps" | "duration") => {
        const repsKey = cacheKey(exerciseId, set.id, "reps");
        const durationKey = cacheKey(exerciseId, set.id, "durationSeconds");
        setTextCache((prev) => {
            const next = { ...prev };
            delete next[repsKey];
            delete next[durationKey];
            return next;
        });
        updateSetPatch(exerciseId, set.id, effortMode === "duration"
            ? { effortMode, reps: 0, durationSeconds: set.durationSeconds ?? 0 }
            : { effortMode, durationSeconds: 0 });
    }, [updateSetPatch]);

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

    const openAddExerciseModal = useCallback(() => {
        setNewExerciseName("");
        setNewExerciseLibraryItem(null);
        setNewExerciseIndex(Array.isArray(session.exercises) ? session.exercises.length : 0);
        setAddExerciseModalVisible(true);
    }, [session.exercises]);

    const addExerciseAtSelectedPosition = useCallback(() => {
        const newEx: WorkoutExercise = {
            id: uid(),
            exerciseId: newExerciseLibraryItem?.id,
            name: newExerciseName.trim(),
            isCustom: true,
            sets: [
                { id: uid(), weight: 0, reps: 0, weightMode: "kg", effortMode: "reps", durationSeconds: 0, unit: "kg", completed: false },
            ],
        };
        const insertIndex = Math.max(0, Math.min(newExerciseIndex, session.exercises.length));
        updateSession((prev) => {
            const exercises = [...prev.exercises];
            exercises.splice(insertIndex, 0, newEx);
            return { ...prev, exercises };
        });
        setAddExerciseModalVisible(false);
        setNewExerciseName("");
        setNewExerciseLibraryItem(null);
        setRecentlyAddedExerciseId(newEx.id);
        requestAnimationFrame(() => {
            webScrollRef.current?.scrollTo({
                y: Math.max(0, insertIndex * 260),
                animated: true,
            });
        });
    }, [newExerciseIndex, newExerciseLibraryItem, newExerciseName, session.exercises.length, updateSession]);

    const removeExercise = useCallback((exerciseId: string) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.filter((e) => e.id !== exerciseId),
        }));
    }, [updateSession]);

    const addSetToExercise = useCallback((exerciseId: string, isWarmup = false) => {
        const newSet = { id: uid(), weight: 0, reps: 0, weightMode: "kg" as const, effortMode: "reps" as const, durationSeconds: 0, unit: "kg" as const, completed: false, isWarmup };
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((e) =>
                e.id === exerciseId
                    ? { ...e, sets: insertSetByType(e.sets, newSet, isWarmup) }
                    : e
            ),
        }));
    }, [updateSession]);

    const reorderSets = useCallback((exerciseId: string, sets: WorkoutSet[]) => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((e) =>
                e.id === exerciseId ? { ...e, sets } : e,
            ),
        }));
    }, [updateSession]);

    const moveExercise = useCallback((exerciseId: string, direction: "up" | "down") => {
        updateSession((prev) => {
            const fromIndex = prev.exercises.findIndex((exercise) => exercise.id === exerciseId);
            const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
            if (fromIndex < 0 || toIndex < 0 || toIndex >= prev.exercises.length) return prev;

            const exercises = [...prev.exercises];
            const [moved] = exercises.splice(fromIndex, 1);
            exercises.splice(toIndex, 0, moved);
            return { ...prev, exercises };
        });
    }, [updateSession]);

    const moveSet = useCallback((exerciseId: string, setId: string, direction: "up" | "down") => {
        updateSession((prev) => ({
            ...prev,
            exercises: prev.exercises.map((exercise) => {
                if (exercise.id !== exerciseId) return exercise;

                const fromIndex = exercise.sets.findIndex((set) => set.id === setId);
                const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
                if (fromIndex < 0 || toIndex < 0 || toIndex >= exercise.sets.length) return exercise;

                const sets = [...exercise.sets];
                const [moved] = sets.splice(fromIndex, 1);
                sets.splice(toIndex, 0, moved);
                return { ...exercise, sets };
            }),
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

    const discardWorkout = useCallback(async () => {
        finishingRef.current = true;
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
    }, [navigation]);

    const leaveWorkout = useCallback(async (mode: "save" | "discard") => {
        setExitModalVisible(false);
        finishingRef.current = true;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        if (mode === "save") {
            await saveActiveSession({ ...materializeSessionInputs(), totalDuration: elapsed });
        } else {
            await clearActiveSession();
        }

        const action = pendingExitActionRef.current;
        pendingExitActionRef.current = null;
        if (action) navigation.dispatch(action);
        else navigation.goBack();
    }, [elapsed, materializeSessionInputs, navigation]);

    // ─── Finish Workout ──────────────────────

    const finishWorkout = async (qualityCheckedSession?: WorkoutSession) => {
        if (finishingRef.current) return;

        const trustedQualitySession = isWorkoutSessionLike(qualityCheckedSession) ? qualityCheckedSession : undefined;
        let currentSession = trustedQualitySession || closeActiveCardioIfNeeded(materializeSessionInputs());
        if (currentSession !== session) {
            setSession(currentSession);
            await saveActiveSession({ ...currentSession, totalDuration: elapsed });
        }
        const validExercises = currentSession.exercises.filter(
            (e) => e.name.trim().length > 0 && e.sets.some(hasLoggedSetData),
        );
        const validCardioBlocks = (currentSession.cardioBlocks || []).filter((block) =>
            Number(block.totalDuration) > 0 ||
            Number(block.totalDistance) > 0 ||
            Number(block.totalSteps) > 0 ||
            Number(block.totalCalories) > 0 ||
            (Array.isArray(block.stages) && block.stages.length > 0),
        );

        if (validExercises.length === 0 && validCardioBlocks.length === 0) {
            setEmptyFinishModalVisible(true);
            return;
        }

        if (!trustedQualitySession) {
            const quality = prepareSessionForCoachAnalysis(currentSession);
            if (quality.warnings.length > 0) {
                qualityCheckedSessionRef.current = quality.session;
                setQualityWarnings(quality.warnings);
                setQualityModalVisible(true);
                return;
            }
        }

        if (route.params?.mode === "free" && freeWorkoutNameConfirmedRef.current) {
            currentSession = {
                ...currentSession,
                title: freeWorkoutNameOverrideRef.current || "Serbest Antrenman",
            };
        }

        if (route.params?.mode === "free" && !freeWorkoutNameConfirmedRef.current && !freeWorkoutNameConfirmed) {
            setFreeWorkoutNameDraft(currentSession.title && currentSession.title !== "Serbest Antrenman" ? currentSession.title : "");
            setFreeWorkoutNameModalVisible(true);
            return;
        }

        setFinishing(true);
        finishingRef.current = true;

        // Stop the timer and any pending auto-save immediately
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        try {
            const completedSession: WorkoutSession = {
                ...currentSession,
                exercises: validExercises,
                cardioBlocks: validCardioBlocks,
                completedAt: new Date().toISOString(),
                totalDuration: elapsed,
                totalVolume: calculateLoadScoreFromExercises(validExercises),
                status: "completed",
            };

            await savePendingWorkout(completedSession);
            await clearActiveSession();

            let syncNotice: { title: string; message: string } | null = null;
            try {
                const syncResult = await syncPendingWorkouts();
                if (syncResult.failed > 0) {
                    syncNotice = {
                        title: "Senkronizasyon uyarisi",
                        message: `Antrenman yerel olarak kaydedildi ancak sunucuya gonderilemedi.\n\n` +
                            `Hata: ${syncResult.errors.join(", ")}\n\n` +
                            "Internet baglantinizi kontrol edin. Sonraki giriste tekrar denenecek.",
                    };
                } else if (syncResult.offline) {
                    syncNotice = {
                        title: "Cevrimdisi kayit",
                        message: "Antrenman yerel olarak kaydedildi. Internet baglantisi saglandiginda otomatik olarak senkronize edilecek.",
                    };
                }
            } catch (err) {
                console.warn("[WorkoutSession] Sync hatası (arka planda yeniden denenecek):", err);
                syncNotice = {
                    title: "Senkronizasyon hatasi",
                    message: "Antrenman yerel olarak kaydedildi ancak sunucuya gonderilemedi. Sonraki girisinizde tekrar denenecek.",
                };
            }

            // ── Compute summary stats ──
            const totalVolume = calculateLoadScoreFromExercises(validExercises);
            const setCount = validExercises.reduce(
                (total, ex) => total + ex.sets.filter((set) => !set.isWarmup).length,
                0,
            );

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
            const summaryParams = {
                programId,
                programName: route.params?.programName,
                dayLabel,
                nextDayLabel,
                totalVolume,
                duration: elapsed,
                exerciseCount: validExercises.length,
                setCount,
                notes: completedSession.notes,
                cardioBlocks: completedSession.cardioBlocks,
            };

            if (syncNotice) {
                setPostFinishNotice({ ...syncNotice, summaryParams });
            } else {
                (navigation as any).replace("WorkoutSummary", summaryParams);
            }
        } catch (error) {
            console.error("[WorkoutSession] Kaydetme hatası:", error);
            setConceptNotice({ title: "Kaydetme hatasi", message: "Antrenman verisi kaydedilirken bir hata olustu." });
        } finally {
            setFinishing(false);
            finishingRef.current = false;
        }
    };

    const cancelWorkout = async () => {
        pendingExitActionRef.current = null;
        setExitModalHasData(hasLoggedWorkoutData(materializeSessionInputs()));
        setExitModalVisible(true);
    };

    const confirmEmptyWorkoutCancel = async () => {
        setEmptyFinishModalVisible(false);
        await discardWorkout();
    };

    const continueWithQualityWarnings = async () => {
        const nextSession = qualityCheckedSessionRef.current;
        qualityCheckedSessionRef.current = null;
        setQualityModalVisible(false);
        setQualityWarnings([]);
        if (nextSession) {
            await finishWorkout(nextSession);
        }
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
            if (prev === "none") return "rpe";
            if (prev === "rpe") return "rir";
            if (prev === "rir") return "both";
            return "none";
        });
    };

    const confirmFreeWorkoutName = (override?: string) => {
        const name = (override ?? freeWorkoutNameDraft).trim();
        const nextTitle = name || "Serbest Antrenman";
        freeWorkoutNameConfirmedRef.current = true;
        freeWorkoutNameOverrideRef.current = nextTitle;
        updateSession((prev) => ({ ...prev, title: nextTitle }));
        setFreeWorkoutNameConfirmed(true);
        setFreeWorkoutNameModalVisible(false);
        setTimeout(() => {
            finishWorkout();
        }, 0);
    };

    const modeLabelMap = { none: "RPE/RIR Kapalı", rpe: "RPE", rir: "RIR", both: "RPE+RIR" };

    const openCardioSession = async (cardioBlockId?: string) => {
        const activeSession = { ...materializeSessionInputs(), totalDuration: elapsed };
        await saveActiveSession(activeSession);
        navigation.navigate("CardioSession", cardioBlockId ? { cardioBlockId } : undefined);
    };

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
                        style={[styles.infoBtn, !showRpeRirInfo && { display: "none" }]}
                        onPress={() => setConceptNotice({
                            title: "RPE / RIR nedir?",
                            message: "RPE, setin zorluğunu 0-10 arası puanlamaktır. RIR ise sette kaç tekrar yedek kaldığını tahmin etmektir. Örn. RIR 2, yaklaşık 2 tekrar daha çıkardı demektir.",
                        })}
                    >
                        <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.rirToggleBtn, { borderColor: colors.accent }]}
                        onPress={openAddExerciseModal}
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

            <TouchableOpacity
                style={[styles.sessionNoteBtn, session.notes && styles.sessionNoteBtnActive]}
                onPress={openNoteModal}
                activeOpacity={0.85}
            >
                <Ionicons
                    name={session.notes ? "document-text" : "document-text-outline"}
                    size={18}
                    color={session.notes ? colors.background : colors.accent}
                />
                <Text style={[styles.sessionNoteBtnText, session.notes && styles.sessionNoteBtnTextActive]}>
                    {session.notes ? "Notu düzenle" : "Not ekle"}
                </Text>
            </TouchableOpacity>
            {session.notes ? (
                <Text style={styles.sessionNotePreview} numberOfLines={2}>
                    {session.notes}
                </Text>
            ) : null}
        </View>
    );

    const renderFooter = () => (
        <View style={styles.listFooter}>
            {(session.cardioBlocks || []).length > 0 ? (
                <View style={styles.cardioSummaryCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardioSummaryTitle}>Kardiyo</Text>
                        <Text style={styles.cardioSummaryText}>{summarizeCardioBlocks(session.cardioBlocks)}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.cardioAddSmallBtn}
                        onPress={() => setCardioListVisible(true)}
                    >
                        <Ionicons name="list-outline" size={18} color={colors.accent} />
                    </TouchableOpacity>
                </View>
            ) : null}
            <TouchableOpacity style={styles.cardioAddBtn} onPress={() => openCardioSession()} activeOpacity={0.86}>
                <Ionicons name="pulse-outline" size={18} color={colors.accent} />
                <Text style={styles.cardioAddText}>Kardiyo Ekle</Text>
            </TouchableOpacity>
            <AccentButton
                title="Antrenmanı Bitir"
                onPress={() => finishWorkout()}
                loading={finishing}
                style={styles.finishBtn}
            />
            <View style={{ height: spacing.xxxl * 2 }} />
        </View>
    );

    const renderExerciseItem = ({ item: exercise, drag, isActive, getIndex }: RenderItemParams<WorkoutExercise>) => {
        const exIndex = getIndex() ?? 0;
        const weightModes = new Set(exercise.sets.map((set) => set.weightMode === "bodyweight" ? "BW" : "KG"));
        const effortModes = new Set(exercise.sets.map((set) => set.effortMode === "duration" ? "SÜRE" : "TEKRAR"));
        const weightHeader = weightModes.size === 1 ? [...weightModes][0] : "KG/BW";
        const effortHeader = effortModes.size === 1 ? [...effortModes][0] : "TEKRAR/SÜRE";
        const getSetLabel = (set: WorkoutSet, sets: WorkoutSet[]) => {
            const sameTypeSets = sets.filter((candidate) => !!candidate.isWarmup === !!set.isWarmup);
            const setNumber = sameTypeSets.findIndex((candidate) => candidate.id === set.id) + 1;
            return set.isWarmup ? `W${setNumber}` : `${setNumber}`;
        };

        const renderSetItem = ({ item: set, drag: dragSet, getIndex: getSetIndex }: RenderItemParams<WorkoutSet>) => {
            const setIndex = getSetIndex() ?? 0;
            const isWarmup = !!set.isWarmup;
            const label = getSetLabel(set, exercise.sets);
            const canMoveSetUp = setIndex > 0;
            const canMoveSetDown = setIndex < exercise.sets.length - 1;

            const setContent = (
                <View style={styles.setBlock}>
                <View style={[styles.setRow, isWarmup && styles.warmupSetRow, set.sideMode === "left_right" && styles.unilateralSetRow]}>
                        {isWeb ? (
                            <View style={[styles.setDragHandle, styles.webSetOrderHandle, isWarmup && styles.warmupSetDragHandle]}>
                                <Text style={[styles.setNumber, isWarmup && styles.warmupSetNumber]}>
                                    {label}
                                </Text>
                                <View style={styles.webOrderButtons}>
                                    <TouchableOpacity
                                        onPress={() => moveSet(exercise.id, set.id, "up")}
                                        disabled={!canMoveSetUp}
                                        style={[styles.webOrderBtn, !canMoveSetUp && styles.webOrderBtnDisabled]}
                                    >
                                        <Ionicons name="chevron-up" size={12} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => moveSet(exercise.id, set.id, "down")}
                                        disabled={!canMoveSetDown}
                                        style={[styles.webOrderBtn, !canMoveSetDown && styles.webOrderBtnDisabled]}
                                    >
                                        <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onLongPress={dragSet}
                                delayLongPress={180}
                                style={[styles.setDragHandle, isWarmup && styles.warmupSetDragHandle]}
                            >
                                <Text style={[styles.setNumber, isWarmup && styles.warmupSetNumber]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={[styles.inputWrapper, { flex: 1 }]}>
                            <TextInput
                                ref={(el) => { inputRefs.current[`ex-${exIndex}-set-${setIndex}-weight`] = el; }}
                                style={[styles.numericInput, set.weightMode === "bodyweight" && styles.exceptionInput]}
                                value={set.weightMode === "bodyweight" ? "BW" : getTextValue(exercise.id, set.id, "weight", set.weight)}
                                editable={set.weightMode !== "bodyweight"}
                                onChangeText={(text) => {
                                    onNumericChange(exercise.id, set.id, "weight", text);
                                    if (text.trim() && !set.completed) toggleSetCompleted(exercise.id, set.id);
                                }}
                                onBlur={() => onNumericBlur(exercise.id, set.id, "weight")}
                                placeholder={
                                    set.weightMode === "bodyweight"
                                        ? `${set.weight || latestBodyWeight || 0} kg`
                                        : set.targetWeight ?? exercise.targetWeight ?? "0"
                                }
                                placeholderTextColor={
                                    set.weightMode === "bodyweight" || (set.targetWeight || exercise.targetWeight)
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
                                style={[styles.numericInput, set.effortMode === "duration" && styles.exceptionInput]}
                                value={getEffortTextValue(exercise.id, set)}
                                onChangeText={(text) => {
                                    onNumericChange(exercise.id, set.id, set.effortMode === "duration" ? "durationSeconds" as any : "reps", text);
                                    if (text.trim() && !set.completed) toggleSetCompleted(exercise.id, set.id);
                                }}
                                onBlur={() => onNumericBlur(exercise.id, set.id, set.effortMode === "duration" ? "durationSeconds" : "reps", set.effortMode !== "duration")}
                                placeholder={set.effortMode === "duration" ? "sn" : (set.targetReps ?? exercise.targetReps ?? "0")}
                                placeholderTextColor={
                                    set.effortMode !== "duration" && (set.targetReps || exercise.targetReps)
                                        ? colors.accentDark
                                        : colors.textMuted
                                }
                                keyboardType={set.effortMode === "duration" ? "default" : "number-pad"}
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
                                    keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
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
                {set.sideMode === "left_right" && (
                    <View style={styles.unilateralPanel}>
                        {(["left", "right"] as const).map((side) => {
                            const sideData = set[side] || {};
                            const sideLabel = side === "left" ? "Sol" : "Sag";
                            return (
                                <View key={side} style={styles.unilateralRow}>
                                    <Text style={styles.unilateralLabel}>{sideLabel}</Text>
                                    <TextInput
                                        style={styles.unilateralInput}
                                        value={sideData.weight ? String(sideData.weight) : ""}
                                        onChangeText={(text) => updateUnilateralSide(exercise.id, set, side, "weight", text)}
                                        placeholder={set.weightMode === "bodyweight" ? "BW" : "kg"}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                        selectionColor={colors.accent}
                                    />
                                    <TextInput
                                        style={styles.unilateralInput}
                                        value={
                                            set.effortMode === "duration"
                                                ? formatDurationInput(sideData.durationSeconds)
                                                : sideData.reps ? String(sideData.reps) : ""
                                        }
                                        onChangeText={(text) => updateUnilateralSide(
                                            exercise.id,
                                            set,
                                            side,
                                            set.effortMode === "duration" ? "durationSeconds" : "reps",
                                            text,
                                        )}
                                        placeholder={set.effortMode === "duration" ? "sn" : "tekrar"}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType={set.effortMode === "duration" ? "default" : "number-pad"}
                                        selectionColor={colors.accent}
                                    />
                                </View>
                            );
                        })}
                        <Text style={styles.unilateralHint}>Analiz zayif taraf uzerinden hesaplanir.</Text>
                    </View>
                )}
                </View>
            );

            return isWeb ? setContent : <ScaleDecorator>{setContent}</ScaleDecorator>;
        };

        const exerciseContent = (
            <View style={[
                    styles.exerciseCard,
                    isActive && styles.activeExerciseCard,
                    recentlyAddedExerciseId === exercise.id && styles.recentlyAddedExerciseCard,
                ]}>
                    <View style={styles.exerciseHeader}>
                        {isWeb ? (
                            <View style={[styles.dragHandle, styles.webExerciseOrderHandle]}>
                                <TouchableOpacity
                                    onPress={() => moveExercise(exercise.id, "up")}
                                    disabled={exIndex === 0}
                                    style={[styles.webOrderBtn, exIndex === 0 && styles.webOrderBtnDisabled]}
                                >
                                    <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => moveExercise(exercise.id, "down")}
                                    disabled={exIndex === session.exercises.length - 1}
                                    style={[styles.webOrderBtn, exIndex === session.exercises.length - 1 && styles.webOrderBtnDisabled]}
                                >
                                    <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onLongPress={drag} delayLongPress={200} style={styles.dragHandle}>
                                <Ionicons name="reorder-two" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}

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
                        <TouchableOpacity
                            onPress={() => setSetSettingsExercise(exercise)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.exerciseSettingsBtn}
                        >
                            <Ionicons name="options-outline" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
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
                        <Text style={[styles.setHeaderText, { flex: 1 }]}>{weightHeader}</Text>
                        <Text style={[styles.setHeaderText, { flex: 1 }]}>{effortHeader}</Text>
                        {(rpeMode === "rpe" || rpeMode === "both") && (
                            <Text style={[styles.setHeaderText, { flex: 0.8 }]}>RPE</Text>
                        )}
                        {(rpeMode === "rir" || rpeMode === "both") && (
                            <Text style={[styles.setHeaderText, { flex: 0.8 }]}>RIR</Text>
                        )}
                    </View>

                    {false && (() => {
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
                                    keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
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

                    {isWeb ? (
                        <View>
                            {exercise.sets.map((set, index) => (
                                <React.Fragment key={set.id}>
                                    {renderSetItem({
                                        item: set,
                                        getIndex: () => index,
                                        drag: () => undefined,
                                        isActive: false,
                                    } as RenderItemParams<WorkoutSet>)}
                                </React.Fragment>
                            ))}
                        </View>
                    ) : (
                        <DraggableFlatList
                            data={exercise.sets}
                            keyExtractor={(set) => set.id}
                            renderItem={renderSetItem}
                            onDragEnd={({ data }) => reorderSets(exercise.id, data)}
                            scrollEnabled={false}
                            activationDistance={8}
                        />
                    )}

                    <View style={styles.addSetRow}>
                        <TouchableOpacity
                            style={styles.addSetBtn}
                            onPress={() => addSetToExercise(exercise.id, false)}
                        >
                            <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                            <Text style={styles.addSetText}>Set Ekle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.addSetBtn}
                            onPress={() => addSetToExercise(exercise.id, true)}
                        >
                            <Ionicons name="flame-outline" size={16} color={colors.textMuted} />
                            <Text style={[styles.addSetText, { color: colors.textMuted }]}>Isınma</Text>
                        </TouchableOpacity>
                    </View>

            </View>
        );

        return isWeb ? exerciseContent : <ScaleDecorator>{exerciseContent}</ScaleDecorator>;
    };

    const settingsExercise = setSettingsExercise
        ? session.exercises.find((exercise) => exercise.id === setSettingsExercise.id) ?? null
        : null;

    // ─── Render ──────────────────────────────

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ActionConfirmModal
                visible={emptyFinishModalVisible}
                title="Henüz veri girmediniz"
                message="Bu antrenmanda kayıtlı set verisi yok. Yanlışlıkla başlattıysanız antrenmanı iptal edebilir veya loglamaya devam edebilirsiniz."
                primaryLabel="Antrenmanı İptal Et"
                secondaryLabel="Devam Et"
                destructivePrimary
                onPrimary={confirmEmptyWorkoutCancel}
                onSecondary={() => setEmptyFinishModalVisible(false)}
                onDismiss={() => setEmptyFinishModalVisible(false)}
            />
            <ActionConfirmModal
                visible={qualityModalVisible}
                title="Koç analizi için şüpheli veri"
                message={`Bazı setler kaydedilecek ama koç analizine dahil edilmeyecek:\n\n${qualityWarnings.slice(0, 4).join("\n")}${qualityWarnings.length > 4 ? `\n+${qualityWarnings.length - 4} set daha` : ""}`}
                primaryLabel="Böyle Kaydet"
                secondaryLabel="Düzenle"
                onPrimary={continueWithQualityWarnings}
                onSecondary={() => {
                    qualityCheckedSessionRef.current = null;
                    setQualityModalVisible(false);
                }}
                onDismiss={() => {
                    qualityCheckedSessionRef.current = null;
                    setQualityModalVisible(false);
                }}
            />
            <ActionConfirmModal
                visible={exitModalVisible}
                title={exitModalHasData ? "Antrenman devam ediyor" : "Antrenman iptal edilsin mi?"}
                message={
                    exitModalHasData
                        ? "Antrenmanı yarıda bırakıp daha sonra devam edebilir, loglamaya dönebilir veya tamamen iptal edebilirsiniz."
                        : "Henüz veri girmediniz. Bu antrenmanı iptal etmek ister misiniz?"
                }
                primaryLabel={exitModalHasData ? "Kaydet ve Çık" : "Antrenmanı İptal Et"}
                secondaryLabel="Devam Et"
                destructivePrimary={!exitModalHasData}
                onPrimary={() => leaveWorkout(exitModalHasData ? "save" : "discard")}
                tertiaryLabel={exitModalHasData ? "Antrenmanı İptal Et" : undefined}
                destructiveTertiary
                onTertiary={exitModalHasData ? () => leaveWorkout("discard") : undefined}
                onSecondary={() => {
                    pendingExitActionRef.current = null;
                    setExitModalVisible(false);
                }}
                onDismiss={() => {
                    pendingExitActionRef.current = null;
                    setExitModalVisible(false);
                }}
            />
            <ActionConfirmModal
                visible={startBlockedModalVisible}
                title="Devam eden antrenman var"
                message="Bu antrenman bitirilmeden veya iptal edilmeden yeni bir antrenman başlatılamaz. Mevcut kayda geri döndüm; istersen buradan devam edebilir ya da iptal edebilirsin."
                primaryLabel="Antrenmana Devam Et"
                secondaryLabel="Tamam"
                onPrimary={() => setStartBlockedModalVisible(false)}
                onSecondary={() => setStartBlockedModalVisible(false)}
                onDismiss={() => setStartBlockedModalVisible(false)}
            />
            <NoticeModal
                visible={!!conceptNotice}
                title={conceptNotice?.title ?? ""}
                message={conceptNotice?.message ?? ""}
                onClose={() => setConceptNotice(null)}
            />
            <NoticeModal
                visible={!!postFinishNotice}
                title={postFinishNotice?.title ?? ""}
                message={postFinishNotice?.message ?? ""}
                onClose={() => {
                    const summaryParams = postFinishNotice?.summaryParams;
                    setPostFinishNotice(null);
                    if (summaryParams) {
                        (navigation as any).replace("WorkoutSummary", summaryParams);
                    }
                }}
            />
            <Modal
                visible={freeWorkoutNameModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setFreeWorkoutNameModalVisible(false)}
            >
                <View style={styles.addExerciseOverlay}>
                    <View style={styles.addExerciseModal}>
                        <Text style={styles.addExerciseTitle}>Antrenman adı</Text>
                        <Text style={styles.bodyWeightModalText}>
                            Serbest antrenmanını geçmişte daha kolay bulmak için kısa bir isim verebilirsin.
                        </Text>
                        <TextInput
                            style={styles.addExerciseInput}
                            value={freeWorkoutNameDraft}
                            onChangeText={setFreeWorkoutNameDraft}
                            placeholder="Örn. Göğüs odaklı serbest"
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.accent}
                            autoFocus
                        />
                        <View style={styles.addExerciseActions}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => {
                                    confirmFreeWorkoutName("");
                                }}
                            >
                                <Text style={styles.modalSecondaryText}>İsimsiz Kaydet</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => confirmFreeWorkoutName()}>
                                <Text style={styles.modalPrimaryText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
                visible={cardioListVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCardioListVisible(false)}
            >
                <View style={styles.addExerciseOverlay}>
                    <View style={styles.addExerciseModal}>
                        <Text style={styles.addExerciseTitle}>Kardiyo Logları</Text>
                        <Text style={styles.bodyWeightModalText}>
                            Düzenlemek istediğin kardiyo kaydını seç.
                        </Text>
                        {(session.cardioBlocks || []).map((block) => (
                            <TouchableOpacity
                                key={block.id}
                                style={styles.cardioListItem}
                                onPress={() => {
                                    setCardioListVisible(false);
                                    openCardioSession(block.id);
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardioListTitle}>{block.title}</Text>
                                    <Text style={styles.cardioListText}>{summarizeCardioBlocks([block])}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        ))}
                        <View style={styles.addExerciseActions}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setCardioListVisible(false)}
                            >
                                <Text style={styles.modalSecondaryText}>Kapat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalPrimaryBtn}
                                onPress={() => {
                                    setCardioListVisible(false);
                                    openCardioSession();
                                }}
                            >
                                <Text style={styles.modalPrimaryText}>Yeni Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
                visible={!!bodyWeightModal}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setBodyWeightModal(null);
                    setBodyWeightDraft("");
                }}
            >
                <View style={styles.addExerciseOverlay}>
                    <View style={styles.addExerciseModal}>
                        <Text style={styles.addExerciseTitle}>Vücut ağırlığı</Text>
                        <Text style={styles.bodyWeightModalText}>
                            BW setlerini doğru hesaplayabilmem için güncel vücut ağırlığını kg cinsinden gir.
                        </Text>
                        <TextInput
                            style={styles.addExerciseInput}
                            value={bodyWeightDraft}
                            onChangeText={setBodyWeightDraft}
                            placeholder="Örn. 82.5"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                            selectionColor={colors.accent}
                            autoFocus
                        />
                        <View style={styles.addExerciseActions}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => {
                                    setBodyWeightModal(null);
                                    setBodyWeightDraft("");
                                }}
                            >
                                <Text style={styles.modalSecondaryText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalPrimaryBtn}
                                onPress={saveBodyWeightForSet}
                            >
                                <Text style={styles.modalPrimaryText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
                visible={!!settingsExercise}
                transparent
                animationType="fade"
                onRequestClose={() => setSetSettingsExercise(null)}
            >
                <View style={styles.addExerciseOverlay}>
                    <View style={styles.addExerciseModal}>
                        <View style={styles.setSettingsHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.addExerciseTitle}>Set ayarları</Text>
                                <Text style={styles.setSettingsSubtitle} numberOfLines={1}>
                                    {settingsExercise?.name}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSetSettingsExercise(null)}
                                style={styles.setSettingsCloseBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.setSettingsList}
                            contentContainerStyle={styles.setSettingsListContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {settingsExercise && (() => {
                                let warmupCount = 0;
                                let workingCount = 0;
                                return settingsExercise.sets.map((set) => {
                                    const isWarmup = !!set.isWarmup;
                                    if (isWarmup) warmupCount++;
                                    else workingCount++;
                                    const label = isWarmup ? `W${warmupCount}` : `${workingCount}`;
                                    const currentWeightMode = set.weightMode ?? "kg";
                                    const currentEffortMode = set.effortMode ?? "reps";
                                    const currentSideMode = set.sideMode ?? "both";

                                    return (
                                        <View key={set.id} style={styles.setSettingsRow}>
                                            <View style={styles.setSettingsSetBadge}>
                                                <Text style={styles.setSettingsSetText}>{label}</Text>
                                            </View>
                                            <View style={styles.setSettingsControls}>
                                                <View style={styles.segmentedControl}>
                                                    <TouchableOpacity
                                                        style={[styles.segmentBtn, currentWeightMode === "kg" && styles.segmentBtnActive]}
                                                        onPress={() => setWeightMode(settingsExercise.id, set, "kg")}
                                                    >
                                                        <Text style={[styles.segmentText, currentWeightMode === "kg" && styles.segmentTextActive]}>KG</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.segmentBtn, currentWeightMode === "bodyweight" && styles.segmentBtnActive]}
                                                        onPress={() => setWeightMode(settingsExercise.id, set, "bodyweight")}
                                                    >
                                                        <Text style={[styles.segmentText, currentWeightMode === "bodyweight" && styles.segmentTextActive]}>BW</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={styles.segmentedControl}>
                                                    <TouchableOpacity
                                                        style={[styles.segmentBtn, currentEffortMode === "reps" && styles.segmentBtnActive]}
                                                        onPress={() => setEffortMode(settingsExercise.id, set, "reps")}
                                                    >
                                                        <Text style={[styles.segmentText, currentEffortMode === "reps" && styles.segmentTextActive]}>Tekrar</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.segmentBtn, currentEffortMode === "duration" && styles.segmentBtnActive]}
                                                        onPress={() => setEffortMode(settingsExercise.id, set, "duration")}
                                                    >
                                                        <Text style={[styles.segmentText, currentEffortMode === "duration" && styles.segmentTextActive]}>Süre</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={styles.segmentedControl}>
                                                    <TouchableOpacity
                                                        style={[styles.segmentBtn, currentSideMode !== "left_right" && styles.segmentBtnActive]}
                                                        onPress={() => updateSetPatch(settingsExercise.id, set.id, { sideMode: "both", left: undefined, right: undefined })}
                                                    >
                                                        <Text style={[styles.segmentText, currentSideMode !== "left_right" && styles.segmentTextActive]}>Normal</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.segmentBtn, currentSideMode === "left_right" && styles.segmentBtnActive]}
                                                        onPress={() => updateSetPatch(settingsExercise.id, set.id, {
                                                            sideMode: "left_right",
                                                            left: set.left || { weight: set.weight || undefined, reps: set.reps || undefined, durationSeconds: set.durationSeconds || undefined },
                                                            right: set.right || { weight: set.weight || undefined, reps: set.reps || undefined, durationSeconds: set.durationSeconds || undefined },
                                                        })}
                                                    >
                                                        <Text style={[styles.segmentText, currentSideMode === "left_right" && styles.segmentTextActive]}>L/R</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                });
                            })()}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.modalPrimaryBtn}
                            onPress={() => setSetSettingsExercise(null)}
                        >
                            <Text style={styles.modalPrimaryText}>Tamam</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal
                visible={noteModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setNoteModalVisible(false)}
            >
                <View style={styles.addExerciseOverlay}>
                    <View style={styles.addExerciseModal}>
                        <Text style={styles.addExerciseTitle}>Antrenman notu</Text>
                        <TextInput
                            style={[styles.addExerciseInput, styles.sessionNoteInput]}
                            value={noteDraft}
                            onChangeText={setNoteDraft}
                            placeholder="Bugün nasıl geçti, dikkat etmek istediğin şeyler..."
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.accent}
                            multiline
                            maxLength={2000}
                            textAlignVertical="top"
                            autoFocus
                        />
                        <View style={styles.noteMetaRow}>
                            <Text style={styles.noteMetaText}>{noteDraft.length}/2000</Text>
                        </View>
                        <View style={styles.addExerciseActions}>
                            {session.notes ? (
                                <TouchableOpacity
                                    style={styles.modalSecondaryBtn}
                                    onPress={clearWorkoutNote}
                                >
                                    <Text style={[styles.modalSecondaryText, styles.modalDangerText]}>Sil</Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setNoteModalVisible(false)}
                            >
                                <Text style={styles.modalSecondaryText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalPrimaryBtn}
                                onPress={saveWorkoutNote}
                            >
                                <Text style={styles.modalPrimaryText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
                visible={addExerciseModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAddExerciseModalVisible(false)}
            >
                <View style={styles.addExerciseOverlay}>
                    <View style={styles.addExerciseModal}>
                        <Text style={styles.addExerciseTitle}>Hareket ekle</Text>
                        <TextInput
                            style={styles.addExerciseInput}
                            value={newExerciseName}
                            onChangeText={handleNewExerciseNameChange}
                            placeholder="Hareket adı"
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.accent}
                            autoFocus
                        />
                        {newExerciseLibraryItem && (
                            <View style={styles.exerciseLibrarySelected}>
                                <Ionicons name="checkmark-circle-outline" size={15} color={colors.accent} />
                                <Text style={styles.exerciseLibrarySelectedText}>Kutuphaneden secildi</Text>
                            </View>
                        )}
                        <Text style={styles.addExerciseSectionLabel}>Kutuphaneden sec</Text>
                        <ScrollView
                            style={styles.exerciseLibraryList}
                            contentContainerStyle={styles.exerciseLibraryListContent}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                        >
                            {exerciseLibraryResults.map((item) => {
                                const selected = newExerciseLibraryItem?.id === item.id;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[
                                            styles.exerciseLibraryCard,
                                            selected && styles.exerciseLibraryCardActive,
                                        ]}
                                        activeOpacity={0.84}
                                        onPress={() => selectExerciseFromLibrary(item)}
                                    >
                                        <View style={styles.exerciseLibraryCardTop}>
                                            <View style={styles.exerciseLibraryIcon}>
                                                <Ionicons name="barbell-outline" size={17} color={colors.accent} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.exerciseLibraryName}>{item.name}</Text>
                                                <Text style={styles.exerciseLibraryMeta} numberOfLines={1}>
                                                    {[...item.primaryMuscles, ...item.equipment].slice(0, 4).join(" · ")}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {exerciseLibraryResults.length === 0 && (
                                <Text style={styles.exerciseLibraryEmpty}>Sonuc yok. Hareketi serbest yazabilirsin.</Text>
                            )}
                        </ScrollView>
                        <Text style={styles.addExerciseSectionLabel}>Konum</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.positionList}
                            keyboardShouldPersistTaps="handled"
                        >
                            {session.exercises.map((exercise, index) => (
                                <TouchableOpacity
                                    key={exercise.id}
                                    style={[
                                        styles.positionChip,
                                        newExerciseIndex === index && styles.positionChipActive,
                                    ]}
                                    onPress={() => setNewExerciseIndex(index)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.positionChipText,
                                            newExerciseIndex === index && styles.positionChipTextActive,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {index + 1}. sıraya
                                    </Text>
                                    <Text
                                        style={[
                                            styles.positionChipSubText,
                                            newExerciseIndex === index && styles.positionChipTextActive,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {exercise.name || "Adsız"}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[
                                    styles.positionChip,
                                    newExerciseIndex === session.exercises.length && styles.positionChipActive,
                                ]}
                                onPress={() => setNewExerciseIndex(session.exercises.length)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.positionChipText,
                                        newExerciseIndex === session.exercises.length && styles.positionChipTextActive,
                                    ]}
                                    numberOfLines={1}
                                >
                                    En sona
                                </Text>
                                <Text
                                    style={[
                                        styles.positionChipSubText,
                                        newExerciseIndex === session.exercises.length && styles.positionChipTextActive,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {session.exercises.length + 1}. sıra
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                        <View style={styles.addExerciseActions}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setAddExerciseModalVisible(false)}
                            >
                                <Text style={styles.modalSecondaryText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalPrimaryBtn,
                                    !newExerciseName.trim() && styles.modalPrimaryBtnDisabled,
                                ]}
                                onPress={addExerciseAtSelectedPosition}
                                disabled={!newExerciseName.trim()}
                            >
                                <Text style={styles.modalPrimaryText}>Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {isWeb ? (
                <ScrollView
                    ref={webScrollRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                >
                    {renderHeader()}
                    {session.exercises.map((exercise, index) => (
                        <React.Fragment key={exercise.id}>
                            {renderExerciseItem({
                                item: exercise,
                                getIndex: () => index,
                                drag: () => undefined,
                                isActive: false,
                            } as RenderItemParams<WorkoutExercise>)}
                        </React.Fragment>
                    ))}
                    {renderFooter()}
                </ScrollView>
            ) : (
                <DraggableFlatList
                    data={session.exercises}
                    onDragEnd={({ data }: { data: WorkoutExercise[] }) => updateSession(prev => ({ ...prev, exercises: data }))}
                    keyExtractor={(item: WorkoutExercise) => item.id}
                    renderItem={renderExerciseItem}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    containerStyle={styles.scrollView}
                />
            )}
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
    infoBtn: {
        width: 38,
        minHeight: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: spacing.sm,
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
        marginBottom: spacing.md,
        paddingVertical: spacing.sm,
    },
    sessionNoteBtn: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
    },
    sessionNoteBtnActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    sessionNoteBtnText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    sessionNoteBtnTextActive: {
        color: colors.background,
    },
    sessionNotePreview: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.lg,
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
    exerciseSettingsBtn: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        marginLeft: spacing.xs,
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
    setBlock: {
        marginBottom: spacing.sm,
    },
    setRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    unilateralSetRow: {
        marginBottom: spacing.xs,
    },
    unilateralPanel: {
        marginLeft: 54,
        marginRight: spacing.sm,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        gap: spacing.xs,
    },
    unilateralRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    unilateralLabel: {
        width: 34,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    unilateralInput: {
        flex: 1,
        minHeight: 38,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        textAlign: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
    },
    unilateralHint: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        lineHeight: 16,
    },
    warmupSetRow: {
        opacity: 0.75,
        borderLeftWidth: 3,
        borderLeftColor: colors.textMuted,
        paddingLeft: spacing.xs,
    },
    setDragHandle: {
        flex: 0.5,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    warmupSetDragHandle: {
        opacity: 0.95,
    },
    setNumber: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
        textAlign: "center",
    },
    warmupSetNumber: {
        fontStyle: "italic",
        color: colors.textMuted,
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
    exceptionInput: {
        borderColor: colors.accent,
        color: colors.accent,
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
    recentlyAddedExerciseCard: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    webExerciseOrderHandle: {
        gap: 2,
        paddingRight: spacing.sm,
        alignItems: "center",
    },
    webSetOrderHandle: {
        flexDirection: "row",
        gap: 4,
    },
    webOrderButtons: {
        gap: 2,
    },
    webOrderBtn: {
        width: 22,
        height: 18,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceLight,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    webOrderBtnDisabled: {
        opacity: 0.35,
    },
    listHeader: {
        marginBottom: spacing.md,
    },
    listFooter: {
        marginTop: spacing.md,
    },
    cardioAddBtn: {
        minHeight: 50,
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
    },
    cardioAddText: {
        color: colors.accent,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    cardioSummaryCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    cardioSummaryTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    cardioSummaryText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        marginTop: spacing.xs,
    },
    cardioAddSmallBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    cardioListItem: {
        minHeight: 58,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    cardioListTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    cardioListText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        marginTop: 2,
    },

    // Add Set
    addSetRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    addSetBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceElevated,
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
    addExerciseOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.62)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    addExerciseModal: {
        width: "100%",
        maxWidth: 440,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    addExerciseTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.md,
    },
    bodyWeightModalText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    addExerciseInput: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
    },
    exerciseLibrarySelected: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    exerciseLibrarySelectedText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    exerciseLibraryList: {
        maxHeight: 230,
        marginBottom: spacing.md,
    },
    exerciseLibraryListContent: {
        gap: spacing.sm,
        paddingBottom: spacing.xs,
    },
    exerciseLibraryCard: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        padding: spacing.sm,
    },
    exerciseLibraryCardActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    exerciseLibraryCardTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    exerciseLibraryIcon: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceLight,
    },
    exerciseLibraryName: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    exerciseLibraryMeta: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    exerciseLibraryEmpty: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        textAlign: "center",
        paddingVertical: spacing.md,
    },
    sessionNoteInput: {
        minHeight: 132,
        fontWeight: fontWeight.regular,
        textAlignVertical: "top",
    },
    noteMetaRow: {
        alignItems: "flex-end",
        marginTop: -spacing.sm,
        marginBottom: spacing.sm,
    },
    noteMetaText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
    },
    setSettingsHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    setSettingsSubtitle: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        marginTop: -spacing.sm,
    },
    setSettingsCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    setSettingsList: {
        maxHeight: 360,
    },
    setSettingsListContent: {
        gap: spacing.sm,
        paddingBottom: spacing.sm,
    },
    setSettingsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    setSettingsSetBadge: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceLight,
    },
    setSettingsSetText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    setSettingsControls: {
        flex: 1,
        gap: spacing.xs,
    },
    segmentedControl: {
        flexDirection: "row",
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.sm,
        padding: 3,
        gap: 3,
    },
    segmentBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 30,
        borderRadius: borderRadius.sm,
    },
    segmentBtnActive: {
        backgroundColor: colors.accent,
    },
    segmentText: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    segmentTextActive: {
        color: colors.background,
    },
    modalDangerText: {
        color: colors.error,
    },
    addExerciseSectionLabel: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    positionList: {
        gap: spacing.sm,
        paddingBottom: spacing.xs,
    },
    positionChip: {
        width: 116,
        minHeight: 58,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        justifyContent: "center",
    },
    positionChipActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    positionChipText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    positionChipSubText: {
        marginTop: 2,
        fontSize: fontSize.xs,
        color: colors.textMuted,
    },
    positionChipTextActive: {
        color: colors.background,
    },
    addExerciseActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    modalSecondaryBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
    },
    modalSecondaryText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
    },
    modalPrimaryBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
    },
    modalPrimaryBtnDisabled: {
        opacity: 0.45,
    },
    modalPrimaryText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },

    // Finish
    finishBtn: {
        marginBottom: spacing.lg,
    },
});
