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
    Keyboard,
    InputAccessoryView,
    AppState,
    Modal,
    Animated,
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
    CardioBlock,
    WarmupRoutineLog,
    WarmupRoutineTemplate,
} from "../types/workout";
import DraggableFlatList, {
    RenderItemParams,
} from "react-native-draggable-flatlist";
import {
    saveActiveSession,
    clearActiveSession,
    restoreActiveSession,
    saveFinishingSession,
    clearFinishingSession,
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
import { reschedulePreWorkoutRemindersForProgram } from "../services/localNotificationService";
import { applyProgramDayIndex } from "../services/programDayProgressService";
import { clearOnboardingTrainingPending } from "../utils/appTourEvents";
import { getCachedWorkouts } from "../services/workoutCacheService";

// ─── Constants ───────────────────────────────

// Default Fitness sport ID — replace with dynamic value when sports API ready
const DEFAULT_SPORT_ID = "00000000-0000-0000-0000-000000000001";
const AUTOSAVE_DEBOUNCE_MS = 500;
const ADDED_EXERCISE_HIGHLIGHT_MS = 1400;
const ADDED_EXERCISE_FADE_OUT_MS = 900;
const IOS_NUMERIC_ACCESSORY_ID = "workout-session-numeric-toolbar";
const TRAINING_TIPS = [
    "Ilk sette hedef tekrar araligina ulasabilecegin kontrollu bir agirlik sec.",
    "Seti bitirince kg ve tekrar alanlarini hemen logla.",
    "RPE/RIR biliyorsan ekle; koc analizi bu verilerle daha dogru calisir.",
    "Seti tamamlandi olarak isaretle ve siradaki sete gecmeden hazir hisset.",
    "Hareketleri program sirasi ile takip etmeye calis; gerekiyorsa sirayi sonra degistirebilirsin.",
    "Demo bittiginde antrenmani bitir butonuyla akisi tamamla.",
];

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

function hasLoggedWarmupRoutineData(routine?: WarmupRoutineLog): boolean {
    if (!routine) return false;
    return !!routine.steps?.some((step) => step.completed) ||
        !!routine.exercises?.some((exercise) =>
            exercise.name.trim().length > 0 &&
            exercise.sets.some(hasLoggedSetData),
        ) ||
        !!routine.cardioBlocks?.some((block) =>
            Number(block.totalDuration) > 0 ||
            Number(block.totalDistance) > 0 ||
            Number(block.totalSteps) > 0 ||
            Number(block.totalCalories) > 0 ||
            !!block.completedAt ||
            (Array.isArray(block.stages) && block.stages.length > 0),
        );
}

function hasWarmupRoutineContent(routine?: WarmupRoutineLog): boolean {
    if (!routine) return false;
    return !!routine.steps?.length || !!routine.exercises?.length || !!routine.cardioBlocks?.length;
}

function hasMainWorkoutLoggedData(session: WorkoutSession): boolean {
    return hasLoggedCardioData(session) || session.exercises.some((exercise) =>
        exercise.name.trim().length > 0 &&
        exercise.sets.some(hasLoggedSetData),
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
    return hasMainWorkoutLoggedData(session) || hasLoggedWarmupRoutineData(session.warmupRoutine);
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
            warmupRoutine: data.warmupRoutine,
        };
    }

    // Legacy flat exercises structure
    if (Array.isArray(data.exercises)) {
        return {
            exercises: data.exercises,
            warmupRoutine: data.warmupRoutine,
        } as ProgramData;
    }

    console.warn("[WorkoutSession] normalizeProgramData: Unsupported programData shape", {
        keys: Object.keys(data || {}),
    });
    return null;
}

