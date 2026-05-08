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

const workoutSetSchema = z.object({
    reps: z.number().int().min(0),
    weight: z.number().nonnegative(),
    unit: z.enum(["kg", "lbs"]).default("kg"),
    rpe: z.union([z.number(), z.string()]).optional(),
    rir: z.union([z.number(), z.string()]).optional(),
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
    totalDuration: z.number().int().nonnegative().optional(),
    totalVolume: z.number().nonnegative().optional(),
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
    notes: z.string().max(2000).optional(),
    data: workoutDataSchema,
    logDate: z.string().datetime({ message: "Invalid date format, use ISO 8601" }),
});

export const syncWorkoutsSchema = z.object({
    workouts: z
        .array(syncWorkoutItemSchema)
        .min(1, "At least one workout is required")
        .max(50, "Maximum 50 workouts per sync"),
});

export type SyncWorkoutsInput = z.infer<typeof syncWorkoutsSchema>;

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
            notes: w.notes,
            data: w.data,
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
