import prisma from "../config/prisma";
import { NotFoundError } from "../utils/errors";
import { moderationService } from "./moderation.service";

function displayName(user: { firstName: string; lastName: string; nickname: string | null }) {
    return user.nickname || [user.firstName, user.lastName].filter(Boolean).join(" ");
}

export class ProfileService {
    async getPublicProfile(viewerId: string, profileUserId: string) {
        const user = await prisma.user.findUnique({
            where: { id: profileUserId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                avatarUrl: true,
                settings: true,
                programs: {
                    where: { isPublic: true, sourceProgramId: null },
                    orderBy: { createdAt: "desc" },
                    include: {
                        _count: { select: { programStars: true } },
                        programStars: viewerId ? { where: { userId: viewerId }, select: { id: true } } : false,
                    },
                },
                workoutLogs: {
                    orderBy: { logDate: "desc" },
                    take: 200,
                    select: { id: true, logDate: true, data: true },
                },
            },
        });

        if (!user) throw new NotFoundError("Profile not found");
        if (viewerId !== user.id && await moderationService.isEitherBlocked(viewerId, user.id)) {
            throw new NotFoundError("Profile not found");
        }

        const visibility = String((user.settings as any)?.profile_visibility || "private");
        const isPublic = visibility === "public";
        const base = {
            id: user.id,
            displayName: displayName(user),
            firstName: user.firstName,
            lastName: user.lastName,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            isPublic,
        };

        if (!isPublic && viewerId !== user.id) {
            return {
                ...base,
                locked: true,
            };
        }

        const publicPrograms = user.programs.map((program: any) => {
            const { _count, programStars, ...rest } = program;
            return {
                ...rest,
                starCount: _count?.programStars ?? 0,
                isStarredByMe: Array.isArray(programStars) && programStars.length > 0,
            };
        });

        return {
            ...base,
            locked: false,
            stats: {
                workoutCount: user.workoutLogs.length,
                publicProgramCount: publicPrograms.length,
                totalProgramStars: publicPrograms.reduce((sum, program) => sum + (program.starCount || 0), 0),
            },
            programs: publicPrograms,
        };
    }
}

export const profileService = new ProfileService();
