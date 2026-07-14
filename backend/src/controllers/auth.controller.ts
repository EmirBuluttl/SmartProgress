// ─────────────────────────────────────────────
// Auth Controller
// ─────────────────────────────────────────────
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service";
import { ValidationError } from "../utils/errors";

// ─── Zod Schemas ─────────────────────────────

const registerSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must not exceed 128 characters"),
    firstName: z
        .string()
        .min(1, "First name is required")
        .max(50, "First name must not exceed 50 characters"),
    lastName: z
        .string()
        .min(1, "Last name is required")
        .max(50, "Last name must not exceed 50 characters"),
});

const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
});

const socialLoginSchema = z.object({
    idToken: z.string().min(20, "Identity token is required"),
    email: z.string().email("Invalid email format").optional(),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
});

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email format"),
});

const resetPasswordSchema = z.object({
    token: z.string().min(16, "Reset token is required"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must not exceed 128 characters"),
});

const updateProfileSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    nickname: z.string().max(50).optional(),
    avatarUrl: z.string().optional().nullable(),
    settings: z.record(z.any()).optional(),
});

const syncEntitlementsSchema = z.object({
    appUserId: z.string().uuid().optional(),
});

// ─── Controller ──────────────────────────────

export class AuthController {
    /**
     * POST /register
     */
    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = registerSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const result = await authService.register(parsed.data);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /login
     */
    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = loginSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const result = await authService.login(parsed.data);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async loginWithGoogle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = socialLoginSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const result = await authService.loginWithGoogle(parsed.data);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async loginWithApple(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = socialLoginSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const result = await authService.loginWithApple(parsed.data);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = forgotPasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const result = await authService.requestPasswordReset(parsed.data);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = resetPasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const result = await authService.resetPassword(parsed.data);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /me  (protected)
     */
    async me(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const profile = await authService.getProfile(userId);
            res.status(200).json(profile);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /me  (protected) — Update profile
     */
    async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const parsed = updateProfileSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const profile = await authService.updateProfile(userId, parsed.data);
            res.status(200).json(profile);
        } catch (error) {
            next(error);
        }
    }

    async syncEntitlements(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const parsed = syncEntitlementsSchema.safeParse(req.body || {});
            if (!parsed.success) {
                throw new ValidationError("Validation failed", parsed.error.flatten());
            }

            const profile = await authService.syncEntitlements(userId, parsed.data);
            res.status(200).json(profile);
        } catch (error) {
            next(error);
        }
    }

    async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const result = await authService.deleteAccount(userId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}

export const authController = new AuthController();

