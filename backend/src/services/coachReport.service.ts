import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import prisma from "../config/prisma";
import { coachInsightService } from "./coachInsight.service";
import { coachNarrationService } from "./coachNarration.service";

function startOfIsoWeek(date = new Date()) {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - day + 1);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
}

type UpsertWeeklyReportInput = {
    userId: string;
    weekStart?: Date;
    sourceHash?: string;
    status?: string;
    data: Prisma.InputJsonValue;
};

type BestSet = {
    weight: number;
    reps: number;
    rir?: number | string | null;
};

type ExerciseHistoryEntry = {
    logId: string;
    logDate: Date;
    name: string;
    best: BestSet;
};

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeExerciseName(name: unknown): string {
    return String(name || "").trim().toLowerCase();
}

function normalizeRirValue(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value).replace(",", ".").trim();
    if (text.includes("-")) {
        const parts = text.split("-").map((part) => Number(part.trim())).filter(Number.isFinite);
        if (parts.length > 0) return parts.reduce((sum, part) => sum + part, 0) / parts.length;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function bestWorkingSet(exercise: any): BestSet | null {
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    const logged = sets
        .filter((set: any) => !set?.isWarmup && set?.effortMode !== "duration")
        .map((set: any) => ({
            weight: toNumber(set?.weight),
            reps: toNumber(set?.reps),
            rir: set?.rir,
        }))
        .filter((set: BestSet) => set.weight > 0 || set.reps > 0);
    if (logged.length === 0) return null;
    return logged.sort((a: BestSet, b: BestSet) => (b.weight - a.weight) || (b.reps - a.reps))[0];
}

function compareBestSets(previous: BestSet | null, current: BestSet | null) {
    if (!current) return { decision: "inconsistent_data", reason: "Bu hafta geçerli set verisi yok." };
    if (!previous) return { decision: "baseline", reason: "Bu hareket için kıyaslanacak önceki log yok." };
    if (current.weight > previous.weight) return { decision: "progress", reason: "Önceki loga göre ağırlık arttı." };
    if (current.weight === previous.weight && current.reps > previous.reps) return { decision: "progress", reason: "Aynı ağırlıkla tekrar arttı." };
    if (current.weight === previous.weight && current.reps === previous.reps) return { decision: "watch", reason: "Önceki logla aynı seviyede." };
    return { decision: "watch", reason: "Son log önceki logun gerisinde veya karma sinyal var." };
}

function compareExerciseHistory(entries: ExerciseHistoryEntry[]) {
    const latest = entries[entries.length - 1];
    const previous = entries[entries.length - 2];
    const beforePrevious = entries[entries.length - 3];
    const comparison = compareBestSets(previous?.best || null, latest?.best || null);
    const flags: string[] = [];

    if (!latest) {
        return {
            decision: "inconsistent_data",
            reason: "Bu hafta gecerli set verisi yok.",
            flags: ["missing_current_best"],
            currentBest: null,
            previousBest: null,
        };
    }

    if (!previous) {
        return {
            decision: "baseline",
            reason: "Bu hareket icin kiyaslanacak onceki log yok.",
            flags: ["baseline"],
            currentBest: latest.best,
            previousBest: null,
        };
    }

    const isSameAsPrevious = latest.best.weight === previous.best.weight && latest.best.reps === previous.best.reps;
    const isRegression = latest.best.weight < previous.best.weight ||
        (latest.best.weight === previous.best.weight && latest.best.reps < previous.best.reps);
    if (isRegression) flags.push("single_session_regression");
    if (isSameAsPrevious) flags.push("same_as_previous");

    if (beforePrevious) {
        const previousWasStalledOrDown = previous.best.weight < beforePrevious.best.weight ||
            (previous.best.weight === beforePrevious.best.weight && previous.best.reps <= beforePrevious.best.reps);
        const latestStalledOrDown = latest.best.weight < previous.best.weight ||
            (latest.best.weight === previous.best.weight && latest.best.reps <= previous.best.reps);

        if (previousWasStalledOrDown && latestStalledOrDown) {
            flags.push("plateau_candidate");
            const lowRir = [beforePrevious.best, previous.best, latest.best].some((set) => {
                const rir = normalizeRirValue(set.rir);
                return rir !== null && rir <= 1.25;
            });
            if (lowRir) flags.push("low_rir");
        }
    }

    if (comparison.decision === "watch" && flags.includes("plateau_candidate")) {
        return {
            ...comparison,
            reason: flags.includes("low_rir")
                ? "Son 3 sessionda progress yok ve RIR dusuk. Once RIR hedefini rahatlatmak gerekebilir."
                : "Son 3 sessionda net progress yok. Plato adayi olarak takip edilmeli.",
            flags,
            currentBest: latest.best,
            previousBest: previous.best,
        };
    }

    return {
        ...comparison,
        flags,
        currentBest: latest.best,
        previousBest: previous.best,
    };
}

function hashWorkoutSources(logs: { id: string; updatedAt: Date }[]) {
    return createHash("sha256")
        .update(["coach-report-v3", ...logs.map((log) => `${log.id}:${log.updatedAt.toISOString()}`)].join("|"))
        .digest("hex");
}

function insightTypeForAnalysis(analysis: { decision: string; flags: string[] }) {
    if (analysis.flags.includes("single_session_regression")) return "REGRESSION_DETECTED";
    if (analysis.flags.includes("plateau_candidate")) return "PLATEAU_CANDIDATE";
    if (analysis.decision === "progress") return "PROGRESS_DETECTED";
    return null;
}

export class CoachReportService {
    getWeekStart(date = new Date()) {
        return startOfIsoWeek(date);
    }

    async findWeeklyReport(userId: string, date = new Date()) {
        return prisma.coachWeeklyReport.findUnique({
            where: {
                userId_weekStart: {
                    userId,
                    weekStart: startOfIsoWeek(date),
                },
            },
        });
    }

    async upsertWeeklyReport(input: UpsertWeeklyReportInput) {
        const weekStart = input.weekStart || startOfIsoWeek();
        return prisma.coachWeeklyReport.upsert({
            where: {
                userId_weekStart: {
                    userId: input.userId,
                    weekStart,
                },
            },
            create: {
                userId: input.userId,
                weekStart,
                sourceHash: input.sourceHash,
                status: input.status || "ready",
                data: input.data,
            },
            update: {
                sourceHash: input.sourceHash,
                status: input.status || "ready",
                data: input.data,
            },
        });
    }

    async generateWeeklyReport(userId: string, date = new Date()) {
        const weekStart = startOfIsoWeek(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

        const [weekLogs, analysisLogs] = await Promise.all([
            prisma.workoutLog.findMany({
                where: {
                    userId,
                    logDate: { gte: weekStart, lt: weekEnd },
                },
                orderBy: { logDate: "asc" },
            }),
            prisma.workoutLog.findMany({
                where: {
                    userId,
                    logDate: { lt: weekEnd },
                },
                orderBy: { logDate: "desc" },
                take: 300,
            }),
        ]);

        const sourceHash = hashWorkoutSources(analysisLogs.map((log) => ({ id: log.id, updatedAt: log.updatedAt })));
        const cached = await this.findWeeklyReport(userId, weekStart);
        if (cached?.sourceHash === sourceHash) return cached;

        const historyByExercise = new Map<string, ExerciseHistoryEntry[]>();
        const chronologicalAnalysisLogs = [...analysisLogs].sort((a, b) => a.logDate.getTime() - b.logDate.getTime());
        for (const log of chronologicalAnalysisLogs) {
            const exercises = Array.isArray((log.data as any)?.exercises) ? (log.data as any).exercises : [];
            for (const exercise of exercises) {
                const key = normalizeExerciseName(exercise?.name);
                if (!key) continue;
                const best = bestWorkingSet(exercise);
                if (!best) continue;
                const history = historyByExercise.get(key) || [];
                history.push({
                    logId: log.id,
                    logDate: log.logDate,
                    name: String(exercise?.name || "Hareket"),
                    best,
                });
                historyByExercise.set(key, history);
            }
        }

        const exerciseAnalyses = Array.from(historyByExercise.values()).flatMap((history) => {
            const latest = history[history.length - 1];
            if (!latest || latest.logDate < weekStart || latest.logDate >= weekEnd) return [];
            const comparison = compareExerciseHistory(history);
            return {
                exerciseName: latest.name,
                decision: comparison.decision,
                reason: comparison.reason,
                flags: comparison.flags,
                currentBest: comparison.currentBest,
                previousBest: comparison.previousBest,
                sourceLogId: latest.logId,
                signalDate: latest.logDate,
            };
        });

        const progressCount = exerciseAnalyses.filter((item) => item.decision === "progress").length;
        const watchCount = exerciseAnalyses.filter((item) => item.decision === "watch").length;
        const plateauCount = exerciseAnalyses.filter((item) => item.flags.includes("plateau_candidate")).length;
        const regressionCount = exerciseAnalyses.filter((item) => item.flags.includes("single_session_regression")).length;
        const coachNarration = coachNarrationService.buildWeeklyNarration({
            workoutCount: weekLogs.length,
            progressCount,
            watchCount,
            plateauCount,
            regressionCount,
            exerciseAnalyses,
        });
        const data = {
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            generatedAt: new Date().toISOString(),
            workoutCount: weekLogs.length,
            progressCount,
            watchCount,
            plateauCount,
            regressionCount,
            exerciseAnalyses,
            coachNarration,
            summary: weekLogs.length === 0
                ? "Bu hafta rapor üretmek için log yok."
                : `${weekLogs.length} antrenman loglandı. ${progressCount} progress, ${plateauCount} plato adayı, ${regressionCount} gerileme sinyali var.`,
        };

        await coachInsightService.upsertMany(exerciseAnalyses.flatMap((analysis) => {
            const type = insightTypeForAnalysis(analysis);
            if (!type) return [];
            return {
                userId,
                type,
                exerciseName: analysis.exerciseName,
                decision: analysis.decision,
                reason: analysis.reason,
                flags: analysis.flags,
                currentBest: analysis.currentBest as Prisma.InputJsonValue,
                previousBest: analysis.previousBest as Prisma.InputJsonValue,
                sourceLogId: analysis.sourceLogId,
                signalDate: analysis.signalDate,
                weekStart,
                metadata: {
                    weekEnd: weekEnd.toISOString(),
                },
            };
        }));

        return this.upsertWeeklyReport({
            userId,
            weekStart,
            sourceHash,
            data: data as Prisma.InputJsonValue,
        });
    }
}

export const coachReportService = new CoachReportService();
