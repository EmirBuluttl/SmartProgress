import { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { aiUsageService } from "./aiUsage.service";

type AiFeature = "coach_chat" | "weekly_report" | "program_explanation" | string;

type GenerateTextInput = {
    userId: string;
    feature: AiFeature;
    instructions: string;
    input: string;
    fallbackText: string;
    maxOutputTokens?: number;
    metadata?: Prisma.InputJsonValue;
};

type GenerateTextResult = {
    text: string;
    source: "openai" | "fallback";
    reason?: "provider_disabled" | "budget_denied" | "provider_error" | "feature_limit_denied";
    model?: string;
    usage: {
        estimatedInputTokens: number;
        estimatedOutputTokens: number;
        estimatedCostMicros: number;
        actualInputTokens?: number;
        actualOutputTokens?: number;
        actualCostMicros?: number;
    };
    budget?: {
        budgetMicros: number;
        usedMicros: number;
        remainingMicros: number;
        nextCostMicros: number;
    };
    quota?: {
        limit: number;
        usedCount: number;
        remainingCount: number;
        nextCount: number;
    };
};

function clampPositive(value: number, fallback: number) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function estimateTokens(text: string) {
    return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCostMicros(inputTokens: number, outputTokens: number) {
    const inputCost = (inputTokens / 1000) * clampPositive(env.AI_INPUT_COST_MICROS_PER_1K, 1000);
    const outputCost = (outputTokens / 1000) * clampPositive(env.AI_OUTPUT_COST_MICROS_PER_1K, 4000);
    return Math.ceil(inputCost + outputCost);
}

function extractOutputText(payload: any): string {
    if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const parts: string[] = [];
    for (const item of Array.isArray(payload?.output) ? payload.output : []) {
        for (const content of Array.isArray(item?.content) ? item.content : []) {
            if (typeof content?.text === "string") parts.push(content.text);
        }
    }
    return parts.join("\n").trim();
}

export const SMART_PROGRESS_COACH_INSTRUCTIONS = [
    "Sen SmartProgress premium koc katmanisin.",
    "Kural disina cikma; sadece verilen kullanici verileri, program kurallari ve rapor sinyalleri uzerinden yorum yap.",
    "Tibbi teshis, tedavi veya kesin saglik iddiasi verme. Agri, sakatlik veya hastalik varsa doktora/uzmana yonlendir.",
    "Program degisikliklerini otomatik uygulama; kullanici onayini sart kos.",
    "Kisa, net ve uygulanabilir Turkce cevap ver.",
].join("\n");

export class AiProviderService {
    estimateRequest(input: Pick<GenerateTextInput, "instructions" | "input" | "maxOutputTokens">) {
        const maxOutputTokens = clampPositive(input.maxOutputTokens || env.AI_DEFAULT_MAX_OUTPUT_TOKENS, 500);
        const estimatedInputTokens = estimateTokens(`${input.instructions}\n${input.input}`);
        const estimatedOutputTokens = maxOutputTokens;
        return {
            estimatedInputTokens,
            estimatedOutputTokens,
            estimatedCostMicros: estimateCostMicros(estimatedInputTokens, estimatedOutputTokens),
        };
    }

    async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
        const estimate = this.estimateRequest(input);
        const [featureQuota, budget] = await Promise.all([
            aiUsageService.canUseFeature(input.userId, input.feature),
            aiUsageService.canConsume(input.userId, estimate.estimatedCostMicros),
        ]);
        const quotaSnapshot = {
            limit: featureQuota.limit,
            usedCount: featureQuota.usedCount,
            remainingCount: featureQuota.remainingCount,
            nextCount: featureQuota.nextCount,
        };
        const budgetSnapshot = {
            budgetMicros: budget.budgetMicros,
            usedMicros: budget.usedMicros,
            remainingMicros: budget.remainingMicros,
            nextCostMicros: budget.nextCostMicros,
        };

        if (!featureQuota.allowed) {
            return {
                text: "Bu ayki AI koç soru hakkın doldu. Rule-based haftalık rapor ve program wizard yine kullanılabilir.",
                source: "fallback",
                reason: "feature_limit_denied",
                usage: estimate,
                budget: budgetSnapshot,
                quota: quotaSnapshot,
            };
        }

        if (!budget.allowed) {
            return {
                text: input.fallbackText,
                source: "fallback",
                reason: "budget_denied",
                usage: estimate,
                budget: budgetSnapshot,
                quota: quotaSnapshot,
            };
        }

        const provider = env.AI_PROVIDER.toLowerCase();
        if (provider !== "openai" || !env.OPENAI_API_KEY) {
            await aiUsageService.recordUsage({
                userId: input.userId,
                feature: input.feature,
                provider: "mock",
                model: "rule-based-fallback",
                inputTokens: estimate.estimatedInputTokens,
                outputTokens: 0,
                estimatedCostMicros: 0,
                metadata: input.metadata,
            });
            return {
                text: input.fallbackText,
                source: "fallback",
                reason: "provider_disabled",
                model: env.OPENAI_MODEL,
                usage: estimate,
                budget: budgetSnapshot,
                quota: quotaSnapshot,
            };
        }

        try {
            const response = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: env.OPENAI_MODEL,
                    instructions: input.instructions,
                    input: input.input,
                    max_output_tokens: estimate.estimatedOutputTokens,
                    store: false,
                }),
            });

            const payload: any = await response.json();
            if (!response.ok) {
                throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "OpenAI request failed");
            }

            const text = extractOutputText(payload) || input.fallbackText;
            const actualInputTokens = Number(payload?.usage?.input_tokens) || estimate.estimatedInputTokens;
            const actualOutputTokens = Number(payload?.usage?.output_tokens) || estimate.estimatedOutputTokens;
            const actualCostMicros = estimateCostMicros(actualInputTokens, actualOutputTokens);

            await aiUsageService.recordUsage({
                userId: input.userId,
                feature: input.feature,
                provider: "openai",
                model: env.OPENAI_MODEL,
                inputTokens: actualInputTokens,
                outputTokens: actualOutputTokens,
                estimatedCostMicros: actualCostMicros,
                metadata: input.metadata,
            });

            return {
                text,
                source: "openai",
                model: env.OPENAI_MODEL,
                usage: {
                    ...estimate,
                    actualInputTokens,
                    actualOutputTokens,
                    actualCostMicros,
                },
                budget: budgetSnapshot,
                quota: quotaSnapshot,
            };
        } catch (error) {
            console.error("[AiProviderService] provider call failed:", error);
            return {
                text: input.fallbackText,
                source: "fallback",
                reason: "provider_error",
                model: env.OPENAI_MODEL,
                usage: estimate,
                budget: budgetSnapshot,
                quota: quotaSnapshot,
            };
        }
    }
}

export const aiProviderService = new AiProviderService();
