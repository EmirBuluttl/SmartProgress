import { Request, Response, NextFunction } from "express";
import { coachReportService } from "../services/coachReport.service";

export class CoachController {
    async weeklyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const date = typeof req.query.date === "string" ? new Date(req.query.date) : new Date();
            const report = await coachReportService.generateWeeklyReport(userId, date);
            res.status(200).json(report);
        } catch (error) {
            next(error);
        }
    }
}

export const coachController = new CoachController();
