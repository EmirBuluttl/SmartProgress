import { workoutApi } from "./api";
import { invalidateWorkoutAnalyticsCache } from "./workoutAnalyticsCacheService";

const WORKOUT_CACHE_TTL_MS = 5 * 60 * 1000;

type WorkoutCacheEntry = {
    limit: number;
    workouts: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let cache: WorkoutCacheEntry | null = null;

function isFresh(entry: WorkoutCacheEntry | null, limit: number) {
    if (!entry) return false;
    if (entry.limit < limit) return false;
    return Date.now() - entry.fetchedAt < WORKOUT_CACHE_TTL_MS;
}

export async function getCachedWorkouts(limit = 200, options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && isFresh(cache, limit)) {
        return (cache?.workouts || []).slice(0, limit);
    }

    if (!options.forceRefresh && cache?.promise && cache.limit >= limit) {
        const workouts = await cache.promise;
        return workouts.slice(0, limit);
    }

    const requestedLimit = Math.max(limit, cache?.limit || 0);
    const promise = workoutApi.list({ limit: requestedLimit })
        .then((res) => {
            const workouts = res.data.workouts || [];
            cache = {
                limit: requestedLimit,
                workouts,
                fetchedAt: Date.now(),
            };
            return workouts;
        })
        .catch((error) => {
            if (cache?.promise === promise) cache = null;
            throw error;
        });

    cache = {
        limit: requestedLimit,
        workouts: cache?.workouts || [],
        fetchedAt: cache?.fetchedAt || 0,
        promise,
    };

    const workouts = await promise;
    return workouts.slice(0, limit);
}

export function getWorkoutCacheSnapshot(limit = 200) {
    if (!cache?.workouts?.length) return [];
    return cache.workouts.slice(0, limit);
}

export function invalidateWorkoutCache() {
    cache = null;
    invalidateWorkoutAnalyticsCache();
}
