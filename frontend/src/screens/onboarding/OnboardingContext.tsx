// ─────────────────────────────────────────────
// OnboardingContext — Onboarding boyunca toplanan veriler
// ─────────────────────────────────────────────
import React, { createContext, useContext, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutGoal =
    | "muscle"
    | "strength"
    | "fat_loss"
    | "fitness"
    | "performance";

export interface OnboardingData {
    // Fiziksel bilgiler
    age: number;
    height: number;
    heightUnit: "cm" | "ft";
    weight: number;
    weightUnit: "kg" | "lbs";
    // Spor türleri
    sports: string[];
    // Deneyim
    experienceLevel: ExperienceLevel | null;
    guidanceEnabled: boolean;
    // Hedefler
    workoutGoal: WorkoutGoal | null;
    weeklyFrequency: number;
}

const defaultData: OnboardingData = {
    age: 25,
    height: 175,
    heightUnit: "cm",
    weight: 75,
    weightUnit: "kg",
    sports: [],
    experienceLevel: null,
    guidanceEnabled: true,
    workoutGoal: null,
    weeklyFrequency: 4,
};

const ONBOARDING_DRAFT_KEY = "onboarding_draft_v1";

interface OnboardingContextType {
    data: OnboardingData;
    step: number;
    hydrated: boolean;
    update: (partial: Partial<OnboardingData>) => void;
    setStep: (step: number) => void;
    reset: () => void;
    clearDraft: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<OnboardingData>(defaultData);
    const [step, setStepState] = useState(1);
    const [hydrated, setHydrated] = useState(false);

    React.useEffect(() => {
        let mounted = true;
        AsyncStorage.getItem(ONBOARDING_DRAFT_KEY)
            .then((raw) => {
                if (!mounted || !raw) return;
                const parsed = JSON.parse(raw);
                if (parsed?.data) setData({ ...defaultData, ...parsed.data });
                if (Number(parsed?.step) > 0) setStepState(Math.min(6, Math.max(1, Number(parsed.step))));
            })
            .catch((error) => console.warn("[Onboarding] Draft load failed:", error))
            .finally(() => {
                if (mounted) setHydrated(true);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const persistDraft = React.useCallback((nextData: OnboardingData, nextStep = step) => {
        AsyncStorage.setItem(
            ONBOARDING_DRAFT_KEY,
            JSON.stringify({ data: nextData, step: nextStep, updatedAt: new Date().toISOString() }),
        ).catch((error) => console.warn("[Onboarding] Draft save failed:", error));
    }, [step]);

    const update = (partial: Partial<OnboardingData>) => {
        setData((prev) => {
            const next = { ...prev, ...partial };
            persistDraft(next);
            return next;
        });
    };

    const setStep = (nextStep: number) => {
        const safeStep = Math.min(6, Math.max(1, nextStep));
        setStepState(safeStep);
        persistDraft(data, safeStep);
    };

    const clearDraft = async () => {
        await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
    };

    const reset = () => {
        setData(defaultData);
        setStepState(1);
        AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY).catch(() => undefined);
    };

    return (
        <OnboardingContext.Provider value={{ data, step, hydrated, update, setStep, reset, clearDraft }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
    return ctx;
}
