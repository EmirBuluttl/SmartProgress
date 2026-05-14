// ─────────────────────────────────────────────
// Program Controller
// ─────────────────────────────────────────────
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { programService } from "../services/program.service";
import { autoRegulationService } from "../services/autoRegulation.service";
import { ValidationError } from "../utils/errors";

// ─── Zod Schemas ─────────────────────────────

const createProgramSchema = z.object({
    name: z
        .string()
        .min(1, "Program name is required")
        .max(100, "Program name must not exceed 100 characters"),
    description: z.string().max(1000).optional(),
    isPublic: z.boolean().optional(),
    frequency: z.number().int().min(1).max(7).optional(),
    data: z.any().optional(),
});

// ─── Controller ──────────────────────────────

export class ProgramController {
    /**
     * POST /
     * Create a new program.
     */
    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            console.log("[ProgramController] Create Request Body:", JSON.stringify(req.body, null, 2));

            const parsed = createProgramSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            // Ensure data is passed exactly as received in case Zod strips nested objects unintentionally
            const programPayload = {
                ...parsed.data,
                data: req.body.data ?? parsed.data.data
            };

            const program = await programService.createProgram(userId, programPayload);
            console.log("[ProgramController] Created Program:", {
                id: program.id,
                name: program.name,
                hasData: !!program.data,
            });
            res.status(201).json(program);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /:id/visibility
     * Toggle program public/private.
     */
    async toggleVisibility(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;

            const program = await programService.toggleVisibility(userId, programId);
            res.status(200).json({
                message: `Program is now ${program.isPublic ? "public" : "private"}`,
                program,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /public
     * List all public programs (community feed).
     */
    async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

            const programs = await programService.getPublicPrograms(limit, offset, req.user?.userId);
            res.status(200).json({
                count: programs.length,
                programs,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /mine
     * List user's own programs.
     */
    async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programs = await programService.getUserPrograms(userId);
            console.log("[ProgramController] listMine result:", {
                userId,
                count: programs.length,
                firstProgram: programs[0]
                    ? {
                        id: programs[0].id,
                        name: programs[0].name,
                        hasData: !!programs[0].data,
                    }
                    : null,
            });
            res.status(200).json({
                count: programs.length,
                programs,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /community
     * Authenticated community feed with star state.
     */
    async listCommunity(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

            const programs = await programService.getPublicPrograms(limit, offset, userId);
            res.status(200).json({
                count: programs.length,
                programs,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /:id
     * Get a specific program by ID.
     */
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;
            console.log(
                `[ProgramController] getById called. userId=${userId}, programId="${programId}"`,
            );
            const program = await programService.getProgramById(userId, programId);
            res.status(200).json(program);
        } catch (error) {
            console.error("[ProgramController] getById error", {
                userId: req.user?.userId,
                programId: req.params.id,
                name: (error as any)?.name,
                message: (error as any)?.message,
            });
            next(error);
        }
    }

    /**
     * PATCH /:id/advance-day
     * Advance the currentDayIndex for a cycle-based program.
     */
    async advanceDay(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;
            const program = await programService.advanceDayIndex(userId, programId);
            res.status(200).json({
                message: "Day advanced",
                currentDayIndex: program.currentDayIndex,
                program,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /:id
     * Update a program (name, description, frequency, data, isPublic).
     */
    async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;

            const updateSchema = createProgramSchema.partial();
            const parsed = updateSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const payload = {
                ...parsed.data,
                data: req.body.data ?? parsed.data.data,
            };

            const program = await programService.updateProgram(userId, programId, payload);
            res.status(200).json(program);
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /:id
     * Delete a program.
     */
    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;

            await programService.deleteProgram(userId, programId);
            res.status(200).json({ message: "Program deleted" });
        } catch (error) {
            next(error);
        }
    }

    async star(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;
            const program = await programService.starProgram(userId, programId);
            res.status(200).json(program);
        } catch (error) {
            next(error);
        }
    }

    async unstar(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;
            const program = await programService.unstarProgram(userId, programId);
            res.status(200).json(program);
        } catch (error) {
            next(error);
        }
    }

    async copy(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const programId = req.params.id as string;
            const program = await programService.copyPublicProgramToLibrary(userId, programId);
            res.status(201).json(program);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /suggest/:exerciseName
     * Auto-regulation weight suggestion.
     */
    async suggestWeight(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const userId = req.user!.userId;
            const exerciseName = decodeURIComponent(req.params.exerciseName as string);

            const suggestion = await autoRegulationService.suggestNextSet(
                userId,
                exerciseName,
            );

            res.status(200).json(suggestion);
        } catch (error) {
            next(error);
        }
    }
}

export const programController = new ProgramController();
