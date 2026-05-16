import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

// Route imports
import authRoutes from "./routes/auth.routes";
import workoutRoutes from "./routes/workout.routes";
import programRoutes from "./routes/program.routes";
import bodyMeasurementRoutes from "./routes/bodyMeasurement.routes";
import nutritionRoutes from "./routes/nutrition.routes";

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
// Middlewares
// ─────────────────────────────────────────────
app.use(helmet());
app.use(cors());
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
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workouts", workoutRoutes);
app.use("/api/v1/programs", programRoutes);
app.use("/api/v1/body-measurements", bodyMeasurementRoutes);
app.use("/api/v1/nutrition", nutritionRoutes);

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

