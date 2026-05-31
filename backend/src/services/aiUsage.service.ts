import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

const MICROS_PER_USD = 1_000_000;

const MONTHLY_BUDGET_MICROS: Record<string, number> = {
    FREE: 0,
    PRO: 0,
    COACH_PLUS: 3 * MICROS_PER_USD,
};

const MONTHLY_FEATURE_LIMITS: Record<string, Partial<Record<string, number>>> = {
    FREE: {},
    PRO: {},
    COACH_PLUS: {
        coach_chat: 50,
    },
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

    async getMonthlyFeatureUsage(userId: string, feature: string, now = new Date()) {
        const { start, end } = monthRange(now);
        return prisma.aiUsageEvent.count({
            where: {
                userId,
                feature,
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        });
    }

    async getUserSubscription(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionStatus: true, settings: true },
        });
        const settings = user?.settings as Record<string, any> | null | undefined;
        const expiresAt = settings?.pro_trial_expires_at ? new Date(settings.pro_trial_expires_at) : null;
        const isExpiredTrial = user?.subscriptionStatus === "TRIAL" &&
            expiresAt &&
            Number.isFinite(expiresAt.getTime()) &&
            expiresAt.getTime() < Date.now();
        if (isExpiredTrial) {
            return { tier: "FREE", isActive: false };
        }
        const tier = user?.subscriptionTier || "FREE";
        const isActive = user?.subscriptionStatus === "ACTIVE" || user?.subscriptionStatus === "TRIAL";
        return { tier, isActive };
    }

    async getMonthlyBudget(userId: string) {
        const { tier, isActive } = await this.getUserSubscription(userId);
        return isActive ? MONTHLY_BUDGET_MICROS[tier] || 0 : 0;
    }

    async getMonthlyFeatureLimit(userId: string, feature: string) {
        const { tier, isActive } = await this.getUserSubscription(userId);
        return isActive ? MONTHLY_FEATURE_LIMITS[tier]?.[feature] || 0 : 0;
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

    async canUseFeature(userId: string, feature: string) {
        const [usedCount, limit] = await Promise.all([
            this.getMonthlyFeatureUsage(userId, feature),
            this.getMonthlyFeatureLimit(userId, feature),
        ]);
        return {
            allowed: limit > 0 && usedCount < limit,
            usedCount,
            limit,
            remainingCount: Math.max(0, limit - usedCount),
            nextCount: usedCount + 1,
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
