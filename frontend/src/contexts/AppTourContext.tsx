import React from "react";
import { View } from "react-native";

export type AppTourTarget = {
    ref: React.RefObject<View | null>;
    scrollTo?: () => void;
    action?: () => void;
};

type AppTourTargetRegistration = {
    ref: React.RefObject<View | null>;
    getOptions: () => Omit<AppTourTarget, "ref">;
};

type AppTourContextValue = {
    registerTarget: (id: string, target: AppTourTargetRegistration) => () => void;
    getTarget: (id: string) => AppTourTarget | null;
};

const AppTourContext = React.createContext<AppTourContextValue | null>(null);

export function AppTourProvider({ children }: { children: React.ReactNode }) {
    const targetsRef = React.useRef(new Map<string, AppTourTargetRegistration>());

    const registerTarget = React.useCallback((id: string, target: AppTourTargetRegistration) => {
        targetsRef.current.set(id, target);
        return () => {
            const current = targetsRef.current.get(id);
            if (current === target) {
                targetsRef.current.delete(id);
            }
        };
    }, []);

    const getTarget = React.useCallback((id: string): AppTourTarget | null => {
        const target = targetsRef.current.get(id);
        if (!target) return null;
        return {
            ref: target.ref,
            ...target.getOptions(),
        };
    }, []);

    const value = React.useMemo(() => ({ registerTarget, getTarget }), [getTarget, registerTarget]);

    return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

export function useAppTour() {
    const context = React.useContext(AppTourContext);
    if (!context) {
        throw new Error("useAppTour must be used inside AppTourProvider");
    }
    return context;
}

export function useAppTourTarget(
    id: string,
    options: Omit<AppTourTarget, "ref"> = {},
) {
    const { registerTarget } = useAppTour();
    const ref = React.useRef<View>(null);
    const optionsRef = React.useRef(options);
    optionsRef.current = options;

    React.useEffect(() => {
        return registerTarget(id, {
            ref,
            getOptions: () => optionsRef.current,
        });
    }, [id, registerTarget]);

    return ref;
}
