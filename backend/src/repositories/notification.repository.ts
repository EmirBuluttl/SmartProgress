import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

export class NotificationRepository {
    listByUser(userId: string, limit = 30) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    }

    unreadCount(userId: string) {
        return prisma.notification.count({
            where: { userId, readAt: null },
        });
    }

    create(data: Prisma.NotificationCreateInput) {
        return prisma.notification.create({ data });
    }

    markRead(userId: string, id: string) {
        return prisma.notification.updateMany({
            where: { id, userId },
            data: { readAt: new Date() },
        });
    }

    findProgramSplitPrompt(userId: string, programId: string) {
        return prisma.notification.findFirst({
            where: {
                userId,
                type: "PROGRAM_SPLIT_TAG_PROMPT",
                metadata: {
                    path: ["programId"],
                    equals: programId,
                },
            },
        });
    }
}

export const notificationRepository = new NotificationRepository();
