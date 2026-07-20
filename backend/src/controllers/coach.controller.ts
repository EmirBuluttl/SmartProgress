import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { aiProviderService, SMART_PROGRESS_COACH_INSTRUCTIONS } from "../services/aiProvider.service";
import { aiUsageService } from "../services/aiUsage.service";
import { coachAiMessageService } from "../services/coachAiMessage.service";
import { coachInsightService } from "../services/coachInsight.service";
import { coachReportService } from "../services/coachReport.service";

const askCoachSchema = z.object({
    question: z.string().trim().min(3).max(1200),
    context: z.record(z.unknown()).optional(),
});

const recommendationDecisionSchema = z.object({
    decision: z.enum(["accepted", "rejected", "follow"]),
});

function formatBestSet(set?: any) {
    if (!set) return "önceki veri yok";
    const rirText = set.rir !== null && set.rir !== undefined && String(set.rir).trim()
        ? `, RIR ${set.rir}`
        : "";
    if (set.weightMode === "bodyweight") {
        const external = Number(set.externalWeight || 0);
        const loadText = external > 0
            ? `BW + ${external} kg`
            : `BW${set.bodyWeight ? ` (${set.bodyWeight} kg)` : ""}`;
        return `${loadText} x ${set.reps || 0}${rirText}`;
    }
    return `${set.weight || 0} kg x ${set.reps || 0}${rirText}`;
}

function buildRuleBasedCoachAnswer(question: string, reportData: any) {
    const analyses = Array.isArray(reportData?.exerciseAnalyses) ? reportData.exerciseAnalyses : [];
    const progressItems = analyses.filter((item: any) => item.decision === "progress");
    const plateauItems = analyses.filter((item: any) => item.flags?.includes("plateau_candidate"));
    const regressionItems = analyses.filter((item: any) => item.flags?.includes("single_session_regression"));
    const watchItems = analyses.filter((item: any) => item.decision === "watch");
    const weightIncreaseItems = analyses.filter((item: any) => item.flags?.includes("weight_increase_candidate"));
    const rirAdjustmentItems = analyses.filter((item: any) => item.flags?.includes("rir_adjustment_candidate"));
    const volumeReduceItems = analyses.filter((item: any) => item.flags?.includes("volume_reduce_candidate"));
    const volumeIncreaseItems = analyses.filter((item: any) => item.flags?.includes("volume_increase_candidate"));

    if (analyses.length === 0) {
        return [
            `Sorun: ${question}`,
            "Karar: Bu hafta yorumlanabilir çalışma seti yok. Koç kararını tahminle değil, log verisiyle vereceğim.",
            "Aksiyon: Bir sonraki antrenmanda aynı hareket isimleriyle kg, tekrar ve mümkünse RIR logla. En az 2 benzer session sonrası net progress/plato sinyali üretebilirim.",
        ].join("\n\n");
    }

    const lines = [
        `Sorun: ${question}`,
        `Veri özeti: ${reportData?.workoutCount || 0} antrenman, ${progressItems.length} progress, ${plateauItems.length} plato adayı, ${regressionItems.length} gerileme sinyali.`,
        "Karar: Programı otomatik değiştirmiyorum; aşağıdaki aksiyonlar kullanıcı onayıyla uygulanmalı.",
    ];

    if (weightIncreaseItems.length > 0) {
        const item = weightIncreaseItems[0];
        lines.push(`Ağırlık artırma adayı: ${item.exerciseName} ${formatBestSet(item.previousBest)} -> ${formatBestSet(item.currentBest)}. Tekrar aralığının üst sınırına ulaştığın için sonraki benzer sessionda form bozulmadan minimum kg artışı dene.`);
    } else if (progressItems.length > 0) {
        const item = progressItems[0];
        lines.push(`En net pozitif sinyal: ${item.exerciseName} ${formatBestSet(item.previousBest)} -> ${formatBestSet(item.currentBest)}. Aynı form standardını koru; henüz ekstra set eklemek zorunda değilsin.`);
    }

    if (rirAdjustmentItems.length > 0) {
        const item = rirAdjustmentItems[0];
        lines.push(`RIR müdahale adayı: ${item.exerciseName}. Son 3 benzer logda progress yok ve RIR düşük görünüyor. İlk öneri hacim kısmak değil; hedef RIR'ı biraz rahatlatıp toparlanmayı test etmek.`);
    } else if (volumeReduceItems.length > 0) {
        const item = volumeReduceItems[0];
        lines.push(`Hacim azaltma adayı: ${item.exerciseName}. RIR düşük görünmeden plato oluşmuş; kullanıcı onayıyla bu hareketten 1 çalışma seti azaltma test edilebilir.`);
    } else if (plateauItems.length > 0) {
        const names = plateauItems.slice(0, 3).map((item: any) => item.exerciseName).join(", ");
        lines.push(`Takip edilmesi gereken plato adayları: ${names}. Bir sonraki aynı sessionda dinlenme süresi, set odağı ve RIR tutarlılığını özellikle izle.`);
    }

    if (volumeIncreaseItems.length > 0) {
        const item = volumeIncreaseItems[0];
        lines.push(`Set artırma adayı: ${item.exerciseName}. Üst üste güçlü progress var; bu sinyal devam ederse kullanıcı onayıyla 1 set eklemek mantıklı olabilir.`);
    }

    if (regressionItems.length > 0) {
        const item = regressionItems[0];
        lines.push(`Gerileme sinyali: ${item.exerciseName} ${formatBestSet(item.previousBest)} -> ${formatBestSet(item.currentBest)}. Tek log panik sebebi değil; uyku, beslenme, stres ve önceki set yorgunluğunu not alıp sonraki benzer logda doğrula.`);
    }

    if (progressItems.length === 0 && plateauItems.length === 0 && regressionItems.length === 0 && watchItems.length > 0) {
        const names = watchItems.slice(0, 3).map((item: any) => item.exerciseName).join(", ");
        lines.push(`Takipte: ${names}. Henüz sert müdahale yok; sonraki sessionda aynı hareketlerde kg/tekrar/RIR tutarlılığını görmemiz lazım.`);
    }

    lines.push("Kısa aksiyon: Sıradaki benzer antrenmanda önce formu ve dinlenmeyi sabitle. Sonra ya aynı kg ile +1 tekrar, ya da üst tekrar sınırına ulaştıysan minimum kg artışı dene. RIR 0-1 çok sık geliyorsa toparlanmayı bozabilir.");
    return lines.join("\n\n");
}

