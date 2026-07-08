// ─────────────────────────────────────────────
// Workout Controller
// ─────────────────────────────────────────────
import { Request, Response, NextFunction } from "express";
import { workoutService } from "../services/workout.service";

export class WorkoutController {
    /**
     * POST /sync
     * Bulk-sync workout logs from mobile app.
     */
    async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;

            // Validate input
            console.log("[WorkoutController] Sync request body:", JSON.stringify(req.body, null, 2));
            const input = workoutService.validateSyncInput(req.body);
            console.log("[WorkoutController] Validation passed, syncing", input.workouts.length, "workout(s)");

            // Sync workouts (transactional with outbox)
            const createdLogs = await workoutService.syncWorkouts(userId, input);

            res.status(201).json({
                message: `Successfully synced ${createdLogs.length} workout(s)`,
                count: createdLogs.length,
                workouts: createdLogs,
            });
        } catch (error: any) {
            console.error("[WorkoutController] Sync error:", error?.message || error);
            console.error("[WorkoutController] Sync error stack:", error?.stack);
            if (error?.code) console.error("[WorkoutController] Prisma error code:", error.code);
            if (error?.meta) console.error("[WorkoutController] Prisma meta:", JSON.stringify(error.meta));
            next(error);
        }
    }

    /**
     * GET /
     * Get user's workout logs with optional pagination.
     */
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
            const summary = req.query.summary === "true";

            const workouts = await workoutService.getUserWorkouts(userId, limit, offset, summary);

            res.status(200).json({
                count: workouts.length,
                workouts,
            });
        } catch (error) {
            next(error);
        }
    }

    async previousSetLookup(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const rawKeys = Array.isArray(req.query.keys)
                ? req.query.keys.join(",")
                : String(req.query.keys || "");
            const keys = rawKeys
                .split(",")
                .map((key) => key.trim())
                .filter(Boolean);

            const lookup = await workoutService.getPreviousSetLookup(userId, keys);
            res.status(200).json({ lookup });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /:id
     * Get a specific workout log by ID.
     */
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const id = req.params.id as string;

            const workout = await workoutService.getWorkoutById(userId, id);
            if (!workout) {
                res.status(404).json({ message: "Workout not found" });
                return;
            }

            res.status(200).json(workout);
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /:id
     * Delete a specific workout log.
     */
    async deleteById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const id = req.params.id as string;

            await workoutService.deleteWorkout(userId, id);

            res.status(200).json({
                message: "Workout deleted successfully",
            });
        } catch (error) {
            next(error);
        }
    }
}

export const workoutController = new WorkoutController();
