import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { moderationService } from "../services/moderation.service";
import { ValidationError } from "../utils/errors";

const reportSchema = z.object({
    targetType: z.enum(["PROFILE", "PROFILE_PHOTO", "PROGRAM"]),
    targetUserId: z.string().uuid().optional(),
    targetProgramId: z.string().uuid().optional(),
    reason: z.enum(["inappropriate", "spam", "harassment", "misleading", "other"]),
    details: z.string().max(1000).optional(),
});

const blockSchema = z.object({
    blockedUserId: z.string().uuid(),
});

export class ModerationController {
    async listBlocks(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const users = await moderationService.listBlockedUsers(req.user!.userId);
            res.status(200).json({ users });
        } catch (error) {
            next(error);
        }
    }

    async report(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = reportSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }
            const report = await moderationService.createReport(req.user!.userId, parsed.data);
            res.status(201).json({ message: "Report received", reportId: report.id });
        } catch (error) {
            next(error);
        }
    }

    async block(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = blockSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }
            await moderationService.blockUser(req.user!.userId, parsed.data.blockedUserId);
            res.status(200).json({ message: "User blocked", blockedUserId: parsed.data.blockedUserId });
        } catch (error) {
            next(error);
        }
    }

    async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const blockedUserId = String(req.params.userId || "");
            if (!z.string().uuid().safeParse(blockedUserId).success) {
                throw new ValidationError("Invalid user id");
            }
            await moderationService.unblockUser(req.user!.userId, blockedUserId);
            res.status(200).json({ message: "User unblocked", blockedUserId });
        } catch (error) {
            next(error);
        }
    }
}

export const moderationController = new ModerationController();
