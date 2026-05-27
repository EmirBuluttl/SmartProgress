import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { aiProviderService, SMART_PROGRESS_COACH_INSTRUCTIONS } from "../services/aiProvider.service";
import { aiUsageService } from "../services/aiUsage.service";
import { coachReportService } from "../services/coachReport.service";

const askCoachSchema = z.object({
    question: z.string().trim().min(3).max(1200),
    context: z.record(z.unknown()).optional(),
});

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

    async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const parsed = askCoachSchema.parse(req.body);
            const report = await coachReportService.generateWeeklyReport(userId);
            const reportData = report.data as any;
            const fallbackText = reportData?.coachNarration?.summary
                || reportData?.summary
                || "Koç cevabı için önce birkaç antrenman logu oluşturman gerekiyor.";

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

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const coachController = new CoachController();
