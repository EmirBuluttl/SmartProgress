import { z } from "zod";
import prisma from "../config/prisma";

const nullableNumber = z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}, z.number().nonnegative().nullable());

const nullableInt = z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}, z.number().int().nonnegative().nullable());

export const nutritionLogSchema = z.object({
    date: z.string().min(1),
    calories: nullableInt.optional(),
    protein: nullableNumber.optional(),
    carbs: nullableNumber.optional(),
    fat: nullableNumber.optional(),
    notes: z.string().max(1000).optional().nullable(),
});

export type NutritionLogInput = z.infer<typeof nutritionLogSchema>;

export class NutritionService {
    list(userId: string, limit = 180) {
        return prisma.nutritionLog.findMany({
            where: { userId },
            orderBy: { date: "desc" },
            take: limit,
        });
    }

    upsert(userId: string, input: NutritionLogInput) {
        const date = new Date(input.date);
        const data = {
            date,
            calories: input.calories ?? null,
            protein: input.protein ?? null,
            carbs: input.carbs ?? null,
            fat: input.fat ?? null,
            notes: input.notes ?? null,
        };

        return prisma.nutritionLog.upsert({
            where: { userId_date: { userId, date } },
            create: { userId, ...data },
            update: data,
        });
    }

    async delete(userId: string, id: string): Promise<void> {
        await prisma.nutritionLog.deleteMany({
            where: { id, userId },
        });
    }
}

export const nutritionService = new NutritionService();
