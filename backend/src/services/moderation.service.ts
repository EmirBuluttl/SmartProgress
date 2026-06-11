import prisma from "../config/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";

export type ReportTargetType = "PROFILE" | "PROFILE_PHOTO" | "PROGRAM";

export interface CreateReportDto {
    targetType: ReportTargetType;
    targetUserId?: string;
    targetProgramId?: string;
    reason: string;
    details?: string;
}

const VALID_REASONS = new Set(["inappropriate", "spam", "harassment", "misleading", "other"]);

export class ModerationService {
    async getBlockedUserIds(viewerId?: string): Promise<string[]> {
        if (!viewerId) return [];
        const rows = await (prisma as any).userBlock.findMany({
            where: { blockerId: viewerId },
            select: { blockedUserId: true },
        });
        return rows.map((row: any) => row.blockedUserId);
    }

    async isEitherBlocked(viewerId: string, targetUserId: string): Promise<boolean> {
        if (viewerId === targetUserId) return false;
        const block = await (prisma as any).userBlock.findFirst({
            where: {
                OR: [
                    { blockerId: viewerId, blockedUserId: targetUserId },
                    { blockerId: targetUserId, blockedUserId: viewerId },
                ],
            },
            select: { id: true },
        });
        return !!block;
    }

    async createReport(reporterId: string, dto: CreateReportDto) {
        const reason = dto.reason.trim();
        if (!VALID_REASONS.has(reason)) {
            throw new BadRequestError("Invalid report reason");
        }

        let targetUserId = dto.targetUserId;
        let targetProgramId = dto.targetProgramId;

        if (dto.targetType === "PROGRAM") {
            if (!targetProgramId) throw new BadRequestError("Program report target is required");
            const program = await prisma.program.findUnique({
                where: { id: targetProgramId },
                select: { id: true, userId: true, isPublic: true },
            });
            if (!program || !program.isPublic) throw new NotFoundError("Program not found");
            targetUserId = program.userId;
        } else {
            if (!targetUserId) throw new BadRequestError("Profile report target is required");
            const user = await prisma.user.findUnique({
                where: { id: targetUserId },
                select: { id: true },
            });
            if (!user) throw new NotFoundError("Profile not found");
        }

        if (targetUserId === reporterId) {
            throw new BadRequestError("You cannot report your own content");
        }

        return (prisma as any).contentReport.create({
            data: {
                reporterId,
                targetType: dto.targetType,
                targetUserId,
                targetProgramId,
                reason,
                details: dto.details?.trim() || null,
                metadata: {
                    source: "in_app",
                },
            },
        });
    }

    async blockUser(blockerId: string, blockedUserId: string) {
        if (blockerId === blockedUserId) {
            throw new BadRequestError("You cannot block yourself");
        }
        const user = await prisma.user.findUnique({
            where: { id: blockedUserId },
            select: { id: true },
        });
        if (!user) throw new NotFoundError("User not found");

        return (prisma as any).userBlock.upsert({
            where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
            update: {},
            create: { blockerId, blockedUserId },
        });
    }

    async unblockUser(blockerId: string, blockedUserId: string) {
        if (blockerId === blockedUserId) {
            throw new ForbiddenError("Invalid block target");
        }
        await (prisma as any).userBlock.deleteMany({
            where: { blockerId, blockedUserId },
        });
        return { blockedUserId };
    }
}

export const moderationService = new ModerationService();
