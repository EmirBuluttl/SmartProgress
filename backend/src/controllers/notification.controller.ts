import { Request, Response, NextFunction } from "express";
import { notificationService } from "../services/notification.service";

export class NotificationController {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const result = await notificationService.listForUser(userId, limit);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const result = await notificationService.markRead(userId, String(req.params.id));
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const notificationController = new NotificationController();
