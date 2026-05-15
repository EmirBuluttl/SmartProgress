// ─────────────────────────────────────────────
// Workout Service
// ─────────────────────────────────────────────
import { WorkoutLog } from "@prisma/client";
import { z } from "zod";
import {
    workoutRepository,
    CreateWorkoutLogData,
} from "../repositories/workout.repository";
import { ValidationError } from "../utils/errors";

// ─── Zod Schema for JSONB Workout Data ───────

// Preprocessor: coerce string → number, NaN → 0
const coerceNumber = z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
}, z.number());

const coerceInt = z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return 0;
    const num = parseInt(String(val), 10);
    return isNaN(num) ? 0 : num;
}, z.number().int());

const workoutSetSchema = z.object({
    reps: coerceInt.pipe(z.number().int().min(0)),
    weight: coerceNumber.pipe(z.number().nonnegative()),
    unit: z.enum(["kg", "lbs"]).default("kg"),
    rpe: z.union([z.number(), z.string()]).optional().nullable(),
    rir: z.union([z.number(), z.string()]).optional().nullable(),
    isWarmup: z.boolean().optional(),
});

const workoutExerciseSchema = z.object({
    name: z.string().min(1, "Exercise name is required"),
    sets: z.array(workoutSetSchema).min(1, "At least one set is required"),
});

const workoutDataSchema = z.object({
    exercises: z
        .array(workoutExerciseSchema)
        .min(1, "At least one exercise is required")
        .optional(),
    totalDuration: coerceInt.optional(),
    totalVolume: coerceNumber.optional(),
    programId: z.string().uuid().optional(),
    dayIndex: z.number().int().nonnegative().optional(),
    caloriesBurned: z.number().nonnegative().optional(),
    // Running-specific fields
    distance: z.number().nonnegative().optional(),
    distanceUnit: z.enum(["km", "mi"]).optional(),
    duration: z.number().int().nonnegative().optional(),
    avgPace: z.string().optional(),
    avgHeartRate: z.number().int().nonnegative().optional(),
    elevationGain: z.number().nonnegative().optional(),
});

const syncWorkoutItemSchema = z.object({
    sportId: z.string().uuid("Invalid sport ID"),
    title: z.string().min(1, "Title is required").max(200),
    notes: z.string().max(2000).optional().nullable(),
    data: workoutDataSchema,
    logDate: z.string().datetime({ offset: true, message: "Invalid date format, use ISO 8601" }),
});

export const syncWorkoutsSchema = z.object({
    workouts: z
        .array(syncWorkoutItemSchema)
        .min(1, "At least one workout is required")
        .max(50, "Maximum 50 workouts per sync"),
});

export type SyncWorkoutsInput = z.infer<typeof syncWorkoutsSchema>;

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function clampRpe(value: unknown): number {
    return Math.min(10, Math.max(0, toNumber(value)));
}

function clampRir(value: unknown, reps: unknown): number | undefined {
    if (value === null || value === undefined || value === "") return undefined;
    return Math.min(Math.max(0, Math.floor(toNumber(reps))), Math.max(0, toNumber(value)));
}

function calculateLoadScore(data: any): number {
    const exercises = Array.isArray(data?.exercises) ? data.exercises : [];
    const score = exercises.reduce((total: number, exercise: any) => {
        const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
        return total + sets.reduce((setTotal: number, set: any) => {
            if (set?.isWarmup) return setTotal;
            if (toNumber(set?.weight) <= 0 && toNumber(set?.reps) <= 0 && toNumber(set?.rpe) <= 0) return setTotal;
            const rpe = clampRpe(set?.rpe);
            return setTotal + (rpe > 0 ? rpe / 10 : 1);
        }, 0);
    }, 0);
    return Math.round(score * 10) / 10;
}

function normalizeWorkoutData(data: any) {
    const exercises = Array.isArray(data?.exercises)
        ? data.exercises.map((exercise: any) => ({
            ...exercise,
            sets: Array.isArray(exercise?.sets)
                ? exercise.sets.map((set: any) => {
                    const normalizedSet = { ...set };
                    if (set?.rpe !== undefined && set?.rpe !== null && set?.rpe !== "") {
                        normalizedSet.rpe = clampRpe(set.rpe);
                    } else {
                        delete normalizedSet.rpe;
                    }

                    const rir = clampRir(set?.rir, set?.reps);
                    if (rir !== undefined) normalizedSet.rir = rir;
                    else delete normalizedSet.rir;

                    return normalizedSet;
                })
                : [],
        }))
        : data?.exercises;

    const normalized = { ...data, exercises };
    return {
        ...normalized,
        totalVolume: calculateLoadScore(normalized),
    };
}

// ─── Service ─────────────────────────────────

export class WorkoutService {
    /**
     * Sync (bulk-create) workout logs from mobile app.
     * - Validates JSONB data structure via Zod
     * - Delegates to repository for transactional insert + outbox
     */
    async syncWorkouts(
        userId: string,
        input: SyncWorkoutsInput,
    ): Promise<WorkoutLog[]> {
        const workoutData: CreateWorkoutLogData[] = input.workouts.map((w) => ({
            sportId: w.sportId,
            title: w.title,
            notes: w.notes ?? undefined,
            data: normalizeWorkoutData(w.data),
            logDate: new Date(w.logDate),
        }));

        return workoutRepository.createManyWithOutbox(userId, workoutData);
    }

    /**
     * Get user's workout logs with pagination.
     */
    async getUserWorkouts(
        userId: string,
        limit?: number,
        offset?: number,
    ): Promise<WorkoutLog[]> {
        return workoutRepository.findByUserId(userId, { limit, offset });
    }

    /**
     * Delete a workout log by ID.
     */
    async deleteWorkout(userId: string, id: string): Promise<void> {
        return workoutRepository.deleteById(userId, id);
    }

    /**
     * Validate the sync request body with Zod.
     */
    validateSyncInput(body: unknown): SyncWorkoutsInput {
        const parsed = syncWorkoutsSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError(
                "Workout sync validation failed",
                parsed.error.flatten(),
            );
        }
        return parsed.data;
    }
}

export const workoutService = new WorkoutService();
