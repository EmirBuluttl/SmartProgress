// ─────────────────────────────────────────────
// SmartProgress — Sync Service (Client-Side Outbox Pattern)
// Offline-first: pending workout queue + auto-sync
// ─────────────────────────────────────────────
import AsyncStorage from "@react-native-async-storage/async-storage";
import { workoutApi } from "./api";
import { isOnline } from "./networkService";
import {
    PendingWorkout,
    WorkoutSession,
    SyncWorkoutPayload,
    STORAGE_KEYS,
} from "../types/workout";
import { calculateLoadScoreFromExercises, clampRpe, normalizeRirLogValue } from "../utils/workoutMetrics";

// ─── Helpers ─────────────────────────────────

function generateId(): string {
    // Simple UUID v4 without external dependency
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Convert a completed WorkoutSession into the API payload format.
 */
function sessionToPayload(session: WorkoutSession): SyncWorkoutPayload {
    // Load score: working sets count as 1, or RPE/10 when RPE is logged.
    const totalVolume = calculateLoadScoreFromExercises(session.exercises);

    return {
        sportId: session.sportId,
        title: session.title,
        notes: session.notes?.trim() || undefined,
        data: {
            exercises: session.exercises.map((ex) => ({
                name: ex.name,
                sets: ex.sets
                    .filter((s) => s.weight > 0 || s.reps > 0 || (s.durationSeconds ?? 0) > 0)
                    .map((s) => ({
                        reps: s.reps,
                        weight: s.weight,
                        weightMode: s.weightMode ?? "kg",
                        bodyWeight: s.bodyWeight,
                        externalWeight: s.externalWeight,
                        effortMode: s.effortMode ?? "reps",
                        durationSeconds: s.durationSeconds ?? 0,
                        unit: s.unit,
                        rpe: s.rpe !== undefined && s.rpe !== "" ? clampRpe(s.rpe) : undefined,
                        rir: normalizeRirLogValue((s as any).rir, s.reps),
                        targetReps: s.targetReps,
                        analysisExcluded: s.analysisExcluded === true ? true : undefined,
                        analysisWarning: s.analysisWarning,
                        isWarmup: s.isWarmup ?? false,
                    })),
            })).filter((ex) => ex.sets.length > 0),
            totalDuration: session.totalDuration,
            totalVolume,
            cardioBlocks: session.cardioBlocks ?? [],
            programId: session.programId,
            dayIndex: session.dayIndex,
        },
        logDate: session.completedAt || new Date().toISOString(),
    };
}

// ─── Pending Queue Management ────────────────

/**
 * Get all pending (unsynchronized) workouts from AsyncStorage.
 */
export async function getPendingWorkouts(): Promise<PendingWorkout[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_WORKOUTS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Save the pending workouts array back to AsyncStorage.
 */
async function savePendingWorkouts(workouts: PendingWorkout[]): Promise<void> {
    await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_WORKOUTS,
        JSON.stringify(workouts),
    );
}

/**
 * Clear all pending workouts (for debugging / stuck queue recovery).
 */
export async function clearAllPendingWorkouts(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_WORKOUTS);
    console.log("[SyncService] Tüm bekleyen antrenmanlar temizlendi");
}

/**
 * Reset failed workouts back to "pending" so they can be retried.
 */
export async function resetFailedWorkouts(): Promise<number> {
    const pending = await getPendingWorkouts();
    let resetCount = 0;
    const updated = pending.map((w) => {
        if (w.syncStatus === "failed") {
            resetCount++;
            return { ...w, syncStatus: "pending" as const, failCount: 0 };
        }
        return w;
    });
    await savePendingWorkouts(updated);
    console.log("[SyncService]", resetCount, "başarısız antrenman sıfırlandı");
    return resetCount;
}

/**
 * Add a completed workout session to the pending queue.
 */
export async function savePendingWorkout(session: WorkoutSession): Promise<PendingWorkout> {
    console.log("[SyncService] Yerel depolama başlatıldı — key:", STORAGE_KEYS.PENDING_WORKOUTS);

    const pending: PendingWorkout = {
        id: generateId(),
        session,
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        failCount: 0,
    };

    const existing = await getPendingWorkouts();
    existing.push(pending);
    await savePendingWorkouts(existing);

    console.log(
        "[SyncService] Senkronizasyon kuyruğuna eklendi — id:",
        pending.id,
        "exercises:",
        session.exercises.length,
        "sets:",
        session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    );
    console.log("[SyncService] Kuyruk boyutu:", existing.length);

    return pending;
}

/**
 * Remove a specific workout from the pending queue (after successful sync).
 */
export async function removeSyncedWorkout(id: string): Promise<void> {
    const existing = await getPendingWorkouts();
    const filtered = existing.filter((w) => w.id !== id);
    await savePendingWorkouts(filtered);
}

/**
 * Update the sync status of a specific pending workout.
 */
async function updatePendingStatus(
    id: string,
    status: PendingWorkout["syncStatus"],
): Promise<void> {
    const existing = await getPendingWorkouts();
    const updated = existing.map((w) =>
        w.id === id
            ? {
                ...w,
                syncStatus: status,
                lastSyncAttempt: new Date().toISOString(),
                failCount: status === "failed" ? w.failCount + 1 : w.failCount,
            }
            : w,
    );
    await savePendingWorkouts(updated);
}

// ─── Sync Result Type ────────────────────────

export interface SyncResult {
    synced: number;
    failed: number;
    pending: number;
    permanentlyFailed: number;
    errors: string[];
    offline: boolean;
}

