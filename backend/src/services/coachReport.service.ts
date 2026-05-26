import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

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
}

export const coachReportService = new CoachReportService();
