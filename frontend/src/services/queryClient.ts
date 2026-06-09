// ─────────────────────────────────────────────
// SmartProgress — TanStack Query Client
// Synchronous persistence layer using react-native-mmkv
// ─────────────────────────────────────────────
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createMMKV } from "react-native-mmkv";
import { Platform } from "react-native";
import { registerProgramMutationCallback } from "./api";

// 1. Storage Interface (MMKV for native, localStorage for web)
interface SyncStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
}

let clientStorage: SyncStorage;

if (Platform.OS === "web") {
    clientStorage = {
        getItem: (key: string) => {
            try {
                return window.localStorage.getItem(key);
            } catch {
                return null;
            }
        },
        setItem: (key: string, value: string) => {
            try {
                window.localStorage.setItem(key, value);
            } catch {}
        },
        removeItem: (key: string) => {
            try {
                window.localStorage.removeItem(key);
            } catch {}
        },
    };
} else {
    const mmkv = createMMKV({ id: "smartprogress-query-cache" });
    clientStorage = {
        getItem: (key: string) => {
            return mmkv.getString(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            mmkv.set(key, value);
        },
        removeItem: (key: string) => {
            mmkv.remove(key);
        },
    };
}

// 2. Query Client Initialization
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection
            staleTime: 1000 * 60 * 5,    // 5 minutes stale time (matching existing TTL)
            refetchOnWindowFocus: true,
            retry: 2,
        },
    },
});

// 3. Sync Storage Persister
const persister = createSyncStoragePersister({
    storage: clientStorage,
    key: "REACT_QUERY_OFFLINE_CACHE",
});

persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24, // Keep persistent cache valid for 24 hours
});

// 4. Invalidate programs cache automatically on mutations
registerProgramMutationCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["programs"] });
});
