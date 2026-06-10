import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Route imports
import authRoutes from "./routes/auth.routes";
import workoutRoutes from "./routes/workout.routes";
import programRoutes from "./routes/program.routes";
import bodyMeasurementRoutes from "./routes/bodyMeasurement.routes";
import nutritionRoutes from "./routes/nutrition.routes";
import notificationRoutes from "./routes/notification.routes";
import profileRoutes from "./routes/profile.routes";
import coachRoutes from "./routes/coach.routes";
import webhookRoutes from "./routes/webhook.routes";

// Middleware imports
import { errorHandler } from "./middlewares/errorHandler";
import prisma from "./config/prisma";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Default Sport ID ────────────────────────
const DEFAULT_SPORT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Ensure the default "Fitness" sport exists in the database.
 * Runs once at startup to prevent FK constraint errors during workout sync.
 */
async function ensureDefaultSport(): Promise<void> {
    try {
        const existing = await prisma.sport.findUnique({
            where: { id: DEFAULT_SPORT_ID },
        });
        if (!existing) {
            await prisma.sport.upsert({
                where: { id: DEFAULT_SPORT_ID },
                update: {},
                create: {
                    id: DEFAULT_SPORT_ID,
                    name: "Fitness",
                    slug: "fitness",
                    icon: "barbell",
                },
            });
            console.log("🌱 Default sport 'Fitness' seeded successfully");
        }
    } catch (err) {
        console.error("⚠️ Failed to seed default sport:", err);
    }
}

// ─────────────────────────────────────────────
// Rate Limiters
// ─────────────────────────────────────────────

/** Auth endpoints: max 20 requests per 15 minutes (brute-force protection) */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});

/** Coach ask: max 5 requests per minute (OpenAI budget protection) */
const coachAskLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Coach rate limit exceeded. Please wait a moment." },
});

/** General API: max 200 requests per 15 minutes per IP */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});

// ─────────────────────────────────────────────
// Middlewares
// ─────────────────────────────────────────────
// Trust Caddy reverse proxy — required for express-rate-limit to work correctly
// behind a reverse proxy (Caddy sets X-Forwarded-For header)
app.set("trust proxy", 1);
app.use(helmet());

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : ["https://app.smartprogress.online"],
    credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "smartprogress-api",
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/coach/ask", coachAskLimiter);
app.use("/api/v1/workouts", generalLimiter, workoutRoutes);
app.use("/api/v1/programs", generalLimiter, programRoutes);
app.use("/api/v1/body-measurements", generalLimiter, bodyMeasurementRoutes);
app.use("/api/v1/nutrition", generalLimiter, nutritionRoutes);
app.use("/api/v1/notifications", generalLimiter, notificationRoutes);
app.use("/api/v1/profiles", generalLimiter, profileRoutes);
app.use("/api/v1/coach", generalLimiter, coachRoutes);
// Webhook — no rate limiter: RevenueCat servers call this, auth is via Authorization header
app.use("/api/v1/webhooks", webhookRoutes);

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`🚀 SmartProgress API running on port ${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
    await ensureDefaultSport();
});

export default app;

