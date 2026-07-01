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

export interface SyncEntitlementsDto {
    appUserId?: string;
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
        subscriptionTier: string;
        subscriptionStatus: string;
    };
}

// ─── Default Settings ────────────────────────

const DEFAULT_USER_SETTINGS = {
    is_auto_suggest_enabled: false,
    remember_reps_enabled: false,
    profile_visibility: "private",
    training_level: "beginner",
    show_rpe_rir_info: true,
    pre_workout_reminder_enabled: false,
    pre_workout_reminder_note: "",
    pre_workout_reminders_by_program: {},
    onboarding_completed: false,
};

const FREE_WIZARD_USES = 2;
const MANUAL_PREMIUM_TRIAL_DAYS = 60;
const PASSWORD_RESET_EXPIRES_MINUTES = env.PASSWORD_RESET_EXPIRES_MINUTES;
const PASSWORD_RESET_COOLDOWN_MINUTES = env.PASSWORD_RESET_COOLDOWN_MINUTES;
const PASSWORD_RESET_DAILY_LIMIT = env.PASSWORD_RESET_DAILY_LIMIT;
const PASSWORD_RESET_MESSAGE =
    "Eğer bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.";

function hashResetToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function todayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
}

function maskEmail(email: string): string {
    const [name, domain] = email.split("@");
    if (!domain) return "***";
    const visible = name.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function getPasswordResetMeta(settings: unknown) {
    const source = settings as Record<string, any> | null;
    const meta = source?.password_reset_meta as Record<string, any> | undefined;
    return {
        lastSentAt: typeof meta?.last_sent_at === "string" ? meta.last_sent_at : null,
        dailyDate: typeof meta?.daily_date === "string" ? meta.daily_date : null,
        dailyCount: Number.isFinite(Number(meta?.daily_count)) ? Number(meta?.daily_count) : 0,
    };
}

function canSendPasswordReset(settings: unknown) {
    const now = Date.now();
    const meta = getPasswordResetMeta(settings);
    const lastSentAt = meta.lastSentAt ? new Date(meta.lastSentAt).getTime() : 0;
    const cooldownMs = Math.max(1, PASSWORD_RESET_COOLDOWN_MINUTES) * 60 * 1000;
    const dailyDate = todayKey();
    const dailyCount = meta.dailyDate === dailyDate ? meta.dailyCount : 0;

    if (lastSentAt && Number.isFinite(lastSentAt) && now - lastSentAt < cooldownMs) {
        return { allowed: false, reason: "cooldown", dailyDate, dailyCount };
    }

    if (dailyCount >= Math.max(1, PASSWORD_RESET_DAILY_LIMIT)) {
        return { allowed: false, reason: "daily_limit", dailyDate, dailyCount };
    }

    return { allowed: true, reason: "", dailyDate, dailyCount };
}

function buildPasswordResetSettings(settings: unknown) {
    const existing = (settings as Record<string, any> | null) || {};
    const meta = getPasswordResetMeta(settings);
    const dailyDate = todayKey();
    const dailyCount = meta.dailyDate === dailyDate ? meta.dailyCount + 1 : 1;

    return {
        ...existing,
        password_reset_meta: {
            last_sent_at: new Date().toISOString(),
            daily_date: dailyDate,
            daily_count: dailyCount,
        },
    };
}

function buildDefaultUserSettings() {
    const trialStartedAt = new Date();
    const trialExpiresAt = new Date(trialStartedAt);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + MANUAL_PREMIUM_TRIAL_DAYS);

    return {
        ...DEFAULT_USER_SETTINGS,
        free_wizard_uses_remaining: FREE_WIZARD_USES,
        coach_plus_beta: false,
        pro_trial_started_at: trialStartedAt.toISOString(),
        pro_trial_expires_at: trialExpiresAt.toISOString(),
        pro_trial_source: "manual_signup_promo",
    };
}

function effectiveSubscription(user: { subscriptionTier: string; subscriptionStatus: string; settings: unknown }) {
    const settings = user.settings as Record<string, any> | null;
    const expiresAt = settings?.pro_trial_expires_at ? new Date(settings.pro_trial_expires_at) : null;
    const isExpiredTrial = user.subscriptionStatus === "TRIAL" &&
        expiresAt &&
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt.getTime() < Date.now();

    if (isExpiredTrial) {
        return { subscriptionTier: "FREE", subscriptionStatus: "INACTIVE" };
    }

    return {
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
    };
}

function hasUnexpiredManualTrial(user: { subscriptionTier: string; subscriptionStatus: string; settings: unknown }) {
    const settings = user.settings as Record<string, any> | null;
    const expiresAt = settings?.pro_trial_expires_at ? new Date(settings.pro_trial_expires_at) : null;
    return user.subscriptionTier === "PRO" &&
        user.subscriptionStatus === "TRIAL" &&
        !!expiresAt &&
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt.getTime() > Date.now();
}

