const marks = new Map<string, number>();
const enabled = typeof __DEV__ !== "undefined" && __DEV__;

export function markPerf(name: string) {
    if (!enabled) return;
    marks.set(name, Date.now());
}

export function logPerf(name: string, startName?: string) {
    if (!enabled) return;
    const start = startName ? marks.get(startName) : marks.get(name);
    if (!start) {
        console.log(`[perf] ${name}`);
        return;
    }
    console.log(`[perf] ${name}_ms`, Date.now() - start);
}

export async function measurePerf<T>(name: string, task: () => Promise<T>): Promise<T> {
    if (!enabled) return task();
    const start = Date.now();
    try {
        return await task();
    } finally {
        console.log(`[perf] ${name}_ms`, Date.now() - start);
    }
}
