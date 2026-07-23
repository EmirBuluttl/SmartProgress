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

export type CoachRecommendationDecision = "accepted" | "rejected" | "follow";

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeMetadata(
    current: Prisma.JsonValue | null | undefined,
    next: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue | undefined {
    const nextRecord = isRecord(next) ? next as Record<string, unknown> : null;
    const currentRecord = isRecord(current) ? current as Record<string, unknown> : null;
    const nextMetadata = nextRecord ? { ...nextRecord } : undefined;
    if (!nextMetadata) return undefined;

    if (currentRecord?.recommendationDecision && !nextMetadata.recommendationDecision) {
        nextMetadata.recommendationDecision = currentRecord.recommendationDecision as Prisma.InputJsonValue;
    }

    return nextMetadata as Prisma.InputJsonValue;
}

export class CoachInsightService {
    async syncWeekInsights(userId: string, weekStart: Date, insights: CoachInsightInput[]) {
        const current = await prisma.coachInsight.findMany({
            where: { userId, weekStart },
            select: { id: true, type: true, exerciseName: true, sourceLogId: true },
        });
        const keepKeys = new Set(insights.map((insight) =>
            `${insight.type}|${insight.exerciseName}|${insight.sourceLogId}`,
        ));
        const staleIds = current
            .filter((insight) => !keepKeys.has(`${insight.type}|${insight.exerciseName}|${insight.sourceLogId}`))
            .map((insight) => insight.id);

        if (staleIds.length > 0) {
            await prisma.coachInsight.deleteMany({
                where: { id: { in: staleIds }, userId },
            });
        }

        return this.upsertMany(insights);
    }

    async upsertMany(insights: CoachInsightInput[]) {
        if (insights.length === 0) return [];

        return Promise.all(insights.map(async (insight) => {
            const where = {
                userId_type_exerciseName_sourceLogId: {
                    userId: insight.userId,
                    type: insight.type,
                    exerciseName: insight.exerciseName,
                    sourceLogId: insight.sourceLogId,
                },
            };
            const current = await prisma.coachInsight.findUnique({ where });
            const metadata = mergeMetadata(current?.metadata, insight.metadata);

            return prisma.coachInsight.upsert({
                where,
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
                    metadata,
                },
                update: {
                    decision: insight.decision,
                    reason: insight.reason,
                    flags: insight.flags || [],
                    currentBest: insight.currentBest || undefined,
                    previousBest: insight.previousBest || undefined,
                    signalDate: insight.signalDate,
                    weekStart: insight.weekStart,
                    metadata,
                },
            });
        }));
    }

    async listForUser(userId: string, limit = 20) {
        return prisma.coachInsight.findMany({
            where: { userId },
            orderBy: { signalDate: "desc" },
            take: Math.min(Math.max(limit, 1), 50),
        });
    }

    async updateRecommendationDecision(
        userId: string,
        insightId: string,
        decision: CoachRecommendationDecision,
        programPatch?: Prisma.InputJsonValue | null,
    ) {
        const insight = await prisma.coachInsight.findFirst({
            where: { id: insightId, userId },
        });
        if (!insight) return null;

        const metadata: Record<string, unknown> = isRecord(insight.metadata) ? { ...insight.metadata } : {};
        metadata.recommendationDecision = {
            decision,
            decidedAt: new Date().toISOString(),
        };
        if (programPatch !== undefined) {
            metadata.programPatch = programPatch;
        }

        return prisma.coachInsight.update({
            where: { id: insight.id },
            data: { metadata: metadata as Prisma.InputJsonValue },
        });
    }
}

export const coachInsightService = new CoachInsightService();
