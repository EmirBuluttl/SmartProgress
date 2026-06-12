import prisma from "../config/prisma";
import { env } from "../config/env";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";

type RevenueCatEventType =
    | "INITIAL_PURCHASE"
    | "RENEWAL"
    | "PRODUCT_CHANGE"
    | "CANCELLATION"
    | "BILLING_ISSUE"
    | "EXPIRATION"
    | "REFUND"
    | "TRANSFER"
    | "SUBSCRIBER_ALIAS";

interface RevenueCatWebhookEvent {
    event: {
        type: RevenueCatEventType;
        app_user_id: string;
        original_app_user_id?: string;
        product_id?: string;
        entitlement_ids?: string[];
        expiration_at_ms?: number;
        cancel_reason?: string;
    };
}

const PREMIUM_PRODUCT_IDS = new Set([
    "smartprogress_premium_monthly",
    "smartprogress_premium_monthly:monthly-plan",
]);

function isPremiumEvent(event: RevenueCatWebhookEvent["event"]): boolean {
    const entitlementId = env.REVENUECAT_PREMIUM_ENTITLEMENT_ID;
    const entitlementIds = event.entitlement_ids ?? [];
    const productId = event.product_id?.toLowerCase();

    if (entitlementIds.length > 0) {
        return entitlementIds.includes(entitlementId);
    }

    return !!productId && PREMIUM_PRODUCT_IDS.has(productId);
}

function tierFromProductId(productId?: string): SubscriptionTier {
    const lower = productId?.toLowerCase() ?? "";
    if (lower.includes("coach_plus") || lower.includes("coach-plus")) {
        return SubscriptionTier.COACH_PLUS;
    }

    return SubscriptionTier.PRO;
}

export async function handleRevenueCatWebhook(body: RevenueCatWebhookEvent): Promise<void> {
    const event = body?.event;
    if (!event?.type || !event?.app_user_id) {
        console.warn("[Webhook] Malformed RevenueCat event; missing type or app_user_id");
        return;
    }

    const userId = event.app_user_id;
    const eventType = event.type;

    if (eventType === "TRANSFER" || eventType === "SUBSCRIBER_ALIAS") {
        console.log(`[Webhook] Informational RevenueCat event ${eventType}; no action taken`);
        return;
    }

    if (!isPremiumEvent(event)) {
        console.log(
            `[Webhook] RevenueCat event ignored for non-premium product/entitlement: ${eventType}`
        );
        return;
    }

    console.log(`[Webhook] RevenueCat event received: ${eventType} for user ${userId}`);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.warn(`[Webhook] User not found for app_user_id: ${userId} (event: ${eventType})`);
        return;
    }

    let newTier: SubscriptionTier = user.subscriptionTier;
    let newStatus: SubscriptionStatus = user.subscriptionStatus;

    switch (eventType) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "PRODUCT_CHANGE":
            newTier = tierFromProductId(event.product_id);
            newStatus = SubscriptionStatus.ACTIVE;
            break;

        case "CANCELLATION":
            newStatus = SubscriptionStatus.CANCELLED;
            break;

        case "BILLING_ISSUE":
            newStatus = SubscriptionStatus.BILLING_ISSUE;
            break;

        case "EXPIRATION":
        case "REFUND":
            newTier = SubscriptionTier.FREE;
            newStatus = SubscriptionStatus.INACTIVE;
            break;

        default:
            console.log(`[Webhook] Unknown RevenueCat event type: ${eventType}; skipping`);
            return;
    }

    if (newTier === user.subscriptionTier && newStatus === user.subscriptionStatus) {
        console.log(`[Webhook] No subscription change needed for user ${userId}`);
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
        `[Webhook] Updated user ${userId}: ${user.subscriptionTier}/${user.subscriptionStatus} -> ${newTier}/${newStatus} (event: ${eventType})`
    );
}
