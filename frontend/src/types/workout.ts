// ─────────────────────────────────────────────
// SmartProgress — Workout Type Definitions
// Antrenman akışı için tüm tip tanımları
// ─────────────────────────────────────────────

// ─── Set ─────────────────────────────────────

export interface WorkoutSet {
    id: string;
    weight: number;
    weightMode?: "kg" | "bodyweight";
    bodyWeight?: number;
    externalWeight?: number;
    reps: number;
    effortMode?: "reps" | "duration";
    durationSeconds?: number;
    unit: "kg" | "lbs";
    rpe?: number | string; // Rate of Perceived Exertion (1-10)
    rir?: number | string; // Reps in reserve
    analysisExcluded?: boolean; // true when set is kept in log but ignored by coach analysis
    analysisWarning?: string;
    completed: boolean;
    isWarmup?: boolean;    // warmup set flag
    targetReps?: string;   // from program template
    targetWeight?: string; // from program template
    targetRPE?: string;    // from program template
    targetRIR?: string;    // from program template
    sideMode?: "both" | "left_right";
    left?: UnilateralSetSide;
    right?: UnilateralSetSide;
}

export interface UnilateralSetSide {
    weight?: number;
    reps?: number;
    durationSeconds?: number;
    rpe?: number | string;
    rir?: number | string;
}

// ─── Target Set (Program Template) ──────────

export interface TargetSet {
    targetReps: string;    // e.g. "8-12" or "10"
    targetWeight?: string; // e.g. "100"
    targetRPE?: string;    // 0-10
    targetRIR?: string;    // 0-5
    isWarmup?: boolean;    // warmup set flag
}

// ─── Target Exercise (Program Template) ─────

export interface TargetExercise {
    id: string;
    exerciseId?: string;
    name: string;
    targetSets: TargetSet[];
    targetPattern?: string;
    targetMuscle?: string;
    primaryMuscles?: string[];
    equipment?: string[];
    riskAdjusted?: boolean;
    painWarning?: string;
    logDisabled?: boolean;
    logDisabledReason?: string;
    supersetGroupId?: string;
    supersetLabel?: string;
    supersetRestHint?: string;
}

// ─── Exercise (Live Session) ─────────────────

export interface WorkoutExercise {
    id: string;
    exerciseId?: string;
    name: string;
    sets: WorkoutSet[];
    isCustom?: boolean;    // true for manually added exercises (editable name, add set)
    targetReps?: string;   // from program template, e.g. "8-12"
    targetWeight?: string; // from program template, e.g. "100"
    targetRPE?: string;    // from program template
    targetRIR?: string;    // from program template
    targetPattern?: string;
    targetMuscle?: string;
    primaryMuscles?: string[];
    equipment?: string[];
    riskAdjusted?: boolean;
    painWarning?: string;
    logDisabled?: boolean;
    logDisabledReason?: string;
    supersetGroupId?: string;
    supersetLabel?: string;
    supersetRestHint?: string;
}

// ─── Cycle-Based Program Data ─────────────────

export type CardioType = "treadmill" | "bike" | "elliptical" | "outdoor_run" | "daily_steps" | "other";

export interface CardioStage {
    id: string;
    startedAt: string;
    endedAt?: string;
    duration: number; // seconds
    speed?: number;
    incline?: number;
    resistance?: number;
    rpm?: number;
    distance?: number;
    steps?: number;
    calories?: number;
    note?: string;
    isRest?: boolean;
}

export interface CardioBlock {
    id: string;
    type: CardioType;
    title: string;
    startedAt: string;
    completedAt?: string;
    totalDuration: number; // seconds
    totalDistance?: number;
    totalSteps?: number;
    totalCalories?: number;
    stages: CardioStage[];
}

export interface WarmupRoutineStep {
    id: string;
    title: string;
    description?: string;
    durationSeconds?: number;
    completed?: boolean;
}

