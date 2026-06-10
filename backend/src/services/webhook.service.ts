// ─────────────────────────────────────────────
// Webhook Service — RevenueCat Event Handler
//
// RevenueCat sends a POST to /api/v1/webhooks/revenuecat
// for every subscription lifecycle event.
//
// We use the app_user_id field (= our user's UUID) to find
// the user and update their subscription in the database.
// ─────────────────────────────────────────────
import prisma from "../config/prisma";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";

// ─── RevenueCat event types we care about ────
// Full list: https://www.revenuecat.com/docs/webhooks
type RevenueCatEventType =
    | "INITIAL_PURCHASE"   // First ever purchase
    | "RENEWAL"            // Subscription auto-renewed
    | "PRODUCT_CHANGE"     // User changed plan
    | "CANCELLATION"       // User cancelled (access until period end)
    | "BILLING_ISSUE"      // Payment failed (grace period starts)
    | "EXPIRATION"         // Subscription fully expired (no more access)
    | "REFUND"             // Purchase refunded
    | "TRANSFER"           // Subscription transferred between users
    | "SUBSCRIBER_ALIAS";  // User alias event (ignore)

interface RevenueCatWebhookEvent {
    event: {
        type: RevenueCatEventType;
        app_user_id: string;       // This is our user's UUID
        original_app_user_id?: string;
        product_id?: string;        // e.g. "smartprogress_pro_monthly"
        entitlement_ids?: string[]; // e.g. ["premium"]
        expiration_at_ms?: number;  // Unix ms when access expires
        cancel_reason?: string;
    };
}

// ─── Map product_id → SubscriptionTier ───────
// Update this if you add new products in RevenueCat
function tierFromProductId(productId?: string): SubscriptionTier {
    if (!productId) return SubscriptionTier.PRO;
    const lower = productId.toLowerCase();
    if (lower.includes("coach_plus") || lower.includes("coach-plus")) {
        return SubscriptionTier.COACH_PLUS;
    }
    return SubscriptionTier.PRO;
}

// ─── Main Handler ─────────────────────────────

export async function handleRevenueCatWebhook(body: RevenueCatWebhookEvent): Promise<void> {
    const event = body?.event;
    if (!event?.type || !event?.app_user_id) {
        console.warn("[Webhook] Malformed RevenueCat event — missing type or app_user_id");
        return;
    }

    const userId = event.app_user_id;
    const eventType = event.type;

    console.log(`[Webhook] RevenueCat event received: ${eventType} for user ${userId}`);

    // Find user in our DB by the RevenueCat app_user_id (= our UUID)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        // Could be a transfer or test event — log and skip gracefully
        console.warn(`[Webhook] User not found for app_user_id: ${userId} (event: ${eventType})`);
        return;
    }

    let newTier: SubscriptionTier = user.subscriptionTier;
    let newStatus: SubscriptionStatus = user.subscriptionStatus;

    switch (eventType) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "PRODUCT_CHANGE":
            // User is now active — grant full access
            newTier = tierFromProductId(event.product_id);
            newStatus = SubscriptionStatus.ACTIVE;
            break;

        case "CANCELLATION":
            // User cancelled but access continues until expiration_at_ms.
            // We keep the tier so they still have premium features until then.
            // The EXPIRATION event will downgrade them when the period ends.
            newStatus = SubscriptionStatus.CANCELLED;
            break;

        case "BILLING_ISSUE":
            // Payment failed — RevenueCat starts a grace period.
            // Keep tier active (they still have access during grace period).
            newStatus = SubscriptionStatus.BILLING_ISSUE;
            break;

        case "EXPIRATION":
        case "REFUND":
            // Access fully revoked — downgrade to free
            newTier = SubscriptionTier.FREE;
            newStatus = SubscriptionStatus.INACTIVE;
            break;

        case "TRANSFER":
        case "SUBSCRIBER_ALIAS":
            // Informational events — no DB change needed
            console.log(`[Webhook] Informational event ${eventType} — no action taken`);
            return;

        default:
            console.log(`[Webhook] Unknown event type: ${eventType} — skipping`);
            return;
    }

    // Only write to DB if something actually changed
    if (newTier === user.subscriptionTier && newStatus === user.subscriptionStatus) {
        console.log(`[Webhook] No change needed for user ${userId} — already ${newTier}/${newStatus}`);
        return;
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            subscriptionTier: newTier,
            subscriptionStatus: newStatus,
        },
    });

    console.log(
        `[Webhook] ✅ Updated user ${userId}: ${user.subscriptionTier}/${user.subscriptionStatus} → ${newTier}/${newStatus} (event: ${eventType})`
    );
}
