import { bodyMeasurementApi } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TTL_MS = 3 * 60 * 1000; // 3 dakika
const STORAGE_KEY = "body_measurement_cache_data";

type Cache = {
    data: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let cache: Cache | null = null;
let cacheVersion = 0;

type BodyMeasurementCacheListener = (version: number) => void;
const listeners = new Set<BodyMeasurementCacheListener>();

export function subscribeToBodyMeasurementCache(listener: BodyMeasurementCacheListener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notifyListeners() {
    listeners.forEach((listener) => {
        try {
            listener(cacheVersion);
        } catch (err) {
            console.error("[bodyMeasurementCacheService] Listener error:", err);
        }
    });
}

function isFresh(): boolean {
    return !!cache?.data && Date.now() - cache.fetchedAt < TTL_MS;
}

export function getBodyMeasurementCacheVersion(): number {
    return cacheVersion;
}

async function saveToStorage(data: any[], fetchedAt: number) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ data, fetchedAt }));
    } catch (err) {
        console.warn("[bodyMeasurementCacheService] AsyncStorage save failed:", err);
    }
}

async function fetchFreshMeasurements(limit: number): Promise<any[]> {
    const promise = bodyMeasurementApi
        .list({ limit })
        .then((res) => {
            const data: any[] = res.data.measurements || [];
            cache = { data, fetchedAt: Date.now() };
            cacheVersion++;
            saveToStorage(data, Date.now());
            notifyListeners();
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

    return promise;
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

    // Load from storage if memory cache is empty
    if (!cache) {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.data)) {
                    cache = {
                        data: parsed.data,
                        fetchedAt: parsed.fetchedAt || 0,
                    };
                    cacheVersion++;
                    notifyListeners();

                    // If storage is fresh enough, return immediately
                    if (!options.forceRefresh && isFresh()) {
                        return cache.data.slice(0, limit);
                    }

                    // Otherwise, trigger background fetch (SWR)
                    fetchFreshMeasurements(limit).catch(() => undefined);
                    return cache.data.slice(0, limit);
                }
            }
        } catch (err) {
            console.warn("[bodyMeasurementCacheService] AsyncStorage load error:", err);
        }
    }

    const data = await fetchFreshMeasurements(limit);
    return data.slice(0, limit);
}

export function invalidateBodyMeasurementCache(): void {
    cache = null;
    cacheVersion++;
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
    notifyListeners();
}

export function getBodyMeasurementSnapshot(): any[] {
    return cache?.data ?? [];
}
