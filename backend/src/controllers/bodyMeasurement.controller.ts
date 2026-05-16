import { Request, Response, NextFunction } from "express";
import { bodyMeasurementSchema, bodyMeasurementService } from "../services/bodyMeasurement.service";

export class BodyMeasurementController {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 180;
            const measurements = await bodyMeasurementService.list(userId, limit);
            res.status(200).json({ count: measurements.length, measurements });
        } catch (error) {
            next(error);
        }
    }

    async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const input = bodyMeasurementSchema.parse(req.body);
            const measurement = await bodyMeasurementService.upsert(userId, input);
            res.status(200).json({ measurement });
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            await bodyMeasurementService.delete(userId, req.params.id as string);
            res.status(200).json({ message: "Measurement deleted successfully" });
        } catch (error) {
            next(error);
        }
    }
}

export const bodyMeasurementController = new BodyMeasurementController();
