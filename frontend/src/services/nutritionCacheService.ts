// ─────────────────────────────────────────────────────────────────────────────
// nutritionCacheService — Beslenme kayıtları için 2 dakikalık TTL cache
// MyProgressScreen useFocusEffect tetiklendiğinde her seferinde API'ye
// gitmesini önler.
// ─────────────────────────────────────────────────────────────────────────────
import { nutritionApi } from "./api";

const TTL_MS = 2 * 60 * 1000; // 2 dakika

type Cache = {
    data: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let cache: Cache | null = null;

function isFresh(): boolean {
    return !!cache?.data && Date.now() - cache.fetchedAt < TTL_MS;
}

export async function getCachedNutritionLogs(
    limit = 180,
    options: { forceRefresh?: boolean } = {},
): Promise<any[]> {
    if (!options.forceRefresh && isFresh()) {
        return cache!.data.slice(0, limit);
    }

    if (!options.forceRefresh && cache?.promise) {
        return (await cache.promise).slice(0, limit);
    }

    const promise = nutritionApi
        .list({ limit })
        .then((res) => {
            const data: any[] = res.data.logs || [];
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

/** Kullanıcı beslenme kaydı eklediğinde/sildiğinde çağır */
export function invalidateNutritionCache(): void {
    cache = null;
}

export function getNutritionSnapshot(): any[] {
    return cache?.data ?? [];
}
