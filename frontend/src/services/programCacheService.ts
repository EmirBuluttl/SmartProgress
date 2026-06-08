import { programApi } from "./api";

const PROGRAM_CACHE_TTL_MS = 5 * 60 * 1000;

type ProgramCacheEntry = {
    programs: any[];
    fetchedAt: number;
    promise?: Promise<any[]>;
};

let mineCache: ProgramCacheEntry | null = null;
const detailCache = new Map<string, { program: any; fetchedAt: number; promise?: Promise<any> }>();

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

export async function getCachedMyPrograms(options: { forceRefresh?: boolean } = {}) {
    if (!options.forceRefresh && mineCache?.programs && isFresh(mineCache.fetchedAt)) {
        return mineCache.programs;
    }
    if (!options.forceRefresh && mineCache?.promise) return mineCache.promise;

    const promise = programApi.listMine()
        .then((res) => {
            const programs = res.data.programs || [];
            mineCache = { programs, fetchedAt: Date.now() };
            for (const program of programs) {
                if (program?.id) detailCache.set(program.id, { program, fetchedAt: Date.now() });
            }
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
        return;
    }
    mineCache = null;
    detailCache.clear();
}
