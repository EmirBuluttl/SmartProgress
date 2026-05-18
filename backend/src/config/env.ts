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
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

    // Bcrypt
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),

    // Database
    DATABASE_URL: process.env.DATABASE_URL || "",

    // Password reset
    APP_URL: process.env.APP_URL || "https://app.smartprogress.online",
    PASSWORD_RESET_EXPOSE_TOKEN: process.env.PASSWORD_RESET_EXPOSE_TOKEN === "true",
} as const;
