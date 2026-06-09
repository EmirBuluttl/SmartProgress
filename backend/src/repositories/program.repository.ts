// ─────────────────────────────────────────────
// Program Repository
// ─────────────────────────────────────────────
import { Prisma, Program } from "@prisma/client";
import prisma from "../config/prisma";

const socialInclude = (userId?: string) => ({
    user: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            avatarUrl: true,
        },
    },
    ...(userId
        ? {
            programStars: {
                where: { userId },
                select: { id: true },
            },
        }
        : {}),
});

export class ProgramRepository {
    /**
     * Create a new program.
     */
    async create(data: Prisma.ProgramCreateInput): Promise<Program> {
        return prisma.program.create({ data });
    }

    /**
     * Find a program by ID.
     */
    async findById(id: string): Promise<Program | null> {
        return prisma.program.findUnique({
            where: { id },
        });
    }

    async findByIdWithSocial(id: string, userId?: string) {
        return prisma.program.findUnique({
            where: { id },
            include: socialInclude(userId),
        });
    }

    async findLibraryCopiesBySource(sourceProgramId: string) {
        return prisma.program.findMany({
            where: {
                sourceProgramId,
            },
            select: {
                id: true,
                userId: true,
                name: true,
                updatedAt: true,
            },
        });
    }

    /**
     * Update program visibility (public/private).
     */
    async updateVisibility(id: string, isPublic: boolean): Promise<Program> {
        return prisma.program.update({
            where: { id },
            data: { isPublic },
        });
    }

    /**
     * Get all public programs with user info.
     */
    async findPublicPrograms(
        limit = 20,
        offset = 0,
        userId?: string,
        sort: "stars" | "newest" | "oldest" = "stars",
    ) {
        const orderBy =
            sort === "oldest"
                ? [{ createdAt: "asc" as const }]
                : sort === "newest"
                    ? [{ createdAt: "desc" as const }]
                    : [
                        { starCount: "desc" as const },
                        { createdAt: "desc" as const },
                    ];

        return prisma.program.findMany({
            where: {
                isPublic: true,
                sourceProgramId: null,
            },
            include: socialInclude(userId),
            orderBy,
            take: limit,
            skip: offset,
        });
    }

    /**
     * Get programs by user ID.
     */
    async findByUserId(userId: string) {
        return prisma.program.findMany({
            where: { userId },
            include: socialInclude(userId),
            orderBy: { createdAt: "desc" },
        });
    }

    async countPublicByUser(userId: string): Promise<number> {
        return prisma.program.count({
            where: {
                userId,
                isPublic: true,
            },
        });
    }

    async starProgram(userId: string, programId: string) {
        return prisma.$transaction(async (tx) => {
            const existingStar = await tx.programStar.findUnique({
                where: { userId_programId: { userId, programId } },
            });
            if (existingStar) {
                return existingStar;
            }
            const star = await tx.programStar.create({
                data: {
                    user: { connect: { id: userId } },
                    program: { connect: { id: programId } },
                },
            });
            await tx.program.update({
                where: { id: programId },
                data: { starCount: { increment: 1 } },
            });
            return star;
        });
    }

    async unstarProgram(userId: string, programId: string) {
        return prisma.$transaction(async (tx) => {
            const existingStar = await tx.programStar.findUnique({
                where: { userId_programId: { userId, programId } },
            });
            if (!existingStar) {
                return { count: 0 };
            }
            await tx.programStar.delete({
                where: { userId_programId: { userId, programId } },
            });
            const program = await tx.program.findUnique({
                where: { id: programId },
                select: { starCount: true },
            });
            const newStarCount = program ? Math.max(0, program.starCount - 1) : 0;
            await tx.program.update({
                where: { id: programId },
                data: { starCount: newStarCount },
            });
            return { count: 1 };
        });
    }

    /**
     * Update the currentDayIndex for a cycle-based program.
     */
    async updateDayIndex(id: string, newIndex: number): Promise<Program> {
        return prisma.program.update({
            where: { id },
            data: { currentDayIndex: newIndex },
        });
    }

    /**
     * Generic update for a program.
     */
    async update(id: string, data: Prisma.ProgramUpdateInput): Promise<Program> {
        return prisma.program.update({ where: { id }, data });
    }

    /**
     * Delete a program by ID.
     */
    async deleteById(id: string): Promise<Program> {
        return prisma.program.delete({ where: { id } });
    }
}

export const programRepository = new ProgramRepository();
