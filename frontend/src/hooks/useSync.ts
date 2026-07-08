import { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import { recoverFinishingWorkoutIfNeeded, syncPendingWorkouts } from "../services/syncService";
import { onConnectivityChange } from "../services/networkService";
import { useAuth } from "../store/AuthContext";

export function useSync(): void {
    const isSyncing = useRef(false);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { isAuthenticated } = useAuth();

    const attemptSync = async () => {
        if (!isAuthenticated || isSyncing.current) return;
        isSyncing.current = true;
        try {
            await recoverFinishingWorkoutIfNeeded();
            await syncPendingWorkouts();
        } catch (error) {
            console.warn("[useSync] Background sync failed:", error);
        } finally {
            isSyncing.current = false;
        }
    };

    const scheduleSync = (delay = 7000) => {
        if (!isAuthenticated) return;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
                attemptSync();
            });
        }, delay);
    };

    useEffect(() => {
        scheduleSync(7000);
        const unsubscribe = onConnectivityChange((online) => {
            if (online && isAuthenticated) scheduleSync(5000);
        });

        return () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            unsubscribe();
        };
    }, [isAuthenticated]);
}
