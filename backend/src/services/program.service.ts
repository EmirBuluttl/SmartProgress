// ─────────────────────────────────────────────
// Program Service
// ─────────────────────────────────────────────
import { Program } from "@prisma/client";
import { programRepository } from "../repositories/program.repository";
import { NotFoundError, ForbiddenError, BadRequestError } from "../utils/errors";
import prisma from "../config/prisma";

// ─── DTOs ────────────────────────────────────

export interface CreateProgramDto {
    name: string;
    description?: string;
    isPublic?: boolean;
    frequency?: number; // sessions per week (for cycle-based programs)
    data?: any;         // CycleProgramData | legacy exercises array
    sourceProgramId?: string;
}

export type ProgramSplitType = "PPL" | "AP" | "UL" | "TL" | "FB" | "OTHER";
export type ProgramSortType = "stars" | "newest" | "oldest";
const FREE_PUBLIC_PROGRAM_LIMIT = 5;
const PRO_PUBLIC_PROGRAM_LIMIT = 10;

function normalizeSplit(value: unknown): ProgramSplitType | undefined {
    const split = String(value || "").trim().toUpperCase();
    return ["PPL", "AP", "UL", "TL", "FB", "OTHER"].includes(split)
        ? split as ProgramSplitType
        : undefined;
}

function isActivePaidAccess(user: { subscriptionTier?: string | null; subscriptionStatus?: string | null; settings?: unknown } | null) {
    if (!user) return false;
    const tier = String(user.subscriptionTier || "").toUpperCase();
    const status = String(user.subscriptionStatus || "").toUpperCase();
    const settings = user.settings as Record<string, any> | null;
    const expiresAt = settings?.pro_trial_expires_at ? new Date(settings.pro_trial_expires_at) : null;
    const expiredTrial = status === "TRIAL" &&
        expiresAt &&
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt.getTime() < Date.now();
    if (expiredTrial) return false;
    return (tier === "PRO" || tier === "COACH_PLUS") && (status === "ACTIVE" || status === "TRIAL");
}

// ─── Service ─────────────────────────────────

export class ProgramService {
    private decorateProgram(program: any, userId?: string) {
        const starCount = program?.starCount ?? 0;
        const isStarredByMe = Array.isArray(program?.programStars) && program.programStars.length > 0;

        const { _count, programStars, ...rest } = program;
        return {
            ...rest,
            starCount,
            isStarredByMe,
            isMine: userId ? rest.userId === userId : false,
        };
    }

    /**
     * Create a new program for a user.
     */
    async createProgram(
        userId: string,
        dto: CreateProgramDto,
    ): Promise<Program> {
        if (dto.isPublic) {
            await this.assertPublicProgramLimit(userId);
        }
        return programRepository.create({
            name: dto.name,
            description: dto.description,
            isPublic: dto.isPublic ?? false,
            frequency: dto.frequency ?? 7,
            data: dto.data ?? null,
            sourceProgramId: dto.sourceProgramId,
            currentDayIndex: 0,
            user: { connect: { id: userId } },
        });
    }

    /**
     * Toggle program visibility (public/private).
     * Only the owner can change visibility.
     */
    async toggleVisibility(
        userId: string,
        programId: string,
    ): Promise<Program> {
        const program = await programRepository.findById(programId);

        if (!program) {
            throw new NotFoundError("Program not found");
        }

        if (program.userId !== userId) {
            throw new ForbiddenError("You can only modify your own programs");
        }

        if (!program.isPublic) {
            await this.assertPublicProgramLimit(userId);
        }
        return programRepository.updateVisibility(programId, !program.isPublic);
    }

    /**
     * Get all public programs (community feed).
     */
    async getPublicPrograms(
        limit?: number,
        offset?: number,
        userId?: string,
        filters?: { split?: ProgramSplitType; sort?: ProgramSortType },
    ) {
        const fetchLimit = filters?.split ? Math.max(limit ?? 20, 100) : limit;
        const programs = await programRepository.findPublicPrograms(
            fetchLimit,
            offset,
            userId,
            filters?.sort ?? "stars",
        );
        return programs
            .filter((program) => {
                if (!filters?.split) return true;
                return normalizeSplit((program.data as any)?.splitType) === filters.split;
            })
            .slice(0, limit ?? 20)
            .map((program) => this.decorateProgram(program, userId));
    }

