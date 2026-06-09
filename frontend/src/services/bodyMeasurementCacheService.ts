// ─────────────────────────────────────────────────────────────────────────────
// bodyMeasurementCacheService — Vücut ölçümleri için 3 dakikalık TTL cache
// MyProgressScreen useFocusEffect tetiklendiğinde her seferinde API'ye
// gitmesini önler.
// ─────────────────────────────────────────────────────────────────────────────
import { bodyMeasurementApi } from "./api";

const TTL_MS = 3 * 60 * 1000; // 3 dakika

type Cache = {
    data: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let cache: Cache | null = null;

function isFresh(): boolean {
    return !!cache?.data && Date.now() - cache.fetchedAt < TTL_MS;
}

export async function getCachedBodyMeasurements(
    limit = 180,
    options: { forceRefresh?: boolean } = {},
): Promise<any[]> {
    if (!options.forceRefresh && isFresh()) {
        return cache!.data.slice(0, limit);
    }

    if (!options.forceRefresh && cache?.promise) {
        return (await cache.promise).slice(0, limit);
    }

    const promise = bodyMeasurementApi
        .list({ limit })
        .then((res) => {
            const data: any[] = res.data.measurements || [];
            cache = { data, fetchedAt: Date.now() };
            return data;
        })
        .catch((err) => {
            if (cache?.promise === promise) {
                cache = cache?.data ? { data: cache.data, fetchedAt: cache.fetchedAt } : null;
            }
            throw err;
        });

    cache = {
        data: cache?.data ?? [],
        fetchedAt: cache?.fetchedAt ?? 0,
        promise,
    };

    return (await promise).slice(0, limit);
}

/** Kullanıcı ölçüm eklediğinde/sildiğinde çağır */
export function invalidateBodyMeasurementCache(): void {
    cache = null;
}

export function getBodyMeasurementSnapshot(): any[] {
    return cache?.data ?? [];
}
