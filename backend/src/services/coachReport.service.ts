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

export type CoachSignalRatioRange = "7" | "30" | "365" | "all";

export type CoachSignalRatioPoint = {
    weekLabel: string;
    weekStart: string;
    weekEnd: string;
    progressRatio: number;
    plateauRatio: number;
    regressionRatio: number;
    watchRatio: number;
    analyzedCount: number;
    workoutCount: number;
};

const SIGNAL_RATIO_WEEK_COUNTS: Record<Exclude<CoachSignalRatioRange, "all">, number> = {
    "7": 1,
    "30": 5,
    "365": 53,
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

function compareBestSet(a: CoachBestSet, b: CoachBestSet) {
    return (b.weight - a.weight) || (b.reps - a.reps);
}

function buildCoachSet(set: any, side?: "left" | "right"): CoachBestSet | null {
    const sideData = side ? set?.[side] || {} : {};
    const source = side
        ? {
            ...set,
            ...sideData,
            weight: sideData.weight ?? set?.weight,
            reps: sideData.reps ?? set?.reps,
            durationSeconds: sideData.durationSeconds ?? set?.durationSeconds,
            rpe: sideData.rpe ?? set?.rpe,
            rir: sideData.rir ?? set?.rir,
        }
        : set;

    if (source?.effortMode === "duration" || toNumber(source?.durationSeconds) > 0 && toNumber(source?.reps) <= 0) return null;

    const next = {
        ...resolveCoachSetLoad(source),
        reps: toNumber(source?.reps),
        rir: source?.rir,
        targetReps: set?.targetReps,
    };

    return next.weight > 0 || next.reps > 0 ? next : null;
}

function bestWorkingSets(exercise: any): { keySuffix: string; name: string; best: CoachBestSet }[] {
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    const byTrack = new Map<string, { keySuffix: string; name: string; best: CoachBestSet }>();
    const baseName = String(exercise?.name || "Hareket");

    for (const set of sets) {
        if (set?.isWarmup || set?.analysisExcluded === true) continue;

        const sides: ("left" | "right" | undefined)[] = set?.sideMode === "left_right"
            ? ["left", "right"]
            : [undefined];

        for (const side of sides) {
            const best = buildCoachSet(set, side);
            if (!best) continue;
            const keySuffix = side ? `:${side}` : ":both";
            const name = side === "left"
                ? `${baseName} (Sol)`
                : side === "right"
                    ? `${baseName} (Sag)`
                    : baseName;
            const existing = byTrack.get(keySuffix);
            if (!existing || compareBestSet(existing.best, best) > 0) {
                byTrack.set(keySuffix, { keySuffix, name, best });
            }
        }
    }

    return Array.from(byTrack.values());
}

function hashWorkoutSources(logs: { id: string; updatedAt: Date }[]) {
    return createHash("sha256")
        .update(["coach-report-v7-session-buckets", ...logs.map((log) => `${log.id}:${log.updatedAt.toISOString()}`)].join("|"))
        .digest("hex");
}

function formatWeekLabel(weekStart: Date) {
    return weekStart.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function ratio(count: number, denominator: number) {
    if (denominator <= 0) return 0;
    return Math.round((count / denominator) * 1000) / 10;
}

function getReportData(report: { data: Prisma.JsonValue }) {
    return (report.data || {}) as Record<string, any>;
}

function clampSignalRange(value: unknown): CoachSignalRatioRange {
    return value === "7" || value === "30" || value === "365" || value === "all"
        ? value
        : "30";
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

    normalizeSignalRatioRange(value: unknown): CoachSignalRatioRange {
        return clampSignalRange(value);
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

        const logsForHash = await prisma.workoutLog.findMany({
            where: {
                userId,
                logDate: { lt: weekEnd },
            },
            orderBy: { logDate: "desc" },
            take: 300,
            select: { id: true, updatedAt: true },
        });

        const sourceHash = hashWorkoutSources(logsForHash);
        const cached = await this.findWeeklyReport(userId, weekStart);
        if (cached?.sourceHash === sourceHash) return cached;

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

        const bestByExerciseDay = new Map<string, { historyKey: string; logId: string; logDate: Date; name: string; best: CoachBestSet }>();
        const chronologicalAnalysisLogs = [...analysisLogs].sort((a, b) => a.logDate.getTime() - b.logDate.getTime());
        for (const log of chronologicalAnalysisLogs) {
            const exercises = Array.isArray((log.data as any)?.exercises) ? (log.data as any).exercises : [];
            for (const exercise of exercises) {
                const baseKey = exerciseHistoryKey(exercise);
                if (!baseKey) continue;
                for (const entry of bestWorkingSets(exercise)) {
                    const historyKey = `${baseKey}${entry.keySuffix}`;
                    const bucketKey = `${historyKey}:${log.id}`;
                    const existing = bestByExerciseDay.get(bucketKey);
                    if (!existing || compareBestSet(existing.best, entry.best) > 0) {
                        bestByExerciseDay.set(bucketKey, {
                            historyKey,
                            logId: log.id,
                            logDate: log.logDate,
                            name: entry.name,
                            best: entry.best,
                        });
                    }
                }
            }
        }

        const historyByExercise = new Map<string, CoachExerciseHistoryEntry[]>();
        for (const entry of Array.from(bestByExerciseDay.values()).sort((a, b) => a.logDate.getTime() - b.logDate.getTime())) {
            const history = historyByExercise.get(entry.historyKey) || [];
            history.push({
                logId: entry.logId,
                logDate: entry.logDate,
                name: entry.name,
                best: entry.best,
            });
            historyByExercise.set(entry.historyKey, history);
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

        const insightInputs = exerciseAnalyses.flatMap((analysis) => {
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
        });
        await coachInsightService.syncWeekInsights(userId, weekStart, insightInputs);

        return this.upsertWeeklyReport({
            userId,
            weekStart,
            sourceHash,
            data: data as Prisma.InputJsonValue,
        });
    }

    async generateSignalRatios(userId: string, rangeInput: unknown = "30") {
        const range = clampSignalRange(rangeInput);
        const currentWeekStart = startOfIsoWeek();
        let weekCount = range === "all" ? 0 : SIGNAL_RATIO_WEEK_COUNTS[range];

        if (range === "all") {
            const oldestLog = await prisma.workoutLog.findFirst({
                where: { userId },
                orderBy: { logDate: "asc" },
                select: { logDate: true },
            });
            if (!oldestLog) {
                return {
                    range,
                    generatedAt: new Date().toISOString(),
                    points: [] as CoachSignalRatioPoint[],
                };
            }
            const oldestWeekStart = startOfIsoWeek(oldestLog.logDate);
            const diffMs = currentWeekStart.getTime() - oldestWeekStart.getTime();
            weekCount = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
        }

        const weekStarts = Array.from({ length: weekCount }, (_, index) => {
            const weekStart = new Date(currentWeekStart);
            weekStart.setUTCDate(currentWeekStart.getUTCDate() - (weekCount - index - 1) * 7);
            return weekStart;
        });

        const reports = await Promise.all(
            weekStarts.map((weekStart) => this.generateWeeklyReport(userId, weekStart)),
        );

        const points: CoachSignalRatioPoint[] = reports.map((report, index) => {
            const data = getReportData(report);
            const analyses = Array.isArray(data.exerciseAnalyses) ? data.exerciseAnalyses : [];
            const progressCount = Number(data.progressCount || 0);
            const plateauCount = Number(data.plateauCount || 0);
            const regressionCount = Number(data.regressionCount || 0);
            const watchCount = Number(data.watchCount || 0);
            const analyzedCount = analyses.length || progressCount + plateauCount + regressionCount + watchCount;
            const weekStart = weekStarts[index];
            const weekEnd = new Date(weekStart);
            weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

            return {
                weekLabel: formatWeekLabel(weekStart),
                weekStart: weekStart.toISOString(),
                weekEnd: weekEnd.toISOString(),
                progressRatio: ratio(progressCount, analyzedCount),
                plateauRatio: ratio(plateauCount, analyzedCount),
                regressionRatio: ratio(regressionCount, analyzedCount),
                watchRatio: ratio(watchCount, analyzedCount),
                analyzedCount,
                workoutCount: Number(data.workoutCount || 0),
            };
        });

        return {
            range,
            generatedAt: new Date().toISOString(),
            points,
        };
    }
}

export const coachReportService = new CoachReportService();
