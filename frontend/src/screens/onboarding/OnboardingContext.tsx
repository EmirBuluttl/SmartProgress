// ─────────────────────────────────────────────
// OnboardingContext — Onboarding boyunca toplanan veriler
// ─────────────────────────────────────────────
import React, { createContext, useContext, useState, ReactNode } from "react";

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

interface OnboardingContextType {
    data: OnboardingData;
    update: (partial: Partial<OnboardingData>) => void;
    reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<OnboardingData>(defaultData);

    const update = (partial: Partial<OnboardingData>) => {
        setData((prev) => ({ ...prev, ...partial }));
    };

    const reset = () => setData(defaultData);

    return (
        <OnboardingContext.Provider value={{ data, update, reset }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
    return ctx;
}