function buildWarmupRoutineLog(template: WarmupRoutineTemplate | any[] | undefined): WarmupRoutineLog | undefined {
    if (!template) return undefined;
    const startedAt = new Date().toISOString();

    if (Array.isArray(template)) {
        if (template.length === 0) return undefined;
        return {
            status: "pending",
            startedAt,
            steps: template.map((step: any) => ({ ...step, completed: false })),
        };
    }

    const exercises: WorkoutExercise[] = (template.exercises || [])
        .filter((exercise: any) => String(exercise?.name || "").trim())
        .map((exercise: any) => ({
            id: uid(),
            exerciseId: exercise.exerciseId,
            name: String(exercise.name || "").trim(),
            targetReps: exercise.targetSets?.[0]?.targetReps,
            targetPattern: exercise.targetPattern,
            targetMuscle: exercise.targetMuscle,
            primaryMuscles: exercise.primaryMuscles,
            equipment: exercise.equipment,
            riskAdjusted: exercise.riskAdjusted,
            painWarning: exercise.painWarning,
            logDisabled: exercise.logDisabled,
            logDisabledReason: exercise.logDisabledReason,
            supersetGroupId: exercise.supersetGroupId,
            supersetLabel: exercise.supersetLabel,
            supersetRestHint: exercise.supersetRestHint,
            sets: (exercise.targetSets?.length ? exercise.targetSets : [{ targetReps: "10-15" }]).map((targetSet: TargetSet) => ({
                id: uid(),
                weight: 0,
                reps: 0,
                weightMode: targetSet?.weightMode === "bodyweight" ? "bodyweight" as const : "kg" as const,
                effortMode: targetSet?.effortMode === "duration" || String(targetSet?.targetReps || "").toLowerCase().includes("sn") ? "duration" as const : "reps" as const,
                durationSeconds: 0,
                rpe: 0,
                unit: "kg" as const,
                completed: false,
                targetReps: targetSet?.targetReps,
                targetWeight: targetSet?.targetWeight,
                targetRPE: targetSet?.targetRPE,
                targetRIR: targetSet?.targetRIR,
                sideMode: targetSet?.sideMode === "left_right" ? "left_right" as const : "both" as const,
                left: targetSet?.sideMode === "left_right" ? {} : undefined,
                right: targetSet?.sideMode === "left_right" ? {} : undefined,
            })),
        }));

    const cardioBlocks: CardioBlock[] = (template.cardioBlocks || []).map((block: any) => ({
        id: block.id || uid(),
        type: block.type || "other",
        title: block.title || "Kardiyo",
        startedAt,
        totalDuration: Number(block.totalDuration) || 0,
        stages: [],
    }));

    if (exercises.length === 0 && cardioBlocks.length === 0 && !(template.steps || []).length) return undefined;

    return {
        status: "pending",
        startedAt,
        steps: template.steps?.map((step: any) => ({ ...step, completed: false })),
        exercises,
        cardioBlocks,
    };
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
        exercise?.exerciseId ? `id:${String(exercise.exerciseId).trim().toLowerCase()}` : "",
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

function normalizePreviousLookupPayload(payload: any): Record<string, any> {
    const lookup = payload?.lookup || payload?.data?.lookup || {};
    return lookup && typeof lookup === "object" && !Array.isArray(lookup) ? lookup : {};
}

function getPreviousLookupEntry(previousLookup: Map<string, any>, exercise: any): any {
    for (const key of exerciseLookupKeys(exercise)) {
        const direct = previousLookup.get(key);
        if (direct) return direct;
        const normalized = previousLookup.get(key.toLowerCase());
        if (normalized) return normalized;
    }
    return {};
}

function hasPreviousLookupData(entry: any): boolean {
    return Boolean(
        (Array.isArray(entry?.weights) && entry.weights.length > 0) ||
        (Array.isArray(entry?.reps) && entry.reps.length > 0) ||
        (Array.isArray(entry?.durations) && entry.durations.length > 0) ||
        (Array.isArray(entry?.left?.weights) && entry.left.weights.length > 0) ||
        (Array.isArray(entry?.left?.reps) && entry.left.reps.length > 0) ||
        (Array.isArray(entry?.right?.weights) && entry.right.weights.length > 0) ||
        (Array.isArray(entry?.right?.reps) && entry.right.reps.length > 0),
    );
}

function mergeCachedPreviousPlaceholders(previousLookup: Map<string, any>, workouts: any[], exercises: any[]) {
    if (!Array.isArray(workouts) || workouts.length === 0) return;

    const weightLookup = buildPreviousWeightLookup(workouts);
    const repsLookup = buildPreviousRepsLookup(workouts);

    exercises.forEach((exercise) => {
        if (hasPreviousLookupData(getPreviousLookupEntry(previousLookup, exercise))) return;

        const keys = exerciseLookupKeys(exercise);
        const weights = keys
            .map((key) => weightLookup.get(key) || weightLookup.get(key.toLowerCase()))
            .find((values) => Array.isArray(values) && values.length > 0) || [];
        const reps = keys
            .map((key) => repsLookup.get(key) || repsLookup.get(key.toLowerCase()))
            .find((values) => Array.isArray(values) && values.length > 0) || [];

        if (weights.length === 0 && reps.length === 0) return;

        const cachedEntry = {
            weights,
            reps,
            durations: [],
            weightModes: [],
            effortModes: [],
            sideModes: [],
        };
        keys.forEach((key) => previousLookup.set(key.toLowerCase(), cachedEntry));
    });
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
    const [preWorkoutWarmupVisible, setPreWorkoutWarmupVisible] = useState(false);
    const [exerciseNameNotice, setExerciseNameNotice] = useState<string | null>(null);
    const [exitModalVisible, setExitModalVisible] = useState(false);
    const [exitModalHasData, setExitModalHasData] = useState(false);
    const [addExerciseModalVisible, setAddExerciseModalVisible] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState("");
    const [newExerciseLibraryItem, setNewExerciseLibraryItem] = useState<ExerciseLibraryItem | null>(null);
    const [newExerciseIndex, setNewExerciseIndex] = useState(0);
    const recentlyAddedExerciseGlow = useRef(new Animated.Value(0)).current;
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
    const isTrainingDemo = route.params?.trainingMode === "onboarding_demo";
    const [trainingTipIndex, setTrainingTipIndex] = useState(0);

    // Use a ref for finishing flag so beforeRemove always has the latest value
    // (avoids stale closure problem where state is captured at render time)
    const finishingRef = useRef(false);
    // Permanent flag: once the workout is saved & navigating away, never restore or auto-save again
    const completedRef = useRef(false);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRefs = useRef<Record<string, TextInput | null>>({});
    const webScrollRef = useRef<ScrollView | null>(null);
    const mobileListRef = useRef<any>(null);
    const pendingExitActionRef = useRef<any>(null);
    const freeWorkoutNameConfirmedRef = useRef(false);
    const freeWorkoutNameOverrideRef = useRef<string | null>(null);
    const qualityCheckedSessionRef = useRef<WorkoutSession | null>(null);
    const preWorkoutReminderShownRef = useRef(false);
    const preWorkoutWarmupShownRef = useRef(false);
    const [focusedInputKey, setFocusedInputKey] = useState<string | null>(null);

    const inputKey = useCallback((exIndex: number, setIndex: number, field: "weight" | "reps" | "rpe" | "rir") =>
        `ex-${exIndex}-set-${setIndex}-${field}`, []);

    const registerInput = useCallback((key: string, el: TextInput | null) => {
        inputRefs.current[key] = el;
    }, []);

    const focusInputByKey = useCallback((key?: string) => {
        if (!key) {
            Keyboard.dismiss();
            return;
        }
        const nextInput = inputRefs.current[key];
        if (nextInput) {
            nextInput.focus();
        } else {
            Keyboard.dismiss();
        }
    }, []);

    const getOrderedInputKeys = useCallback(() => {
        const keys: string[] = [];
        session.exercises.forEach((exercise, exIndex) => {
            exercise.sets.forEach((set, setIndex) => {
                if (set.sideMode === "left_right") return;
                if (set.weightMode !== "bodyweight") keys.push(inputKey(exIndex, setIndex, "weight"));
                keys.push(inputKey(exIndex, setIndex, "reps"));
                if (rpeMode === "rpe" || rpeMode === "both") keys.push(inputKey(exIndex, setIndex, "rpe"));
                if (rpeMode === "rir" || rpeMode === "both") keys.push(inputKey(exIndex, setIndex, "rir"));
            });
        });
        return keys.filter((key) => !!inputRefs.current[key]);
    }, [inputKey, rpeMode, session.exercises]);

    const focusAdjacentInput = useCallback((direction: "previous" | "next") => {
        const keys = getOrderedInputKeys();
        if (keys.length === 0) {
            Keyboard.dismiss();
            return;
        }
        const currentIndex = focusedInputKey ? keys.indexOf(focusedInputKey) : -1;
        const fallbackIndex = direction === "next" ? 0 : keys.length - 1;
        const nextIndex = currentIndex >= 0
            ? currentIndex + (direction === "next" ? 1 : -1)
            : fallbackIndex;
        if (nextIndex < 0 || nextIndex >= keys.length) {
            Keyboard.dismiss();
            return;
        }
        focusInputByKey(keys[nextIndex]);
    }, [focusInputByKey, focusedInputKey, getOrderedInputKeys]);

    const focusNext = useCallback((exIndex: number, setIndex: number, field: "weight" | "reps" | "rpe" | "rir") => {
        let candidates: string[] = [];
        if (field === "weight") candidates = [inputKey(exIndex, setIndex, "reps")];
        else if (field === "reps") {
            if (rpeMode === "rpe" || rpeMode === "both") candidates.push(inputKey(exIndex, setIndex, "rpe"));
            if (rpeMode === "rir" || rpeMode === "both") candidates.push(inputKey(exIndex, setIndex, "rir"));
            candidates.push(inputKey(exIndex, setIndex + 1, "weight"));
        } else if (field === "rpe") {
            if (rpeMode === "both") candidates.push(inputKey(exIndex, setIndex, "rir"));
            candidates.push(inputKey(exIndex, setIndex + 1, "weight"));
        } else if (field === "rir") candidates = [inputKey(exIndex, setIndex + 1, "weight")];

        focusInputByKey(candidates.find((key) => !!inputRefs.current[key]));
    }, [focusInputByKey, inputKey, rpeMode]);

    // ─── Decimal Input Cache ─────────────────
    // Stores raw text per input so users can type "72." or "72,5" without
    // the dot/comma being stripped by parseFloat on every keystroke.
    const [textCache, setTextCache] = useState<Record<string, string>>({});

    const cacheKey = (exerciseId: string, setId: string, field: string) =>
        `${exerciseId}-${setId}-${field}`;

    const sideCacheKey = (exerciseId: string, setId: string, side: "left" | "right", field: string) =>
        `${exerciseId}-${setId}-${side}-${field}`;

    const normalizeDecimalText = (text: string) => {
        const normalized = text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
        const firstDotIndex = normalized.indexOf(".");
        if (firstDotIndex === -1) return normalized;
        return `${normalized.slice(0, firstDotIndex + 1)}${normalized.slice(firstDotIndex + 1).replace(/\./g, "")}`;
    };

    const clearTextCacheKey = (key: string) => {
        setTextCache((prev) => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const getTextValue = (
        exerciseId: string,
        setId: string,
        field: string,
        numericValue: number | string,
        options: { showZero?: boolean } = {},
    ): string => {
        const key = cacheKey(exerciseId, setId, field);
        if (key in textCache) return textCache[key];
        if (typeof numericValue === 'string') return numericValue || "";
        if (numericValue === 0) return options.showZero ? "0" : "";
        return numericValue > 0 ? String(numericValue) : "";
    };

    const getSideTextValue = (
        exerciseId: string,
        setId: string,
        side: "left" | "right",
        field: string,
        value: unknown,
        formatter?: (value: any) => string,
        options: { showZero?: boolean } = {},
    ) => {
        const key = sideCacheKey(exerciseId, setId, side, field);
        if (key in textCache) return textCache[key];
        if (formatter) return formatter(value);
        if (value === 0) return options.showZero ? "0" : "";
        return value ? String(value) : "";
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

        if (field === "durationSeconds") {
            updateSet(exerciseId, setId, field as any, parseDurationInput(normalized));
            return;
        }

        if (field === "rir") {
            const currentSet = session.exercises
                .find((exercise) => exercise.id === exerciseId)
                ?.sets.find((set) => set.id === setId);
            const repsKey = cacheKey(exerciseId, setId, "reps");
            const repsRaw = textCache[repsKey];
            const repsForClamp = repsRaw !== undefined ? parseInt(repsRaw, 10) || 0 : currentSet?.reps;
            updateSet(exerciseId, setId, field as any, normalizeRirLogValue(normalized, repsForClamp) ?? "");
            return;
        }

        const nextValue = field === "reps"
            ? (parseInt(normalized, 10) || 0)
            : field === "rpe"
                ? clampRpe(normalized)
                : (parseFloat(normalized) || 0);
        updateSet(exerciseId, setId, field as any, nextValue);
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

        if (set.sideMode !== "left_right" && weightRaw !== undefined) {
            nextSet.weight = parseFloat(weightRaw) || 0;
        }
        if (set.sideMode !== "left_right" && repsRaw !== undefined) {
            nextSet.reps = parseInt(repsRaw, 10) || 0;
        }
        if (set.sideMode !== "left_right" && durationRaw !== undefined) {
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
                const saved = isTrainingDemo ? null : await restoreActiveSession();
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
                const dayWarmupRoutine = isCycle
                    ? days![dayIndex % days!.length]?.warmupRoutine
                    : (normalized as any).warmupRoutine;
                const programTrackingMode = inferTrackingModeFromExercises(templateExercises);

                if (templateExercises.length > 0) {
                    const dayLabel = isCycle
                        ? days![dayIndex % days!.length]?.label
                        : undefined;
                    const title = dayLabel
                        ? `${programName ?? "Antrenman"} · ${dayLabel}`
                        : (programName ?? "Antrenman");

                    let previousLookup = new Map<string, any>();
                    try {
                        const lookupKeys = Array.from(new Set(templateExercises.flatMap((exercise) => exerciseLookupKeys(exercise))));
                        if (lookupKeys.length > 0) {
                            const lookupRes = await workoutApi.previousSetLookup(lookupKeys);
                            const lookup = normalizePreviousLookupPayload(lookupRes.data);
                            previousLookup = new Map(
                                Object.entries(lookup).map(([key, value]) => [key.toLowerCase(), value]),
                            );
                        }
                    } catch (err) {
                        console.warn("[WorkoutSession] Previous set placeholders could not be loaded:", err);
                    }

                    const hasMissingPreviousPlaceholders = templateExercises.some(
                        (exercise) => !hasPreviousLookupData(getPreviousLookupEntry(previousLookup, exercise)),
                    );
                    if (hasMissingPreviousPlaceholders) {
                        try {
                            const cachedWorkouts = await getCachedWorkouts(80);
                            mergeCachedPreviousPlaceholders(previousLookup, cachedWorkouts, templateExercises);
                        } catch (err) {
                            console.warn("[WorkoutSession] Cached previous placeholders could not be loaded:", err);
                        }
                    }

                    const newExercises: WorkoutExercise[] = templateExercises.map((templateEx: any) => {
                        const targetSet = templateEx.targetSets?.[0] ?? templateEx.sets?.[0];
                        const exercisePreviousLookup = getPreviousLookupEntry(previousLookup, templateEx);
                        const exercisePreviousWeights = Array.isArray(exercisePreviousLookup?.weights) ? exercisePreviousLookup.weights : [];
                        const exercisePreviousReps = rememberRepsEnabled && Array.isArray(exercisePreviousLookup?.reps) ? exercisePreviousLookup.reps : [];
                        const exercisePreviousDurations = Array.isArray(exercisePreviousLookup?.durations) ? exercisePreviousLookup.durations : [];
                        const exercisePreviousLeft = exercisePreviousLookup?.left || {};
                        const exercisePreviousRight = exercisePreviousLookup?.right || {};
                        let workingSetIndex = 0;
                        let repsSetIndex = 0;
                        let durationSetIndex = 0;
                        let sideSetIndex = 0;
                        return {
                            id: uid(),
                            exerciseId: templateEx.exerciseId,
                            name: templateEx.name,
                            targetReps: targetSet?.targetReps,
                            targetWeight: targetSet?.targetWeight,
                            targetRPE: targetSet?.targetRPE,
                            targetRIR: targetSet?.targetRIR,
                            targetPattern: templateEx.targetPattern,
                            targetMuscle: templateEx.targetMuscle,
                            primaryMuscles: templateEx.primaryMuscles,
                            equipment: templateEx.equipment,
                            riskAdjusted: templateEx.riskAdjusted,
                            painWarning: templateEx.painWarning,
                            logDisabled: templateEx.logDisabled,
                            logDisabledReason: templateEx.logDisabledReason,
                            supersetGroupId: templateEx.supersetGroupId,
                            supersetLabel: templateEx.supersetLabel,
                            supersetRestHint: templateEx.supersetRestHint,
                            sets: (templateEx.targetSets ?? templateEx.sets ?? [{}]).map((ts: TargetSet) => {
                                const isWarmup = !!ts?.isWarmup;
                                const previousWeight = isWarmup
                                    ? undefined
                                    : exercisePreviousWeights[workingSetIndex++];
                                const previousRepsValue = isWarmup
                                    ? undefined
                                    : exercisePreviousReps[repsSetIndex++];
                                const previousDurationValue = isWarmup
                                    ? undefined
                                    : exercisePreviousDurations[durationSetIndex++];
                                const previousLeft = !isWarmup && ts?.sideMode === "left_right"
                                    ? {
                                        targetWeight: exercisePreviousLeft.weights?.[sideSetIndex] ? String(exercisePreviousLeft.weights[sideSetIndex]) : undefined,
                                        targetReps: rememberRepsEnabled && exercisePreviousLeft.reps?.[sideSetIndex] ? String(exercisePreviousLeft.reps[sideSetIndex]) : undefined,
                                        targetDuration: exercisePreviousLeft.durations?.[sideSetIndex] ? formatDurationInput(exercisePreviousLeft.durations[sideSetIndex]) : undefined,
                                    }
                                    : undefined;
                                const previousRight = !isWarmup && ts?.sideMode === "left_right"
                                    ? {
                                        targetWeight: exercisePreviousRight.weights?.[sideSetIndex] ? String(exercisePreviousRight.weights[sideSetIndex]) : undefined,
                                        targetReps: rememberRepsEnabled && exercisePreviousRight.reps?.[sideSetIndex] ? String(exercisePreviousRight.reps[sideSetIndex]) : undefined,
                                        targetDuration: exercisePreviousRight.durations?.[sideSetIndex] ? formatDurationInput(exercisePreviousRight.durations[sideSetIndex]) : undefined,
                                    }
                                    : undefined;
                                if (!isWarmup && ts?.sideMode === "left_right") sideSetIndex++;
                                return {
                                    id: uid(),
                                    weight: 0,
                                    reps: 0,
                                    weightMode: ts?.weightMode === "bodyweight" ? "bodyweight" as const : "kg" as const,
                                    effortMode: ts?.effortMode === "duration" ? "duration" as const : "reps" as const,
                                    durationSeconds: 0,
                                    rpe: 0,
                                    unit: "kg" as const,
                                    completed: false,
                                    isWarmup,
                                    targetReps: previousRepsValue ? String(previousRepsValue) : previousDurationValue ? formatDurationInput(previousDurationValue) : ts?.targetReps,
                                    targetWeight: previousWeight ? String(previousWeight) : ts?.targetWeight,
                                    targetRPE: ts?.targetRPE,
                                    targetRIR: ts?.targetRIR,
                                    sideMode: ts?.sideMode === "left_right" ? "left_right" as const : "both" as const,
                                    left: ts?.sideMode === "left_right" ? previousLeft || {} : undefined,
                                    right: ts?.sideMode === "left_right" ? previousRight || {} : undefined,
                                };
                            }),
                        };
                    });
                    const newSession: WorkoutSession = {
                        ...createSession(),
                        title,
                        exercises: newExercises,
                        warmupRoutine: buildWarmupRoutineLog(dayWarmupRoutine),
                        programId: programId,
                        dayIndex,
                    };
                    setSession(newSession);
                    setRpeMode(programTrackingMode);
                    setElapsed(0);
                    if (!isTrainingDemo) {
                        await saveActiveSession(newSession);
                    }
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
            if (isTrainingDemo) return;
            if (!restored || finishingRef.current || completedRef.current) return;
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

        recentlyAddedExerciseGlow.stopAnimation();
        recentlyAddedExerciseGlow.setValue(1);
        const timer = setTimeout(() => {
            Animated.timing(recentlyAddedExerciseGlow, {
                toValue: 0,
                duration: ADDED_EXERCISE_FADE_OUT_MS,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setRecentlyAddedExerciseId(null);
            });
        }, ADDED_EXERCISE_HIGHLIGHT_MS);

        return () => {
            clearTimeout(timer);
            recentlyAddedExerciseGlow.stopAnimation();
        };
    }, [recentlyAddedExerciseGlow, recentlyAddedExerciseId]);

    useEffect(() => {
        if (isTrainingDemo) return;
        const programId = route.params?.programId;
        const dayIndex = route.params?.dayIndex ?? 0;
        const dayReminder = programId
            ? user?.settings?.pre_workout_reminders_by_program?.[programId]?.days?.[String(dayIndex)]
            : undefined;
        const note = String(dayReminder?.note || "").trim();
        if (
            preWorkoutReminderShownRef.current ||
            !programId ||
            dayReminder?.enabled !== true ||
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
        route.params?.dayIndex,
        route.params?.programId,
        session.exercises.length,
        session.id,
        user?.settings?.pre_workout_reminders_by_program,
    ]);

    useEffect(() => {
        if (isTrainingDemo) return;
        if (
            preWorkoutWarmupShownRef.current ||
            route.params?.mode === "free" ||
            session.warmupRoutine?.status !== "pending" ||
            !hasWarmupRoutineContent(session.warmupRoutine)
        ) {
            return;
        }

        preWorkoutWarmupShownRef.current = true;
        setPreWorkoutWarmupVisible(true);
    }, [route.params?.mode, session.id, session.warmupRoutine]);

    // ─── Debounced Auto-Save ─────────────────
    useEffect(() => {
        if (isTrainingDemo) return;
        if (!restored || finishingRef.current || completedRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            if (finishingRef.current || completedRef.current) return;
            const nextSession = { ...getSessionWithCachedInputs(), totalDuration: elapsed };
            saveActiveSession(nextSession);
        }, AUTOSAVE_DEBOUNCE_MS);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [elapsed, getSessionWithCachedInputs, restored]);

    useEffect(() => {
        if (isTrainingDemo) return;
        if (!restored) return;

        const persistNow = () => {
            if (finishingRef.current || completedRef.current) return;
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

    const setWarmupRoutineStatus = useCallback(async (status: "completed" | "skipped" | "cancelled") => {
        if (isTrainingDemo) {
            setPreWorkoutWarmupVisible(false);
            return;
        }
        const currentSession = materializeSessionInputs();
        const nextSession = {
            ...currentSession,
            warmupRoutine: currentSession.warmupRoutine
                ? {
                    ...currentSession.warmupRoutine,
                    status,
                    completedAt: new Date().toISOString(),
                    steps: status === "completed"
                        ? currentSession.warmupRoutine.steps?.map((step) => ({ ...step, completed: true }))
                        : currentSession.warmupRoutine.steps,
                }
                : currentSession.warmupRoutine,
        };
        setSession(nextSession);
        await saveActiveSession({ ...nextSession, totalDuration: elapsed });
        setPreWorkoutWarmupVisible(false);
    }, [elapsed, isTrainingDemo, materializeSessionInputs]);

    const openWarmupSession = useCallback(async () => {
        if (isTrainingDemo) {
            setPreWorkoutWarmupVisible(false);
            setConceptNotice({
                title: "Egitim modu",
                message: "Bu demoda ana set loglama akisini ogreniyoruz. Isinma rutinini gercek antrenmanda kullanabilirsin.",
            });
            return;
        }
        const currentSession = materializeSessionInputs();
        if (!currentSession.warmupRoutine || hasMainWorkoutLoggedData(currentSession)) {
            setPreWorkoutWarmupVisible(false);
            return;
        }
        const nextSession = {
            ...currentSession,
            warmupRoutine: {
                ...currentSession.warmupRoutine,
                status: "pending" as const,
                startedAt: currentSession.warmupRoutine.startedAt || new Date().toISOString(),
            },
        };
        setSession(nextSession);
        await saveActiveSession({ ...nextSession, totalDuration: elapsed });
        setPreWorkoutWarmupVisible(false);
        navigation.navigate("WarmupSession");
    }, [elapsed, isTrainingDemo, materializeSessionInputs, navigation]);

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
        field: "weight" | "reps" | "durationSeconds" | "rpe" | "rir",
        rawValue: string,
    ) => {
        const repsForSide = Number((set[side] || {}).reps) || Number(set.reps) || undefined;
        const normalizedRaw = field === "weight"
            ? normalizeDecimalText(rawValue)
            : field === "reps" || field === "rpe"
                ? rawValue.replace(/[^0-9]/g, "")
                : rawValue.replace(/,/g, ".");
        setTextCache((prev) => ({
            ...prev,
            [sideCacheKey(exerciseId, set.id, side, field)]: normalizedRaw,
        }));
        const value = field === "durationSeconds"
            ? parseDurationInput(normalizedRaw)
            : field === "rir"
                ? (normalizeRirLogValue(normalizedRaw, repsForSide) ?? "")
                : field === "rpe"
                    ? clampRpe(normalizedRaw)
                    : field === "weight"
                        ? (normalizedRaw === "" || normalizedRaw === "." ? "" : Number(normalizedRaw) || 0)
                        : Number(normalizedRaw) || 0;
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
        const leftRpe = Number(left.rpe) || 0;
        const rightRpe = Number(right.rpe) || 0;
        const leftRir = left.rir === "" || left.rir === undefined || left.rir === null ? undefined : Number(left.rir);
        const rightRir = right.rir === "" || right.rir === undefined || right.rir === null ? undefined : Number(right.rir);
        const hasLeftRir = typeof leftRir === "number" && Number.isFinite(leftRir);
        const hasRightRir = typeof rightRir === "number" && Number.isFinite(rightRir);

        updateSetPatch(exerciseId, set.id, {
            sideMode: "left_right",
            left,
            right,
            weight: leftWeight > 0 && rightWeight > 0 ? Math.min(leftWeight, rightWeight) : Math.max(leftWeight, rightWeight, Number(set.weight) || 0),
            reps: leftReps > 0 && rightReps > 0 ? Math.min(leftReps, rightReps) : Math.max(leftReps, rightReps, Number(set.reps) || 0),
            durationSeconds: leftDuration > 0 && rightDuration > 0 ? Math.min(leftDuration, rightDuration) : Math.max(leftDuration, rightDuration, Number(set.durationSeconds) || 0),
            rpe: leftRpe > 0 && rightRpe > 0 ? Math.max(leftRpe, rightRpe) : Math.max(leftRpe, rightRpe, Number(set.rpe) || 0),
            rir: hasLeftRir && hasRightRir ? Math.min(leftRir, rightRir) : hasLeftRir ? leftRir : hasRightRir ? rightRir : set.rir,
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

    const markSetCompleted = useCallback((exerciseId: string, setId: string) => {
        updateSetPatch(exerciseId, setId, { completed: true });
    }, [updateSetPatch]);

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

    const scrollToExerciseIndex = useCallback((index: number, attempt = 0) => {
        const safeIndex = Math.max(0, index);
        const estimatedOffset = Math.max(0, safeIndex * 260);
        try {
            if (isWeb) {
                webScrollRef.current?.scrollTo({ y: estimatedOffset, animated: true });
                return;
            }
            const list = mobileListRef.current;
            if (list?.scrollToIndex) {
                list.scrollToIndex({ index: safeIndex, animated: true, viewPosition: 0.18 });
                return;
            }
            if (list?.scrollToOffset) {
                list.scrollToOffset({ offset: estimatedOffset, animated: true });
                return;
            }
        } catch {
            if (attempt < 3) {
                setTimeout(() => scrollToExerciseIndex(safeIndex, attempt + 1), 120);
            }
        }
    }, [isWeb]);

    const addExerciseAtSelectedPosition = useCallback(() => {
        Keyboard.dismiss();
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
        setTimeout(() => scrollToExerciseIndex(insertIndex), 180);
    }, [newExerciseIndex, newExerciseLibraryItem, newExerciseName, scrollToExerciseIndex, session.exercises.length, updateSession]);

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
        if (isTrainingDemo) {
            navigation.replace("MainTabs");
            return;
        }
        await clearActiveSession();
        navigation.goBack();
    }, [isTrainingDemo, navigation]);

    const leaveTrainingDemo = useCallback(async (mode: "continue_later" | "close") => {
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
        if (mode === "close") {
            await clearOnboardingTrainingPending();
        }
        pendingExitActionRef.current = null;
        navigation.replace("MainTabs");
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

        if (isTrainingDemo) {
            // Demo sessions never overwrite or clear a real active workout.
        } else if (mode === "save") {
            await saveActiveSession({ ...materializeSessionInputs(), totalDuration: elapsed });
        } else {
            await clearActiveSession();
        }

        const action = pendingExitActionRef.current;
        pendingExitActionRef.current = null;
        if (action) navigation.dispatch(action);
        else navigation.goBack();
    }, [elapsed, isTrainingDemo, materializeSessionInputs, navigation]);

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
        const hasCompletedWarmupRoutine = currentSession.warmupRoutine?.status === "completed" &&
            hasLoggedWarmupRoutineData(currentSession.warmupRoutine);

        if (validExercises.length === 0 && validCardioBlocks.length === 0 && !hasCompletedWarmupRoutine) {
            setEmptyFinishModalVisible(true);
            return;
        }

        if (isTrainingDemo) {
            setFinishing(true);
            finishingRef.current = true;
            completedRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            navigation.replace("TrainingComplete", {
                programId: route.params?.programId,
                programName: route.params?.programName,
            });
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

            await saveFinishingSession(completedSession);
            await savePendingWorkout(completedSession);
            await clearFinishingSession();
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
                    applyProgramDayIndex(programId, nextIndex);
                    await reschedulePreWorkoutRemindersForProgram({
                        programId,
                        programName: route.params?.programName || "Program",
                        currentDayIndex: nextIndex,
                        days: programData.days,
                        reminders: user?.settings?.pre_workout_reminders_by_program?.[programId],
                    });
                } catch (err) {
                    console.warn("[WorkoutSession] advanceDay hatası:", err);
                    if (!syncNotice) {
                        syncNotice = {
                            title: "Program gunu ilerletilemedi",
                            message: "Antrenman kaydedildi ancak program siradaki gune otomatik gecemedi. Ana sayfadan manuel degistirebilirsin.",
                        };
                    }
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
                sourceWorkout: route.params?.mode === "free"
                    ? {
                        title: completedSession.title,
                        exercises: completedSession.exercises,
                    }
                    : undefined,
            };

            if (syncNotice) {
                setPostFinishNotice({ ...syncNotice, summaryParams });
            } else {
                (navigation as any).replace("WorkoutSummary", summaryParams);
            }
        } catch (error) {
            console.error("[WorkoutSession] Kaydetme hatası:", error);
            // Only reset finishing state on error so user can retry
            setFinishing(false);
            finishingRef.current = false;
            setConceptNotice({ title: "Kaydetme hatasi", message: "Antrenman verisi kaydedilirken bir hata olustu." });
            return; // exit early, don't set completedRef
        }
        // Workout successfully saved — mark as completed permanently.
        // Do NOT reset finishingRef here: keeping it true prevents auto-save
        // from re-writing the session back to AsyncStorage after clearActiveSession().
        completedRef.current = true;
        setFinishing(false);
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
        if (isTrainingDemo) {
            setConceptNotice({
                title: "Egitim modu",
                message: "Bu demoda program hareketlerini loglamayi ogreniyoruz. Kardiyoyu gercek antrenmaninda ekleyebilirsin.",
            });
            return;
        }
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

                <View style={styles.headerActionGroup}>
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

            {isTrainingDemo ? (
                <View style={styles.trainingCard}>
                    <View style={styles.trainingHeader}>
                        <View style={styles.trainingIcon}>
                            <Ionicons name="school-outline" size={17} color={colors.background} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.trainingEyebrow}>Egitim modu</Text>
                            <Text style={styles.trainingTitle}>Gercek kayit olusturmaz</Text>
                        </View>
                        <Text style={styles.trainingStep}>{trainingTipIndex + 1}/{TRAINING_TIPS.length}</Text>
                    </View>
                    <Text style={styles.trainingText}>{TRAINING_TIPS[trainingTipIndex]}</Text>
                    <TouchableOpacity
                        style={styles.trainingNextBtn}
                        onPress={() => setTrainingTipIndex((index) => Math.min(index + 1, TRAINING_TIPS.length - 1))}
                        disabled={trainingTipIndex >= TRAINING_TIPS.length - 1}
                        activeOpacity={0.78}
                    >
                        <Text style={[styles.trainingNextText, trainingTipIndex >= TRAINING_TIPS.length - 1 && styles.trainingNextTextDone]}>
                            {trainingTipIndex >= TRAINING_TIPS.length - 1 ? "Son ipucu" : "Sonraki ipucu"}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}

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
            {session.warmupRoutine && session.warmupRoutine.status !== "completed" && !hasMainWorkoutLoggedData(session) ? (
                <TouchableOpacity
                    style={styles.sessionNoteBtn}
                    onPress={openWarmupSession}
                    activeOpacity={0.85}
                >
                    <Ionicons name="flame-outline" size={18} color={colors.accent} />
                    <Text style={styles.sessionNoteBtnText}>Isinma rutinim</Text>
                </TouchableOpacity>
            ) : null}
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

    const visibleExercises = React.useMemo(() => session.exercises.filter((exercise, index) => {
        if (!exercise.supersetGroupId) return true;
        return session.exercises.findIndex((candidate) => candidate.supersetGroupId === exercise.supersetGroupId) === index;
    }), [session.exercises]);

    const applyVisibleExerciseOrder = useCallback((orderedVisible: WorkoutExercise[]) => {
        updateSession((prev) => {
            const used = new Set<string>();
            const next: WorkoutExercise[] = [];
            orderedVisible.forEach((visibleExercise) => {
                const original = prev.exercises.find((candidate) => candidate.id === visibleExercise.id) || visibleExercise;
                if (original.supersetGroupId) {
                    prev.exercises
                        .filter((candidate) => candidate.supersetGroupId === original.supersetGroupId)
                        .forEach((groupExercise) => {
                            if (!used.has(groupExercise.id)) {
                                next.push(groupExercise);
                                used.add(groupExercise.id);
                            }
                        });
                    return;
                }
                if (!used.has(original.id)) {
                    next.push(original);
                    used.add(original.id);
                }
            });
            prev.exercises.forEach((exercise) => {
                if (!used.has(exercise.id)) next.push(exercise);
            });
            return { ...prev, exercises: next };
        });
    }, [updateSession]);

    const renderExerciseItem = ({ item: exercise, drag, isActive, getIndex }: RenderItemParams<WorkoutExercise>) => {
        const visibleIndex = getIndex() ?? 0;
        const actualExerciseIndex = session.exercises.findIndex((candidate) => candidate.id === exercise.id);
        const exIndex = actualExerciseIndex >= 0 ? actualExerciseIndex : visibleIndex;
        const weightModes = new Set(exercise.sets.map((set) => set.weightMode === "bodyweight" ? "BW" : "KG"));
        const effortModes = new Set(exercise.sets.map((set) => set.effortMode === "duration" ? "SÜRE" : "TEKRAR"));
        const weightHeader = weightModes.size === 1 ? [...weightModes][0] : "KG/BW";
        const effortHeader = effortModes.size === 1 ? [...effortModes][0] : "TEKRAR/SÜRE";
        const exerciseLogDisabled = !!exercise.logDisabled;
        const supersetMembers = exercise.supersetGroupId
            ? session.exercises.filter((candidate) => candidate.supersetGroupId === exercise.supersetGroupId)
            : [];
        const isSupersetLead = !!exercise.supersetGroupId && supersetMembers[0]?.id === exercise.id && supersetMembers.length > 1;
        const supersetExerciseTitle = isSupersetLead ? supersetMembers.map((member) => member.name).join(" + ") : exercise.name;
        const getSetLabel = (set: WorkoutSet, sets: WorkoutSet[]) => {
            const sameTypeSets = sets.filter((candidate) => !!candidate.isWarmup === !!set.isWarmup);
            const setNumber = sameTypeSets.findIndex((candidate) => candidate.id === set.id) + 1;
            return set.isWarmup ? `W${setNumber}` : `${setNumber}`;
        };

        const renderSetItem = (
            { item: set, drag: dragSet, getIndex: getSetIndex }: RenderItemParams<WorkoutSet>,
            targetExercise = exercise,
            targetExIndex = exIndex,
            labelOverride?: string,
        ) => {
            const setIndex = getSetIndex() ?? 0;
            const isWarmup = !!set.isWarmup;
            const targetLogDisabled = !!targetExercise.logDisabled;
            const label = labelOverride || getSetLabel(set, targetExercise.sets);
            const canMoveSetUp = setIndex > 0;
            const canMoveSetDown = setIndex < targetExercise.sets.length - 1;

            const setContent = (
                <View style={styles.setBlock}>
                <View style={[styles.setRow, isWarmup && styles.warmupSetRow, set.sideMode === "left_right" && styles.unilateralSetRow, targetLogDisabled && styles.disabledSetRow]}>
                        {isWeb ? (
                            <View style={[styles.setDragHandle, styles.webSetOrderHandle, isWarmup && styles.warmupSetDragHandle]}>
                                <Text style={[styles.setNumber, isWarmup && styles.warmupSetNumber]}>
                                    {label}
                                </Text>
                                <View style={styles.webOrderButtons}>
                                    <TouchableOpacity
                                        onPress={() => moveSet(targetExercise.id, set.id, "up")}
                                        disabled={!canMoveSetUp}
                                        style={[styles.webOrderBtn, !canMoveSetUp && styles.webOrderBtnDisabled]}
                                    >
                                        <Ionicons name="chevron-up" size={12} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => moveSet(targetExercise.id, set.id, "down")}
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
                                delayLongPress={300}
                                style={[styles.setDragHandle, isWarmup && styles.warmupSetDragHandle]}
                            >
                                <Text style={[styles.setNumber, isWarmup && styles.warmupSetNumber]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={[styles.inputWrapper, { flex: 1 }]}>
                            <TextInput
                                ref={(el) => registerInput(inputKey(targetExIndex, setIndex, "weight"), el)}
                                style={[styles.numericInput, set.weightMode === "bodyweight" && styles.exceptionInput]}
                                value={set.sideMode === "left_right" ? "L/R" : set.weightMode === "bodyweight" ? "BW" : getTextValue(targetExercise.id, set.id, "weight", set.weight)}
                                editable={!targetLogDisabled && set.sideMode !== "left_right" && set.weightMode !== "bodyweight"}
                                onChangeText={(text) => {
                                    onNumericChange(targetExercise.id, set.id, "weight", text);
                                    if (text.trim() && !set.completed) markSetCompleted(targetExercise.id, set.id);
                                }}
                                onBlur={() => onNumericBlur(targetExercise.id, set.id, "weight")}
                                placeholder={
                                    set.weightMode === "bodyweight"
                                        ? `${set.weight || latestBodyWeight || 0} kg`
                                        : set.targetWeight ?? targetExercise.targetWeight ?? "kg"
                                }
                                placeholderTextColor={
                                    set.weightMode === "bodyweight" || (set.targetWeight || targetExercise.targetWeight)
                                        ? colors.accentDark
                                        : colors.textMuted
                                }
                                keyboardType="decimal-pad"
                                inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                onFocus={() => setFocusedInputKey(inputKey(targetExIndex, setIndex, "weight"))}
                                selectionColor={colors.accent}
                                returnKeyType="next"
                                onSubmitEditing={() => focusNext(targetExIndex, setIndex, "weight")}
                                blurOnSubmit={false}
                            />
                        </View>

                        <View style={[styles.inputWrapper, { flex: 1 }]}>
                            <TextInput
                                ref={(el) => registerInput(inputKey(targetExIndex, setIndex, "reps"), el)}
                                style={[styles.numericInput, set.effortMode === "duration" && styles.exceptionInput]}
                                value={set.sideMode === "left_right" ? "L/R" : getEffortTextValue(targetExercise.id, set)}
                                editable={!targetLogDisabled && set.sideMode !== "left_right"}
                                onChangeText={(text) => {
                                    onNumericChange(targetExercise.id, set.id, set.effortMode === "duration" ? "durationSeconds" as any : "reps", text);
                                    if (text.trim() && !set.completed) markSetCompleted(targetExercise.id, set.id);
                                }}
                                onBlur={() => onNumericBlur(targetExercise.id, set.id, set.effortMode === "duration" ? "durationSeconds" : "reps", set.effortMode !== "duration")}
                                placeholder={set.effortMode === "duration" ? "sn" : (set.targetReps ?? targetExercise.targetReps ?? "tekrar")}
                                placeholderTextColor={
                                    set.effortMode !== "duration" && (set.targetReps || targetExercise.targetReps)
                                        ? colors.accentDark
                                        : colors.textMuted
                                }
                                keyboardType={set.effortMode === "duration" ? "default" : "number-pad"}
                                inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                onFocus={() => setFocusedInputKey(inputKey(targetExIndex, setIndex, "reps"))}
                                selectionColor={colors.accent}
                                returnKeyType="next"
                                onSubmitEditing={() => focusNext(targetExIndex, setIndex, "reps")}
                                blurOnSubmit={false}
                            />
                        </View>

                        {(rpeMode === "rpe" || rpeMode === "both") && (
                            <View style={[styles.inputWrapper, { flex: 0.8 }]}>
                                <TextInput
                                    ref={(el) => registerInput(inputKey(targetExIndex, setIndex, "rpe"), el)}
                                    style={styles.numericInput}
                                    value={set.sideMode === "left_right" ? "L/R" : getTextValue(targetExercise.id, set.id, "rpe", set.rpe ?? 0)}
                                    editable={!targetLogDisabled && set.sideMode !== "left_right"}
                                    onChangeText={(text) => onNumericChange(targetExercise.id, set.id, "rpe", text)}
                                    onBlur={() => onNumericBlur(targetExercise.id, set.id, "rpe")}
                                    placeholder={
                                        (set.targetRPE || targetExercise.targetRPE)
                                            ? `${set.targetRPE ?? targetExercise.targetRPE}`
                                            : "—"
                                    }
                                    placeholderTextColor={colors.accentDark}
                                    keyboardType="number-pad"
                                    inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                    onFocus={() => setFocusedInputKey(inputKey(targetExIndex, setIndex, "rpe"))}
                                    selectionColor={colors.accent}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNext(targetExIndex, setIndex, "rpe")}
                                    blurOnSubmit={false}
                                />
                            </View>
                        )}

                        {(rpeMode === "rir" || rpeMode === "both") && (
                            <View style={[styles.inputWrapper, { flex: 0.8 }]}>
                                <TextInput
                                    ref={(el) => registerInput(inputKey(targetExIndex, setIndex, "rir"), el)}
                                    style={styles.numericInput}
                                    value={set.sideMode === "left_right" ? "L/R" : getTextValue(targetExercise.id, set.id, "rir" as any, (set as any).rir ?? "", { showZero: true })}
                                    editable={!targetLogDisabled && set.sideMode !== "left_right"}
                                    onChangeText={(text) => onNumericChange(targetExercise.id, set.id, "rir" as any, text)}
                                    onBlur={() => onNumericBlur(targetExercise.id, set.id, "rir" as any)}
                                    placeholder={
                                        (set.targetRIR || targetExercise.targetRIR)
                                            ? `${set.targetRIR ?? targetExercise.targetRIR}`
                                            : "—"
                                    }
                                    placeholderTextColor={colors.accentDark}
                                    keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
                                    inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                    onFocus={() => setFocusedInputKey(inputKey(targetExIndex, setIndex, "rir"))}
                                    selectionColor={colors.accent}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNext(targetExIndex, setIndex, "rir")}
                                    blurOnSubmit={false}
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={() => !targetLogDisabled && removeSet(targetExercise.id, set.id)}
                            disabled={targetLogDisabled}
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
                                        value={getSideTextValue(targetExercise.id, set.id, side, "weight", sideData.weight)}
                                        editable={!targetLogDisabled}
                                        onChangeText={(text) => updateUnilateralSide(targetExercise.id, set, side, "weight", text)}
                                        onBlur={() => clearTextCacheKey(sideCacheKey(targetExercise.id, set.id, side, "weight"))}
                                        placeholder={set.weightMode === "bodyweight" ? "BW" : sideData.targetWeight || "kg"}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                        inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                        selectionColor={colors.accent}
                                    />
                                    <TextInput
                                        style={styles.unilateralInput}
                                        value={
                                            set.effortMode === "duration"
                                                ? getSideTextValue(targetExercise.id, set.id, side, "durationSeconds", sideData.durationSeconds, formatDurationInput)
                                                : getSideTextValue(targetExercise.id, set.id, side, "reps", sideData.reps)
                                        }
                                        editable={!targetLogDisabled}
                                        onChangeText={(text) => updateUnilateralSide(
                                            targetExercise.id,
                                            set,
                                            side,
                                            set.effortMode === "duration" ? "durationSeconds" : "reps",
                                            text,
                                        )}
                                        onBlur={() => clearTextCacheKey(sideCacheKey(
                                            targetExercise.id,
                                            set.id,
                                            side,
                                            set.effortMode === "duration" ? "durationSeconds" : "reps",
                                        ))}
                                        placeholder={set.effortMode === "duration" ? sideData.targetDuration || "sn" : sideData.targetReps || "tekrar"}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType={set.effortMode === "duration" ? "default" : "number-pad"}
                                        inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                        selectionColor={colors.accent}
                                    />
                                    {(rpeMode === "rpe" || rpeMode === "both") && (
                                        <TextInput
                                            style={styles.unilateralInput}
                                            value={getSideTextValue(targetExercise.id, set.id, side, "rpe", sideData.rpe)}
                                            editable={!targetLogDisabled}
                                            onChangeText={(text) => updateUnilateralSide(targetExercise.id, set, side, "rpe", text)}
                                            onBlur={() => clearTextCacheKey(sideCacheKey(targetExercise.id, set.id, side, "rpe"))}
                                            placeholder="RPE"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="number-pad"
                                            inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                            selectionColor={colors.accent}
                                        />
                                    )}
                                    {(rpeMode === "rir" || rpeMode === "both") && (
                                        <TextInput
                                            style={styles.unilateralInput}
                                            value={getSideTextValue(targetExercise.id, set.id, side, "rir", sideData.rir, undefined, { showZero: true })}
                                            editable={!targetLogDisabled}
                                            onChangeText={(text) => updateUnilateralSide(targetExercise.id, set, side, "rir", text)}
                                            onBlur={() => clearTextCacheKey(sideCacheKey(targetExercise.id, set.id, side, "rir"))}
                                            placeholder="RIR"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
                                            inputAccessoryViewID={IOS_NUMERIC_ACCESSORY_ID}
                                            selectionColor={colors.accent}
                                        />
                                    )}
                                </View>
                            );
                        })}
                        <Text style={styles.unilateralHint}>Analiz zayif taraf uzerinden hesaplanir.</Text>
                    </View>
                )}
                </View>
            );

            return setContent;
        };

        const renderSupersetMergedSets = () => {
            if (!isSupersetLead) return null;
            const maxWorkSetCount = Math.max(
                ...supersetMembers.map((member) => member.sets.filter((set) => !set.isWarmup).length),
                1,
            );
            const rows: React.ReactNode[] = [];

            for (let roundIndex = 0; roundIndex < maxWorkSetCount; roundIndex += 1) {
                supersetMembers.forEach((member, memberIndex) => {
                    const workSets = member.sets.filter((set) => !set.isWarmup);
                    const set = workSets[roundIndex];
                    if (!set) return;
                    const memberSetIndex = member.sets.findIndex((candidate) => candidate.id === set.id);
                    const memberExerciseIndex = session.exercises.findIndex((candidate) => candidate.id === member.id);
                    const setLetter = String.fromCharCode(65 + memberIndex);
                    const label = `${roundIndex + 1}. set ${setLetter}`;
                    const compactLabel = `${roundIndex + 1}${setLetter}`;
                    rows.push(
                        <View key={`${member.id}_${set.id}`} style={styles.supersetMergedSetBlock}>
                            <View style={styles.supersetMergedSetHeader}>
                                <Text style={styles.supersetMergedSetLabel}>{label}</Text>
                                <Text style={styles.supersetMergedExerciseName} numberOfLines={1}>{member.name}</Text>
                            </View>
                            {renderSetItem({
                                item: set,
                                getIndex: () => memberSetIndex,
                                drag: () => undefined,
                                isActive: false,
                            } as RenderItemParams<WorkoutSet>, member, memberExerciseIndex >= 0 ? memberExerciseIndex : exIndex, compactLabel)}
                        </View>,
                    );
                });
            }

            return (
                <View style={styles.supersetMergedCard}>
                    <View style={styles.supersetMergedHeader}>
                        <Ionicons name="git-compare-outline" size={15} color={colors.accent} />
                        <Text style={styles.supersetMergedTitle}>Birleşik superset kartı</Text>
                    </View>
                    <Text style={styles.supersetMergedHint}>
                        Setleri aşağıdaki sırayla uygula; tur bitince dinlen.
                    </Text>
                    {rows}
                </View>
            );
        };

        const exerciseContent = (
            <View style={[
                    styles.exerciseCard,
                    isActive && styles.activeExerciseCard,
                    exerciseLogDisabled && styles.lockedExerciseCard,
                ]}>
                    {recentlyAddedExerciseId === exercise.id ? (
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.recentlyAddedExerciseGlow,
                                { opacity: recentlyAddedExerciseGlow },
                            ]}
                        />
                    ) : null}
                    <View style={styles.exerciseHeader}>
                        {isWeb ? (
                            <View style={[styles.dragHandle, styles.webExerciseOrderHandle]}>
                                <TouchableOpacity
                                    onPress={() => moveExercise(exercise.id, "up")}
                                    disabled={visibleIndex === 0}
                                    style={[styles.webOrderBtn, visibleIndex === 0 && styles.webOrderBtnDisabled]}
                                >
                                    <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => moveExercise(exercise.id, "down")}
                                    disabled={visibleIndex === visibleExercises.length - 1}
                                    style={[styles.webOrderBtn, visibleIndex === visibleExercises.length - 1 && styles.webOrderBtnDisabled]}
                                >
                                    <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onLongPress={drag}
                                delayLongPress={300}
                                activeOpacity={0.75}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[styles.dragHandle, styles.mobileDragHandle]}
                            >
                                <Ionicons name="reorder-three" size={24} color={isActive ? colors.accent : colors.textSecondary} />
                                <Text style={[styles.dragHintText, isActive && { color: colors.accent }]}>Taşı</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.exerciseIndexBadge}>
                            <Text style={styles.exerciseIndexText}>{visibleIndex + 1}</Text>
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
                            <TouchableOpacity
                                style={styles.exerciseNameTapTarget}
                                onPress={() => setExerciseNameNotice(isSupersetLead ? supersetMembers.map((member, index) => `${String.fromCharCode(65 + index)}. ${member.name}`).join("\n") : exercise.name)}
                                activeOpacity={0.78}
                            >
                            <Text style={styles.exerciseNameText} numberOfLines={1}>
                                {supersetExerciseTitle}
                            </Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.exerciseActionGroup}>
                            <TouchableOpacity
                                onPress={() => removeExercise(exercise.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.exerciseIconBtn}
                            >
                                <Ionicons name="trash-outline" size={19} color={colors.error} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setSetSettingsExercise(exercise)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.exerciseSettingsBtn}
                            >
                                <Ionicons name="options-outline" size={19} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {(exercise.painWarning || exercise.riskAdjusted || exercise.logDisabled) && (
                        <View style={styles.exerciseMetaNoticeWrap}>
                            {exercise.painWarning || exercise.riskAdjusted ? (
                                <View style={styles.painNotice}>
                                    <Ionicons name="warning-outline" size={14} color="#F5A524" />
                                    <Text style={styles.painNoticeText}>
                                        {exercise.logDisabledReason || exercise.painWarning || "Agri notu nedeniyle bu hareket guvenli modda loglanmali."}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}

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


                    {isSupersetLead ? (
                        renderSupersetMergedSets()
                    ) : isWeb ? (
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
                            activationDistance={28}
                        />
                    )}

                    {!isSupersetLead ? (
                    <View style={styles.addSetRow}>
                        <TouchableOpacity
                            style={[styles.addSetBtn, exerciseLogDisabled && styles.disabledActionBtn]}
                            disabled={exerciseLogDisabled}
                            onPress={() => addSetToExercise(exercise.id, false)}
                        >
                            <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                            <Text style={styles.addSetText}>Set Ekle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.addSetBtn, exerciseLogDisabled && styles.disabledActionBtn]}
                            disabled={exerciseLogDisabled}
                            onPress={() => addSetToExercise(exercise.id, true)}
                        >
                            <Ionicons name="flame-outline" size={16} color={colors.textMuted} />
                            <Text style={[styles.addSetText, { color: colors.textMuted }]}>Isınma</Text>
                        </TouchableOpacity>
                    </View>
                    ) : null}

                    {exerciseLogDisabled ? (
                        <TouchableOpacity
                            style={styles.lockedExerciseOverlay}
                            onPress={() => setConceptNotice({
                                title: "Sakatlik nedeniyle kilitli",
                                message: exercise.logDisabledReason || "Bu hareket sakatlik bildirimi nedeniyle loglanamaz. Sakatlik gectiyse program detayindan ilgili bildirimi kapatabilirsin.",
                            })}
                            activeOpacity={0.9}
                        >
                            <View style={styles.lockedExerciseBadge}>
                                <View style={styles.lockedExerciseIcon}>
                                    <Ionicons name="lock-closed" size={22} color={colors.accent} />
                                </View>
                                <Text style={styles.lockedExerciseTitle}>Loglama kilitli</Text>
                                <Text style={styles.lockedExerciseText}>
                                    Sakatlik bildirimi nedeniyle bu hareketi loglayamazsin.
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ) : null}

            </View>
        );

        return exerciseContent;
    };

    const settingsExercise = setSettingsExercise
        ? session.exercises.find((exercise) => exercise.id === setSettingsExercise.id) ?? null
        : null;
    const settingsExercises = React.useMemo(() => {
        if (!settingsExercise) return [];
        if (!settingsExercise.supersetGroupId) return [settingsExercise];
        return session.exercises.filter((exercise) => exercise.supersetGroupId === settingsExercise.supersetGroupId);
    }, [session.exercises, settingsExercise]);
    const isSupersetSettings = settingsExercises.length > 1;
    const applySideModeToSettingsExercises = useCallback((sideMode: "both" | "left_right") => {
        settingsExercises.forEach((exercise) => {
            exercise.sets.forEach((set) => {
                if (sideMode === "both") {
                    updateSetPatch(exercise.id, set.id, { sideMode: "both", left: undefined, right: undefined });
                    return;
                }
                updateSetPatch(exercise.id, set.id, {
                    sideMode: "left_right",
                    left: set.left || { weight: set.weight || undefined, reps: set.reps || undefined, durationSeconds: set.durationSeconds || undefined },
                    right: set.right || { weight: set.weight || undefined, reps: set.reps || undefined, durationSeconds: set.durationSeconds || undefined },
                });
            });
        });
    }, [settingsExercises, updateSetPatch]);

    // ─── Render ──────────────────────────────

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "web" ? undefined : "padding"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
            {Platform.OS === "ios" ? (
                <InputAccessoryView nativeID={IOS_NUMERIC_ACCESSORY_ID}>
                    <View style={styles.keyboardAccessory}>
                        <TouchableOpacity
                            style={styles.keyboardAccessoryBtn}
                            onPress={() => focusAdjacentInput("previous")}
                        >
                            <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
                            <Text style={styles.keyboardAccessoryText}>Önceki</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.keyboardAccessoryBtn}
                            onPress={() => focusAdjacentInput("next")}
                        >
                            <Text style={styles.keyboardAccessoryText}>Sonraki</Text>
                            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.keyboardAccessoryBtn, styles.keyboardAccessoryDone]}
                            onPress={Keyboard.dismiss}
                        >
                            <Text style={styles.keyboardAccessoryDoneText}>Kapat</Text>
                        </TouchableOpacity>
                    </View>
                </InputAccessoryView>
            ) : null}
            <ActionConfirmModal
                visible={preWorkoutWarmupVisible}
                title="Isinma rutinin var"
                message="Bu gun icin tanimli isinma rutinini baslatabilir veya atlayip ana antrenmana gecebilirsin."
                primaryLabel="Isinmaya Basla"
                secondaryLabel="Atla"
                onPrimary={openWarmupSession}
                onSecondary={() => setWarmupRoutineStatus("skipped")}
                onDismiss={() => setPreWorkoutWarmupVisible(false)}
            />
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
                title={isTrainingDemo ? "Egitimden cikilsin mi?" : exitModalHasData ? "Antrenman devam ediyor" : "Antrenman iptal edilsin mi?"}
                message={
                    isTrainingDemo
                        ? "Bu demo gercek antrenman kaydi olusturmaz. Istersen sonra kaldigin egitim akisina donebilir veya egitimi tamamen kapatabilirsin."
                        : exitModalHasData
                        ? "Antrenmanı yarıda bırakıp daha sonra devam edebilir, loglamaya dönebilir veya tamamen iptal edebilirsiniz."
                        : "Henüz veri girmediniz. Bu antrenmanı iptal etmek ister misiniz?"
                }
                primaryLabel={isTrainingDemo ? "Sonra devam et" : exitModalHasData ? "Kaydet ve Çık" : "Antrenmanı İptal Et"}
                secondaryLabel={isTrainingDemo ? "Egitime devam et" : "Devam Et"}
                destructivePrimary={!isTrainingDemo && !exitModalHasData}
                onPrimary={() => isTrainingDemo ? leaveTrainingDemo("continue_later") : leaveWorkout(exitModalHasData ? "save" : "discard")}
                tertiaryLabel={isTrainingDemo ? "Egitimi kapat" : exitModalHasData ? "Antrenmanı İptal Et" : undefined}
                destructiveTertiary
                onTertiary={isTrainingDemo ? () => leaveTrainingDemo("close") : exitModalHasData ? () => leaveWorkout("discard") : undefined}
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
                visible={!!exerciseNameNotice}
                title="Hareket adi"
                message={exerciseNameNotice ?? ""}
                onClose={() => setExerciseNameNotice(null)}
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
                                <Text style={styles.addExerciseTitle}>
                                    {isSupersetSettings ? "Superset ayarları" : "Set ayarları"}
                                </Text>
                                <Text style={styles.setSettingsSubtitle} numberOfLines={1}>
                                    {isSupersetSettings
                                        ? settingsExercises.map((exercise, index) => `${String.fromCharCode(65 + index)}. ${exercise.name}`).join("  •  ")
                                        : settingsExercise?.name}
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
                            {isSupersetSettings ? (
                                <View style={styles.supersetSettingsBulkCard}>
                                    <Text style={styles.supersetSettingsTitle}>Birleşik ayar</Text>
                                    <Text style={styles.supersetSettingsText}>
                                        L/R seçimi tüm superset hareketlerine birlikte uygulanır. İstersen aşağıda her hareketin setlerini ayrıca düzenleyebilirsin.
                                    </Text>
                                    <View style={styles.segmentedControl}>
                                        <TouchableOpacity
                                            style={styles.segmentBtn}
                                            onPress={() => applySideModeToSettingsExercises("both")}
                                        >
                                            <Text style={styles.segmentText}>Tümünü Normal</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.segmentBtn}
                                            onPress={() => applySideModeToSettingsExercises("left_right")}
                                        >
                                            <Text style={styles.segmentText}>Tümünü L/R</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                            {settingsExercises.map((exercise, exerciseIndex) => {
                                let warmupCount = 0;
                                let workingCount = 0;
                                return (
                                    <View
                                        key={exercise.id}
                                        style={isSupersetSettings ? styles.supersetSettingsExerciseBlock : undefined}
                                    >
                                        {isSupersetSettings ? (
                                            <View style={styles.supersetSettingsExerciseHeader}>
                                                <View style={styles.setSettingsSetBadge}>
                                                    <Text style={styles.setSettingsSetText}>{String.fromCharCode(65 + exerciseIndex)}</Text>
                                                </View>
                                                <Text style={styles.supersetMergedExerciseName} numberOfLines={2}>
                                                    {exercise.name}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {exercise.sets.map((set) => {
                                            const isWarmup = !!set.isWarmup;
                                            if (isWarmup) warmupCount++;
                                            else workingCount++;
                                            const labelBase = isWarmup ? `W${warmupCount}` : `${workingCount}`;
                                            const label = isSupersetSettings
                                                ? `${labelBase}${String.fromCharCode(65 + exerciseIndex)}`
                                                : labelBase;
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
                                                                onPress={() => setWeightMode(exercise.id, set, "kg")}
                                                            >
                                                                <Text style={[styles.segmentText, currentWeightMode === "kg" && styles.segmentTextActive]}>KG</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.segmentBtn, currentWeightMode === "bodyweight" && styles.segmentBtnActive]}
                                                                onPress={() => setWeightMode(exercise.id, set, "bodyweight")}
                                                            >
                                                                <Text style={[styles.segmentText, currentWeightMode === "bodyweight" && styles.segmentTextActive]}>BW</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                        <View style={styles.segmentedControl}>
                                                            <TouchableOpacity
                                                                style={[styles.segmentBtn, currentEffortMode === "reps" && styles.segmentBtnActive]}
                                                                onPress={() => setEffortMode(exercise.id, set, "reps")}
                                                            >
                                                                <Text style={[styles.segmentText, currentEffortMode === "reps" && styles.segmentTextActive]}>Tekrar</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.segmentBtn, currentEffortMode === "duration" && styles.segmentBtnActive]}
                                                                onPress={() => setEffortMode(exercise.id, set, "duration")}
                                                            >
                                                                <Text style={[styles.segmentText, currentEffortMode === "duration" && styles.segmentTextActive]}>Süre</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                        <View style={styles.segmentedControl}>
                                                            <TouchableOpacity
                                                                style={[styles.segmentBtn, currentSideMode !== "left_right" && styles.segmentBtnActive]}
                                                                onPress={() => updateSetPatch(exercise.id, set.id, { sideMode: "both", left: undefined, right: undefined })}
                                                            >
                                                                <Text style={[styles.segmentText, currentSideMode !== "left_right" && styles.segmentTextActive]}>Normal</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.segmentBtn, currentSideMode === "left_right" && styles.segmentBtnActive]}
                                                                onPress={() => updateSetPatch(exercise.id, set.id, {
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
                                        })}
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.setSettingsFooter}>
                            <TouchableOpacity
                                style={[styles.modalPrimaryBtn, styles.setSettingsDoneBtn]}
                                onPress={() => setSetSettingsExercise(null)}
                            >
                                <Text style={styles.modalPrimaryText}>Tamam</Text>
                            </TouchableOpacity>
                        </View>
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
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                    onScrollBeginDrag={Keyboard.dismiss}
                >
                    {renderHeader()}
                    {visibleExercises.map((exercise, index) => (
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
                    ref={mobileListRef}
                    data={visibleExercises}
                    onDragEnd={({ data }: { data: WorkoutExercise[] }) => applyVisibleExerciseOrder(data)}
                    keyExtractor={(item: WorkoutExercise) => item.id}
                    renderItem={renderExerciseItem}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                    onScrollBeginDrag={Keyboard.dismiss}
                    containerStyle={styles.scrollView}
                    activationDistance={32}
                    autoscrollThreshold={80}
                    autoscrollSpeed={120}
                    dragItemOverflow
                    onScrollToIndexFailed={({ index }: { index: number }) => {
                        setTimeout(() => scrollToExerciseIndex(index, 1), 120);
                    }}
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
    keyboardAccessory: {
        minHeight: 46,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    keyboardAccessoryBtn: {
        minHeight: 34,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    keyboardAccessoryText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    keyboardAccessoryDone: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    keyboardAccessoryDoneText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.md,
        paddingTop: Platform.OS === "ios" ? 60 : spacing.xxxl + spacing.lg,
        paddingBottom: spacing.xxxl * 3,
    },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: spacing.sm,
        marginBottom: spacing.xxl,
    },
    headerActionGroup: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: spacing.xs,
        minWidth: 0,
    },
    cancelBtn: {
        padding: spacing.xs,
    },
    timerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accent,
        flexShrink: 0,
    },
    rirToggleBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 34,
        justifyContent: "center",
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
    },
    timerText: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.accent,
        marginLeft: spacing.xs,
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
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        position: "relative",
    },
    lockedExerciseCard: {
        borderColor: colors.warning ?? "#F5A524",
    },
    lockedExerciseOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.52)",
        padding: spacing.lg,
    },
    lockedExerciseBadge: {
        width: "100%",
        maxWidth: 280,
        alignItems: "center",
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: "#F5A52466",
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 16,
        elevation: 8,
    },
    lockedExerciseIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        marginBottom: spacing.sm,
    },
    lockedExerciseTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        textAlign: "center",
        marginBottom: 4,
    },
    lockedExerciseText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 17,
        textAlign: "center",
    },
    exerciseHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: spacing.md,
        gap: spacing.xs,
    },
    exerciseMetaNoticeWrap: {
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    supersetBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accent + "66",
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
    },
    supersetBadgeText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    supersetHint: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        lineHeight: 17,
    },
    supersetFlowCard: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accent + "66",
        backgroundColor: colors.accentMuted,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    supersetFlowHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    supersetFlowTitle: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    supersetFlowHint: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 17,
    },
    supersetFlowRow: {
        flexDirection: "row",
        gap: spacing.xs,
    },
    supersetFlowPill: {
        flex: 1,
        minWidth: 0,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.accent + "44",
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    supersetFlowLabel: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    supersetFlowName: {
        color: colors.text,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    supersetMergedCard: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    supersetMergedHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    supersetMergedTitle: {
        color: colors.textPrimary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    supersetMergedHint: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 18,
    },
    supersetMergedSetBlock: {
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: borderRadius.md,
        padding: spacing.xs,
        backgroundColor: colors.surfaceElevated,
        gap: spacing.xs,
    },
    supersetMergedSetHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    supersetMergedSetLabel: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        minWidth: 52,
    },
    supersetMergedExerciseName: {
        color: colors.textPrimary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        flex: 1,
    },
    painNotice: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.xs,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: "#F5A52455",
        backgroundColor: colors.surfaceElevated,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    painNoticeText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 17,
    },
    disabledSetRow: {
        opacity: 0.45,
    },
    disabledActionBtn: {
        opacity: 0.45,
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
        minWidth: 0,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        color: colors.text,
        paddingVertical: spacing.xs,
    },
    exerciseNameTapTarget: {
        flex: 1,
        minWidth: 0,
    },
    exerciseActionGroup: {
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 0,
        gap: spacing.xs,
    },
    exerciseIconBtn: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    exerciseSettingsBtn: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },

    // Set Header
    setHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
        gap: spacing.xs,
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
        gap: 2,
    },
    unilateralSetRow: {
        marginBottom: spacing.xs,
    },
    unilateralPanel: {
        marginLeft: 0,
        marginRight: 0,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        gap: spacing.xs,
        overflow: "hidden",
    },
    unilateralRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: spacing.xs,
    },
    unilateralLabel: {
        width: 34,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    unilateralInput: {
        flex: 1,
        minWidth: 62,
        minHeight: 38,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        textAlign: "center",
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        fontSize: fontSize.sm,
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
        width: 34,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
        flexShrink: 0,
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
        marginHorizontal: 2,
        minWidth: 0,
    },
    numericInput: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.sm,
        paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
        paddingHorizontal: spacing.sm,
        fontSize: fontSize.md,
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
    mobileDragHandle: {
        minWidth: 44,
        minHeight: 46,
        alignItems: "center",
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.xs,
    },
    dragHintText: {
        color: colors.textMuted,
        fontSize: 9,
        fontWeight: fontWeight.bold,
        marginTop: -3,
    },
    activeExerciseCard: {
        borderColor: colors.accent,
        elevation: 8,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    recentlyAddedExerciseGlow: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        borderRadius: borderRadius.lg,
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
        maxHeight: "86%",
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
        maxHeight: 320,
    },
    setSettingsListContent: {
        gap: spacing.sm,
        paddingBottom: spacing.md,
    },
    supersetSettingsBulkCard: {
        gap: spacing.xs,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
    },
    supersetSettingsTitle: {
        color: colors.textPrimary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    supersetSettingsText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 18,
    },
    supersetSettingsExerciseBlock: {
        gap: spacing.sm,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
    },
    supersetSettingsExerciseHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    setSettingsFooter: {
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    setSettingsDoneBtn: {
        flex: 0,
        minHeight: 48,
        width: "100%",
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
    warmupRoutineList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    warmupRoutineStep: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    warmupRoutineStepDone: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    warmupRoutineCheck: {
        width: 24,
        height: 24,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    warmupRoutineCheckDone: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    warmupRoutineStepTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    warmupRoutineStepDesc: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 19,
        marginTop: 3,
    },
    warmupRoutineActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    secondaryActionBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
    },
    secondaryActionText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        textAlign: "center",
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
    trainingCard: {
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        marginBottom: spacing.md,
    },
    trainingHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    trainingIcon: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    trainingEyebrow: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        textTransform: "uppercase",
        letterSpacing: 0,
    },
    trainingTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        marginTop: 2,
    },
    trainingStep: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    trainingText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    trainingNextBtn: {
        alignSelf: "flex-start",
        minHeight: 34,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    trainingNextText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    trainingNextTextDone: {
        color: colors.textMuted,
    },

    // Finish
    finishBtn: {
        marginBottom: spacing.lg,
    },
});