function revenueCatSubscriberUrl(appUserId: string) {
    return `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
}

async function fetchRevenueCatPremiumStatus(appUserId: string): Promise<{ active: boolean; raw?: unknown }> {
    if (!env.REVENUECAT_SECRET_API_KEY) {
        throw new ValidationError("RevenueCat secret key is not configured.");
    }

    const response = await fetch(revenueCatSubscriberUrl(appUserId), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new ValidationError("RevenueCat entitlement could not be verified.");
    }

    const data: any = await response.json();
    const entitlementId = env.REVENUECAT_PREMIUM_ENTITLEMENT_ID;
    const entitlement = data?.subscriber?.entitlements?.[entitlementId];
    const expiresDate = entitlement?.expires_date ? new Date(entitlement.expires_date) : null;
    const isActive = !!entitlement && (!expiresDate || expiresDate.getTime() > Date.now());

    return { active: isActive, raw: data };
}

async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
    const subject = "SmartProgress şifre sıfırlama";
    const html = `
        <p>SmartProgress hesabınız için şifre sıfırlama isteği aldık.</p>
        <p><a href="${resetUrl}">Şifrenizi sıfırlamak için tıklayın</a></p>
        <p>Bu bağlantı ${PASSWORD_RESET_EXPIRES_MINUTES} dakika geçerlidir. Bu işlemi siz istemediyseniz bu e-postayı yok sayabilirsiniz.</p>
    `;
    const text = `SmartProgress şifre sıfırlama bağlantınız: ${resetUrl}\n\nBu bağlantı ${PASSWORD_RESET_EXPIRES_MINUTES} dakika geçerlidir.`;

    try {
        if (env.RESEND_API_KEY) {
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: env.PASSWORD_RESET_FROM_EMAIL,
                    to: email,
                    subject,
                    html,
                    text,
                }),
            });
            if (!response.ok) {
                console.warn("[AuthService] Resend password reset email failed:", response.status, await response.text());
                return false;
            }
            return true;
        }

        if (env.BREVO_API_KEY) {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": env.BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: { email: env.PASSWORD_RESET_FROM_EMAIL.replace(/^.*<|>$/g, "") },
                    to: [{ email }],
                    subject,
                    htmlContent: html,
                    textContent: text,
                }),
            });
            if (!response.ok) {
                console.warn("[AuthService] Brevo password reset email failed:", response.status, await response.text());
                return false;
            }
            return true;
        }
    } catch (error) {
        console.warn("[AuthService] Password reset email failed:", error);
        return false;
    }

    return false;
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
            settings: buildDefaultUserSettings(),
            subscriptionTier: "PRO",
            subscriptionStatus: "TRIAL",
        });
        const subscription = effectiveSubscription(user);

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
                subscriptionTier: subscription.subscriptionTier,
                subscriptionStatus: subscription.subscriptionStatus,
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
        const subscription = effectiveSubscription(user);

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
                subscriptionTier: subscription.subscriptionTier,
                subscriptionStatus: subscription.subscriptionStatus,
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

        const subscription = effectiveSubscription(user);

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            role: user.role,
            settings: user.settings,
            subscriptionTier: subscription.subscriptionTier,
            subscriptionStatus: subscription.subscriptionStatus,
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
        const subscription = effectiveSubscription(updated);

        return {
            id: updated.id,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            nickname: updated.nickname,
            avatarUrl: updated.avatarUrl,
            role: updated.role,
            settings: updated.settings,
            subscriptionTier: subscription.subscriptionTier,
            subscriptionStatus: subscription.subscriptionStatus,
        };
    }

    async syncEntitlements(userId: string, dto: SyncEntitlementsDto = {}): Promise<AuthResponse["user"]> {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const appUserId = dto.appUserId || user.id;
        if (appUserId !== user.id) {
            throw new ValidationError("RevenueCat app user id does not match the authenticated user.");
        }

        const revenueCatStatus = await fetchRevenueCatPremiumStatus(appUserId);
        const settings = {
            ...(user.settings as any || {}),
            revenuecat_last_sync_at: new Date().toISOString(),
            revenuecat_entitlement_id: env.REVENUECAT_PREMIUM_ENTITLEMENT_ID,
        };

        const preserveManualTrial = !revenueCatStatus.active && hasUnexpiredManualTrial(user);
        const updated = await userRepository.updateById(userId, {
            subscriptionTier: revenueCatStatus.active || preserveManualTrial ? "PRO" : "FREE",
            subscriptionStatus: revenueCatStatus.active ? "ACTIVE" : preserveManualTrial ? "TRIAL" : "INACTIVE",
            settings,
        });

        const subscription = effectiveSubscription(updated);
        return {
            id: updated.id,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            nickname: updated.nickname,
            avatarUrl: updated.avatarUrl,
            role: updated.role,
            settings: updated.settings,
            subscriptionTier: subscription.subscriptionTier,
            subscriptionStatus: subscription.subscriptionStatus,
        };
    }

    async deleteAccount(userId: string): Promise<{ message: string }> {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError("User not found");
        }

        await userRepository.deleteById(userId);
        return { message: "Account and associated data deleted." };
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

        const resetGate = canSendPasswordReset(user.settings);
        if (!resetGate.allowed) {
            console.warn(`[AuthService] Password reset suppressed (${resetGate.reason}) for ${maskEmail(email)}.`);
            return { message: PASSWORD_RESET_MESSAGE };
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashResetToken(token);
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

        await userRepository.updateById(user.id, {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
            settings: buildPasswordResetSettings(user.settings),
        });

        const resetUrl = `${env.APP_URL.replace(/\/+$/, "")}/reset-password?token=${token}`;

        const emailSent = await sendPasswordResetEmail(email, resetUrl);

        if (env.PASSWORD_RESET_EXPOSE_TOKEN || env.NODE_ENV !== "production") {
            return { message: PASSWORD_RESET_MESSAGE, resetToken: token, resetUrl };
        }

        if (!emailSent) {
            console.warn(`[AuthService] Password reset email could not be sent for ${email}. Configure RESEND_API_KEY or BREVO_API_KEY.`);
        }
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