// ─── Sync Engine ─────────────────────────────

const MAX_FAIL_COUNT = 5;

/**
 * Attempt to sync all pending workouts to the backend.
 * Returns a detailed result with success/failure counts and error messages.
 */
export async function syncPendingWorkouts(): Promise<SyncResult> {
    const result: SyncResult = {
        synced: 0,
        failed: 0,
        pending: 0,
        permanentlyFailed: 0,
        errors: [],
        offline: false,
    };

    const online = await isOnline();
    if (!online) {
        console.log("[SyncService] Çevrimdışı — senkronizasyon atlandı");
        result.offline = true;
        const pending = await getPendingWorkouts();
        result.pending = pending.length;
        return result;
    }

    const pending = await getPendingWorkouts();
    const toSync = pending.filter(
        (w) => (w.syncStatus === "pending" || w.syncStatus === "failed") && w.failCount < MAX_FAIL_COUNT,
    );

    const permanentlyFailed = pending.filter((w) => w.failCount >= MAX_FAIL_COUNT);
    result.permanentlyFailed = permanentlyFailed.length;
    if (permanentlyFailed.length > 0) {
        console.warn(`[SyncService] ${permanentlyFailed.length} antrenman ${MAX_FAIL_COUNT} denemeden sonra başarısız oldu, atlanıyor`);
    }

    if (toSync.length === 0) {
        console.log("[SyncService] Senkron edilecek antrenman yok");
        result.pending = pending.filter((w) => w.syncStatus === "pending").length;
        return result;
    }

    console.log("[SyncService] Senkronizasyon başlatıldı —", toSync.length, "antrenman bekliyor");

    // Sync one by one to handle partial failures gracefully
    for (const workout of toSync) {
        try {
            await updatePendingStatus(workout.id, "syncing");

            const payload = sessionToPayload(workout.session);
            console.log("[SyncService] Payload hazırlandı:", JSON.stringify(payload, null, 2));
            await workoutApi.sync([payload]);

            await removeSyncedWorkout(workout.id);
            result.synced++;
            console.log("[SyncService] ✅ Senkron edildi:", workout.id);
        } catch (error: any) {
            const respData = error?.response?.data;
            const status = error?.response?.status;
            const errMsg = respData?.error || error?.message || "Bilinmeyen hata";

            console.error("[SyncService] ❌ Senkron hatası:", workout.id, "Status:", status);
            console.error("[SyncService] ❌ Backend yanıtı:", JSON.stringify(respData, null, 2));
            console.error("[SyncService] ❌ Hata mesajı:", error?.message);

            result.failed++;
            result.errors.push(`[${status || "NET"}] ${errMsg}`);
            await updatePendingStatus(workout.id, "failed");
        }
    }

    // Recalculate pending count
    const updatedPending = await getPendingWorkouts();
    result.pending = updatedPending.filter((w) => w.syncStatus === "pending" || w.syncStatus === "failed").length;

    console.log("[SyncService] Senkronizasyon tamamlandı —", result.synced, "/", toSync.length, "başarılı");
    return result;
}

/**
 * Get the count of pending workouts without triggering a sync.
 */
export async function getPendingWorkoutCount(): Promise<{ pending: number; failed: number; permanent: number }> {
    const all = await getPendingWorkouts();
    return {
        pending: all.filter((w) => w.syncStatus === "pending" || w.syncStatus === "syncing").length,
        failed: all.filter((w) => w.syncStatus === "failed" && w.failCount < MAX_FAIL_COUNT).length,
        permanent: all.filter((w) => w.failCount >= MAX_FAIL_COUNT).length,
    };
}


// ─── Active Session Persistence ──────────────

function normalizeActiveSession(rawSession: any): WorkoutSession | null {
    if (!rawSession || typeof rawSession !== "object") return null;
    if (!rawSession.id || !rawSession.startedAt || rawSession.status !== "active") return null;
    if (rawSession.completedAt) return null;

    return {
        ...rawSession,
        title: typeof rawSession.title === "string" ? rawSession.title : "",
        sportId: rawSession.sportId || "00000000-0000-0000-0000-000000000001",
        exercises: Array.isArray(rawSession.exercises) ? rawSession.exercises : [],
        cardioBlocks: Array.isArray(rawSession.cardioBlocks) ? rawSession.cardioBlocks : [],
        activeCardioBlockId: typeof rawSession.activeCardioBlockId === "string" ? rawSession.activeCardioBlockId : undefined,
        activeCardioStage: rawSession.activeCardioStage && typeof rawSession.activeCardioStage === "object"
            ? rawSession.activeCardioStage
            : undefined,
        totalDuration: Number.isFinite(Number(rawSession.totalDuration))
            ? Math.max(0, Number(rawSession.totalDuration))
            : 0,
        status: "active",
    };
}

/**
 * Save the active workout session to AsyncStorage (crash protection).
 */
export async function saveActiveSession(session: WorkoutSession): Promise<void> {
    const normalized = normalizeActiveSession(session);
    if (!normalized) {
        console.warn("[SyncService] Invalid active session skipped");
        return;
    }
    await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_SESSION,
        JSON.stringify(normalized),
    );
}

/**
 * Restore a previously saved active session (after app restart).
 */
export async function restoreActiveSession(): Promise<WorkoutSession | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
        return raw ? normalizeActiveSession(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

/**
 * Clear the active session from AsyncStorage (after completion).
 */
export async function clearActiveSession(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
}
