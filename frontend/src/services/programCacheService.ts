import { programApi, registerProgramMutationCallback } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRAM_CACHE_TTL_MS = 5 * 60 * 1000;
const PROGRAM_CACHE_STORAGE_KEY = "my_program_list_cache_data";

type ProgramCacheEntry = {
    programs: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let mineCache: ProgramCacheEntry | null = null;
const detailCache = new Map<string, { program: any; fetchedAt: number; promise?: Promise<any> }>();
let cacheVersion = 0;

type ProgramCacheListener = (version: number) => void;
const listeners = new Set<ProgramCacheListener>();

export function subscribeToProgramCache(listener: ProgramCacheListener) {
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
            console.error("[programCacheService] Listener error:", err);
        }
    });
}

function isFresh(timestamp: number) {
    return Date.now() - timestamp < PROGRAM_CACHE_TTL_MS;
}

export function getProgramListSnapshot() {
    return mineCache?.programs || [];
}

export function getProgramDetailSnapshot(programId: string) {
    const detail = detailCache.get(programId);
    if (detail?.program) return detail.program;
    return mineCache?.programs.find((program) => program.id === programId) || null;
}

export function getProgramCacheVersion(): number {
    return cacheVersion;
}

export function updateProgramDayInCache(programId: string, currentDayIndex: number) {
    let changed = false;
    if (mineCache?.programs) {
        mineCache = {
            ...mineCache,
            programs: mineCache.programs.map((program) => {
                if (program.id !== programId) return program;
                changed = true;
                return { ...program, currentDayIndex };
            }),
            fetchedAt: Date.now(),
        };
    }

    const detail = detailCache.get(programId);
    if (detail?.program) {
        detailCache.set(programId, {
            ...detail,
            program: { ...detail.program, currentDayIndex },
            fetchedAt: Date.now(),
        });
        changed = true;
    }

    if (changed) {
        cacheVersion++;
        if (mineCache) saveToStorage(mineCache.programs, mineCache.fetchedAt);
        notifyListeners();
    }
}

async function saveToStorage(programs: any[], fetchedAt: number) {
    try {
        await AsyncStorage.setItem(
            PROGRAM_CACHE_STORAGE_KEY,
            JSON.stringify({ programs, fetchedAt })
        );
    } catch (err) {
        console.warn("[programCacheService] AsyncStorage save failed:", err);
    }
}

async function fetchFreshMyPrograms(): Promise<any[]> {
    const promise = programApi.listMine()
        .then((res) => {
            const programs = res.data.programs || [];
            mineCache = { programs, fetchedAt: Date.now() };
            cacheVersion++;
            for (const program of programs) {
                if (program?.id) detailCache.set(program.id, { program, fetchedAt: Date.now() });
            }
            saveToStorage(programs, Date.now());
            notifyListeners();
            return programs;
        })
        .catch((error) => {
            if (mineCache?.promise === promise) mineCache = null;
            throw error;
        });

    mineCache = {
        programs: mineCache?.programs || [],
        fetchedAt: mineCache?.fetchedAt || 0,
        promise,
    };
    return promise;
}

export async function getCachedMyPrograms(options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && mineCache?.programs && isFresh(mineCache.fetchedAt)) {
        return mineCache.programs;
    }
    if (!options.forceRefresh && mineCache?.promise) return mineCache.promise;

    // Load from storage if cache is empty
    if (!mineCache) {
        try {
            const stored = await AsyncStorage.getItem(PROGRAM_CACHE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.programs)) {
                    mineCache = {
                        programs: parsed.programs,
                        fetchedAt: parsed.fetchedAt || 0,
                    };
                    cacheVersion++;
                    for (const program of parsed.programs) {
                        if (program?.id) detailCache.set(program.id, { program, fetchedAt: parsed.fetchedAt || 0 });
                    }
                    notifyListeners();

                    // If storage is fresh enough, return immediately
                    if (!options.forceRefresh && isFresh(mineCache.fetchedAt)) {
                        return mineCache.programs;
                    }

                    // Otherwise, trigger background fetch (SWR)
                    fetchFreshMyPrograms().catch(() => undefined);
                    return mineCache.programs;
                }
            }
        } catch (err) {
            console.warn("[programCacheService] AsyncStorage load error:", err);
        }
    }

    return fetchFreshMyPrograms();
}

export async function getCachedProgramById(programId: string, options: { forceRefresh?: boolean } = {}) {
    const current = detailCache.get(programId);
    if (!options.forceRefresh && current?.program && isFresh(current.fetchedAt)) return current.program;
    if (!options.forceRefresh && current?.promise) return current.promise;

    const listMatch = mineCache?.programs.find((program) => program.id === programId);
    if (!options.forceRefresh && listMatch && isFresh(mineCache?.fetchedAt || 0)) return listMatch;

    const promise = programApi.getById(programId)
        .then((res) => {
            const program = res.data;
            detailCache.set(programId, { program, fetchedAt: Date.now() });
            return program;
        })
        .catch((error) => {
            const latest = detailCache.get(programId);
            if (latest?.promise === promise) detailCache.delete(programId);
            throw error;
        });

    detailCache.set(programId, {
        program: current?.program || listMatch,
        fetchedAt: current?.fetchedAt || mineCache?.fetchedAt || 0,
        promise,
    });
    return promise;
}

export function invalidateProgramCache(programId?: string) {
    if (programId) {
        detailCache.delete(programId);
        mineCache = mineCache
            ? { ...mineCache, programs: mineCache.programs.filter((program) => program.id !== programId), fetchedAt: 0 }
            : null;
        cacheVersion++;
        if (mineCache) saveToStorage(mineCache.programs, 0);
        notifyListeners();
        return;
    }
    mineCache = null;
    detailCache.clear();
    cacheVersion++;
    AsyncStorage.removeItem(PROGRAM_CACHE_STORAGE_KEY).catch(() => undefined);
    notifyListeners();
}

// Automatically invalidate program cache whenever a program write mutation succeeds
registerProgramMutationCallback(() => {
    invalidateProgramCache();
});
