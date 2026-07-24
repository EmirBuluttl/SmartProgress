import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";

export class SubscriptionController {
    async startPremiumTrial(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const profile = await authService.startPremiumTrial(userId);
            res.status(200).json(profile);
        } catch (error) {
            next(error);
        }
    }
}

export const subscriptionController = new SubscriptionController();
