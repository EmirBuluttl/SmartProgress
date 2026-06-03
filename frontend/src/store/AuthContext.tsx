// ─────────────────────────────────────────────
// SmartProgress — Auth Context (Context API)
// Token, user state, login/logout/register
// ─────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi, parseApiError, setLogoutCallback } from "../services/api";

// ─── Types ───────────────────────────────────

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    avatarUrl?: string | null;
    role: string;
    subscriptionTier?: "FREE" | "PRO" | "COACH_PLUS" | "free" | "pro" | "coach_plus";
    subscriptionStatus?: "ACTIVE" | "INACTIVE" | "TRIAL" | "active" | "inactive" | "trial";
    settings: {
        is_auto_suggest_enabled: boolean;
        remember_reps_enabled?: boolean;
        profile_visibility?: "public" | "private";
        training_level?: "beginner" | "intermediate" | "advanced";
        show_rpe_rir_info?: boolean;
        pre_workout_reminder_enabled?: boolean;
        pre_workout_reminder_note?: string;
        onboarding_completed?: boolean;
        onboarding_profile?: Record<string, any>;
        onboardingProfile?: Record<string, any>;
        coach_profile?: Record<string, any>;
        coachProfile?: Record<string, any>;
        pro_trial_started_at?: string;
        pro_trial_expires_at?: string;
        free_wizard_uses_remaining?: number;
        pro_wizard_uses_remaining?: number;
        coach_plus_beta?: boolean;
    } | null;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<void>;
    register: (data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
    }) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (partialUser: Record<string, any>) => Promise<void>;
}

// ─── Context ─────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isLoading: true,
        isAuthenticated: false,
    });

    // Register global 401 logout callback so Axios interceptor can reset context
    useEffect(() => {
        setLogoutCallback(() => {
            setState({
                user: null,
                token: null,
                isLoading: false,
                isAuthenticated: false,
            });
        });
    }, []);

    // Restore session from AsyncStorage on mount
    useEffect(() => {
        const restore = async () => {
            try {
                const token = await AsyncStorage.getItem("auth_token");
                const userJson = await AsyncStorage.getItem("user");
                if (token && userJson) {
                    setState({
                        user: JSON.parse(userJson),
                        token,
                        isLoading: false,
                        isAuthenticated: true,
                    });
                } else {
                    // No stored session → show LoginScreen
                    setState({
                        user: null,
                        token: null,
                        isLoading: false,
                        isAuthenticated: false,
                    });
                }
            } catch {
                setState((prev) => ({ ...prev, isLoading: false, isAuthenticated: false }));
            }
        };
        restore();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const response = await authApi.login({ email, password });
            const { token, user } = response.data;

            await AsyncStorage.setItem("auth_token", token);
            await AsyncStorage.setItem("user", JSON.stringify(user));

            setState({
                user,
                token,
                isLoading: false,
                isAuthenticated: true,
            });
        } catch (error) {
            const apiError = parseApiError(error);
            throw new Error(apiError.message);
        }
    }, []);

    const register = useCallback(
        async (data: {
            email: string;
            password: string;
            firstName: string;
            lastName: string;
        }) => {
            try {
                const response = await authApi.register(data);
                const { token, user } = response.data;

                await AsyncStorage.setItem("auth_token", token);
                await AsyncStorage.setItem("user", JSON.stringify(user));

                setState({
                    user,
                    token,
                    isLoading: false,
                    isAuthenticated: true,
                });
            } catch (error) {
                const apiError = parseApiError(error);
                throw new Error(apiError.message);
            }
        },
        [],
    );

    const logout = useCallback(async () => {
        await AsyncStorage.removeItem("auth_token");
        await AsyncStorage.removeItem("user");

        setState({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
        });
    }, []);

    const updateUser = useCallback(async (partialUser: Record<string, any>) => {
        setState((prev) => {
            if (!prev.user) return prev;
            const updatedUser = { ...prev.user, ...partialUser };
            // Update storage asynchronously
            AsyncStorage.setItem("user", JSON.stringify(updatedUser)).catch(console.error);
            return { ...prev, user: updatedUser };
        });
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

