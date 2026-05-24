import prisma from "../config/prisma";
import { notificationRepository } from "../repositories/notification.repository";

export class NotificationService {
    async listForUser(userId: string, limit?: number) {
        await this.ensureSplitTagPromptNotificationsForUser(userId);
        const [items, unreadCount] = await Promise.all([
            notificationRepository.listByUser(userId, limit),
            notificationRepository.unreadCount(userId),
        ]);
        return { notifications: items, unreadCount };
    }

    async markRead(userId: string, id: string) {
        await notificationRepository.markRead(userId, id);
        return this.listForUser(userId);
    }

    async clearForUser(userId: string) {
        await notificationRepository.clearForUser(userId);
        const [items, unreadCount] = await Promise.all([
            notificationRepository.listByUser(userId),
            notificationRepository.unreadCount(userId),
        ]);
        return { notifications: items, unreadCount };
    }

    async ensureSplitTagPromptNotificationsForUser(userId: string) {
        const programs = await prisma.program.findMany({
            where: {
                userId,
                isPublic: true,
                sourceProgramId: null,
            },
            select: {
                id: true,
                userId: true,
                name: true,
                data: true,
            },
        });

        let created = 0;
        for (const program of programs) {
            const splitType = String((program.data as any)?.splitType || "").trim();
            if (splitType) continue;

            const existing = await notificationRepository.findProgramSplitPrompt(program.userId, program.id);
            if (existing) continue;

            await notificationRepository.create({
                user: { connect: { id: program.userId } },
                type: "PROGRAM_SPLIT_TAG_PROMPT",
                title: "Program etiketini güncelle",
                message: `"${program.name}" programının keşfette daha kolay bulunması için split etiketini seçmek ister misin?`,
                actionLabel: "Programı Aç",
                actionScreen: "ProgramDetail",
                actionParams: { programId: program.id },
                metadata: { programId: program.id },
            });
            created += 1;
        }

        if (created > 0) {
            console.log(`[NotificationService] Created ${created} split tag prompt notifications`);
        }
    }
}

export const notificationService = new NotificationService();
