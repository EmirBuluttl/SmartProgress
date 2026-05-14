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
    _count: {
        select: {
            programStars: true,
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
    ) {
        return prisma.program.findMany({
            where: { isPublic: true },
            include: socialInclude(userId),
            orderBy: [
                { programStars: { _count: "desc" } },
                { createdAt: "desc" },
            ],
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

    async starProgram(userId: string, programId: string) {
        return prisma.programStar.upsert({
            where: { userId_programId: { userId, programId } },
            update: {},
            create: {
                user: { connect: { id: userId } },
                program: { connect: { id: programId } },
            },
        });
    }

    async unstarProgram(userId: string, programId: string) {
        return prisma.programStar.deleteMany({
            where: { userId, programId },
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
