import type { WarmupRoutineTemplate } from "../types/workout";

export type WarmupRoutineDraftDay = {
    label: string;
    isRestDay?: boolean;
    warmupRoutine?: WarmupRoutineTemplate;
};

export type WarmupRoutineDraft = {
    days: WarmupRoutineDraftDay[];
};

const warmupRoutineDrafts = new Map<string, WarmupRoutineDraft>();

export function setWarmupRoutineDraft(key: string, draft: WarmupRoutineDraft) {
    if (!key) return;
    warmupRoutineDrafts.set(key, draft);
}

export function consumeWarmupRoutineDraft(key: string): WarmupRoutineDraft | undefined {
    if (!key) return undefined;
    const draft = warmupRoutineDrafts.get(key);
    if (draft) {
        warmupRoutineDrafts.delete(key);
    }
    return draft;
}
