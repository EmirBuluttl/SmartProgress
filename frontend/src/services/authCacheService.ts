import { authApi } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_TTL_MS = 5 * 60 * 1000;
const STORAGE_KEY = "user_profile_cache_data";

type ProfileCache = {
    data: any;
    fetchedAt: number;
    promise?: Promise<any>;
};

let cache: ProfileCache | null = null;

function isFresh(): boolean {
    if (!cache?.data) return false;
    return Date.now() - cache.fetchedAt < PROFILE_TTL_MS;
}

async function saveToStorage(data: any, fetchedAt: number) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ data, fetchedAt }));
    } catch (err) {
        console.warn("[authCacheService] AsyncStorage save failed:", err);
    }
}

async function fetchFreshProfile(): Promise<any> {
    const promise = authApi
        .getProfile()
        .then((res) => {
            cache = { data: res.data, fetchedAt: Date.now() };
            saveToStorage(res.data, Date.now());
            return res.data;
        })
        .catch((err) => {
            if (cache?.promise === promise) {
                cache = cache?.data ? { data: cache.data, fetchedAt: cache.fetchedAt } : null;
            }
            throw err;
        });

    cache = {
        data: cache?.data ?? null,
        fetchedAt: cache?.fetchedAt ?? 0,
        promise,
    };

    return promise;
}

export async function getCachedProfile(options: { forceRefresh?: boolean } = {}): Promise<any> {
    if (!options.forceRefresh && isFresh()) {
        return cache!.data;
    }

    if (!options.forceRefresh && cache?.promise) {
        return cache.promise;
    }

    // Load from storage if memory cache is empty
    if (!cache) {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.data) {
                    cache = {
                        data: parsed.data,
                        fetchedAt: parsed.fetchedAt || 0,
                    };

                    // If storage is fresh enough, return immediately
                    if (!options.forceRefresh && isFresh()) {
                        return cache.data;
                    }

                    // Otherwise, trigger background fetch (SWR)
                    fetchFreshProfile().catch(() => undefined);
                    return cache.data;
                }
            }
        } catch (err) {
            console.warn("[authCacheService] AsyncStorage load error:", err);
        }
    }

    return fetchFreshProfile();
}

export function invalidateProfileCache(): void {
    cache = null;
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export function getProfileSnapshot(): any | null {
    return cache?.data ?? null;
}
