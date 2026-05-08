// ─────────────────────────────────────────────
// Global Error Handler Middleware
// ─────────────────────────────────────────────
import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils/errors";
import { env } from "../config/env";

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // Known operational errors
    if (err instanceof ValidationError) {
        res.status(err.statusCode).json({
            error: err.message,
            details: err.details,
        });
        return;
    }

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
        });
        return;
    }

    // Unknown / programmer errors
    console.error("💥 Unexpected error:", err);
    // Log Prisma-specific details for database errors
    if ((err as any).code) console.error("💥 Prisma error code:", (err as any).code);
    if ((err as any).meta) console.error("💥 Prisma error meta:", JSON.stringify((err as any).meta));

    const isDev = env.NODE_ENV !== "production";
    res.status(500).json({
        error: isDev ? err.message || "Internal server error" : "Internal server error",
        ...(isDev && (err as any).code ? { prismaCode: (err as any).code } : {}),
        ...(isDev && (err as any).meta ? { prismaMeta: (err as any).meta } : {}),
    });
}
