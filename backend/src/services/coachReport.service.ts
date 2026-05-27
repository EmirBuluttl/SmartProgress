import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import prisma from "../config/prisma";
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

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeExerciseName(name: unknown): string {
    return String(name || "").trim().toLowerCase();
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

function hashWorkoutSources(logs: { id: string; updatedAt: Date }[]) {
    return createHash("sha256")
        .update(logs.map((log) => `${log.id}:${log.updatedAt.toISOString()}`).join("|"))
        .digest("hex");
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

        const [weekLogs, previousLogs] = await Promise.all([
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
                    logDate: { lt: weekStart },
                },
                orderBy: { logDate: "desc" },
                take: 100,
            }),
        ]);

        const sourceHash = hashWorkoutSources(weekLogs.map((log) => ({ id: log.id, updatedAt: log.updatedAt })));
        const cached = await this.findWeeklyReport(userId, weekStart);
        if (cached?.sourceHash === sourceHash) return cached;

        const previousByExercise = new Map<string, BestSet>();
        for (const log of previousLogs) {
            const exercises = Array.isArray((log.data as any)?.exercises) ? (log.data as any).exercises : [];
            for (const exercise of exercises) {
                const key = normalizeExerciseName(exercise?.name);
                if (!key || previousByExercise.has(key)) continue;
                const best = bestWorkingSet(exercise);
                if (best) previousByExercise.set(key, best);
            }
        }

        const latestWeekByExercise = new Map<string, { name: string; best: BestSet | null }>();
        for (const log of weekLogs) {
            const exercises = Array.isArray((log.data as any)?.exercises) ? (log.data as any).exercises : [];
            for (const exercise of exercises) {
                const key = normalizeExerciseName(exercise?.name);
                if (!key) continue;
                latestWeekByExercise.set(key, {
                    name: String(exercise?.name || "Hareket"),
                    best: bestWorkingSet(exercise),
                });
            }
        }

        const exerciseAnalyses = Array.from(latestWeekByExercise.entries()).map(([key, current]) => {
            const comparison = compareBestSets(previousByExercise.get(key) || null, current.best);
            return {
                exerciseName: current.name,
                decision: comparison.decision,
                reason: comparison.reason,
                currentBest: current.best,
                previousBest: previousByExercise.get(key) || null,
            };
        });

        const progressCount = exerciseAnalyses.filter((item) => item.decision === "progress").length;
        const watchCount = exerciseAnalyses.filter((item) => item.decision === "watch").length;
        const coachNarration = coachNarrationService.buildWeeklyNarration({
            workoutCount: weekLogs.length,
            progressCount,
            watchCount,
            exerciseAnalyses,
        });
        const data = {
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            generatedAt: new Date().toISOString(),
            workoutCount: weekLogs.length,
            progressCount,
            watchCount,
            exerciseAnalyses,
            coachNarration,
            summary: weekLogs.length === 0
                ? "Bu hafta rapor üretmek için log yok."
                : `${weekLogs.length} antrenman loglandı. ${progressCount} harekette progress, ${watchCount} harekette takip sinyali var.`,
        };

        return this.upsertWeeklyReport({
            userId,
            weekStart,
            sourceHash,
            data: data as Prisma.InputJsonValue,
        });
    }
}

export const coachReportService = new CoachReportService();
