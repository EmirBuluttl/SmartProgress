// ─────────────────────────────────────────────
// Program Service
// ─────────────────────────────────────────────
import { Program } from "@prisma/client";
import { programRepository } from "../repositories/program.repository";
import { NotFoundError, ForbiddenError, BadRequestError } from "../utils/errors";

// ─── DTOs ────────────────────────────────────

export interface CreateProgramDto {
    name: string;
    description?: string;
    isPublic?: boolean;
    frequency?: number; // sessions per week (for cycle-based programs)
    data?: any;         // CycleProgramData | legacy exercises array
    sourceProgramId?: string;
}

// ─── Service ─────────────────────────────────

export class ProgramService {
    private decorateProgram(program: any, userId?: string) {
        const starCount = program?._count?.programStars ?? 0;
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

        return programRepository.updateVisibility(programId, !program.isPublic);
    }

    /**
     * Get all public programs (community feed).
     */
    async getPublicPrograms(limit?: number, offset?: number, userId?: string) {
        const programs = await programRepository.findPublicPrograms(limit, offset, userId);
        return programs.map((program) => this.decorateProgram(program, userId));
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
        return this.decorateProgram(program, userId);
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
        if (dto.isPublic !== undefined) updateData.isPublic = dto.isPublic;
        if (dto.frequency !== undefined) updateData.frequency = dto.frequency;
        if (dto.data !== undefined) updateData.data = dto.data;

        return programRepository.update(programId, updateData);
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
}

export const programService = new ProgramService();
