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
let slicedCache: { [key: string]: { workouts: any[]; parentRef: any[] } } = {};
// Her cache güncellemesinde artar
let cacheVersion = 0;

function isFresh(entry: WorkoutCacheEntry | null, limit: number) {
    if (!entry) return false;
    if (entry.limit < limit) return false;
    return Date.now() - entry.fetchedAt < WORKOUT_CACHE_TTL_MS;
}

function getSlicedWorkouts(limit: number) {
    if (!cache) return [];
    const key = String(limit);
    if (slicedCache[key]?.parentRef === cache.workouts) {
        return slicedCache[key].workouts;
    }
    const sliced = cache.workouts.slice(0, limit);
    slicedCache[key] = {
        workouts: sliced,
        parentRef: cache.workouts,
    };
    return sliced;
}

export async function getCachedWorkouts(limit = 200, options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && isFresh(cache, limit)) {
        return getSlicedWorkouts(limit);
    }

    if (!options.forceRefresh && cache?.promise && cache.limit >= limit) {
        await cache.promise;
        return getSlicedWorkouts(limit);
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
            cacheVersion++;
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

    await promise;
    return getSlicedWorkouts(limit);
}

export function getWorkoutCacheSnapshot(limit = 200) {
    return getSlicedWorkouts(limit);
}

/** Her yeni antrenman kaydedildiğinde/silindiğinde artan sürüm numarası */
export function getWorkoutCacheVersion(): number {
    return cacheVersion;
}

export function updateWorkoutInCache(workout: any) {
    if (!cache) {
        cache = {
            limit: 20,
            workouts: [workout],
            fetchedAt: Date.now(),
        };
        slicedCache = {};
        cacheVersion++;
        return;
    }
    const index = cache.workouts.findIndex((w) => w.id === workout.id);
    if (index >= 0) {
        cache.workouts[index] = workout;
    } else {
        cache.workouts.unshift(workout);
    }
    slicedCache = {};
    cacheVersion++;
}

export function invalidateWorkoutCache() {
    cache = null;
    slicedCache = {};
    cacheVersion++;
    invalidateWorkoutAnalyticsCache();
}

