// ─────────────────────────────────────────────
// Workout Repository
// Outbox Pattern: WorkoutLog + OutboxEvent
// in a single database transaction
// ─────────────────────────────────────────────
import { WorkoutLog } from "@prisma/client";
import prisma from "../config/prisma";

// ─── DTOs ────────────────────────────────────

export interface CreateWorkoutLogData {
    sportId: string;
    title: string;
    notes?: string;
    data: unknown;
    logDate: Date;
}

// ─── Repository ──────────────────────────────

export class WorkoutRepository {
    /**
     * Bulk-create workout logs and their corresponding
     * OutboxEvents within a single Prisma transaction.
     *
     * Outbox Pattern guarantees:
     * - WorkoutLog + OutboxEvent are atomically committed
     * - A background processor will later pick up unprocessed events
     */
    async createManyWithOutbox(
        userId: string,
        workouts: CreateWorkoutLogData[],
    ): Promise<WorkoutLog[]> {
        return prisma.$transaction(async (tx) => {
            const createdLogs: WorkoutLog[] = [];

            // Ensure all referenced sports exist (auto-provision if missing)
            const sportIds = [...new Set(workouts.map((w) => w.sportId))];
            for (const sportId of sportIds) {
                console.log(`[WorkoutRepo] Checking sport exists: ${sportId}`);
                const exists = await tx.sport.findUnique({ where: { id: sportId } });
                if (!exists) {
                    console.log(`[WorkoutRepo] Sport not found, auto-provisioning: ${sportId}`);
                    try {
                        await tx.sport.create({
                            data: {
                                id: sportId,
                                name: `Fitness-${sportId.slice(0, 8)}`,
                                slug: `fitness-${sportId.slice(0, 8)}`,
                                icon: "barbell",
                            },
                        });
                        console.log(`[WorkoutRepo] Sport auto-provisioned successfully: ${sportId}`);
                    } catch (e: any) {
                        // Ignore unique constraint errors — another process may have created it
                        if (e?.code !== "P2002") throw e;
                        console.warn(`[WorkoutRepo] Sport P2002 (already exists by name/slug): ${sportId}`);
                    }

                    // Verify the sport now exists with the exact ID we need (FK safety)
                    const verify = await tx.sport.findUnique({ where: { id: sportId } });
                    if (!verify) {
                        console.error(`[WorkoutRepo] Sport FK safety check failed! ID ${sportId} does not exist after auto-provision.`);
                        throw new Error(
                            `Sport with ID ${sportId} could not be provisioned. ` +
                            `A sport with the same name/slug exists under a different ID. ` +
                            `Please run the seed script: npx prisma db seed`,
                        );
                    }
                } else {
                    console.log(`[WorkoutRepo] Sport exists: ${sportId} (${exists.name})`);
                }
            }

            for (const workout of workouts) {
                // 1. Create the WorkoutLog
                const log = await tx.workoutLog.create({
                    data: {
                        userId,
                        sportId: workout.sportId,
                        title: workout.title,
                        notes: workout.notes,
                        data: workout.data as object,
                        logDate: workout.logDate,
                    },
                });

                // 2. Create the OutboxEvent in the same transaction
                await tx.outboxEvent.create({
                    data: {
                        aggregateType: "WorkoutLog",
                        aggregateId: log.id,
                        eventType: "WORKOUT_COMPLETED",
                        payload: {
                            userId,
                            workoutLogId: log.id,
                            sportId: workout.sportId,
                            title: workout.title,
                            logDate: workout.logDate.toISOString(),
                        },
                    },
                });

                createdLogs.push(log);
            }

            return createdLogs;
        });
    }

    /**
     * Find workout logs by user ID with optional date filtering.
     */
    async findByUserId(
        userId: string,
        options?: { limit?: number; offset?: number },
    ): Promise<WorkoutLog[]> {
        return prisma.workoutLog.findMany({
            where: { userId },
            orderBy: { logDate: "desc" },
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
        });
    }

    async findRecentByUserId(
        userId: string,
        limit = 100,
    ): Promise<WorkoutLog[]> {
        return prisma.workoutLog.findMany({
            where: { userId },
            orderBy: { logDate: "desc" },
            take: limit,
        });
    }

    /**
     * Find latest workout logs by user for a specific exercise name.
     * Searches within the JSONB `data` field.
     */
    async findLatestByExercise(
        userId: string,
        exerciseName: string,
        limit = 5,
    ): Promise<WorkoutLog[]> {
        return prisma.workoutLog.findMany({
            where: {
                userId,
                data: {
                    path: ["exercises"],
                    array_contains: [{ name: exerciseName }],
                },
            },
            orderBy: { logDate: "desc" },
            take: limit,
        });
    }

    /**
     * Delete a workout log by ID, ensuring it belongs to the user.
     */
    async deleteById(userId: string, id: string): Promise<void> {
        const result = await prisma.workoutLog.deleteMany({
            where: {
                id,
                userId,
            },
        });
        if (result.count === 0) {
            throw new Error("Workout not found or not owned by user");
        }
    }
}

export const workoutRepository = new WorkoutRepository();