    /**
     * Get programs by user ID.
     */
    async getUserPrograms(userId: string) {
        const programs = await programRepository.findByUserId(userId);
        return programs.map((program) => this.decorateProgram(program, userId));
    }

    /**
     * Get a specific program by ID, ensuring user has access.
     */
    async getProgramById(userId: string, programId: string) {
        console.log(`[ProgramService] getProgramById: userId=${userId}, programId=${programId}`);
        const program = await programRepository.findByIdWithSocial(programId, userId);
        if (!program) {
            console.warn(`[ProgramService] getProgramById: Program NOT FOUND in DB. programId=${programId}`);
            throw new NotFoundError("Program not found");
        }
        console.log(`[ProgramService] getProgramById: Found program. owner=${program.userId}, isPublic=${program.isPublic}, hasData=${!!program.data}`);
        if (!program.isPublic && program.userId !== userId) {
            console.warn(`[ProgramService] getProgramById: ACCESS DENIED. requestUserId=${userId}, ownerUserId=${program.userId}`);
            throw new ForbiddenError("You don't have access to this program");
        }
        const decorated: any = this.decorateProgram(program, userId);
        if (decorated.sourceProgramId) {
            const source = await programRepository.findByIdWithSocial(decorated.sourceProgramId, userId);
            if (source?.isPublic || source?.userId === userId) {
                decorated.sourceProgram = this.decorateProgram(source, userId);
                decorated.sourceUpdateAvailable = source.updatedAt > decorated.updatedAt;
            }
        }
        return decorated;
    }

    async starProgram(userId: string, programId: string) {
        const program = await programRepository.findById(programId);
        if (!program) {
            throw new NotFoundError("Program not found");
        }
        if (!program.isPublic && program.userId !== userId) {
            throw new ForbiddenError("You can only star public programs");
        }

        await programRepository.starProgram(userId, programId);
        const updated = await programRepository.findByIdWithSocial(programId, userId);
        return this.decorateProgram(updated, userId);
    }

    async unstarProgram(userId: string, programId: string) {
        const program = await programRepository.findById(programId);
        if (!program) {
            throw new NotFoundError("Program not found");
        }

        await programRepository.unstarProgram(userId, programId);
        const updated = await programRepository.findByIdWithSocial(programId, userId);
        return this.decorateProgram(updated, userId);
    }

    async copyPublicProgramToLibrary(userId: string, programId: string): Promise<Program> {
        const source = await programRepository.findById(programId);
        if (!source) {
            throw new NotFoundError("Program not found");
        }
        if (!source.isPublic && source.userId !== userId) {
            throw new ForbiddenError("You can only copy public programs");
        }
        if (source.userId === userId) {
            return source;
        }

        return this.createProgram(userId, {
            name: source.name,
            description: source.description ?? undefined,
            frequency: source.frequency,
            data: source.data,
            isPublic: false,
            sourceProgramId: source.sourceProgramId ?? source.id,
        });
    }

    async syncLibraryCopyFromSource(userId: string, programId: string): Promise<Program> {
        const copy = await programRepository.findById(programId);
        if (!copy) {
            throw new NotFoundError("Program not found");
        }
        if (copy.userId !== userId) {
            throw new ForbiddenError("You can only update your own library programs");
        }
        if (!copy.sourceProgramId) {
            throw new BadRequestError("This program is not linked to a source program");
        }

        const source = await programRepository.findById(copy.sourceProgramId);
        if (!source || !source.isPublic) {
            throw new NotFoundError("Source program is no longer available");
        }

        return programRepository.update(programId, {
            name: source.name,
            description: source.description,
            frequency: source.frequency,
            data: source.data as any,
        });
    }

    /**
     * Advance the currentDayIndex by 1, wrapping around modulo total days.
     * Only the program owner can advance the day.
     */
    async advanceDayIndex(userId: string, programId: string): Promise<Program> {
        const program = await programRepository.findById(programId);
        if (!program) {
            throw new NotFoundError("Program not found");
        }
        if (program.userId !== userId) {
            throw new ForbiddenError("You can only modify your own programs");
        }

        // Determine total days from JSONB data
        const data = program.data as any;
        const totalDays =
            Array.isArray(data?.days) && data.days.length > 0
                ? data.days.length
                : 1;

        const nextIndex = (program.currentDayIndex + 1) % totalDays;
        return programRepository.updateDayIndex(programId, nextIndex);
    }

