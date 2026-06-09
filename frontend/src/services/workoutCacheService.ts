import { workoutApi } from "./api";
import { invalidateWorkoutAnalyticsCache } from "./workoutAnalyticsCacheService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WORKOUT_CACHE_TTL_MS = 5 * 60 * 1000;
const WORKOUT_CACHE_STORAGE_KEY = "workout_list_cache_data";

type WorkoutCacheEntry = {
    limit: number;
    workouts: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let cache: WorkoutCacheEntry | null = null;
let slicedCache: { [key: string]: { workouts: any[]; parentRef: any[] } } = {};
let cacheVersion = 0;

type WorkoutCacheListener = (version: number) => void;
const listeners = new Set<WorkoutCacheListener>();

export function subscribeToWorkoutCache(listener: WorkoutCacheListener) {
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
            console.error("[workoutCacheService] Listener error:", err);
        }
    });
}

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

async function saveToStorage(limit: number, workouts: any[], fetchedAt: number) {
    try {
        await AsyncStorage.setItem(
            WORKOUT_CACHE_STORAGE_KEY,
            JSON.stringify({ limit, workouts, fetchedAt })
        );
    } catch (err) {
        console.warn("[workoutCacheService] AsyncStorage save failed:", err);
    }
}

async function fetchFreshWorkouts(limit: number): Promise<any[]> {
    const promise = workoutApi.list({ limit })
        .then((res) => {
            const workouts = res.data.workouts || [];
            cache = {
                limit,
                workouts,
                fetchedAt: Date.now(),
            };
            slicedCache = {};
            cacheVersion++;
            saveToStorage(limit, workouts, Date.now());
            notifyListeners();
            return workouts;
        })
        .catch((error) => {
            if (cache?.promise === promise) cache = null;
            throw error;
        });

    cache = {
        limit,
        workouts: cache?.workouts || [],
        fetchedAt: cache?.fetchedAt || 0,
        promise,
    };

    return promise;
}

export async function getCachedWorkouts(limit = 200, options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && isFresh(cache, limit)) {
        return getSlicedWorkouts(limit);
    }

    if (!options.forceRefresh && cache?.promise && cache.limit >= limit) {
        await cache.promise;
        return getSlicedWorkouts(limit);
    }

    // Load from storage if memory cache is empty
    if (!cache) {
        try {
            const stored = await AsyncStorage.getItem(WORKOUT_CACHE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.workouts)) {
                    cache = {
                        limit: parsed.limit || limit,
                        workouts: parsed.workouts,
                        fetchedAt: parsed.fetchedAt || 0,
                    };
                    slicedCache = {};
                    cacheVersion++;
                    notifyListeners();

                    // If storage is fresh enough, return immediately
                    if (!options.forceRefresh && isFresh(cache, limit)) {
                        return getSlicedWorkouts(limit);
                    }

                    // Otherwise, trigger background fetch (stale-while-revalidate)
                    const requestedLimit = Math.max(limit, cache.limit);
                    fetchFreshWorkouts(requestedLimit).catch(() => undefined);
                    return getSlicedWorkouts(limit);
                }
            }
        } catch (err) {
            console.warn("[workoutCacheService] AsyncStorage load error:", err);
        }
    }

    const requestedLimit = Math.max(limit, cache?.limit || 0);
    return fetchFreshWorkouts(requestedLimit);
}

export function getWorkoutCacheSnapshot(limit = 200) {
    return getSlicedWorkouts(limit);
}

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
        saveToStorage(20, [workout], Date.now());
        notifyListeners();
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
    saveToStorage(cache.limit, cache.workouts, cache.fetchedAt);
    notifyListeners();
}

export function invalidateWorkoutCache() {
    cache = null;
    slicedCache = {};
    cacheVersion++;
    AsyncStorage.removeItem(WORKOUT_CACHE_STORAGE_KEY).catch(() => undefined);
    invalidateWorkoutAnalyticsCache();
    notifyListeners();
}
