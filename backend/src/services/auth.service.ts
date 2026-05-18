// ─────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { userRepository } from "../repositories/user.repository";
import {
    ConflictError,
    UnauthorizedError,
    NotFoundError,
    ValidationError,
} from "../utils/errors";

// ─── DTOs ────────────────────────────────────

export interface RegisterDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface ForgotPasswordDto {
    email: string;
}

export interface ResetPasswordDto {
    token: string;
    password: string;
}

export interface UpdateProfileDto {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    avatarUrl?: string | null;
    settings?: Record<string, any>;
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        nickname: string | null;
        avatarUrl: string | null;
        role: string;
        settings: unknown;
    };
}

// ─── Default Settings ────────────────────────

const DEFAULT_USER_SETTINGS = {
    is_auto_suggest_enabled: false,
};

const PASSWORD_RESET_EXPIRES_MINUTES = 30;
const PASSWORD_RESET_MESSAGE =
    "Eğer bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.";

function hashResetToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Service ─────────────────────────────────

export class AuthService {
    /**
     * Register a new user.
     * - Hashes the password with bcrypt
     * - Assigns default settings
     * - Returns JWT token + user data
     */
    async register(dto: RegisterDto): Promise<AuthResponse> {
        // Check if email is already taken
        const existing = await userRepository.findByEmail(dto.email);
        if (existing) {
            throw new ConflictError("Email is already registered");
        }

        // Hash password
        const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_SALT_ROUNDS);

        // Create user with default settings
        const user = await userRepository.create({
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            settings: DEFAULT_USER_SETTINGS,
        });

        // Generate JWT
        const token = this.generateToken(user.id, user.role);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                settings: user.settings,
            },
        };
    }

    /**
     * Login an existing user.
     * - Validates email + password
     * - Returns JWT token + user data
     */
    async login(dto: LoginDto): Promise<AuthResponse> {
        // Find user by email
        const user = await userRepository.findByEmail(dto.email);
        if (!user) {
            throw new UnauthorizedError("Invalid email or password");
        }

        // Check if the account is active
        if (!user.isActive) {
            throw new UnauthorizedError("Account is deactivated");
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedError("Invalid email or password");
        }

        // Generate JWT
        const token = this.generateToken(user.id, user.role);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                role: user.role,
                settings: user.settings,
            },
        };
    }

    /**
     * Get user profile by ID.
     */
    async getProfile(userId: string): Promise<AuthResponse["user"]> {
        const user = await userRepository.findById(userId);
        if (!user) {
            // Token is valid but the user no longer exists in the DB (e.g. DB was reset).
            // Return 401 so the frontend's response interceptor clears the stale token.
            throw new UnauthorizedError("User account not found. Please log in again.");
        }

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            role: user.role,
            settings: user.settings,
        };
    }

    /**
     * Update user profile (name, nickname, settings).
     */
    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthResponse["user"]> {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const updateData: Record<string, any> = {};
        if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
        if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
        if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
        if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
        if (dto.settings !== undefined) {
            // Merge with existing settings to preserve unset keys
            updateData.settings = { ...(user.settings as any || {}), ...dto.settings };
        }

        const updated = await userRepository.updateById(userId, updateData);

        return {
            id: updated.id,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            nickname: updated.nickname,
            avatarUrl: updated.avatarUrl,
            role: updated.role,
            settings: updated.settings,
        };
    }

    async requestPasswordReset(dto: ForgotPasswordDto): Promise<{
        message: string;
        resetToken?: string;
        resetUrl?: string;
    }> {
        const email = dto.email.trim().toLowerCase();
        const user = await userRepository.findByEmail(email);

        if (!user || !user.isActive) {
            return { message: PASSWORD_RESET_MESSAGE };
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashResetToken(token);
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

        await userRepository.updateById(user.id, {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
        });

        const resetUrl = `${env.APP_URL.replace(/\/+$/, "")}/reset-password?token=${token}`;

        if (env.PASSWORD_RESET_EXPOSE_TOKEN || env.NODE_ENV !== "production") {
            return { message: PASSWORD_RESET_MESSAGE, resetToken: token, resetUrl };
        }

        console.log(`[AuthService] Password reset link for ${email}: ${resetUrl}`);
        return { message: PASSWORD_RESET_MESSAGE };
    }

    async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
        const tokenHash = hashResetToken(dto.token.trim());
        const user = await userRepository.findByPasswordResetTokenHash(tokenHash);

        if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
            throw new ValidationError("Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.");
        }

        const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_SALT_ROUNDS);
        await userRepository.updateById(user.id, {
            passwordHash,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
        });

        return { message: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz." };
    }

    /**
     * Generate a JWT token.
     */
    private generateToken(userId: string, role: string): string {
        return jwt.sign({ userId, role }, env.JWT_SECRET, {
            expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
        });
    }
}

export const authService = new AuthService();

