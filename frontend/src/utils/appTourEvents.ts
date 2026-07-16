import AsyncStorage from "@react-native-async-storage/async-storage";

export const APP_TOUR_COMPLETED_KEY = "@smartprogress_app_tour_completed";
export const DETAILED_APP_TOUR_COMPLETED_KEY = "@smartprogress_detailed_app_tour_completed";

type Listener = () => void;
const listeners = new Set<Listener>();
const detailedListeners = new Set<Listener>();

export function subscribeAppTourRequest(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function subscribeDetailedAppTourRequest(listener: Listener) {
    detailedListeners.add(listener);
    return () => {
        detailedListeners.delete(listener);
    };
}

export async function requestAppTourReplay() {
    await AsyncStorage.removeItem(APP_TOUR_COMPLETED_KEY);
    listeners.forEach((listener) => listener());
}

export async function requestDetailedAppTourReplay() {
    await AsyncStorage.removeItem(DETAILED_APP_TOUR_COMPLETED_KEY);
    detailedListeners.forEach((listener) => listener());
}

export async function markAppTourCompleted() {
    await AsyncStorage.setItem(APP_TOUR_COMPLETED_KEY, "true");
}

export async function markDetailedAppTourCompleted() {
    await AsyncStorage.setItem(DETAILED_APP_TOUR_COMPLETED_KEY, "true");
}

export async function hasCompletedAppTour() {
    return (await AsyncStorage.getItem(APP_TOUR_COMPLETED_KEY)) === "true";
}

export async function hasCompletedDetailedAppTour() {
    return (await AsyncStorage.getItem(DETAILED_APP_TOUR_COMPLETED_KEY)) === "true";
}
