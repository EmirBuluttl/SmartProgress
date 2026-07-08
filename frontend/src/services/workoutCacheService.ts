import { workoutApi } from "./api";
import { invalidateWorkoutAnalyticsCache } from "./workoutAnalyticsCacheService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WORKOUT_CACHE_TTL_MS = 5 * 60 * 1000;
const WORKOUT_CACHE_STORAGE_KEY = "workout_list_cache_data";
const WORKOUT_SUMMARY_CACHE_STORAGE_KEY = "workout_summary_cache_data";
const WORKOUT_DETAIL_CACHE_PREFIX = "workout_detail_cache:";

type WorkoutCacheEntry = {
    limit: number;
    workouts: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

type WorkoutDetailCacheEntry = {
    workout?: any;
    fetchedAt: number;
    promise?: Promise<any>;
};

let cache: WorkoutCacheEntry | null = null;
let summaryCache: WorkoutCacheEntry | null = null;
const detailCache = new Map<string, WorkoutDetailCacheEntry>();
let slicedCache: { [key: string]: { workouts: any[]; parentRef: any[] } } = {};
let slicedSummaryCache: { [key: string]: { workouts: any[]; parentRef: any[] } } = {};
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

function getSlicedSummaries(limit: number) {
    if (!summaryCache) return [];
    const key = String(limit);
    if (slicedSummaryCache[key]?.parentRef === summaryCache.workouts) {
        return slicedSummaryCache[key].workouts;
    }
    const sliced = summaryCache.workouts.slice(0, limit);
    slicedSummaryCache[key] = {
        workouts: sliced,
        parentRef: summaryCache.workouts,
    };
    return sliced;
}

function countWorkingSets(workout: any): number {
    const exercises = Array.isArray(workout?.data?.exercises) ? workout.data.exercises : [];
    return exercises.reduce((sum: number, exercise: any) => {
        const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
        return sum + sets.filter((set: any) => !set?.isWarmup).length;
    }, 0);
}

export function summarizeWorkout(workout: any) {
    const data = workout?.data || {};
    const hasExercises = Array.isArray(data.exercises);
    return {
        ...workout,
        data: {
            totalDuration: data.totalDuration ?? 0,
            totalVolume: data.totalVolume ?? 0,
            exerciseCount: data.exerciseCount ?? (hasExercises ? data.exercises.length : 0),
            setCount: data.setCount ?? (hasExercises ? countWorkingSets(workout) : 0),
            cardioBlocks: Array.isArray(data.cardioBlocks)
                ? data.cardioBlocks.map((block: any) => {
                    const { stages, ...rest } = block || {};
                    return rest;
                })
                : data.cardioBlocks,
            caloriesBurned: data.caloriesBurned,
            distance: data.distance,
            distanceUnit: data.distanceUnit,
            duration: data.duration,
            avgPace: data.avgPace,
            avgHeartRate: data.avgHeartRate,
            elevationGain: data.elevationGain,
        },
    };
}

async function saveToStorage(limit: number, workouts: any[], fetchedAt: number) {
    // Full workout lists can become very large and block the mobile JS thread
    // during AsyncStorage JSON.parse. Keep this cache in memory only; summary
    // and per-detail caches are the persisted sources.
    void limit;
    void workouts;
    void fetchedAt;
}

async function saveSummaryToStorage(limit: number, workouts: any[], fetchedAt: number) {
    try {
        await AsyncStorage.setItem(
            WORKOUT_SUMMARY_CACHE_STORAGE_KEY,
            JSON.stringify({ limit, workouts, fetchedAt })
        );
    } catch (err) {
        console.warn("[workoutCacheService] Summary cache save failed:", err);
    }
}

async function saveDetailToStorage(workout: any, fetchedAt: number) {
    if (!workout?.id) return;
    try {
        await AsyncStorage.setItem(
            `${WORKOUT_DETAIL_CACHE_PREFIX}${workout.id}`,
            JSON.stringify({ workout, fetchedAt })
        );
    } catch (err) {
        console.warn("[workoutCacheService] Detail cache save failed:", err);
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
            summaryCache = {
                limit,
                workouts: workouts.map(summarizeWorkout),
                fetchedAt: Date.now(),
            };
            slicedCache = {};
            slicedSummaryCache = {};
            cacheVersion++;
            saveToStorage(limit, workouts, Date.now());
            saveSummaryToStorage(limit, summaryCache.workouts, Date.now());
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

async function fetchFreshWorkoutSummaries(limit: number): Promise<any[]> {
    const promise = workoutApi.list({ limit, summary: true })
        .then((res) => {
            const workouts = (res.data.workouts || []).map(summarizeWorkout);
            summaryCache = {
                limit,
                workouts,
                fetchedAt: Date.now(),
            };
            slicedSummaryCache = {};
            cacheVersion++;
            saveSummaryToStorage(limit, workouts, Date.now());
            notifyListeners();
            return workouts;
        })
        .catch((error) => {
            if (summaryCache?.promise === promise) summaryCache = null;
            throw error;
        });

    summaryCache = {
        limit,
        workouts: summaryCache?.workouts || [],
        fetchedAt: summaryCache?.fetchedAt || 0,
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

    const requestedLimit = Math.max(limit, cache?.limit || 0);
    return fetchFreshWorkouts(requestedLimit);
}

export async function getCachedWorkoutSummaries(limit = 20, options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && isFresh(summaryCache, limit)) {
        return getSlicedSummaries(limit);
    }

    if (!options.forceRefresh && summaryCache?.promise && summaryCache.limit >= limit) {
        await summaryCache.promise;
        return getSlicedSummaries(limit);
    }

    if (!summaryCache) {
        try {
            const stored = await AsyncStorage.getItem(WORKOUT_SUMMARY_CACHE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.workouts)) {
                    summaryCache = {
                        limit: parsed.limit || limit,
                        workouts: parsed.workouts.map(summarizeWorkout),
                        fetchedAt: parsed.fetchedAt || 0,
                    };
                    slicedSummaryCache = {};
                    cacheVersion++;
                    notifyListeners();

                    if (!options.forceRefresh && isFresh(summaryCache, limit)) {
                        return getSlicedSummaries(limit);
                    }

                    const requestedLimit = Math.max(limit, summaryCache.limit);
                    fetchFreshWorkoutSummaries(requestedLimit).catch(() => undefined);
                    return getSlicedSummaries(limit);
                }
            }
        } catch (err) {
            console.warn("[workoutCacheService] Summary cache load error:", err);
        }
    }

    const requestedLimit = Math.max(limit, summaryCache?.limit || 0);
    if (options.forceRefresh) {
        return fetchFreshWorkoutSummaries(requestedLimit);
    }

    // On mobile cold starts, waiting for network before the first screen becomes
    // usable is worse than showing an empty/stale shell. Kick off the refresh
    // and let cache listeners repaint when the summaries arrive.
    fetchFreshWorkoutSummaries(requestedLimit).catch(() => undefined);
    return getSlicedSummaries(limit);
}

export async function getCachedWorkoutDetail(id: string, fallback?: any, options: { forceRefresh?: boolean } = {}) {
    const current = detailCache.get(id);
    if (!options.forceRefresh && current?.workout && Date.now() - current.fetchedAt < WORKOUT_CACHE_TTL_MS) {
        return current.workout;
    }
    if (!options.forceRefresh && current?.promise) return current.promise;

    const fallbackDetail = fallback?.data?.exercises ? fallback : cache?.workouts.find((workout) => workout.id === id);
    if (!options.forceRefresh && fallbackDetail?.data?.exercises) {
        detailCache.set(id, { workout: fallbackDetail, fetchedAt: Date.now() });
        saveDetailToStorage(fallbackDetail, Date.now());
        return fallbackDetail;
    }

    if (!current && !options.forceRefresh) {
        try {
            const stored = await AsyncStorage.getItem(`${WORKOUT_DETAIL_CACHE_PREFIX}${id}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.workout) {
                    detailCache.set(id, { workout: parsed.workout, fetchedAt: parsed.fetchedAt || 0 });
                    if (Date.now() - (parsed.fetchedAt || 0) < WORKOUT_CACHE_TTL_MS) {
                        return parsed.workout;
                    }
                }
            }
        } catch (err) {
            console.warn("[workoutCacheService] Detail cache load error:", err);
        }
    }

    const promise = workoutApi.getById(id)
        .then((res) => {
            const workout = res.data;
            detailCache.set(id, { workout, fetchedAt: Date.now() });
            updateWorkoutInCache(workout);
            saveDetailToStorage(workout, Date.now());
            return workout;
        })
        .catch((error) => {
            const latest = detailCache.get(id);
            if (latest?.promise === promise) detailCache.delete(id);
            throw error;
        });

    detailCache.set(id, {
        workout: current?.workout || fallbackDetail,
        fetchedAt: current?.fetchedAt || 0,
        promise,
    });
    return promise;
}

export function getWorkoutCacheSnapshot(limit = 200) {
    return getSlicedWorkouts(limit);
}

export function getWorkoutSummarySnapshot(limit = 20) {
    return getSlicedSummaries(limit);
}

export function getWorkoutCacheVersion(): number {
    return cacheVersion;
}

export function updateWorkoutInCache(workout: any) {
    if (workout?.id) {
        detailCache.set(workout.id, { workout, fetchedAt: Date.now() });
        saveDetailToStorage(workout, Date.now());
    }
    if (!cache) {
        cache = {
            limit: 20,
            workouts: [workout],
            fetchedAt: Date.now(),
        };
        summaryCache = {
            limit: 20,
            workouts: [summarizeWorkout(workout)],
            fetchedAt: Date.now(),
        };
        slicedCache = {};
        slicedSummaryCache = {};
        cacheVersion++;
        saveToStorage(20, [workout], Date.now());
        saveSummaryToStorage(20, summaryCache.workouts, Date.now());
        notifyListeners();
        return;
    }
    const index = cache.workouts.findIndex((w) => w.id === workout.id);
    if (index >= 0) {
        cache.workouts[index] = workout;
    } else {
        cache.workouts.unshift(workout);
    }
    const summary = summarizeWorkout(workout);
    if (summaryCache) {
        const summaryIndex = summaryCache.workouts.findIndex((w) => w.id === workout.id);
        if (summaryIndex >= 0) summaryCache.workouts[summaryIndex] = summary;
        else summaryCache.workouts.unshift(summary);
    } else {
        summaryCache = {
            limit: cache.limit,
            workouts: cache.workouts.map(summarizeWorkout),
            fetchedAt: Date.now(),
        };
    }
    slicedCache = {};
    slicedSummaryCache = {};
    cacheVersion++;
    saveToStorage(cache.limit, cache.workouts, cache.fetchedAt);
    saveSummaryToStorage(summaryCache.limit, summaryCache.workouts, summaryCache.fetchedAt);
    notifyListeners();
}

export function invalidateWorkoutCache() {
    cache = null;
    summaryCache = null;
    detailCache.clear();
    slicedCache = {};
    slicedSummaryCache = {};
    cacheVersion++;
    AsyncStorage.removeItem(WORKOUT_CACHE_STORAGE_KEY).catch(() => undefined);
    AsyncStorage.removeItem(WORKOUT_SUMMARY_CACHE_STORAGE_KEY).catch(() => undefined);
    AsyncStorage.getAllKeys()
        .then((keys) => keys.filter((key) => key.startsWith(WORKOUT_DETAIL_CACHE_PREFIX)))
        .then((keys) => {
            if (keys.length > 0) return AsyncStorage.multiRemove(keys);
            return undefined;
        })
        .catch(() => undefined);
    invalidateWorkoutAnalyticsCache();
    notifyListeners();
}
