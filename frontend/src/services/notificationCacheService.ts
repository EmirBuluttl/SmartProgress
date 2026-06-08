// ─────────────────────────────────────────────────────────────────────────────
// notificationCacheService — 60 saniyelik in-memory cache
// Her tab focus'ta notificationApi.list() çağrısını önler
// ─────────────────────────────────────────────────────────────────────────────
import { notificationApi } from "./api";

const NOTIFICATION_TTL_MS = 60 * 1000; // 60 saniye

type NotificationCache = {
    notifications: any[];
    unreadCount: number;
    fetchedAt: number;
    promise?: Promise<NotificationResult>;
};

export type NotificationResult = {
    notifications: any[];
    unreadCount: number;
};

let cache: NotificationCache | null = null;

function isFresh(): boolean {
    if (!cache?.notifications) return false;
    return Date.now() - cache.fetchedAt < NOTIFICATION_TTL_MS;
}

export async function getCachedNotifications(
    options: { forceRefresh?: boolean } = {},
): Promise<NotificationResult> {
    if (!options.forceRefresh && isFresh()) {
        return { notifications: cache!.notifications, unreadCount: cache!.unreadCount };
    }

    if (!options.forceRefresh && cache?.promise) {
        return cache.promise;
    }

    const promise = notificationApi
        .list({ limit: 20 })
        .then((res) => {
            const result: NotificationResult = {
                notifications: res.data.notifications || [],
                unreadCount: res.data.unreadCount || 0,
            };
            cache = { ...result, fetchedAt: Date.now() };
            return result;
        })
        .catch((err) => {
            if (cache?.promise === promise) {
                cache = cache?.notifications
                    ? { notifications: cache.notifications, unreadCount: cache.unreadCount, fetchedAt: cache.fetchedAt }
                    : null;
            }
            throw err;
        });

    cache = {
        notifications: cache?.notifications ?? [],
        unreadCount: cache?.unreadCount ?? 0,
        fetchedAt: cache?.fetchedAt ?? 0,
        promise,
    };

    return promise;
}

/**
 * Bildirim okunduğunda / silindiğinde cache'i anlık güncelle
 * (invalidate yerine update — gereksiz network isteği önler)
 */
export function updateNotificationCache(notifications: any[], unreadCount: number): void {
    if (cache) {
        cache = { notifications, unreadCount, fetchedAt: Date.now() };
    }
}

/** Cache'i tamamen sıfırla (logout vb.) */
export function invalidateNotificationCache(): void {
    cache = null;
}

/** Bellekteki anlık veriyi döndür */
export function getNotificationSnapshot(): NotificationResult {
    return {
        notifications: cache?.notifications ?? [],
        unreadCount: cache?.unreadCount ?? 0,
    };
}
