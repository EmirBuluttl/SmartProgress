import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

const MICROS_PER_USD = 1_000_000;

const MONTHLY_BUDGET_MICROS: Record<string, number> = {
    FREE: 0,
    PRO: 0,
    COACH_PLUS: 3 * MICROS_PER_USD,
};

type RecordAiUsageInput = {
    userId: string;
    feature: "coach_chat" | "weekly_report" | "program_explanation" | string;
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostMicros?: number;
    metadata?: Prisma.InputJsonValue;
};

function monthRange(now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
}

function clampCount(value?: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value || 0));
}

export class AiUsageService {
    async getMonthlyUsage(userId: string, now = new Date()) {
        const { start, end } = monthRange(now);
        const aggregate = await prisma.aiUsageEvent.aggregate({
            where: {
                userId,
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
            _sum: {
                inputTokens: true,
                outputTokens: true,
                estimatedCostMicros: true,
            },
            _count: true,
        });

        return {
            monthStart: start,
            monthEnd: end,
            requestCount: aggregate._count,
            inputTokens: aggregate._sum.inputTokens || 0,
            outputTokens: aggregate._sum.outputTokens || 0,
            estimatedCostMicros: aggregate._sum.estimatedCostMicros || 0,
        };
    }

    async getMonthlyBudget(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionStatus: true },
        });
        const tier = user?.subscriptionTier || "FREE";
        const isActive = user?.subscriptionStatus === "ACTIVE" || user?.subscriptionStatus === "TRIAL";
        return isActive ? MONTHLY_BUDGET_MICROS[tier] || 0 : 0;
    }

    async canConsume(userId: string, estimatedCostMicros: number) {
        const [usage, budgetMicros] = await Promise.all([
            this.getMonthlyUsage(userId),
            this.getMonthlyBudget(userId),
        ]);
        const nextCost = usage.estimatedCostMicros + clampCount(estimatedCostMicros);
        return {
            allowed: budgetMicros > 0 && nextCost <= budgetMicros,
            budgetMicros,
            usedMicros: usage.estimatedCostMicros,
            remainingMicros: Math.max(0, budgetMicros - usage.estimatedCostMicros),
            nextCostMicros: nextCost,
        };
    }

    async recordUsage(input: RecordAiUsageInput) {
        return prisma.aiUsageEvent.create({
            data: {
                userId: input.userId,
                feature: input.feature,
                provider: input.provider,
                model: input.model,
                inputTokens: clampCount(input.inputTokens),
                outputTokens: clampCount(input.outputTokens),
                estimatedCostMicros: clampCount(input.estimatedCostMicros),
                metadata: input.metadata,
            },
        });
    }
}

export const aiUsageService = new AiUsageService();
