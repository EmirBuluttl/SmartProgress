import { z } from "zod";
import prisma from "../config/prisma";

const nullableNumber = z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}, z.number().nonnegative().nullable());

export const bodyMeasurementSchema = z.object({
    date: z.string().min(1),
    weight: nullableNumber.optional(),
    waist: nullableNumber.optional(),
    chest: nullableNumber.optional(),
    arm: nullableNumber.optional(),
    leg: nullableNumber.optional(),
    hip: nullableNumber.optional(),
    shoulder: nullableNumber.optional(),
    notes: z.string().max(1000).optional().nullable(),
});

export type BodyMeasurementInput = z.infer<typeof bodyMeasurementSchema>;

export class BodyMeasurementService {
    list(userId: string, limit = 180) {
        return prisma.bodyMeasurement.findMany({
            where: { userId },
            orderBy: { date: "desc" },
            take: limit,
        });
    }

    upsert(userId: string, input: BodyMeasurementInput) {
        const date = new Date(input.date);
        const data = {
            date,
            weight: input.weight ?? null,
            waist: input.waist ?? null,
            chest: input.chest ?? null,
            arm: input.arm ?? null,
            leg: input.leg ?? null,
            hip: input.hip ?? null,
            shoulder: input.shoulder ?? null,
            notes: input.notes ?? null,
        };

        return prisma.bodyMeasurement.upsert({
            where: { userId_date: { userId, date } },
            create: { userId, ...data },
            update: data,
        });
    }

    async delete(userId: string, id: string): Promise<void> {
        await prisma.bodyMeasurement.deleteMany({
            where: { id, userId },
        });
    }
}

export const bodyMeasurementService = new BodyMeasurementService();
