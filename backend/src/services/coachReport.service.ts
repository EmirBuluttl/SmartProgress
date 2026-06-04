import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import prisma from "../config/prisma";
import { coachInsightService } from "./coachInsight.service";
import { coachNarrationService } from "./coachNarration.service";
import { compareExerciseHistory, resolveCoachSetLoad, type CoachBestSet, type CoachExerciseHistoryEntry } from "./coachSignalEngine";

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

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeExerciseName(name: unknown): string {
    return String(name || "").trim().toLowerCase();
}

function exerciseHistoryKey(exercise: any): string {
    const exerciseId = String(exercise?.exerciseId || "").trim();
    if (exerciseId) return `id:${exerciseId}`;
    return normalizeExerciseName(exercise?.name);
}

function bestWorkingSet(exercise: any): CoachBestSet | null {
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    const logged = sets
        .filter((set: any) => !set?.isWarmup && set?.analysisExcluded !== true && set?.effortMode !== "duration")
        .map((set: any) => ({
            ...resolveCoachSetLoad(set),
            reps: toNumber(set?.reps),
            rir: set?.rir,
            targetReps: set?.targetReps,
        }))
        .filter((set: CoachBestSet) => set.weight > 0 || set.reps > 0);
    if (logged.length === 0) return null;
    return logged.sort((a: CoachBestSet, b: CoachBestSet) => (b.weight - a.weight) || (b.reps - a.reps))[0];
}

function hashWorkoutSources(logs: { id: string; updatedAt: Date }[]) {
    return createHash("sha256")
        .update(["coach-report-v4", ...logs.map((log) => `${log.id}:${log.updatedAt.toISOString()}`)].join("|"))
        .digest("hex");
}

function insightTypeForAnalysis(analysis: { decision: string; flags: string[] }) {
    if (analysis.flags.includes("rir_adjustment_candidate")) return "RIR_ADJUSTMENT_CANDIDATE";
    if (analysis.flags.includes("volume_reduce_candidate")) return "VOLUME_REDUCE_CANDIDATE";
    if (analysis.flags.includes("weight_increase_candidate")) return "WEIGHT_INCREASE_CANDIDATE";
    if (analysis.flags.includes("volume_increase_candidate")) return "VOLUME_INCREASE_CANDIDATE";
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

        const historyByExercise = new Map<string, CoachExerciseHistoryEntry[]>();
        const chronologicalAnalysisLogs = [...analysisLogs].sort((a, b) => a.logDate.getTime() - b.logDate.getTime());
        for (const log of chronologicalAnalysisLogs) {
            const exercises = Array.isArray((log.data as any)?.exercises) ? (log.data as any).exercises : [];
            const bestByExerciseInLog = new Map<string, { name: string; best: CoachBestSet }>();
            for (const exercise of exercises) {
                const key = exerciseHistoryKey(exercise);
                if (!key) continue;
                const best = bestWorkingSet(exercise);
                if (!best) continue;
                const existing = bestByExerciseInLog.get(key);
                if (!existing || best.weight > existing.best.weight || (best.weight === existing.best.weight && best.reps > existing.best.reps)) {
                    bestByExerciseInLog.set(key, {
                        name: String(exercise?.name || "Hareket"),
                        best,
                    });
                }
            }

            for (const [key, entry] of bestByExerciseInLog) {
                const history = historyByExercise.get(key) || [];
                history.push({
                    logId: log.id,
                    logDate: log.logDate,
                    name: entry.name,
                    best: entry.best,
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
                interventionAdvice: comparison.interventionAdvice,
                recommendation: comparison.recommendation,
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
        const interventionCount = exerciseAnalyses.filter((item) =>
            item.flags.includes("rir_adjustment_candidate") ||
            item.flags.includes("volume_reduce_candidate") ||
            item.flags.includes("volume_increase_candidate"),
        ).length;
        const coachNarration = coachNarrationService.buildWeeklyNarration({
            workoutCount: weekLogs.length,
            progressCount,
            watchCount,
            plateauCount,
            regressionCount,
            interventionCount,
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
            interventionCount,
            exerciseAnalyses,
            coachNarration,
            summary: weekLogs.length === 0
                ? "Bu hafta rapor üretmek için log yok."
                : `${weekLogs.length} antrenman loglandı. ${progressCount} progress, ${plateauCount} plato adayı, ${regressionCount} gerileme, ${interventionCount} müdahale adayı var.`,
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
                metadata: {
                    weekEnd: weekEnd.toISOString(),
                    interventionAdvice: analysis.interventionAdvice,
                    recommendation: analysis.recommendation,
                },
                currentBest: analysis.currentBest as Prisma.InputJsonValue,
                previousBest: analysis.previousBest as Prisma.InputJsonValue,
                sourceLogId: analysis.sourceLogId,
                signalDate: analysis.signalDate,
                weekStart,
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