export class CoachController {
    async weeklyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const date = typeof req.query.date === "string" ? new Date(req.query.date) : new Date();
            const report = await coachReportService.generateWeeklyReport(userId, date);
            res.status(200).json(report);
        } catch (error) {
            next(error);
        }
    }

    async signalRatios(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const range = typeof req.query.range === "string" ? req.query.range : "30";
            const ratios = await coachReportService.generateSignalRatios(userId, range);
            res.status(200).json(ratios);
        } catch (error) {
            next(error);
        }
    }

    async aiStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const [usage, budgetMicros, coachChatUsed, coachChatLimit] = await Promise.all([
                aiUsageService.getMonthlyUsage(userId),
                aiUsageService.getMonthlyBudget(userId),
                aiUsageService.getMonthlyFeatureUsage(userId, "coach_chat"),
                aiUsageService.getMonthlyFeatureLimit(userId, "coach_chat"),
            ]);
            res.status(200).json({
                monthStart: usage.monthStart,
                monthEnd: usage.monthEnd,
                requestCount: usage.requestCount,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                usedMicros: usage.estimatedCostMicros,
                budgetMicros,
                remainingMicros: Math.max(0, budgetMicros - usage.estimatedCostMicros),
                coachChat: {
                    used: coachChatUsed,
                    limit: coachChatLimit,
                    remaining: Math.max(0, coachChatLimit - coachChatUsed),
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async insights(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
            const insights = await coachInsightService.listForUser(userId, limit);
            res.status(200).json({ data: insights });
        } catch (error) {
            next(error);
        }
    }

    async updateInsightRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const insightId = String(req.params.insightId || "");
            const parsed = recommendationDecisionSchema.parse(req.body);
            const insight = await coachInsightService.updateRecommendationDecision(userId, insightId, parsed.decision);
            if (!insight) {
                res.status(404).json({ error: "Coach insight not found" });
                return;
            }
            res.status(200).json({ data: insight });
        } catch (error) {
            next(error);
        }
    }

    async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const parsed = askCoachSchema.parse(req.body);
            const report = await coachReportService.generateWeeklyReport(userId);
            const reportData = report.data as any;
            const fallbackText = buildRuleBasedCoachAnswer(parsed.question, reportData);

            const result = await aiProviderService.generateText({
                userId,
                feature: "coach_chat",
                instructions: SMART_PROGRESS_COACH_INSTRUCTIONS,
                input: JSON.stringify({
                    question: parsed.question,
                    context: parsed.context || {},
                    weeklyReport: reportData,
                }),
                fallbackText,
                metadata: {
                    questionLength: parsed.question.length,
                    hasContext: !!parsed.context,
                },
            });

            const shouldPersistMessage = result.reason !== "feature_limit_denied" && result.reason !== "budget_denied";
            const message = shouldPersistMessage
                ? await coachAiMessageService.create({
                    userId,
                    question: parsed.question,
                    answer: result.text,
                    source: result.source,
                    reason: result.reason,
                    metadata: {
                        usage: result.usage,
                        budget: result.budget,
                        quota: result.quota,
                    },
                })
                : null;

            res.status(200).json({ ...result, message });
        } catch (error) {
            next(error);
        }
    }

    async aiMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
            const messages = await coachAiMessageService.listForUser(userId, limit);
            res.status(200).json({ data: messages });
        } catch (error) {
            next(error);
        }
    }
}

export const coachController = new CoachController();