export interface WarmupRoutineLog {
    status: "pending" | "completed" | "skipped" | "cancelled";
    startedAt?: string;
    completedAt?: string;
    steps?: WarmupRoutineStep[];
    exercises?: WorkoutExercise[];
    cardioBlocks?: CardioBlock[];
}

export interface WarmupRoutineTemplate {
    exercises?: TargetExercise[];
    cardioBlocks?: Pick<CardioBlock, "id" | "type" | "title" | "totalDuration">[];
    steps?: WarmupRoutineStep[];
}

export interface ProgramDay {
    label: string;             // "Gün 1 — Anterior"
    exercises: TargetExercise[];
    isRestDay?: boolean;       // Off / dinlenme günü işareti
    warmupRoutine?: WarmupRoutineTemplate;
}

export interface CycleProgramData {
    frequency: number;         // sessions per week, e.g. 3
    days: ProgramDay[];
    warmupRoutine?: WarmupRoutineTemplate | WarmupRoutineStep[];
}

// Legacy flat structure (backwards compat)
export interface LegacyProgramData {
    exercises: TargetExercise[];
    warmupRoutine?: WarmupRoutineTemplate | WarmupRoutineStep[];
}

export type ProgramData = CycleProgramData | LegacyProgramData;

/** Type guard: is this a cycle-based program? */
export function isCycleProgram(data: any): data is CycleProgramData {
    return data && Array.isArray(data.days) && data.days.length > 0;
}

// ─── Session ─────────────────────────────────

export type SessionStatus = "active" | "completed" | "cancelled";

export interface WorkoutSession {
    id: string;
    title: string;
    sportId: string;
    exercises: WorkoutExercise[];
    startedAt: string; // ISO 8601
    completedAt?: string; // ISO 8601
    totalDuration: number; // seconds
    totalVolume?: number; // load score: working sets, weighted by RPE when logged
    notes?: string;
    cardioBlocks?: CardioBlock[];
    activeCardioBlockId?: string;
    activeCardioStage?: CardioStage;
    warmupRoutine?: WarmupRoutineLog;
    status: SessionStatus;
    programId?: string;    // linked program (for cycle advance)
    dayIndex?: number;     // which day was trained
}

// ─── Sync ────────────────────────────────────

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface PendingWorkout {
    id: string;
    session: WorkoutSession;
    syncStatus: SyncStatus;
    createdAt: string; // ISO 8601
    lastSyncAttempt?: string; // ISO 8601
    failCount: number;
}

// ─── API Payload ─────────────────────────────
// POST /api/v1/workouts/sync body format

export interface SyncWorkoutPayload {
    sportId: string;
    title: string;
    notes?: string;
    data: {
        exercises: {
            exerciseId?: string;
            name: string;
            sets: {
                reps: number;
                weight: number;
                weightMode?: "kg" | "bodyweight";
                bodyWeight?: number;
                externalWeight?: number;
                effortMode?: "reps" | "duration";
                durationSeconds?: number;
                unit: "kg" | "lbs";
                rpe?: number | string;
                rir?: number | string;
                targetReps?: string;
                analysisExcluded?: boolean;
                analysisWarning?: string;
                isWarmup?: boolean;
                sideMode?: "both" | "left_right";
                left?: UnilateralSetSide;
                right?: UnilateralSetSide;
            }[];
        }[];
        totalDuration?: number;
        totalVolume?: number;
        cardioBlocks?: CardioBlock[];
        warmupRoutine?: WarmupRoutineLog;
        programId?: string;
        dayIndex?: number;
    };
    logDate: string; // ISO 8601
}

// ─── AsyncStorage Keys ──────────────────────

export const STORAGE_KEYS = {
    ACTIVE_SESSION: "active_workout_session",
    FINISHING_SESSION: "finishing_workout_session",
    PENDING_WORKOUTS: "pending_workouts",
} as const;
