// ─────────────────────────────────────────────────────────────────────────────
// authCacheService — getProfile için 5 dakikalık in-memory cache
// Her useFocusEffect tetiklendiğinde API'ye gitmesini önler
// ─────────────────────────────────────────────────────────────────────────────
import { authApi } from "./api";

const PROFILE_TTL_MS = 5 * 60 * 1000;

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

export async function getCachedProfile(options: { forceRefresh?: boolean } = {}): Promise<any> {
    if (!options.forceRefresh && isFresh()) {
        return cache!.data;
    }

    if (!options.forceRefresh && cache?.promise) {
        return cache.promise;
    }

    const promise = authApi
        .getProfile()
        .then((res) => {
            cache = { data: res.data, fetchedAt: Date.now() };
            return res.data;
        })
        .catch((err) => {
            // Hata durumunda promise'i temizle, eski data'yı koru
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

/** Kullanıcı profil güncellemesinden sonra cache'i sıfırla */
export function invalidateProfileCache(): void {
    cache = null;
}

/** Zaten bellekte data varsa senkron döndür (fallback) */
export function getProfileSnapshot(): any | null {
    return cache?.data ?? null;
}
