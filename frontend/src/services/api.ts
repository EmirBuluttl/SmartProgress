// ─────────────────────────────────────────────
// SmartProgress — API Service
// Backend endpoint'lerine istek atacak yapı
// ─────────────────────────────────────────────
import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SyncWorkoutPayload } from "../types/workout";

function getDefaultApiUrl(): string {
    if (typeof window !== "undefined" && window.location?.hostname) {
        return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return "http://3.79.148.219:3000";
}

const RAW_API_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.API_URL ||
    getDefaultApiUrl();

const API_BASE_URL = `${RAW_API_URL.replace(/\/+$/, "")}/api/v1`;

// ─── Error Types ─────────────────────────────

export interface ApiError {
    message: string;
    statusCode: number;
    details?: unknown;
}

export function parseApiError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError<{ error?: string; message?: string; details?: unknown }>;

        // Network error (offline, timeout, DNS failure)
        if (!axiosErr.response) {
            return {
                message: "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.",
                statusCode: 0,
            };
        }

        const data = axiosErr.response.data;
        return {
            message: data?.error || data?.message || "Bilinmeyen bir hata oluştu.",
            statusCode: axiosErr.response.status,
            details: data?.details,
        };
    }

    return {
        message: error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.",
        statusCode: -1,
    };
}

// ─── Global Logout Callback ──────────────
// AuthContext registers this so the 401 interceptor can fully reset app state.

let _logoutCallback: (() => void) | null = null;
export function setLogoutCallback(cb: () => void) {
    _logoutCallback = cb;
}

// ─── Axios Instance ──────────────────────────

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json",
    },
});

// ─── Request Interceptor (JWT Token) ─────────

api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem("auth_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ─── Response Interceptor (Error Handling) ───

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expired or user deleted — clear storage and reset app state
            await AsyncStorage.removeItem("auth_token");
            await AsyncStorage.removeItem("user");
            _logoutCallback?.();
        }
        return Promise.reject(error);
    },
);

// ─── Auth Endpoints ──────────────────────────

export const authApi = {
    register: (data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
    }) => api.post("/auth/register", data),

    login: (data: { email: string; password: string }) =>
        api.post("/auth/login", data),

    getProfile: () => api.get("/auth/me"),

    updateProfile: (data: {
        firstName?: string;
        lastName?: string;
        nickname?: string;
        avatarUrl?: string | null;
        settings?: Record<string, any>;
    }) => api.patch("/auth/me", data),
};

// ─── Workout Endpoints ───────────────────────

export const workoutApi = {
    sync: (workouts: SyncWorkoutPayload[]) =>
        api.post("/workouts/sync", { workouts }),

    list: (params?: { limit?: number; offset?: number }) =>
        api.get("/workouts", { params }),

    delete: (id: string) => api.delete(`/workouts/${id}`),
};

// ─── Program Endpoints ───────────────────────

export const programApi = {
    create: (data: { name: string; description?: string; isPublic?: boolean; frequency?: number; data?: any }) =>
        api.post("/programs", data),

    getById: (id: string) => api.get(`/programs/${id}`),

    listMine: () => api.get("/programs/mine"),

    listPublic: (params?: { limit?: number; offset?: number }) =>
        api.get("/programs/public", { params }),

    toggleVisibility: (id: string) =>
        api.patch(`/programs/${id}/visibility`),

    suggestWeight: (exerciseName: string) =>
        api.get(`/programs/suggest/${encodeURIComponent(exerciseName)}`),

    /** Advance currentDayIndex by 1 (for cycle-based programs) */
    advanceDay: (id: string) =>
        api.patch(`/programs/${id}/advance-day`),

    /** Delete a program by ID */
    deleteProgram: (id: string) => api.delete(`/programs/${id}`),

    /** Update a program */
    update: (id: string, data: { name?: string; description?: string; isPublic?: boolean; frequency?: number; data?: any }) =>
        api.put(`/programs/${id}`, data),
};

export default api;

