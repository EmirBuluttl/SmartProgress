import { Request, Response, NextFunction } from "express";
import { nutritionLogSchema, nutritionService } from "../services/nutrition.service";

export class NutritionController {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 180;
            const logs = await nutritionService.list(userId, limit);
            res.status(200).json({ count: logs.length, logs });
        } catch (error) {
            next(error);
        }
    }

    async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const input = nutritionLogSchema.parse(req.body);
            const log = await nutritionService.upsert(userId, input);
            res.status(200).json({ log });
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            await nutritionService.delete(userId, req.params.id as string);
            res.status(200).json({ message: "Nutrition log deleted successfully" });
        } catch (error) {
            next(error);
        }
    }
}

export const nutritionController = new NutritionController();
