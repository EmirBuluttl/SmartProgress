import { Request, Response, NextFunction } from "express";
import { profileService } from "../services/profile.service";

export class ProfileController {
    async getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const viewerId = req.user!.userId;
            const profile = await profileService.getPublicProfile(viewerId, String(req.params.userId));
            res.status(200).json(profile);
        } catch (error) {
            next(error);
        }
    }
}

export const profileController = new ProfileController();
