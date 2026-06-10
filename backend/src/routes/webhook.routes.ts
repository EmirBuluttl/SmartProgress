// ─────────────────────────────────────────────
// Webhook Routes — RevenueCat Subscription Events
// POST /api/v1/webhooks/revenuecat
//
// Security: RevenueCat sends an "Authorization" header
// with the value you set in their dashboard.
// We reject any request that doesn't match our secret.
// ─────────────────────────────────────────────
import { Router, Request, Response } from "express";
import { env } from "../config/env";
import { handleRevenueCatWebhook } from "../services/webhook.service";

const router = Router();

router.post("/revenuecat", async (req: Request, res: Response) => {
    // ── 1. Verify the Authorization header ──
    // RevenueCat sends: Authorization: <your-webhook-secret>
    // This prevents random internet traffic from hitting our endpoint.
    const authHeader = req.headers["authorization"] ?? "";
    const webhookSecret = env.REVENUECAT_WEBHOOK_SECRET;

    if (!webhookSecret) {
        // Misconfiguration — secret not set in env
        console.error("[Webhook] REVENUECAT_WEBHOOK_SECRET is not configured in environment");
        return res.status(500).json({ error: "Webhook not configured" });
    }

    if (authHeader !== webhookSecret) {
        console.warn("[Webhook] Unauthorized request — invalid Authorization header");
        return res.status(401).json({ error: "Unauthorized" });
    }

    // ── 2. Acknowledge immediately ──
    // RevenueCat expects a 200 response quickly (within ~5 seconds).
    // We send 200 now and process asynchronously to avoid timeouts.
    res.status(200).json({ received: true });

    // ── 3. Process the event ──
    try {
        await handleRevenueCatWebhook(req.body);
    } catch (error) {
        // Log but don't crash — response already sent
        console.error("[Webhook] Error processing RevenueCat event:", error);
    }
});

export default router;