    async setDayIndex(userId: string, programId: string, dayIndex: number): Promise<Program> {
        const program = await programRepository.findById(programId);
        if (!program) {
            throw new NotFoundError("Program not found");
        }
        if (program.userId !== userId) {
            throw new ForbiddenError("You can only modify your own programs");
        }

        const data = program.data as any;
        const totalDays = Array.isArray(data?.days) ? data.days.length : 0;
        if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= totalDays) {
            throw new BadRequestError("Invalid program day");
        }

        return programRepository.updateDayIndex(programId, dayIndex);
    }

    /**
     * Update a program. Only the owner can update.
     */
    async updateProgram(
        userId: string,
        programId: string,
        dto: Partial<CreateProgramDto>,
    ): Promise<Program> {
        const program = await programRepository.findById(programId);
        if (!program) {
            throw new NotFoundError("Program not found");
        }
        if (program.userId !== userId) {
            throw new ForbiddenError("You can only modify your own programs");
        }

        const updateData: any = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.description !== undefined) updateData.description = dto.description;
        if (dto.isPublic !== undefined) {
            if (dto.isPublic && !program.isPublic) {
                await this.assertPublicProgramLimit(userId);
            }
            updateData.isPublic = dto.isPublic;
        }
        if (dto.frequency !== undefined) updateData.frequency = dto.frequency;
        if (dto.data !== undefined) updateData.data = dto.data;

        const updated = await programRepository.update(programId, updateData);
        await this.notifyLibraryCopiesAboutSourceUpdate(program, updated);
        return updated;
    }

    /**
     * Delete a program. Only the owner can delete.
     */
    async deleteProgram(userId: string, programId: string): Promise<Program> {
        const program = await programRepository.findById(programId);
        if (!program) {
            throw new NotFoundError("Program not found");
        }
        if (program.userId !== userId) {
            throw new ForbiddenError("You can only delete your own programs");
        }
        return programRepository.deleteById(programId);
    }

    private async notifyLibraryCopiesAboutSourceUpdate(previous: Program, updated: Program) {
        if (!updated.isPublic || updated.sourceProgramId) return;
        const meaningfulChange =
            previous.name !== updated.name ||
            previous.description !== updated.description ||
            previous.frequency !== updated.frequency ||
            JSON.stringify(previous.data) !== JSON.stringify(updated.data);
        if (!meaningfulChange) return;

        const copies = await programRepository.findLibraryCopiesBySource(updated.id);
        for (const copy of copies) {
            if (copy.userId === updated.userId) continue;
            const existingUnread = await prisma.notification.findFirst({
                where: {
                    userId: copy.userId,
                    readAt: null,
                    type: "SOURCE_PROGRAM_UPDATED",
                    metadata: {
                        path: ["sourceProgramId"],
                        equals: updated.id,
                    },
                },
            });
            if (existingUnread) continue;

            await prisma.notification.create({
                data: {
                    userId: copy.userId,
                    type: "SOURCE_PROGRAM_UPDATED",
                    title: "Kaydettiğin program güncellendi",
                    message: `"${updated.name}" programının sahibi yeni bir sürüm yayınladı. İstersen kütüphanendeki kopyayı güncelleyebilirsin.`,
                    actionLabel: "Kopyayı Aç",
                    actionScreen: "ProgramDetail",
                    actionParams: { programId: copy.id },
                    metadata: {
                        programId: copy.id,
                        sourceProgramId: updated.id,
                    },
                },
            });
        }
    }

    private async assertPublicProgramLimit(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                subscriptionTier: true,
                subscriptionStatus: true,
                settings: true,
            },
        });
        const limit = isActivePaidAccess(user) ? PRO_PUBLIC_PROGRAM_LIMIT : FREE_PUBLIC_PROGRAM_LIMIT;
        const currentCount = await programRepository.countPublicByUser(userId);
        if (currentCount >= limit) {
            throw new BadRequestError(`Public program limitine ulaştın. Mevcut limitin ${limit}.`);
        }
    }
}

export const programService = new ProgramService();
