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
    // Hacim: Σ (weight × reps) sadece dolu setler üzerinden
    const totalVolume = session.exercises.reduce((total, ex) => (
        total + ex.sets.reduce((s, set) => s + (set.weight * set.reps), 0)
    ), 0);

    return {
        sportId: session.sportId,
        title: session.title,
        data: {
            exercises: session.exercises.map((ex) => ({
                name: ex.name,
                sets: ex.sets
                    .filter((s) => s.weight > 0 || s.reps > 0)
                    .map((s) => ({
                        reps: s.reps,
                        weight: s.weight,
                        unit: s.unit,
                        rpe: s.rpe ?? undefined,
                        rir: (s as any).rir ?? undefined,
                        isWarmup: s.isWarmup ?? false,
                    })),
            })).filter((ex) => ex.sets.length > 0),
            totalDuration: session.totalDuration,
            totalVolume: Math.round(totalVolume),
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

// ─── Sync Engine ─────────────────────────────

/**
 * Attempt to sync all pending workouts to the backend.
 * Returns the number of successfully synced workouts.
 */
export async function syncPendingWorkouts(): Promise<number> {
    const online = await isOnline();
    if (!online) {
        console.log("[SyncService] Çevrimdışı — senkronizasyon atlandı");
        return 0;
    }

    const MAX_FAIL_COUNT = 5;

    const pending = await getPendingWorkouts();
    const toSync = pending.filter(
        (w) => (w.syncStatus === "pending" || w.syncStatus === "failed") && w.failCount < MAX_FAIL_COUNT,
    );

    // Log permanently failed workouts
    const permanentlyFailed = pending.filter((w) => w.failCount >= MAX_FAIL_COUNT);
    if (permanentlyFailed.length > 0) {
        console.warn(`[SyncService] ${permanentlyFailed.length} antrenman ${MAX_FAIL_COUNT} denemeden sonra başarısız oldu, atlanıyor`);
    }

    if (toSync.length === 0) {
        console.log("[SyncService] Senkron edilecek antrenman yok");
        return 0;
    }

    console.log("[SyncService] Senkronizasyon başlatıldı —", toSync.length, "antrenman bekliyor");
    let syncedCount = 0;

    // Sync one by one to handle partial failures gracefully
    for (const workout of toSync) {
        try {
            await updatePendingStatus(workout.id, "syncing");

            const payload = sessionToPayload(workout.session);
            console.log("[SyncService] Payload hazırlandı:", JSON.stringify(payload, null, 2));
            await workoutApi.sync([payload]);

            await removeSyncedWorkout(workout.id);
            syncedCount++;
            console.log("[SyncService] ✅ Senkron edildi:", workout.id);
        } catch (error: any) {
            const respData = error?.response?.data;
            const status = error?.response?.status;
            console.error("[SyncService] ❌ Senkron hatası:", workout.id, "Status:", status);
            console.error("[SyncService] ❌ Backend yanıtı:", JSON.stringify(respData, null, 2));
            console.error("[SyncService] ❌ Hata mesajı:", error?.message);
            await updatePendingStatus(workout.id, "failed");
        }
    }

    console.log("[SyncService] Senkronizasyon tamamlandı —", syncedCount, "/", toSync.length, "başarılı");
    return syncedCount;
}

// ─── Active Session Persistence ──────────────

/**
 * Save the active workout session to AsyncStorage (crash protection).
 */
export async function saveActiveSession(session: WorkoutSession): Promise<void> {
    await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_SESSION,
        JSON.stringify(session),
    );
}

/**
 * Restore a previously saved active session (after app restart).
 */
export async function restoreActiveSession(): Promise<WorkoutSession | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
        return raw ? JSON.parse(raw) : null;
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
