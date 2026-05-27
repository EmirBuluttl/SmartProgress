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

function formatBestSet(set?: any) {
    if (!set) return "önceki veri yok";
    const rirText = set.rir !== null && set.rir !== undefined && String(set.rir).trim()
        ? `, RIR ${set.rir}`
        : "";
    return `${set.weight || 0} kg x ${set.reps || 0}${rirText}`;
}

function buildRuleBasedCoachAnswer(question: string, reportData: any) {
    const analyses = Array.isArray(reportData?.exerciseAnalyses) ? reportData.exerciseAnalyses : [];
    const progressItems = analyses.filter((item: any) => item.decision === "progress");
    const plateauItems = analyses.filter((item: any) => item.flags?.includes("plateau_candidate"));
    const regressionItems = analyses.filter((item: any) => item.flags?.includes("single_session_regression"));
    const watchItems = analyses.filter((item: any) => item.decision === "watch");

    if (analyses.length === 0) {
        return "Bu soruya net koç cevabı verebilmem için bu haftadan en az birkaç geçerli çalışma seti logu gerekiyor. Şimdilik hedefin: aynı hareket isimleriyle kg, tekrar ve mümkünse RIR loglarını tutarlı girmek.";
    }

    const lines = [
        `Sorunu gördüm: "${question}". Bu cevap güvenli rule-based koç cevabı; programı otomatik değiştirmiyorum.`,
    ];

    if (progressItems.length > 0) {
        const item = progressItems[0];
        lines.push(`En net pozitif sinyal ${item.exerciseName}: ${formatBestSet(item.previousBest)} -> ${formatBestSet(item.currentBest)}. Burada aynı form standardını koruyarak mevcut ilerleme yoluna devam et.`);
    }

    if (plateauItems.length > 0) {
        const names = plateauItems.slice(0, 3).map((item: any) => item.exerciseName).join(", ");
        lines.push(`${names} için plato adayı sinyali var. Bir sonraki aynı sessionda RIR hedefini, dinlenme süreni ve set kalitesini özellikle kontrol et; tekrar aynı kalırsa hacim veya RIR ayarı kullanıcı onayıyla gündeme alınmalı.`);
    }

    if (regressionItems.length > 0) {
        const item = regressionItems[0];
        lines.push(`${item.exerciseName} önceki logun gerisine düşmüş: ${formatBestSet(item.previousBest)} -> ${formatBestSet(item.currentBest)}. Bu tek başına panik sebebi değil; uyku, beslenme, stres ve önceki set yorgunluğunu not alıp bir sonraki logda tekrar doğrula.`);
    }

    if (progressItems.length === 0 && plateauItems.length === 0 && regressionItems.length === 0 && watchItems.length > 0) {
        const names = watchItems.slice(0, 3).map((item: any) => item.exerciseName).join(", ");
        lines.push(`${names} takipte. Henüz sert müdahale değil; sonraki sessionda aynı hareketlerde kg/tekrar/RIR tutarlılığını görmemiz lazım.`);
    }

    lines.push("Kısa aksiyon: sıradaki benzer antrenmanda önce formu sabitle, sonra aynı kg ile +1 tekrar veya uygun minimum kg artışı dene. RIR 0-1 çok sık geliyorsa toparlanmayı bozabilir.");
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
