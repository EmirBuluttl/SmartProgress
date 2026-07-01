// ─────────────────────────────────────────────
// Environment Configuration
// ─────────────────────────────────────────────
import dotenv from "dotenv";

dotenv.config();

export const env = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: parseInt(process.env.PORT || "3000", 10),

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || "change-me-in-production",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "180d",

    // Bcrypt
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),

    // Database
    DATABASE_URL: process.env.DATABASE_URL || "",

    // Password reset
    APP_URL: process.env.APP_URL || "https://app.smartprogress.online",
    PASSWORD_RESET_EXPIRES_MINUTES: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || "60", 10),
    PASSWORD_RESET_COOLDOWN_MINUTES: parseInt(process.env.PASSWORD_RESET_COOLDOWN_MINUTES || "30", 10),
    PASSWORD_RESET_DAILY_LIMIT: parseInt(process.env.PASSWORD_RESET_DAILY_LIMIT || "3", 10),
    PASSWORD_RESET_EXPOSE_TOKEN: process.env.PASSWORD_RESET_EXPOSE_TOKEN === "true",
    PASSWORD_RESET_FROM_EMAIL: process.env.PASSWORD_RESET_FROM_EMAIL || "SmartProgress <noreply@smartprogress.online>",
    RESEND_API_KEY: process.env.RESEND_API_KEY || "",
    BREVO_API_KEY: process.env.BREVO_API_KEY || "",

    // RevenueCat
    REVENUECAT_SECRET_API_KEY: process.env.REVENUECAT_SECRET_API_KEY || "",
    REVENUECAT_PREMIUM_ENTITLEMENT_ID: process.env.REVENUECAT_PREMIUM_ENTITLEMENT_ID || "premium",
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET || "",

    // AI provider
    AI_PROVIDER: process.env.AI_PROVIDER || "mock",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    AI_INPUT_COST_MICROS_PER_1K: parseInt(process.env.AI_INPUT_COST_MICROS_PER_1K || "1000", 10),
    AI_OUTPUT_COST_MICROS_PER_1K: parseInt(process.env.AI_OUTPUT_COST_MICROS_PER_1K || "4000", 10),
    AI_DEFAULT_MAX_OUTPUT_TOKENS: parseInt(process.env.AI_DEFAULT_MAX_OUTPUT_TOKENS || "500", 10),
} as const;
