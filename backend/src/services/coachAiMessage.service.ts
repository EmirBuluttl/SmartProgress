import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

type CreateCoachAiMessageInput = {
    userId: string;
    question: string;
    answer: string;
    source: string;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
};

export class CoachAiMessageService {
    async listForUser(userId: string, limit = 10) {
        return prisma.coachAiMessage.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: Math.min(Math.max(limit, 1), 30),
        });
    }

    async create(input: CreateCoachAiMessageInput) {
        return prisma.coachAiMessage.create({
            data: {
                userId: input.userId,
                question: input.question,
                answer: input.answer,
                source: input.source,
                reason: input.reason,
                metadata: input.metadata,
            },
        });
    }
}

export const coachAiMessageService = new CoachAiMessageService();
