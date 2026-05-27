import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

export type CoachInsightInput = {
    userId: string;
    type: string;
    exerciseName: string;
    decision: string;
    reason: string;
    flags?: string[];
    currentBest?: Prisma.InputJsonValue | null;
    previousBest?: Prisma.InputJsonValue | null;
    sourceLogId: string;
    signalDate: Date;
    weekStart: Date;
    metadata?: Prisma.InputJsonValue | null;
};

export class CoachInsightService {
    async upsertMany(insights: CoachInsightInput[]) {
        if (insights.length === 0) return [];

        return Promise.all(insights.map((insight) => prisma.coachInsight.upsert({
            where: {
                userId_type_exerciseName_sourceLogId: {
                    userId: insight.userId,
                    type: insight.type,
                    exerciseName: insight.exerciseName,
                    sourceLogId: insight.sourceLogId,
                },
            },
            create: {
                userId: insight.userId,
                type: insight.type,
                exerciseName: insight.exerciseName,
                decision: insight.decision,
                reason: insight.reason,
                flags: insight.flags || [],
                currentBest: insight.currentBest || undefined,
                previousBest: insight.previousBest || undefined,
                sourceLogId: insight.sourceLogId,
                signalDate: insight.signalDate,
                weekStart: insight.weekStart,
                metadata: insight.metadata || undefined,
            },
            update: {
                decision: insight.decision,
                reason: insight.reason,
                flags: insight.flags || [],
                currentBest: insight.currentBest || undefined,
                previousBest: insight.previousBest || undefined,
                signalDate: insight.signalDate,
                weekStart: insight.weekStart,
                metadata: insight.metadata || undefined,
            },
        })));
    }

    async listForUser(userId: string, limit = 20) {
        return prisma.coachInsight.findMany({
            where: { userId },
            orderBy: { signalDate: "desc" },
            take: Math.min(Math.max(limit, 1), 50),
        });
    }
}

export const coachInsightService = new CoachInsightService();
